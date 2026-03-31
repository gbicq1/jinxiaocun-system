"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
let mainWindow = null;
let db;
// 动态导入数据库模块（支持打包后的 ASAR 路径）
let InventoryDatabase;
if (electron_1.app.isPackaged) {
    // 生产环境：从 ASAR 内部加载
    InventoryDatabase = require((0, path_1.join)((0, path_1.dirname)(__filename), 'database.js')).default;
}
else {
    // 开发环境：直接导入
    InventoryDatabase = require('./database').default;
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: (0, path_1.join)(__dirname, 'preload.js')
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
    db = new InventoryDatabase(dbPath);
    const success = db.initialize();
    console.log('数据库初始化完成:', dbPath, '成功:', success);
    return success;
}
// IPC 处理器
function setupIpcHandlers() {
    // 数据库初始化
    electron_1.ipcMain.handle('db-init', async () => {
        return initDatabase();
    });
    // 数据库操作
    electron_1.ipcMain.handle('db-query', async (event, sql, params = []) => {
        try {
            return db.query(sql, params);
        }
        catch (error) {
            console.error('查询失败:', error);
            throw error;
        }
    });
    electron_1.ipcMain.handle('db-insert', async (event, table, data) => {
        try {
            return db.insert(table, data);
        }
        catch (error) {
            console.error('插入失败:', error);
            throw error;
        }
    });
    electron_1.ipcMain.handle('db-update', async (event, table, data, where, whereParams) => {
        try {
            return db.update(table, data, where, whereParams);
        }
        catch (error) {
            console.error('更新失败:', error);
            throw error;
        }
    });
    electron_1.ipcMain.handle('db-delete', async (event, table, where, whereParams) => {
        try {
            return db.delete(table, where, whereParams);
        }
        catch (error) {
            console.error('删除失败:', error);
            throw error;
        }
    });
    // 业务逻辑 - 产品
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
}
electron_1.app.whenReady().then(() => {
    initDatabase();
    createWindow();
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
