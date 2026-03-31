import { app, BrowserWindow, ipcMain } from 'electron'
import { resolve } from 'path'
import { InventoryDatabase } from './database'
import { CostSettlementHandler } from './cost-settlement-handler'
import { ScheduledTaskService } from './scheduled-task-service'

let mainWindow: BrowserWindow | null = null
let db: InventoryDatabase
let costHandler: CostSettlementHandler
let scheduledTaskService: ScheduledTaskService

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: resolve(__dirname, 'preload.js')
    },
    icon: resolve(__dirname, '../assets/icon.png'),
    title: '进销存管理系统'
  })

  // 开发环境加载 Vite 服务器，生产环境加载构建文件
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(resolve(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 初始化数据库
function initDatabase() {
  const dbPath = resolve(app.getPath('userData'), 'inventory.db')
  db = new InventoryDatabase(dbPath)
  db.initialize()
  console.log('数据库初始化完成:', dbPath)
  
  // 初始化成本结算处理器
  if (db.costDb) {
    costHandler = new CostSettlementHandler(db.costDb, mainWindow!)
    costHandler.registerHandlers()
    console.log('成本结算处理器初始化完成')
    
    // 初始化定时任务服务
    scheduledTaskService = new ScheduledTaskService(db.costDb, mainWindow!)
    scheduledTaskService.start()
    console.log('定时任务服务已启动')
  }
}

// IPC 处理器
function setupIpcHandlers() {
  // 数据库操作
  ipcMain.handle('db-init', async () => {
    return db.initialize()
  })

  ipcMain.handle('db-query', async (event, sql: string, params?: any[]) => {
    try {
      const result = db.query(sql, params || [])
      return result
    } catch (error: any) {
      console.error('数据库查询错误:', error.message, 'SQL:', sql, '参数:', params)
      throw error
    }
  })

  ipcMain.handle('db-insert', async (event, table: string, data: any) => {
    try {
      const id = db.insert(table, data)
      console.log('数据库插入成功:', table, 'ID:', id)
      return id
    } catch (error: any) {
      console.error('数据库插入错误:', error.message, '表:', table, '数据:', data)
      throw error
    }
  })

  ipcMain.handle('db-update', async (event, table: string, data: any, where: string, whereParams: any[]) => {
    try {
      const changes = db.update(table, data, where, whereParams)
      console.log('数据库更新成功:', table, '影响行数:', changes)
      return changes
    } catch (error: any) {
      console.error('数据库更新错误:', error.message, '表:', table, '数据:', data)
      throw error
    }
  })

  ipcMain.handle('db-delete', async (event, table: string, where: string, whereParams: any[]) => {
    try {
      const changes = db.delete(table, where, whereParams)
      console.log('数据库删除成功:', table, '影响行数:', changes)
      return changes
    } catch (error: any) {
      console.error('数据库删除错误:', error.message, '表:', table)
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
      console.log('数据库事务执行成功')
      return { success: true }
    } catch (error: any) {
      console.error('数据库事务错误:', error.message)
      throw error
    }
  })

  // 业务逻辑
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
    return db.addInbound(inbound)
  })

  ipcMain.handle('inbound-update', async (event, inbound: any) => {
    return db.updateInbound(inbound)
  })

  ipcMain.handle('inbound-delete', async (event, id: number) => {
    return db.deleteInbound(id)
  })

  // 销售出库
  ipcMain.handle('outbound-list', async (event, page = 1, pageSize = 10, where?: string, params?: any[]) => {
    return db.getOutboundList(page, pageSize, where, params)
  })

  ipcMain.handle('outbound-add', async (event, outbound: any) => {
    return db.addOutbound(outbound)
  })

  ipcMain.handle('outbound-update', async (event, outbound: any) => {
    return db.updateOutbound(outbound)
  })

  ipcMain.handle('outbound-delete', async (event, id: number) => {
    return db.deleteOutbound(id)
  })

  // 库存调拨
  ipcMain.handle('transfer-list', async (event, page = 1, pageSize = 10, where?: string, params?: any[]) => {
    return db.getTransferList(page, pageSize, where, params)
  })

  ipcMain.handle('transfer-add', async (event, transfer: any) => {
    return db.addTransfer(transfer)
  })

  ipcMain.handle('transfer-update', async (event, transfer: any) => {
    return db.updateTransfer(transfer)
  })

  ipcMain.handle('transfer-delete', async (event, id: number) => {
    return db.deleteTransfer(id)
  })

  // 库存查询
  ipcMain.handle('inventory-query', async (event, warehouseId?: number, productCode?: string) => {
    return db.getInventory(warehouseId, productCode)
  })

  // 成本结算查询
  ipcMain.handle('cost-settlement-query', async (event, year: number, month: number, productCode?: string, warehouseId?: number) => {
    if (!db.costDb) {
      throw new Error('成本结算数据库未初始化')
    }
    return db.costDb.getSettlements(year, month, productCode, warehouseId)
  })

  console.log('IPC 处理器设置完成')
}

app.whenReady().then(() => {
  createWindow()
  initDatabase()
  setupIpcHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

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
