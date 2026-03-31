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

  ipcMain.handle('db-query', async (event, table: string, sql: string, params?: any[]) => {
    return db.query(sql, params || [])
  })

  ipcMain.handle('db-insert', async (event, table: string, data: any) => {
    return db.insert(table, data)
  })

  ipcMain.handle('db-update', async (event, table: string, data: any, where: string, whereParams: any[]) => {
    return db.update(table, data, where, whereParams)
  })

  ipcMain.handle('db-delete', async (event, table: string, where: string, whereParams: any[]) => {
    return db.delete(table, where, whereParams)
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

  // 更多 IPC 处理器...
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
