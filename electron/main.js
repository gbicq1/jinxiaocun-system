"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const database_1 = require("./database");
const cost_settlement_handler_1 = require("./cost-settlement-handler");
const scheduled_task_service_1 = require("./scheduled-task-service");
let mainWindow = null;
let db;
let costHandler;
let scheduledTaskService;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: (0, path_1.resolve)(__dirname, 'preload.js')
        },
        icon: (0, path_1.resolve)(__dirname, '../assets/icon.png'),
        title: '进销存管理系统'
    });
    // 开发环境加载 Vite 服务器，生产环境加载构建文件
    const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile((0, path_1.resolve)(__dirname, '../dist/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// 初始化数据库
function initDatabase() {
    const dbPath = (0, path_1.resolve)(electron_1.app.getPath('userData'), 'inventory.db');
    db = new database_1.InventoryDatabase(dbPath);
    db.initialize();
    console.log('数据库初始化完成:', dbPath);
    // 初始化成本结算处理器
    if (db.costDb) {
        costHandler = new cost_settlement_handler_1.CostSettlementHandler(db.costDb, mainWindow);
        costHandler.registerHandlers();
        console.log('成本结算处理器初始化完成');
        // 初始化定时任务服务
        scheduledTaskService = new scheduled_task_service_1.ScheduledTaskService(db.costDb, mainWindow);
        scheduledTaskService.start();
        console.log('定时任务服务已启动');
    }
}
// IPC 处理器
function setupIpcHandlers() {
    // 数据库操作
    electron_1.ipcMain.handle('db-init', async () => {
        return db.initialize();
    });
    electron_1.ipcMain.handle('db-query', async (event, table, sql, params) => {
        return db.query(sql, params || []);
    });
    electron_1.ipcMain.handle('db-insert', async (event, table, data) => {
        return db.insert(table, data);
    });
    electron_1.ipcMain.handle('db-update', async (event, table, data, where, whereParams) => {
        return db.update(table, data, where, whereParams);
    });
    electron_1.ipcMain.handle('db-delete', async (event, table, where, whereParams) => {
        return db.delete(table, where, whereParams);
    });
    // 业务逻辑
    electron_1.ipcMain.handle('product-list', async (event, page = 1, pageSize = 10) => {
        return db.getProductList(page, pageSize);
    });
    electron_1.ipcMain.handle('product-add', async (event, product) => {
        return db.addProduct(product);
    });
    electron_1.ipcMain.handle('product-update', async (event, product) => {
        return db.updateProduct(product);
    });
    electron_1.ipcMain.handle('product-delete', async (event, id) => {
        return db.deleteProduct(id);
    });
    // 更多 IPC 处理器...
}
electron_1.app.whenReady().then(() => {
    createWindow();
    initDatabase();
    setupIpcHandlers();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('quit', () => {
    if (db) {
        db.close();
    }
});
