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
    }
    // 初始化定时任务服务
    scheduledTaskService = new scheduled_task_service_1.ScheduledTaskService(db.costDb, mainWindow);
    scheduledTaskService.start();
    console.log('定时任务服务已启动');
}
// IPC 处理器
function setupIpcHandlers() {
    // 数据库操作
    electron_1.ipcMain.handle('db-init', async () => {
        return db.initialize();
    });
    electron_1.ipcMain.handle('db-query', async (event, sql, params) => {
        try {
            const result = db.query(sql, params || []);
            return result;
        }
        catch (error) {
            console.error('数据库查询错误:', error.message, 'SQL:', sql, '参数:', params);
            throw error;
        }
    });
    electron_1.ipcMain.handle('db-insert', async (event, table, data) => {
        try {
            const id = db.insert(table, data);
            console.log('数据库插入成功:', table, 'ID:', id);
            return id;
        }
        catch (error) {
            console.error('数据库插入错误:', error.message, '表:', table, '数据:', data);
            throw error;
        }
    });
    electron_1.ipcMain.handle('db-update', async (event, table, data, where, whereParams) => {
        try {
            const changes = db.update(table, data, where, whereParams);
            console.log('数据库更新成功:', table, '影响行数:', changes);
            return changes;
        }
        catch (error) {
            console.error('数据库更新错误:', error.message, '表:', table, '数据:', data);
            throw error;
        }
    });
    electron_1.ipcMain.handle('db-delete', async (event, table, where, whereParams) => {
        try {
            const changes = db.delete(table, where, whereParams);
            console.log('数据库删除成功:', table, '影响行数:', changes);
            return changes;
        }
        catch (error) {
            console.error('数据库删除错误:', error.message, '表:', table);
            throw error;
        }
    });
    electron_1.ipcMain.handle('db-transaction', async (event, operations) => {
        try {
            const transaction = db.db.transaction((ops) => {
                for (const op of ops) {
                    op();
                }
            });
            await transaction(operations);
            console.log('数据库事务执行成功');
            return { success: true };
        }
        catch (error) {
            console.error('数据库事务错误:', error.message);
            throw error;
        }
    });
    // 业务逻辑
    // 产品管理
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
    // 获取所有产品（不分页）
    electron_1.ipcMain.handle('db:products-list', async () => {
        return db.getAllProducts();
    });
    // 仓库管理
    electron_1.ipcMain.handle('warehouse-list', async (event) => {
        return db.getAllWarehouses();
    });
    electron_1.ipcMain.handle('warehouse-add', async (event, warehouse) => {
        return db.addWarehouse(warehouse);
    });
    electron_1.ipcMain.handle('warehouse-update', async (event, warehouse) => {
        return db.updateWarehouse(warehouse);
    });
    electron_1.ipcMain.handle('warehouse-delete', async (event, id) => {
        return db.deleteWarehouse(id);
    });
    // 获取所有仓库（不分页）
    electron_1.ipcMain.handle('db:warehouses-list', async () => {
        return db.getAllWarehouses();
    });
    // 供应商管理
    electron_1.ipcMain.handle('supplier-list', async (event) => {
        return db.getAllSuppliers();
    });
    electron_1.ipcMain.handle('supplier-add', async (event, supplier) => {
        return db.addSupplier(supplier);
    });
    electron_1.ipcMain.handle('supplier-update', async (event, supplier) => {
        return db.updateSupplier(supplier);
    });
    electron_1.ipcMain.handle('supplier-delete', async (event, id) => {
        return db.deleteSupplier(id);
    });
    // 客户管理
    electron_1.ipcMain.handle('customer-list', async (event) => {
        return db.getAllCustomers();
    });
    electron_1.ipcMain.handle('customer-add', async (event, customer) => {
        return db.addCustomer(customer);
    });
    electron_1.ipcMain.handle('customer-update', async (event, customer) => {
        return db.updateCustomer(customer);
    });
    electron_1.ipcMain.handle('customer-delete', async (event, id) => {
        return db.deleteCustomer(id);
    });
    // 采购入库
    electron_1.ipcMain.handle('inbound-list', async (event, page = 1, pageSize = 10, where, params) => {
        return db.getInboundList(page, pageSize, where, params);
    });
    electron_1.ipcMain.handle('inbound-add', async (event, inbound) => {
        return db.addInbound(inbound);
    });
    electron_1.ipcMain.handle('inbound-update', async (event, inbound) => {
        return db.updateInbound(inbound);
    });
    electron_1.ipcMain.handle('inbound-delete', async (event, id) => {
        return db.deleteInbound(id);
    });
    // 销售出库
    electron_1.ipcMain.handle('outbound-list', async (event, page = 1, pageSize = 10, where, params) => {
        return db.getOutboundList(page, pageSize, where, params);
    });
    electron_1.ipcMain.handle('outbound-add', async (event, outbound) => {
        return db.addOutbound(outbound);
    });
    electron_1.ipcMain.handle('outbound-update', async (event, outbound) => {
        return db.updateOutbound(outbound);
    });
    electron_1.ipcMain.handle('outbound-delete', async (event, id) => {
        return db.deleteOutbound(id);
    });
    // 库存调拨
    electron_1.ipcMain.handle('transfer-list', async (event, page = 1, pageSize = 10, where, params) => {
        return db.getTransferList(page, pageSize, where, params);
    });
    electron_1.ipcMain.handle('transfer-add', async (event, transfer) => {
        return db.addTransfer(transfer);
    });
    electron_1.ipcMain.handle('transfer-update', async (event, transfer) => {
        return db.updateTransfer(transfer);
    });
    electron_1.ipcMain.handle('transfer-delete', async (event, id) => {
        return db.deleteTransfer(id);
    });
    // 库存查询
    electron_1.ipcMain.handle('inventory-query', async (event, warehouseId, productCode) => {
        return db.getInventory(warehouseId, productCode);
    });
    // 成本结算查询
    electron_1.ipcMain.handle('cost-settlement-query', async (event, year, month, productCode, warehouseId) => {
        if (!db.costDb) {
            throw new Error('成本结算数据库未初始化');
        }
        return db.costDb.getSettlements(year, month, productCode, warehouseId);
    });
    console.log('IPC 处理器设置完成');
}
electron_1.app.whenReady().then(() => {
    createWindow();
    initDatabase();
    setupIpcHandlers();
    // 系统启动完成
    console.log('\n========== 系统启动完成 ==========');
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
