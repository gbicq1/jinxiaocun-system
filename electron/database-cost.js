"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostSettlementDatabase = void 0;
/**
 * 成本结算数据库模块
 * 负责管理月度成本结转数据
 */
class CostSettlementDatabase {
    constructor(db) {
        this.db = db;
    }
    /**
     * 初始化成本结算表
     */
    initialize() {
        try {
            // 成本结算表
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS cost_settlements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_code TEXT NOT NULL,
          product_name TEXT,
          warehouse_id INTEGER NOT NULL,
          warehouse_name TEXT,
          period_year INTEGER NOT NULL,
          period_month INTEGER NOT NULL,
          opening_qty REAL DEFAULT 0,
          opening_cost REAL DEFAULT 0,
          inbound_qty REAL DEFAULT 0,
          inbound_cost REAL DEFAULT 0,
          outbound_qty REAL DEFAULT 0,
          outbound_cost REAL DEFAULT 0,
          closing_qty REAL DEFAULT 0,
          closing_cost REAL DEFAULT 0,
          avg_cost REAL DEFAULT 0,
          is_locked INTEGER DEFAULT 0,
          calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(product_code, warehouse_id, period_year, period_month)
        )
      `);
            // 创建索引
            this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cost_settlements_period 
        ON cost_settlements(period_year, period_month)
      `);
            this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cost_settlements_product 
        ON cost_settlements(product_code, warehouse_id)
      `);
            this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cost_settlements_locked 
        ON cost_settlements(is_locked)
      `);
            console.log('成本结算表初始化成功');
            return true;
        }
        catch (error) {
            console.error('成本结算表初始化失败:', error);
            return false;
        }
    }
    /**
     * 获取指定期间的成本结算数据
     */
    getSettlement(productCode, warehouseId, year, month) {
        const stmt = this.db.prepare(`
      SELECT * FROM cost_settlements 
      WHERE product_code = ? 
        AND warehouse_id = ? 
        AND period_year = ? 
        AND period_month = ?
    `);
        return stmt.get(productCode, warehouseId, year, month);
    }
    /**
     * 获取已锁定的成本结算数据
     */
    getLockedSettlement(productCode, warehouseId, year, month) {
        const stmt = this.db.prepare(`
      SELECT * FROM cost_settlements 
      WHERE product_code = ? 
        AND warehouse_id = ? 
        AND period_year = ? 
        AND period_month = ?
        AND is_locked = 1
    `);
        return stmt.get(productCode, warehouseId, year, month);
    }
    /**
     * 保存成本结算数据
     */
    saveSettlement(settlement) {
        const stmt = this.db.prepare(`
      INSERT INTO cost_settlements (
        product_code, product_name, warehouse_id, warehouse_name,
        period_year, period_month,
        opening_qty, opening_cost,
        inbound_qty, inbound_cost,
        outbound_qty, outbound_cost,
        closing_qty, closing_cost,
        avg_cost, is_locked
      ) VALUES (
        :product_code, :product_name, :warehouse_id, :warehouse_name,
        :period_year, :period_month,
        :opening_qty, :opening_cost,
        :inbound_qty, :inbound_cost,
        :outbound_qty, :outbound_cost,
        :closing_qty, :closing_cost,
        :avg_cost, :is_locked
      )
      ON CONFLICT(product_code, warehouse_id, period_year, period_month) 
      DO UPDATE SET
        product_name = :product_name,
        warehouse_name = :warehouse_name,
        opening_qty = :opening_qty,
        opening_cost = :opening_cost,
        inbound_qty = :inbound_qty,
        inbound_cost = :inbound_cost,
        outbound_qty = :outbound_qty,
        outbound_cost = :outbound_cost,
        closing_qty = :closing_qty,
        closing_cost = :closing_cost,
        avg_cost = :avg_cost,
        is_locked = :is_locked,
        updated_at = CURRENT_TIMESTAMP
    `);
        return stmt.run({
            ...settlement,
            is_locked: settlement.is_locked || 0
        });
    }
    /**
     * 批量保存成本结算数据
     */
    saveSettlements(settlements) {
        const transaction = this.db.transaction((data) => {
            for (const settlement of data) {
                this.saveSettlement(settlement);
            }
        });
        transaction(settlements);
    }
    /**
     * 锁定指定期间的成本结算数据
     */
    lockSettlement(year, month) {
        const stmt = this.db.prepare(`
      UPDATE cost_settlements 
      SET is_locked = 1, updated_at = CURRENT_TIMESTAMP
      WHERE period_year = ? AND period_month = ?
    `);
        return stmt.run(year, month);
    }
    /**
     * 解锁指定期间的成本结算数据
     */
    unlockSettlement(year, month) {
        const stmt = this.db.prepare(`
      UPDATE cost_settlements 
      SET is_locked = 0, updated_at = CURRENT_TIMESTAMP
      WHERE period_year = ? AND period_month = ?
    `);
        return stmt.run(year, month);
    }
    /**
     * 检查指定期间是否已结算（锁定）
     */
    isSettled(year, month) {
        const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM cost_settlements 
      WHERE period_year = ? AND period_month = ? AND is_locked = 1
    `);
        const result = stmt.get(year, month);
        return result.count > 0;
    }
    /**
     * 获取所有已结算的期间列表
     */
    getSettledPeriods() {
        const stmt = this.db.prepare(`
      SELECT DISTINCT period_year, period_month 
      FROM cost_settlements 
      WHERE is_locked = 1
      ORDER BY period_year DESC, period_month DESC
    `);
        return stmt.all();
    }
    /**
     * 删除指定期间的成本结算数据
     */
    deleteSettlement(year, month) {
        const stmt = this.db.prepare(`
      DELETE FROM cost_settlements 
      WHERE period_year = ? AND period_month = ?
    `);
        return stmt.run(year, month);
    }
    /**
     * 获取最新已结算期间
     */
    getLatestSettledPeriod() {
        const stmt = this.db.prepare(`
      SELECT period_year, period_month 
      FROM cost_settlements 
      WHERE is_locked = 1
      ORDER BY period_year DESC, period_month DESC
      LIMIT 1
    `);
        return stmt.get();
    }
    /**
     * 获取指定产品仓库的所有结算记录
     */
    getProductSettlements(productCode, warehouseId) {
        const stmt = this.db.prepare(`
      SELECT * FROM cost_settlements 
      WHERE product_code = ? AND warehouse_id = ?
      ORDER BY period_year DESC, period_month DESC
    `);
        return stmt.all(productCode, warehouseId);
    }
}
exports.CostSettlementDatabase = CostSettlementDatabase;
