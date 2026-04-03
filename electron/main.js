"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const database_1 = require("./database");
const cost_settlement_handler_1 = require("./cost-settlement-handler");
const scheduled_task_service_1 = require("./scheduled-task-service");
const database_backup_1 = require("./database-backup");
let mainWindow = null;
let db;
let costHandler;
let scheduledTaskService;
let databaseBackup;
function createWindow() {
    console.log('创建窗口，preload 路径:', (0, path_1.resolve)(__dirname, 'preload.js'));
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: (0, path_1.resolve)(__dirname, 'preload.js')
        },
        icon: (0, path_1.resolve)(__dirname, '../assets/icon.png'),
        title: '进销存管理系统'
    });
    // 开发环境加载 Vite 服务器，生产环境加载构建文件
    const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
    console.log('是否开发环境:', isDev);
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
    // 设置中文菜单
    const template = [
        {
            label: '文件',
            submenu: [
                {
                    label: '退出',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
                    click: () => {
                        electron_1.app.quit();
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
                        const { dialog } = require('electron');
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: '关于进销存管理系统',
                            message: '进销存管理系统',
                            detail: '版本：1.0.0\n\n一个完整的进销存管理系统，支持采购、销售、库存管理等功能。'
                        });
                    }
                }
            ]
        }
    ];
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
}
// 初始化数据库
function initDatabase() {
    const dbPath = (0, path_1.resolve)(electron_1.app.getPath('userData'), 'inventory.db');
    db = new database_1.InventoryDatabase(dbPath);
    db.initialize();
    console.log('数据库初始化完成:', dbPath);
    // 初始化数据库备份服务
    databaseBackup = new database_backup_1.DatabaseBackup(dbPath);
    // 启动时自动备份数据库
    const backupPath = databaseBackup.autoBackup();
    if (backupPath) {
        console.log('启动时自动备份完成:', backupPath);
    }
    // 清理旧备份（保留最近 10 个）
    databaseBackup.cleanupOldBackups(10);
    // 初始化成本结算处理器
    if (db.costDb) {
        costHandler = new cost_settlement_handler_1.CostSettlementHandler(db.costDb, mainWindow);
        costHandler.registerHandlers();
        console.log('成本结算处理器初始化完成');
    }
    // 初始化定时任务服务
    scheduledTaskService = new scheduled_task_service_1.ScheduledTaskService(db.costDb, mainWindow, db.db);
    scheduledTaskService.start();
    console.log('定时任务服务已启动');
}
// IPC 处理器
function setupIpcHandlers() {
    // 数据库操作
    electron_1.ipcMain.handle('db-init', async () => {
        return db.initialize();
    });
    electron_1.ipcMain.handle('db-query', async (event, tableOrSql, sqlOrParams, params) => {
        try {
            let sql;
            let sqlParams;
            // 支持两种调用方式：
            // 1. dbQuery(sql, params) - 旧方式
            // 2. dbQuery(table, sql, params) - 新方式（为了兼容性）
            if (typeof sqlOrParams === 'string') {
                // 新方式：dbQuery(table, sql, params)
                sql = sqlOrParams;
                sqlParams = params || [];
            }
            else {
                // 旧方式：dbQuery(sql, params)
                sql = tableOrSql;
                sqlParams = sqlOrParams || [];
            }
            const result = db.query(sql, sqlParams);
            return result;
        }
        catch (error) {
            console.error('数据库查询错误:', error.message, 'SQL:', tableOrSql, '参数:', sqlOrParams, params);
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
        const products = db.getAllProducts();
        console.log('获取产品列表:', products);
        return products;
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
        const warehouses = db.getAllWarehouses();
        console.log('获取仓库列表:', warehouses);
        return warehouses;
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
    // 采购退货
    electron_1.ipcMain.handle('purchase-return-add', async (event, returnData) => {
        return db.addPurchaseReturn(returnData);
    });
    electron_1.ipcMain.handle('purchase-return-list', async (event, page = 1, pageSize = 10) => {
        return db.getPurchaseReturns(page, pageSize);
    });
    electron_1.ipcMain.handle('purchase-return-update', async (event, returnData) => {
        return db.updatePurchaseReturn(returnData);
    });
    electron_1.ipcMain.handle('purchase-return-delete', async (event, id) => {
        return db.deletePurchaseReturn(id);
    });
    // 销售退货
    electron_1.ipcMain.handle('sales-return-add', async (event, returnData) => {
        return db.addSalesReturn(returnData);
    });
    electron_1.ipcMain.handle('sales-return-list', async (event, page = 1, pageSize = 10) => {
        return db.getSalesReturns(page, pageSize);
    });
    electron_1.ipcMain.handle('sales-return-update', async (event, returnData) => {
        return db.updateSalesReturn(returnData);
    });
    electron_1.ipcMain.handle('sales-return-delete', async (event, id) => {
        return db.deleteSalesReturn(id);
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
    // 获取单个产品的实时库存
    electron_1.ipcMain.handle('product-stock', async (event, productId, warehouseId) => {
        return db.getProductStock(productId, warehouseId);
    });
    // 成本结算查询
    electron_1.ipcMain.handle('cost-settlement-query', async (event, year, month, productCode, warehouseId) => {
        if (!db.costDb) {
            throw new Error('成本结算数据库未初始化');
        }
        return db.costDb.getSettlements(year, month, productCode, warehouseId);
    });
    // 数据库备份管理
    electron_1.ipcMain.handle('db-backup-manual', async () => {
        const result = await databaseBackup.manualBackup();
        if (result.success) {
            electron_1.dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '备份成功',
                message: `数据库已成功备份到：\n${result.path}`
            });
        }
        else if (result.error) {
            electron_1.dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: '备份失败',
                message: `备份失败：${result.error}`
            });
        }
        return result;
    });
    electron_1.ipcMain.handle('db-backup-restore', async () => {
        const result = await databaseBackup.restoreBackup();
        if (result.success) {
            electron_1.dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '恢复成功',
                message: '数据库已成功恢复，请重启系统以应用更改。'
            });
        }
        else if (result.error) {
            electron_1.dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: '恢复失败',
                message: `恢复失败：${result.error}`
            });
        }
        return result;
    });
    electron_1.ipcMain.handle('db-backup-list', async () => {
        return databaseBackup.getBackupList();
    });
    electron_1.ipcMain.handle('db-export', async () => {
        const result = await databaseBackup.exportDatabase();
        if (result.success) {
            electron_1.dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '导出成功',
                message: `数据库已成功导出到：\n${result.path}\n\n您可以将此文件复制到其他电脑使用。`
            });
        }
        else if (result.error) {
            electron_1.dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: '导出失败',
                message: `导出失败：${result.error}`
            });
        }
        return result;
    });
    electron_1.ipcMain.handle('db-info', async () => {
        return databaseBackup.getDatabaseInfo();
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
