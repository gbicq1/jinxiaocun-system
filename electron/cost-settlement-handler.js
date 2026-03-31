"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostSettlementHandler = void 0;
const electron_1 = require("electron");
/**
 * 成本结算 IPC 处理器
 * 提供数据库访问接口，成本计算逻辑在渲染进程运行
 */
class CostSettlementHandler {
    constructor(db, mainWindow) {
        this.costDb = db;
        this.mainWindow = mainWindow;
    }
    /**
     * 注册 IPC 处理器
     */
    registerHandlers() {
        // 获取指定期间的结算数据
        electron_1.ipcMain.handle('cost:get-settlement', async (event, { productCode, warehouseId, year, month }) => {
            return this.costDb.getSettlement(productCode, warehouseId, year, month);
        });
        // 获取指定期间的所有结算数据
        electron_1.ipcMain.handle('cost:get-settlements', async (event, { year, month, productCode, warehouseId }) => {
            return this.costDb.getSettlements(year, month, productCode, warehouseId);
        });
        // 获取已锁定的结算数据
        electron_1.ipcMain.handle('cost:get-locked-settlement', async (event, { productCode, warehouseId, year, month }) => {
            return this.costDb.getLockedSettlement(productCode, warehouseId, year, month);
        });
        // 检查是否已结算
        electron_1.ipcMain.handle('cost:is-settled', async (event, { year, month }) => {
            return this.costDb.isSettled(year, month);
        });
        // 获取已结算期间列表
        electron_1.ipcMain.handle('cost:get-settled-periods', async () => {
            return this.costDb.getSettledPeriods();
        });
        // 获取最新已结算期间
        electron_1.ipcMain.handle('cost:get-latest-settled-period', async () => {
            return this.costDb.getLatestSettledPeriod();
        });
        // 保存结算数据
        electron_1.ipcMain.handle('cost:save-settlement', async (event, settlement) => {
            return this.costDb.saveSettlement(settlement);
        });
        // 批量保存结算数据
        electron_1.ipcMain.handle('cost:save-settlements', async (event, settlements) => {
            return this.costDb.saveSettlements(settlements);
        });
        // 解锁指定月份（用于反结算）
        electron_1.ipcMain.handle('cost:unlock-month', async (event, { year, month }) => {
            return this.costDb.unlockSettlement(year, month);
        });
        // 获取库存快照
        electron_1.ipcMain.handle('cost:get-snapshot', async (event, { productCode, warehouseId, date }) => {
            return this.costDb.getSnapshot(productCode, warehouseId, date);
        });
        // 获取指定日期前的最新快照
        electron_1.ipcMain.handle('cost:get-latest-snapshot', async (event, { productCode, warehouseId, beforeDate }) => {
            return this.costDb.getLatestSnapshotBeforeDate(productCode, warehouseId, beforeDate);
        });
        // 获取月末快照
        electron_1.ipcMain.handle('cost:get-month-end-snapshot', async (event, { productCode, warehouseId, year, month }) => {
            return this.costDb.getMonthEndSnapshot(productCode, warehouseId, year, month);
        });
        // 保存库存快照
        electron_1.ipcMain.handle('cost:save-snapshot', async (event, snapshot) => {
            return this.costDb.saveSnapshot(snapshot.product_code, snapshot.product_name, snapshot.warehouse_id, snapshot.warehouse_name, snapshot.snapshot_date, snapshot.quantity, snapshot.cost);
        });
    }
}
exports.CostSettlementHandler = CostSettlementHandler;
