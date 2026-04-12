import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { resolve } from 'path'
import { InventoryDatabase } from './database'
import { CostSettlementHandler } from './cost-settlement-handler'
import { MonthlyCostSettlementService } from './cost-settlement-service'
// import { ScheduledTaskService } from './scheduled-task-service'
import { DatabaseBackup } from './database-backup'
import { BackupScheduler } from './backup-scheduler'

let mainWindow: BrowserWindow | null = null
let db: InventoryDatabase
let costHandler: CostSettlementHandler
let costSettlementService: MonthlyCostSettlementService | null = null
// let scheduledTaskService: ScheduledTaskService
let databaseBackup: DatabaseBackup
let backupScheduler: BackupScheduler

function createWindow() {
  console.log('创建窗口，preload 路径:', resolve(__dirname, 'preload.js'))
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: resolve(__dirname, 'preload.js')
    },
    icon: resolve(__dirname, '../assets/icon.png'),
    title: '进销存管理系统'
  })

  // 开发环境加载 Vite 服务器，生产环境加载构建文件
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  console.log('是否开发环境:', isDev)
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(resolve(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 设置中文菜单
  const template: any = [
    {
      label: '文件',
      submenu: [
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '刷新', role: 'reload' },
        { label: '全屏', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: '开发者工具', role: 'toggleDevTools' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '关闭', role: 'close' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            const { dialog } = require('electron')
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于进销存管理系统',
              message: '进销存管理系统',
              detail: '版本：1.0.0\n\n一个完整的进销存管理系统，支持采购、销售、库存管理等功能。'
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// 初始化数据库
function initDatabase() {
  const dbPath = resolve(app.getPath('userData'), 'inventory.db')
  db = new InventoryDatabase(dbPath)
  db.initialize()

  // 初始化数据库备份服务
  databaseBackup = new DatabaseBackup(dbPath)

  // 启动时自动备份数据库
  const backupPath = databaseBackup.autoBackup()

  // 清理旧备份（保留最近 10 个）
  databaseBackup.cleanupOldBackups(10)

  // 启动定时备份调度器（首次启动时执行一次备份）
  backupScheduler = new BackupScheduler(databaseBackup)
  backupScheduler.start(true) // true 表示首次启动，立即执行一次备份
  
  // 初始化成本结算处理器
  if (db.costDb && db.db) {
    costHandler = new CostSettlementHandler(db.costDb, mainWindow!)
    costHandler.registerHandlers()

    // 初始化成本计算服务
    costSettlementService = new MonthlyCostSettlementService(db.costDb, db.db)
  }
  
  // 定时任务服务已禁用
  // scheduledTaskService = new ScheduledTaskService(db.costDb, mainWindow!, db.db!)
  // scheduledTaskService.start()
}

// IPC 处理器
function setupIpcHandlers() {
  // 数据库操作
  ipcMain.handle('db-init', async () => {
    return db.initialize()
  })

  ipcMain.handle('db-query', async (event, tableOrSql: string, sqlOrParams?: string | any[], params?: any[]) => {
    try {
      let sql: string
      let sqlParams: any[]
      
      // 支持两种调用方式：
      // 1. dbQuery(sql, params) - 旧方式
      // 2. dbQuery(table, sql, params) - 新方式（为了兼容性）
      if (typeof sqlOrParams === 'string') {
        // 新方式：dbQuery(table, sql, params)
        sql = sqlOrParams
        sqlParams = params || []
      } else {
        // 旧方式：dbQuery(sql, params)
        sql = tableOrSql
        sqlParams = sqlOrParams || []
      }
      
      const result = db.query(sql, sqlParams)
      return result
    } catch (error: any) {
      console.error('数据库查询错误:', error.message, 'SQL:', tableOrSql, '参数:', sqlOrParams, params)
      throw error
    }
  })

  ipcMain.handle('db-insert', async (event, table: string, data: any) => {
    try {
      return db.insert(table, data)
    } catch (error: any) {
      throw error
    }
  })

  ipcMain.handle('db-update', async (event, table: string, data: any, where: string, whereParams: any[]) => {
    try {
      return db.update(table, data, where, whereParams)
    } catch (error: any) {
      throw error
    }
  })

  ipcMain.handle('db-delete', async (event, table: string, where: string, whereParams: any[]) => {
    try {
      return db.delete(table, where, whereParams)
    } catch (error: any) {
      throw error
    }
  })

  ipcMain.handle('db-transaction', async (event, operations: any[]) => {
    try {
      const transaction = db.db!.transaction((ops: any[]) => {
        for (const op of ops) {
          op()
        }
      })
      await transaction(operations)
      return { success: true }
    } catch (error: any) {
      throw error
    }
  })

  // 业务逻辑
  // 产品管理
  ipcMain.handle('product-list', async (event, page = 1, pageSize = 10) => {
    return db.getProductList(page, pageSize)
  })

  ipcMain.handle('product-add', async (event, product: any) => {
    return db.addProduct(product)
  })

  ipcMain.handle('product-update', async (event, product: any) => {
    return db.updateProduct(product)
  })

  ipcMain.handle('product-delete', async (event, id: number) => {
    return db.deleteProduct(id)
  })

  // 获取所有产品（不分页）
  ipcMain.handle('db:products-list', async () => {
    return db.getAllProducts()
  })

  // 仓库管理
  ipcMain.handle('warehouse-list', async (event) => {
    return db.getAllWarehouses()
  })

  ipcMain.handle('warehouse-add', async (event, warehouse: any) => {
    return db.addWarehouse(warehouse)
  })

  ipcMain.handle('warehouse-update', async (event, warehouse: any) => {
    return db.updateWarehouse(warehouse)
  })

  ipcMain.handle('warehouse-delete', async (event, id: number) => {
    return db.deleteWarehouse(id)
  })

  // 获取所有仓库（不分页）
  ipcMain.handle('db:warehouses-list', async () => {
    return db.getAllWarehouses()
  })

  // 供应商管理
  ipcMain.handle('supplier-list', async (event) => {
    return db.getAllSuppliers()
  })

  ipcMain.handle('supplier-add', async (event, supplier: any) => {
    return db.addSupplier(supplier)
  })

  ipcMain.handle('supplier-update', async (event, supplier: any) => {
    return db.updateSupplier(supplier)
  })

  ipcMain.handle('supplier-delete', async (event, id: number) => {
    return db.deleteSupplier(id)
  })

  // 客户管理
  ipcMain.handle('customer-list', async (event) => {
    return db.getAllCustomers()
  })

  ipcMain.handle('customer-add', async (event, customer: any) => {
    return db.addCustomer(customer)
  })

  ipcMain.handle('customer-update', async (event, customer: any) => {
    return db.updateCustomer(customer)
  })

  ipcMain.handle('customer-delete', async (event, id: number) => {
    return db.deleteCustomer(id)
  })

  // 采购入库
  ipcMain.handle('inbound-list', async (event, page = 1, pageSize = 10, where?: string, params?: any[]) => {
    return db.getInboundList(page, pageSize, where, params)
  })

  ipcMain.handle('inbound-add', async (event, inbound: any) => {
    // 检查新增单据月份是否已结算
    const inboundDate = new Date(inbound.inbound_date)
    const year = inboundDate.getFullYear()
    const month = inboundDate.getMonth() + 1

    if (db.costDb && db.costDb.isSettled(year, month)) {
      throw new Error(`无法添加单据！${year}年${month}月已进行成本结算，请先反结算后再操作`)
    }

    return db.addInbound(inbound)
  })

  ipcMain.handle('inbound-update', async (event, inbound: any) => {
    // 检查更新单据月份是否已结算
    if (inbound.id) {
      const inboundRecord = db.getInboundById(inbound.id)
      if (inboundRecord && db.costDb) {
        const inboundDate = new Date(inboundRecord.inbound_date)
        const year = inboundDate.getFullYear()
        const month = inboundDate.getMonth() + 1

        if (db.costDb.isSettled(year, month)) {
          throw new Error(`无法修改单据！${year}年${month}月已进行成本结算，请先反结算后再操作`)
        }
      }
    }

    return db.updateInbound(inbound)
  })

  // 开票记录相关 IPC
  ipcMain.handle('invoice-get-record', async (event, inboundNo: string) => {
    return db.getInvoiceRecord(inboundNo)
  })

  ipcMain.handle('invoice-save-record', async (event, recordData: any) => {
    return db.saveInvoiceRecord(recordData)
  })

  ipcMain.handle('inbound-delete', async (event, id: number) => {
    // 检查删除单据月份是否已结算
    const inboundRecord = db.getInboundById(id)
    if (inboundRecord && db.costDb) {
      const inboundDate = new Date(inboundRecord.inbound_date)
      const year = inboundDate.getFullYear()
      const month = inboundDate.getMonth() + 1

      if (db.costDb.isSettled(year, month)) {
        throw new Error(`无法删除单据！${year}年${month}月已进行成本结算，请先反结算后再操作`)
      }
    }

    return db.deleteInbound(id)
  })

  ipcMain.handle('inbound-by-id', async (event, id: number) => {
    return db.getInboundById(id)
  })

  // 销售出库
  ipcMain.handle('outbound-list', async (event, page = 1, pageSize = 10, where?: string, params?: any[]) => {
    return db.getOutboundList(page, pageSize, where, params)
  })

  ipcMain.handle('outbound-add', async (event, outbound: any) => {
    // 检查新增单据月份是否已结算
    const outboundDate = new Date(outbound.outbound_date)
    const year = outboundDate.getFullYear()
    const month = outboundDate.getMonth() + 1

    if (db.costDb && db.costDb.isSettled(year, month)) {
      throw new Error(`无法添加单据！${year}年${month}月已进行成本结算，请先反结算后再操作`)
    }

    return db.addOutbound(outbound)
  })

  ipcMain.handle('outbound-update', async (event, outbound: any) => {
    // 检查更新单据月份是否已结算
    if (outbound.id) {
      const outboundRecord = db.getOutboundById(outbound.id)
      if (outboundRecord && db.costDb) {
        const outboundDate = new Date(outboundRecord.outbound_date)
        const year = outboundDate.getFullYear()
        const month = outboundDate.getMonth() + 1

        if (db.costDb.isSettled(year, month)) {
          throw new Error(`无法修改单据！${year}年${month}月已进行成本结算，请先反结算后再操作`)
        }
      }
    }

    return db.updateOutbound(outbound)
  })

  ipcMain.handle('outbound-delete', async (event, id: number) => {
    // 检查删除单据月份是否已结算
    const outboundRecord = db.getOutboundById(id)
    if (outboundRecord && db.costDb) {
      const outboundDate = new Date(outboundRecord.outbound_date)
      const year = outboundDate.getFullYear()
      const month = outboundDate.getMonth() + 1

      if (db.costDb.isSettled(year, month)) {
        throw new Error(`无法删除单据！${year}年${month}月已进行成本结算，请先反结算后再操作`)
      }
    }

    return db.deleteOutbound(id)
  })

  ipcMain.handle('outbound-by-id', async (event, id: number) => {
    return db.getOutboundById(id)
  })

  // 采购退货
  ipcMain.handle('purchase-return-add', async (event, returnData: any) => {
    // 检查新增单据月份是否已结算
    const returnDate = new Date(returnData.return_date)
    const year = returnDate.getFullYear()
    const month = returnDate.getMonth() + 1

    if (db.costDb && db.costDb.isSettled(year, month)) {
      throw new Error(`无法添加退货单！${year}年${month}月已进行成本结算，请先反结算后再操作`)
    }

    return db.addPurchaseReturn(returnData)
  })

  ipcMain.handle('purchase-return-list', async (event, page = 1, pageSize = 10) => {
    return db.getPurchaseReturns(page, pageSize)
  })

  ipcMain.handle('purchase-return-update', async (event, returnData: any) => {
    // 检查更新单据月份是否已结算
    if (returnData.id && db.costDb) {
      const returnRecord = db.getPurchaseReturnById(returnData.id)
      if (returnRecord) {
        const returnDate = new Date(returnRecord.return_date)
        const year = returnDate.getFullYear()
        const month = returnDate.getMonth() + 1

        if (db.costDb.isSettled(year, month)) {
          throw new Error(`无法修改退货单！${year}年${month}月已进行成本结算，请先反结算后再操作`)
        }
      }
    }

    return db.updatePurchaseReturn(returnData)
  })

  ipcMain.handle('purchase-return-delete', async (event, id: number) => {
    // 检查删除单据月份是否已结算
    const returnRecord = db.getPurchaseReturnById(id)
    if (returnRecord && db.costDb) {
      const returnDate = new Date(returnRecord.return_date)
      const year = returnDate.getFullYear()
      const month = returnDate.getMonth() + 1

      if (db.costDb.isSettled(year, month)) {
        throw new Error(`无法删除退货单！${year}年${month}月已进行成本结算，请先反结算后再操作`)
      }
    }

    return db.deletePurchaseReturn(id)
  })

  ipcMain.handle('purchase-return-by-id', async (event, id: number) => {
    return db.getPurchaseReturnById(id)
  })

  // 销售退货
  ipcMain.handle('sales-return-add', async (event, returnData: any) => {
    // 检查新增单据月份是否已结算
    const returnDate = new Date(returnData.return_date)
    const year = returnDate.getFullYear()
    const month = returnDate.getMonth() + 1

    if (db.costDb && db.costDb.isSettled(year, month)) {
      throw new Error(`无法添加退货单！${year}年${month}月已进行成本结算，请先反结算后再操作`)
    }

    return db.addSalesReturn(returnData)
  })

  ipcMain.handle('sales-return-list', async (event, page = 1, pageSize = 10) => {
    return db.getSalesReturns(page, pageSize)
  })

  ipcMain.handle('sales-return-update', async (event, returnData: any) => {
    // 检查更新单据月份是否已结算
    if (returnData.id && db.costDb) {
      const returnRecord = db.getSalesReturnById(returnData.id)
      if (returnRecord) {
        const returnDate = new Date(returnRecord.return_date)
        const year = returnDate.getFullYear()
        const month = returnDate.getMonth() + 1

        if (db.costDb.isSettled(year, month)) {
          throw new Error(`无法修改退货单！${year}年${month}月已进行成本结算，请先反结算后再操作`)
        }
      }
    }

    return db.updateSalesReturn(returnData)
  })

  ipcMain.handle('sales-return-delete', async (event, id: number) => {
    // 检查删除单据月份是否已结算
    const returnRecord = db.getSalesReturnById(id)
    if (returnRecord && db.costDb) {
      const returnDate = new Date(returnRecord.return_date)
      const year = returnDate.getFullYear()
      const month = returnDate.getMonth() + 1

      if (db.costDb.isSettled(year, month)) {
        throw new Error(`无法删除退货单！${year}年${month}月已进行成本结算，请先反结算后再操作`)
      }
    }

    return db.deleteSalesReturn(id)
  })

  ipcMain.handle('sales-return-by-id', async (event, id: number) => {
    return db.getSalesReturnById(id)
  })

  // 库存调拨
  ipcMain.handle('transfer-list', async (event, page = 1, pageSize = 10, where?: string, params?: any[]) => {
    return db.getTransferList(page, pageSize, where, params)
  })

  ipcMain.handle('transfer-add', async (event, transfer: any) => {
    // 检查新增单据月份是否已结算（调拨涉及两个仓库）
    const transferDate = new Date(transfer.transfer_date)
    const year = transferDate.getFullYear()
    const month = transferDate.getMonth() + 1

    if (db.costDb && db.costDb.isSettled(year, month)) {
      throw new Error(`无法添加调拨单！${year}年${month}月已进行成本结算，请先反结算后再操作`)
    }

    return db.addTransfer(transfer)
  })

  ipcMain.handle('transfer-update', async (event, transfer: any) => {
    // 检查更新单据月份是否已结算
    if (transfer.id && db.costDb) {
      const transferRecord = db.getTransferById(transfer.id)
      if (transferRecord) {
        const transferDate = new Date(transferRecord.transfer_date)
        const year = transferDate.getFullYear()
        const month = transferDate.getMonth() + 1

        if (db.costDb.isSettled(year, month)) {
          throw new Error(`无法修改调拨单！${year}年${month}月已进行成本结算，请先反结算后再操作`)
        }
      }
    }

    return db.updateTransfer(transfer)
  })

  ipcMain.handle('transfer-delete', async (event, id: number) => {
    // 检查删除单据月份是否已结算
    const transferRecord = db.getTransferById(id)
    if (transferRecord && db.costDb) {
      const transferDate = new Date(transferRecord.transfer_date)
      const year = transferDate.getFullYear()
      const month = transferDate.getMonth() + 1

      if (db.costDb.isSettled(year, month)) {
        throw new Error(`无法删除调拨单！${year}年${month}月已进行成本结算，请先反结算后再操作`)
      }
    }

    return db.deleteTransfer(id)
  })

  ipcMain.handle('transfer-by-id', async (event, id: number) => {
    return db.getTransferById(id)
  })

  // 库存查询
  ipcMain.handle('inventory-query', async (event, warehouseId?: number, productCode?: string) => {
    return db.getInventory(warehouseId, productCode)
  })

  // 获取单个产品的实时库存
  ipcMain.handle('product-stock', async (event, productId: number, warehouseId: number) => {
    return db.getProductStock(productId, warehouseId)
  })

  // 获取所有库存
  ipcMain.handle('all-stocks', async (event, endDate?: string) => {
    return db.getAllStocks(endDate)
  })

  // 获取产品明细账（用于库存明细查询）
  ipcMain.handle('product-ledger', async (event, productId: number, warehouseId: number, startDate?: string, endDate?: string) => {
    return db.getProductLedger(productId, warehouseId, startDate, endDate)
  })

  ipcMain.handle('stock-before-date', async (event, productId: number, warehouseId: number, date: string) => {
    return db.getStockBeforeDate(productId, warehouseId, date)
  })

  // 库存盘点 CRUD
  ipcMain.handle('inventory-period-list', async () => {
    return db.getInventoryPeriodList()
  })

  ipcMain.handle('inventory-period-save', async (event, data: any) => {
    return db.saveInventoryPeriod(data)
  })

  ipcMain.handle('inventory-period-delete', async (event, id: number) => {
    return db.deleteInventoryPeriod(id)
  })

  // 成本结算查询
  ipcMain.handle('cost-settlement-query', async (event, year: number, month: number, productCode?: string, warehouseId?: number) => {
    if (!db.costDb) {
      throw new Error('成本结算数据库未初始化')
    }
    return db.costDb.getSettlements(year, month, productCode, warehouseId)
  })

  // 成本初始化计算
  ipcMain.handle('cost:initialize', async (event, params?: { year?: number; month?: number }) => {
    if (!costSettlementService || !db.costDb) {
      throw new Error('成本结算服务未初始化')
    }

    try {
      // 如果没有指定期间，自动补全所有历史月份
      if (!params?.year || !params?.month) {
        const result = costSettlementService.autoCompleteHistory()
        return { success: result.success, message: result.message, count: result.settledMonths }
      }

      // 指定期间结算
      const year = params.year
      const month = params.month
      const result = costSettlementService.settleMonth(year, month, true)

      return {
        success: result.success,
        message: result.error ? result.error : `成功结算${result.count}条记录`,
        count: result.count
      }
    } catch (error: any) {
      console.error('成本初始化失败:', error)
      return { success: false, message: error.message, count: 0 }
    }
  })

  // 重新结算
  ipcMain.handle('cost:recalculate', async (event, params: { fromYear: number; fromMonth: number }) => {
    if (!costSettlementService) {
      throw new Error('成本结算服务未初始化')
    }

    try {
      const result = costSettlementService.recalculateFromMonth(params.fromYear, params.fromMonth)
      return { success: result.success, message: result.message }
    } catch (error: any) {
      console.error('成本重新结算失败:', error)
      return { success: false, message: error.message }
    }
  })

  // 自动补全历史
  ipcMain.handle('cost:auto-complete', async () => {
    if (!costSettlementService) {
      throw new Error('成本结算服务未初始化')
    }

    try {
      const result = costSettlementService.autoCompleteHistory()
      return { success: result.success, message: result.message, settledMonths: result.settledMonths }
    } catch (error: any) {
      console.error('自动补全历史失败:', error)
      return { success: false, message: error.message, settledMonths: 0 }
    }
  })

  // 获取成本结算汇总数据
  ipcMain.handle('cost:settlement-summary', async (event, params: any) => {
    if (!db.costDb) {
      throw new Error('成本结算数据库未初始化')
    }
    console.log('[cost:settlement-summary] 收到参数:', params)
    
    const dateSource = params.periodRange || params.startDate
    let year: number, month: number
    if (dateSource) {
      const dateStr = Array.isArray(dateSource) ? dateSource[0] : String(dateSource)
      const [y, m] = dateStr.split('-').map(Number)
      year = y
      month = m
    } else {
      const now = new Date()
      year = now.getFullYear()
      month = now.getMonth() + 1
    }
    
    console.log(`[cost:settlement-summary] 查询 ${year}年${month}月，参数:`, { year, month, productSearch: params.productSearch, warehouseId: params.warehouseId })
    
    const result = db.costDb.getSettlements(year, month, params.productSearch, params.warehouseId)
    console.log(`[cost:settlement-summary] 返回 ${result.length} 条记录`)
    return result
  })

  // 获取销售成本统计
  ipcMain.handle('cost:sales-summary', async (event, params: any) => {
    if (!db.costDb) {
      throw new Error('成本结算数据库未初始化')
    }
    const dateSource = params.periodRange || params.startDate
    let year: number, month: number
    if (dateSource) {
      const dateStr = Array.isArray(dateSource) ? dateSource[0] : String(dateSource)
      const [y, m] = dateStr.split('-').map(Number)
      year = y
      month = m
    } else {
      const now = new Date()
      year = now.getFullYear()
      month = now.getMonth() + 1
    }
    return db.costDb.getSalesCostSummary(year, month, params.productSearch)
  })

  // 获取调拨成本统计
  ipcMain.handle('cost:transfer-summary', async (event, params: any) => {
    if (!db.costDb) {
      throw new Error('成本结算数据库未初始化')
    }
    const dateSource = params.periodRange || params.startDate
    let year: number, month: number
    if (dateSource) {
      const dateStr = Array.isArray(dateSource) ? dateSource[0] : String(dateSource)
      const [y, m] = dateStr.split('-').map(Number)
      year = y
      month = m
    } else {
      const now = new Date()
      year = now.getFullYear()
      month = now.getMonth() + 1
    }
    return db.costDb.getTransferCostSummary(year, month, params.productSearch)
  })

  // 获取出入库明细数据
  ipcMain.handle('cost:transaction-details', async (event, params: any) => {
    if (!db.costDb) {
      throw new Error('成本结算数据库未初始化')
    }
    const dateSource = params.periodRange || params.startDate
    let year: number, month: number
    if (dateSource) {
      const dateStr = Array.isArray(dateSource) ? dateSource[0] : String(dateSource)
      const [y, m] = dateStr.split('-').map(Number)
      year = y
      month = m
    } else {
      const now = new Date()
      year = now.getFullYear()
      month = now.getMonth() + 1
    }
    return db.costDb.getTransactionDetails(year, month, params.productSearch, params.warehouseId)
  })

  // 获取商品明细账数据
  ipcMain.handle('cost:product-detail-ledger', async (event, params: any) => {
    if (!db.costDb) {
      throw new Error('成本结算数据库未初始化')
    }
    try {
      console.log('[IPC] cost:product-detail-ledger 调用参数:', params)
      const result = db.costDb.getProductDetailLedger(params)
      console.log('[IPC] cost:product-detail-ledger 返回结果:', result ? result.length : 'null', '条记录')
      return result
    } catch (error: any) {
      console.error('[IPC] cost:product-detail-ledger 失败:', error)
      throw error
    }
  })

  // 反结算
  ipcMain.handle('cost:reverse', async (event, params: { year: number; month: number }) => {
    if (!db.costDb) {
      throw new Error('成本结算数据库未初始化')
    }
  
    try {
      console.log(`=== 开始反结算 ${params.year}年${params.month}月 ===`)
      
      // 先检查有多少条记录
      const beforeCount = db.costDb.getSettlements(params.year, params.month)
      console.log(`  反结算前数据量：${Array.isArray(beforeCount) ? beforeCount.length : 0} 条`)
      
      // 删除成本结算主表数据
      const deleteResult = db.costDb.deleteSettlement(params.year, params.month)
      console.log(`  已删除成本结算数据，影响行数：${deleteResult.changes}`)
  
      // 解锁成本结算
      db.costDb.unlockSettlement(params.year, params.month)
      console.log(`  已解锁 ${params.year}年${params.month}月`)
  
      // 删除销售成本统计
      db.costDb.deleteSalesCostSummary(params.year, params.month)
      console.log(`  已删除销售成本统计`)
  
      // 删除调拨成本统计
      db.costDb.deleteTransferCostSummary(params.year, params.month)
      console.log(`  已删除调拨成本统计`)
      
      // 验证是否删除成功
      const afterCount = db.costDb.getSettlements(params.year, params.month)
      console.log(`  反结算后数据量：${Array.isArray(afterCount) ? afterCount.length : 0} 条`)
  
      console.log(`=== 反结算完成 ===`)
      return { 
        success: true, 
        message: '反结算成功',
        deletedCount: deleteResult.changes,
        remainingCount: Array.isArray(afterCount) ? afterCount.length : 0
      }
    } catch (error: any) {
      console.error('反结算失败:', error)
      return { success: false, message: error.message }
    }
  })

  // 系统设置管理
  ipcMain.handle('system:get-settings', async () => {
    try {
      const settings = db.getSystemSettings()
      return { success: true, data: settings }
    } catch (error: any) {
      console.error('获取系统设置失败:', error)
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('system:save-settings', async (event, settings: any) => {
    try {
      db.saveSystemSettings(settings)
      return { success: true, message: '保存成功' }
    } catch (error: any) {
      console.error('保存系统设置失败:', error)
      return { success: false, message: error.message }
    }
  })

  // 数据库备份管理
  ipcMain.handle('db-backup-manual', async () => {
    const result = await databaseBackup.manualBackup()
    if (result.success) {
      dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: '备份成功',
        message: `数据库已成功备份到：\n${result.path}`
      })
    } else if (result.error) {
      dialog.showMessageBox(mainWindow!, {
        type: 'error',
        title: '备份失败',
        message: `备份失败：${result.error}`
      })
    }
    return result
  })

  ipcMain.handle('db-backup-restore', async () => {
    const result = await databaseBackup.restoreBackup()
    if (result.success) {
      // 显示需要重启的确认对话框
      const { response } = await dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        title: '恢复成功',
        message: '数据库已成功恢复，需要重启应用才能生效。\n\n请点击"确定"按钮后手动关闭并重启应用。',
        buttons: ['确定'],
        defaultId: 0
      })
      
      if (response === 0) {
        // 提示用户手动重启
        dialog.showMessageBox(mainWindow!, {
          type: 'info',
          title: '提示',
          message: '请关闭应用窗口，然后重新运行：npm run electron:dev'
        })
      }
    } else if (result.error) {
      dialog.showMessageBox(mainWindow!, {
        type: 'error',
        title: '恢复失败',
        message: `恢复失败：${result.error}`
      })
    }
    return result
  })

  ipcMain.handle('db-backup-list', async () => {
    return databaseBackup.getBackupList()
  })

  ipcMain.handle('db-export', async () => {
    const result = await databaseBackup.exportDatabase()
    if (result.success) {
      dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: '导出成功',
        message: `数据库已成功导出到：\n${result.path}\n\n您可以将此文件复制到其他电脑使用。`
      })
    } else if (result.error) {
      dialog.showMessageBox(mainWindow!, {
        type: 'error',
        title: '导出失败',
        message: `导出失败：${result.error}`
      })
    }
    return result
  })

  ipcMain.handle('db-info', async () => {
    return databaseBackup.getDatabaseInfo()
  })

  // 从指定备份恢复
  ipcMain.handle('db-backup-restore-from', async (event, backupPath: string) => {
    const result = await databaseBackup.restoreFromBackup(backupPath)
    if (result.success) {
      // 显示需要重启的确认对话框
      const { response } = await dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        title: '恢复成功',
        message: '数据库已成功恢复，需要重启应用才能生效。\n\n请点击"确定"按钮后手动关闭并重启应用。',
        buttons: ['确定'],
        defaultId: 0
      })
      
      if (response === 0) {
        // 提示用户手动重启
        dialog.showMessageBox(mainWindow!, {
          type: 'info',
          title: '提示',
          message: '请关闭应用窗口，然后重新运行：npm run electron:dev'
        })
      }
    } else if (result.error) {
      dialog.showMessageBox(mainWindow!, {
        type: 'error',
        title: '恢复失败',
        message: `恢复失败：${result.error}`
      })
    }
    return result
  })

  // 删除备份
  ipcMain.handle('db-backup-delete', async (event, filename: string) => {
    return databaseBackup.deleteBackup(filename)
  })

  // 获取备份配置
  ipcMain.handle('db-backup-config', async () => {
    return databaseBackup.getBackupConfig()
  })

  // 保存备份配置
  ipcMain.handle('db-backup-save-config', async (event, config: { autoBackupEnabled: boolean; autoBackupInterval: number; keepCount: number }) => {
    databaseBackup.saveBackupConfig(config)
    // 重新加载配置并重启定时器
    backupScheduler.reloadConfig()
    return { success: true }
  })

  // 获取备份统计
  ipcMain.handle('db-backup-stats', async () => {
    return databaseBackup.getBackupStats()
  })

  // 导出数据库
  ipcMain.handle('db-backup-export', async () => {
    const result = await databaseBackup.exportCompressedBackup()
    if (result.success) {
      dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: '导出成功',
        message: `数据库已成功导出到：\n${result.path}\n\n您可以将此文件复制到其他电脑使用。`
      })
    } else if (result.error) {
      dialog.showMessageBox(mainWindow!, {
        type: 'error',
        title: '导出失败',
        message: `导出失败：${result.error}`
      })
    }
    return result
  })

  // ==================== 客户/供应商 ====================

  ipcMain.handle('customers-list', async () => {
    return db.getCustomers()
  })

  ipcMain.handle('suppliers-list', async () => {
    return db.getSuppliers()
  })

  // ==================== 收款单 ====================

  ipcMain.handle('receipt-list', async () => {
    return db.getReceiptList() || []
  })

  ipcMain.handle('receipt-add', async (event, data: any) => {
    return db.addReceipt(data)
  })

  ipcMain.handle('receipt-update', async (event, data: any) => {
    return db.updateReceipt(data)
  })

  ipcMain.handle('receipt-delete', async (event, id: number) => {
    return db.deleteReceipt(id)
  })

  // ==================== 付款单 ====================

  ipcMain.handle('payment-list', async () => {
    return db.getPaymentList() || []
  })

  ipcMain.handle('payment-add', async (event, data: any) => {
    return db.addPayment(data)
  })

  ipcMain.handle('payment-update', async (event, data: any) => {
    return db.updatePayment(data)
  })

  ipcMain.handle('payment-delete', async (event, id: number) => {
    return db.deletePayment(id)
  })

  // ==================== 采购订单 ====================

  ipcMain.handle('purchase-orders-list', async () => {
    return db.getPurchaseOrders() || []
  })

  ipcMain.handle('purchase-order-add', async (event, data: any) => {
    return db.addPurchaseOrder(data)
  })

  ipcMain.handle('purchase-order-update', async (event, data: any) => {
    return db.updatePurchaseOrder(data)
  })

  ipcMain.handle('purchase-order-delete', async (event, id: number) => {
    return db.deletePurchaseOrder(id)
  })

  // ==================== 采购申请 ====================

  ipcMain.handle('purchase-requests-list', async () => {
    return db.getPurchaseRequests() || []
  })

  ipcMain.handle('purchase-request-add', async (event, data: any) => {
    return db.addPurchaseRequest(data)
  })

  ipcMain.handle('purchase-request-update', async (event, data: any) => {
    return db.updatePurchaseRequest(data)
  })

  ipcMain.handle('purchase-request-delete', async (event, id: number) => {
    return db.deletePurchaseRequest(id)
  })

  // ==================== 角色管理 ====================

  ipcMain.handle('roles-list', async () => {
    return db.getRoles() || []
  })

  ipcMain.handle('role-add', async (event, data: any) => {
    return db.addRole(data)
  })

  ipcMain.handle('role-update', async (event, data: any) => {
    return db.updateRole(data)
  })

  ipcMain.handle('role-delete', async (event, id: number) => {
    return db.deleteRole(id)
  })

  // ==================== 用户管理 ====================

  ipcMain.handle('users-list', async () => {
    return db.getUsers() || []
  })

  ipcMain.handle('user-add', async (event, data: any) => {
    return db.addUser(data)
  })

  ipcMain.handle('user-update', async (event, data: any) => {
    return db.updateUser(data)
  })

  ipcMain.handle('user-delete', async (event, id: number) => {
    return db.deleteUser(id)
  })

  // ==================== 回收站 ====================

  ipcMain.handle('recycle-bin-list', async () => {
    return db.getRecycleBinItems() || []
  })

  ipcMain.handle('recycle-bin-save', async (event, items: any[]) => {
    return db.saveRecycleBinItems(items)
  })

  // ==================== 价格列表 ====================

  ipcMain.handle('price-list-get', async () => {
    return db.getPriceList() || []
  })

  ipcMain.handle('price-list-save', async (event, items: any[]) => {
    return db.savePriceList(items)
  })

  console.log('IPC 处理器设置完成')
}

// 请求单实例锁，如果已经有实例在运行，则退出
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  console.log('已有实例在运行，退出')
  app.quit()
} else {
  app.whenReady().then(() => {
    createWindow()
    initDatabase()
    setupIpcHandlers()

    // 系统启动完成
    console.log('\n========== 系统启动完成 ==========')

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('quit', () => {
  if (db) {
    db.close()
  }
})
