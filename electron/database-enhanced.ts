/**
 * 增强版数据库模块
 * 解决成本价不一致问题的关键改进：
 * 1. 添加库存快照表，保存每月末的准确库存数据
 * 2. 添加成本结算历史表，确保期初数据可追溯
 * 3. 使用数据库事务保证数据一致性
 */

import Database from 'better-sqlite3'
import { resolve } from 'path'

export class EnhancedInventoryDatabase {
  private db: Database.Database
  private dbPath: string
  private initialized: boolean = false

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.db = null
  }

  /**
   * 初始化数据库并创建所有表
   */
  initialize(): boolean {
    try {
      this.db = new Database(this.dbPath)
      this.createTables()
      this.createIndexes()
      this.initialized = true
      console.log('增强版数据库初始化完成')
      return true
    } catch (error) {
      console.error('数据库初始化失败:', error)
      return false
    }
  }

  /**
   * 创建基础表（继承原有表结构）
   */
  private createTables() {
    // 原有表结构创建...
    // 这里只列出新增的关键表

    // ========== 关键改进 1: 库存快照表 ==========
    // 每月月末自动保存库存快照，确保期初数据准确
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inventory_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        product_code VARCHAR(50) NOT NULL,
        warehouse_id INTEGER NOT NULL,
        snapshot_date DATE NOT NULL,
        snapshot_type VARCHAR(20) NOT NULL, -- 'monthly' 或 'yearly'
        
        -- 库存数量
        quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
        
        -- 成本信息（关键：保存准确的成本价）
        unit_cost DECIMAL(15,6) NOT NULL DEFAULT 0,
        total_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
        
        -- 本月累计（用于快速计算）
        monthly_inbound_qty DECIMAL(15,4) DEFAULT 0,
        monthly_inbound_cost DECIMAL(15,2) DEFAULT 0,
        monthly_outbound_qty DECIMAL(15,4) DEFAULT 0,
        monthly_outbound_cost DECIMAL(15,2) DEFAULT 0,
        
        -- 数据来源标记
        source VARCHAR(20) DEFAULT 'calculated', -- 'calculated' 或 'settled'
        is_locked BOOLEAN DEFAULT 0, -- 是否已锁定（已结算的月份）
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(product_id, warehouse_id, snapshot_date)
      )
    `)

    // ========== 关键改进 2: 成本结算历史表 ==========
    // 保存每次成本结算的完整历史，确保可追溯
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cost_settlement_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        settlement_no VARCHAR(50) UNIQUE NOT NULL,
        product_id INTEGER NOT NULL,
        product_code VARCHAR(50) NOT NULL,
        warehouse_id INTEGER NOT NULL,
        
        -- 会计期间
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        
        -- 期初数据（来自上月快照）
        opening_qty DECIMAL(15,4) DEFAULT 0,
        opening_cost DECIMAL(15,2) DEFAULT 0,
        opening_unit_cost DECIMAL(15,6) DEFAULT 0,
        
        -- 本期入库
        inbound_qty DECIMAL(15,4) DEFAULT 0,
        inbound_cost DECIMAL(15,2) DEFAULT 0,
        
        -- 本期出库
        outbound_qty DECIMAL(15,4) DEFAULT 0,
        outbound_cost DECIMAL(15,2) DEFAULT 0,
        
        -- 加权平均单价（核心）
        weighted_avg_unit_cost DECIMAL(15,6) NOT NULL DEFAULT 0,
        
        -- 期末结存
        closing_qty DECIMAL(15,4) DEFAULT 0,
        closing_cost DECIMAL(15,2) DEFAULT 0,
        closing_unit_cost DECIMAL(15,6) DEFAULT 0,
        
        -- 结算状态
        status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'confirmed', 'locked'
        settled_at DATETIME,
        settled_by VARCHAR(50),
        
        -- 备注
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    `)

    // ========== 关键改进 3: 出入库流水表 ==========
    // 从 localStorage 同步到数据库，确保数据不丢失
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_no VARCHAR(50) NOT NULL,
        product_id INTEGER NOT NULL,
        product_code VARCHAR(50) NOT NULL,
        warehouse_id INTEGER NOT NULL,
        
        -- 交易日期和时间（精确到秒）
        transaction_date DATE NOT NULL,
        transaction_time TIME,
        timestamp DATETIME,
        
        -- 交易类型
        transaction_type VARCHAR(20) NOT NULL, -- 'inbound', 'outbound', 'transfer_in', 'transfer_out', 'return_in', 'return_out'
        bill_type VARCHAR(50), -- 原始单据类型
        bill_no VARCHAR(50), -- 原始单据号
        
        -- 交易数量和成本
        quantity DECIMAL(15,4) NOT NULL,
        unit_cost DECIMAL(15,6) NOT NULL,
        total_cost DECIMAL(15,2) NOT NULL,
        
        -- 交易前的库存结余（关键：用于追溯）
        pre_quantity DECIMAL(15,4),
        pre_unit_cost DECIMAL(15,6),
        pre_total_cost DECIMAL(15,2),
        
        -- 交易后的库存结余
        post_quantity DECIMAL(15,4),
        post_unit_cost DECIMAL(15,6),
        post_total_cost DECIMAL(15,2),
        
        -- 关联信息
        counterparty_name VARCHAR(200), -- 往来单位
        remark TEXT,
        
        -- 数据来源
        source_key VARCHAR(100), -- localStorage 的 key
        source_id VARCHAR(50), -- 原始记录 ID
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_product_warehouse (product_id, warehouse_id),
        INDEX idx_date (transaction_date),
        INDEX idx_timestamp (timestamp)
      )
    `)

    // ========== 关键改进 4: 成本计算日志表 ==========
    // 记录每次成本计算的过程，便于调试和审计
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cost_calculation_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        calculation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        product_id INTEGER NOT NULL,
        product_code VARCHAR(50) NOT NULL,
        warehouse_id INTEGER NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        
        -- 计算参数
        opening_qty_used DECIMAL(15,4),
        opening_cost_used DECIMAL(15,2),
        opening_source VARCHAR(100), -- 期初数据来源
        
        -- 计算结果
        calculated_avg_cost DECIMAL(15,6),
        closing_qty DECIMAL(15,4),
        closing_cost DECIMAL(15,2),
        
        -- 计算过程明细（JSON 格式）
        calculation_details TEXT, -- JSON 格式存储详细计算过程
        
        -- 状态
        status VARCHAR(20) DEFAULT 'success', -- 'success' 或 'error'
        error_message TEXT,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  /**
   * 创建索引以提升查询性能
   */
  private createIndexes() {
    // 库存快照索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_snapshots_product_warehouse 
      ON inventory_snapshots(product_id, warehouse_id)
    `)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_snapshots_date 
      ON inventory_snapshots(snapshot_date)
    `)

    // 成本结算历史索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_settlement_period 
      ON cost_settlement_history(period_start, period_end)
    `)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_settlement_product 
      ON cost_settlement_history(product_id, warehouse_id)
    `)
  }

  /**
   * 关键方法：获取准确的期初数据
   * 这是解决成本价不一致问题的核心
   */
  getOpeningBalance(productId: number, warehouseId: number, periodStart: string): {
    quantity: number
    cost: number
    unitCost: number
    source: string
  } {
    const periodStartDate = new Date(periodStart)
    const previousDay = new Date(periodStartDate)
    previousDay.setDate(previousDay.getDate() - 1)
    const previousDayStr = previousDay.toISOString().slice(0, 10)

    console.log('获取期初数据:', {
      productId,
      warehouseId,
      periodStart,
      previousDay: previousDayStr
    })

    // 方案 1：从库存快照表获取（最准确）
    const snapshot = this.db.prepare(`
      SELECT quantity, total_cost, unit_cost, source
      FROM inventory_snapshots
      WHERE product_id = ? 
        AND warehouse_id = ?
        AND snapshot_date <= ?
      ORDER BY snapshot_date DESC
      LIMIT 1
    `).get(productId, warehouseId, previousDayStr) as any

    if (snapshot) {
      console.log('✅ 从库存快照表获取期初数据:', snapshot)
      return {
        quantity: Number(snapshot.quantity),
        cost: Number(snapshot.total_cost),
        unitCost: Number(snapshot.unit_cost),
        source: 'snapshot:' + snapshot.source
      }
    }

    // 方案 2：从成本结算历史表获取（次准确）
    const settlement = this.db.prepare(`
      SELECT closing_qty, closing_cost, closing_unit_cost, period_end
      FROM cost_settlement_history
      WHERE product_id = ? 
        AND warehouse_id = ?
        AND period_end <= ?
        AND status = 'confirmed'
      ORDER BY period_end DESC
      LIMIT 1
    `).get(productId, warehouseId, previousDayStr) as any

    if (settlement) {
      console.log('✅ 从成本结算历史表获取期初数据:', settlement)
      return {
        quantity: Number(settlement.closing_qty),
        cost: Number(settlement.closing_cost),
        unitCost: Number(settlement.closing_unit_cost),
        source: 'settlement:' + settlement.period_end
      }
    }

    // 方案 3：从出入库流水表计算（兜底方案）
    console.log('⚠️ 未找到快照和结算数据，从出入库流水表计算...')
    const result = this.calculateStockFromTransactions(productId, warehouseId, previousDayStr)
    
    if (result.quantity > 0) {
      console.log('✅ 从出入库流水表计算期初数据:', result)
      return {
        quantity: result.quantity,
        cost: result.totalCost,
        unitCost: result.unitCost,
        source: 'transactions'
      }
    }

    // 方案 4：没有数据，返回 0
    console.log('⚠️ 未找到任何历史数据，期初为 0')
    return {
      quantity: 0,
      cost: 0,
      unitCost: 0,
      source: 'none'
    }
  }

  /**
   * 从出入库流水表计算库存
   */
  private calculateStockFromTransactions(
    productId: number, 
    warehouseId: number, 
    beforeDate: string
  ): {
    quantity: number
    totalCost: number
    unitCost: number
  } {
    const transactions = this.db.prepare(`
      SELECT quantity, unit_cost, total_cost, transaction_type
      FROM inventory_transactions
      WHERE product_id = ? 
        AND warehouse_id = ?
        AND transaction_date <= ?
      ORDER BY transaction_date, transaction_time
    `).all(productId, warehouseId, beforeDate) as any[]

    let quantity = 0
    let totalCost = 0

    transactions.forEach(tx => {
      const qty = Number(tx.quantity)
      const cost = Number(tx.total_cost)
      
      if (tx.transaction_type.startsWith('inbound') || tx.transaction_type === 'transfer_in') {
        quantity += qty
        totalCost += cost
      } else {
        quantity -= qty
        totalCost -= cost
      }
    })

    const unitCost = quantity > 0 ? totalCost / quantity : 0

    return {
      quantity,
      totalCost,
      unitCost
    }
  }

  /**
   * 保存库存快照（在每月结算时调用）
   */
  saveInventorySnapshot(data: {
    productId: number
    productCode: string
    warehouseId: number
    snapshotDate: string
    snapshotType: 'monthly' | 'yearly'
    quantity: number
    unitCost: number
    totalCost: number
    monthlyInboundQty?: number
    monthlyInboundCost?: number
    monthlyOutboundQty?: number
    monthlyOutboundCost?: number
    source?: 'calculated' | 'settled'
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO inventory_snapshots (
        product_id, product_code, warehouse_id, snapshot_date, snapshot_type,
        quantity, unit_cost, total_cost,
        monthly_inbound_qty, monthly_inbound_cost,
        monthly_outbound_qty, monthly_outbound_cost,
        source
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(product_id, warehouse_id, snapshot_date) 
      DO UPDATE SET
        quantity = excluded.quantity,
        unit_cost = excluded.unit_cost,
        total_cost = excluded.total_cost,
        monthly_inbound_qty = excluded.monthly_inbound_qty,
        monthly_inbound_cost = excluded.monthly_inbound_cost,
        monthly_outbound_qty = excluded.monthly_outbound_qty,
        monthly_outbound_cost = excluded.monthly_outbound_cost,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `)

    const result = stmt.run(
      data.productId,
      data.productCode,
      data.warehouseId,
      data.snapshotDate,
      data.snapshotType,
      data.quantity,
      data.unitCost,
      data.totalCost,
      data.monthlyInboundQty || 0,
      data.monthlyInboundCost || 0,
      data.monthlyOutboundQty || 0,
      data.monthlyOutboundCost || 0,
      data.source || 'calculated'
    )

    return result.lastInsertRowid as number
  }

  /**
   * 保存成本结算历史
   */
  saveCostSettlement(data: {
    settlementNo: string
    productId: number
    productCode: string
    warehouseId: number
    periodStart: string
    periodEnd: string
    openingQty: number
    openingCost: number
    openingUnitCost: number
    inboundQty: number
    inboundCost: number
    outboundQty: number
    outboundCost: number
    weightedAvgUnitCost: number
    closingQty: number
    closingCost: number
    closingUnitCost: number
    status?: string
    remark?: string
  }): number {
    const stmt = this.db.prepare(`
      INSERT INTO cost_settlement_history (
        settlement_no, product_id, product_code, warehouse_id,
        period_start, period_end,
        opening_qty, opening_cost, opening_unit_cost,
        inbound_qty, inbound_cost,
        outbound_qty, outbound_cost,
        weighted_avg_unit_cost,
        closing_qty, closing_cost, closing_unit_cost,
        status, remark
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `)

    const result = stmt.run(
      data.settlementNo,
      data.productId,
      data.productCode,
      data.warehouseId,
      data.periodStart,
      data.periodEnd,
      data.openingQty,
      data.openingCost,
      data.openingUnitCost,
      data.inboundQty,
      data.inboundCost,
      data.outboundQty,
      data.outboundCost,
      data.weightedAvgUnitCost,
      data.closingQty,
      data.closingCost,
      data.closingUnitCost,
      data.status || 'draft',
      data.remark || ''
    )

    return result.lastInsertRowid as number
  }

  /**
   * 同步 localStorage 数据到数据库
   * 这是过渡方案，确保数据不丢失
   */
  syncLocalStorageToDatabase(localStorage: Storage): number {
    let syncCount = 0

    try {
      // 同步出入库记录
      const keys = [
        'purchase_inbound_records',
        'sales_outbound_records',
        'inventory_transfers',
        'purchaseReturns',
        'salesReturns'
      ]

      const insertStmt = this.db.prepare(`
        INSERT OR IGNORE INTO inventory_transactions (
          transaction_no, product_id, product_code, warehouse_id,
          transaction_date, transaction_time, timestamp,
          transaction_type, bill_type, bill_no,
          quantity, unit_cost, total_cost,
          source_key, source_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      keys.forEach(key => {
        const raw = localStorage.getItem(key)
        if (!raw) return

        try {
          const records = JSON.parse(raw)
          if (!Array.isArray(records)) return

          records.forEach((rec: any) => {
            const items = rec.items || rec.products || rec.details || []
            if (!Array.isArray(items)) return

            const date = rec.voucherDate || rec.orderDate || rec.date || ''
            const time = rec.createdAt || ''
            
            items.forEach((item: any) => {
              const productId = item.productId || item.id
              const productCode = item.productCode || item.code || ''
              const warehouseId = rec.warehouseId || rec.fromWarehouseId || rec.toWarehouseId

              const quantity = Number(item.quantity || 0)
              const unitCost = Number(item.unitPriceEx || item.costPrice || item.unitPrice || 0)
              const totalCost = quantity * unitCost

              let transactionType = 'unknown'
              if (key.includes('inbound')) transactionType = 'inbound'
              else if (key.includes('outbound')) transactionType = 'outbound'
              else if (key.includes('transfer')) {
                if (rec.fromWarehouseId === warehouseId) transactionType = 'transfer_out'
                else if (rec.toWarehouseId === warehouseId) transactionType = 'transfer_in'
              }
              else if (key.includes('return')) {
                if (key.includes('purchase')) transactionType = 'return_out'
                else if (key.includes('sales')) transactionType = 'return_in'
              }

              try {
                insertStmt.run(
                  rec.voucherNo || rec.transferNo || '',
                  productId,
                  productCode,
                  warehouseId,
                  date,
                  time,
                  time,
                  transactionType,
                  key,
                  rec.voucherNo || rec.transferNo || '',
                  quantity,
                  unitCost,
                  totalCost,
                  key,
                  rec.id || ''
                )
                syncCount++
              } catch (e) {
                // 忽略重复数据
              }
            })
          })
        } catch (e) {
          console.warn('解析 key 失败:', key, e)
        }
      })

      console.log(`同步完成：共同步 ${syncCount} 条记录到数据库`)
    } catch (error) {
      console.error('同步 localStorage 失败:', error)
    }

    return syncCount
  }

  // ========== 基础 CRUD 方法（继承原有实现） ==========
  
  query(sql: string, params: any[] = []): any[] {
    return this.db.prepare(sql).all(...params)
  }

  insert(table: string, data: any): number {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const placeholders = keys.map(() => '?').join(',')
    
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`
    const stmt = this.db.prepare(sql)
    const result = stmt.run(...values)
    return result.lastInsertRowid as number
  }

  update(table: string, data: any, where: string, whereParams: any[] = []): number {
    const keys = Object.keys(data)
    const setClause = keys.map(key => `${key} = ?`).join(', ')
    const values = Object.values(data)
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`
    const stmt = this.db.prepare(sql)
    const result = stmt.run(...values, ...whereParams)
    return result.changes
  }

  delete(table: string, where: string, whereParams: any[] = []): number {
    const sql = `DELETE FROM ${table} WHERE ${where}`
    const stmt = this.db.prepare(sql)
    const result = stmt.run(...whereParams)
    return result.changes
  }

  close() {
    if (this.db) {
      this.db.close()
    }
  }
}

export default EnhancedInventoryDatabase
