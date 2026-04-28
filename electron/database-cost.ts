import Database from 'better-sqlite3'

/**
 * 成本结算数据库模块
 * 负责管理月度成本结转数据
 */
export class CostSettlementDatabase {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
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
      `)

      // 创建索引
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cost_settlements_period 
        ON cost_settlements(period_year, period_month)
      `)

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cost_settlements_product 
        ON cost_settlements(product_code, warehouse_id)
      `)

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cost_settlements_locked 
        ON cost_settlements(is_locked)
      `)

      // 库存快照表（优化功能 1：月末快照机制）
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS inventory_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_code TEXT NOT NULL,
          product_name TEXT,
          warehouse_id INTEGER NOT NULL,
          warehouse_name TEXT,
          snapshot_date TEXT NOT NULL,
          snapshot_year INTEGER NOT NULL,
          snapshot_month INTEGER NOT NULL,
          snapshot_day INTEGER NOT NULL,
          quantity REAL DEFAULT 0,
          cost REAL DEFAULT 0,
          amount REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(product_code, warehouse_id, snapshot_date)
        )
      `)

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_date 
        ON inventory_snapshots(snapshot_year, snapshot_month, snapshot_day)
      `)

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_product 
        ON inventory_snapshots(product_code, warehouse_id)
      `)

      console.log('成本结算表和库存快照表初始化成功')
      return true
    } catch (error) {
      console.error('成本结算表初始化失败:', error)
      return false
    }
  }

  /**
   * 获取指定期间的成本结算数据
   */
  getSettlement(productCode: string, warehouseId: number, year: number, month: number) {
    const stmt = this.db.prepare(`
      SELECT * FROM cost_settlements 
      WHERE product_code = ? 
        AND warehouse_id = ? 
        AND period_year = ? 
        AND period_month = ?
    `)
    return stmt.get(productCode, warehouseId, year, month) as any
  }

  /**
   * 获取指定期间的所有成本结算数据
   */
  getSettlements(year: number, month: number, productCode?: string, warehouseId?: number) {
    let whereClause = 'WHERE cs.period_year = ? AND cs.period_month = ?'
    const params: any[] = [year, month]

    if (productCode) {
      whereClause += ' AND cs.product_code = ?'
      params.push(productCode)
    }

    if (warehouseId) {
      whereClause += ' AND cs.warehouse_id = ?'
      params.push(warehouseId)
    }

    const stmt = this.db.prepare(`
      SELECT 
        cs.*,
        p.spec AS specification,
        p.unit,
        CASE 
          WHEN cs.inbound_qty != 0 THEN ROUND(cs.inbound_cost / cs.inbound_qty, 2)
          ELSE 0 
        END AS inbound_unit_price,
        cs.avg_cost AS closing_unit_price
      FROM cost_settlements cs
      INNER JOIN products p ON cs.product_code = p.code
      ${whereClause}
      ORDER BY cs.warehouse_id, cs.product_code
    `)
    const rows = stmt.all(...params) as any[]

    const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    for (const row of rows) {
      try {
        const taxResult = this.db.prepare(`
          SELECT COALESCE(SUM(
            CASE
              WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.tax_amount
              WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.tax_amount
              ELSE 0
            END
          ), 0) as total_tax
          FROM purchase_inbound_items ii
          JOIN purchase_inbound pi ON ii.inbound_id = pi.id
          WHERE pi.warehouse_id = ?
            AND ii.product_id = (SELECT id FROM products WHERE code = ?)
            AND pi.inbound_date >= ?
            AND pi.inbound_date <= ?
            AND pi.status != 'deleted'
        ` ).get(row.warehouse_id, row.product_code, monthStartStr, monthEndStr) as any
        let totalTax = taxResult?.total_tax || 0

        const returnTaxResult = this.db.prepare(`
          SELECT COALESCE(SUM(
            CASE
              WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.tax_amount * 1.0 * pri.quantity / ii.quantity
              WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.tax_amount * 1.0 * pri.quantity / ii.quantity
              ELSE 0
            END
          ), 0) as return_tax
          FROM purchase_return_items pri
          JOIN purchase_returns pr ON pri.return_id = pr.id
          LEFT JOIN purchase_inbound pi ON pr.original_inbound_no = pi.inbound_no
          LEFT JOIN purchase_inbound_items ii ON pi.id = ii.inbound_id AND pri.product_id = ii.product_id
            AND ii.id = (
              SELECT MIN(ii2.id) FROM purchase_inbound_items ii2
              WHERE ii2.inbound_id = pi.id AND ii2.product_id = pri.product_id
            )
          WHERE pr.warehouse_id = ?
            AND pri.product_id = (SELECT id FROM products WHERE code = ?)
            AND pr.return_date >= ?
            AND pr.return_date <= ?
            AND pr.status != 'deleted'
            AND pri.quantity != 0
            AND ii.quantity > 0
        `).get(row.warehouse_id, row.product_code, monthStartStr, monthEndStr) as any
        totalTax -= (returnTaxResult?.return_tax || 0)

        row.inbound_tax_amount = Number(totalTax.toFixed(2))
      } catch (e) {
        row.inbound_tax_amount = 0
      }

      try {
        const transferInResult = this.db.prepare(`
          SELECT COALESCE(SUM(tri.amount), 0) as total_amount
          FROM transfer_record_items tri
          JOIN transfer_records tr ON tri.transfer_id = tr.id
          WHERE tr.to_warehouse_id = ?
            AND tri.product_id = (SELECT id FROM products WHERE code = ?)
            AND tr.transfer_date >= ?
            AND tr.transfer_date <= ?
            AND tr.status != 'deleted'
        `).get(row.warehouse_id, row.product_code, monthStartStr, monthEndStr) as any
        row.transfer_in_cost = Number(transferInResult?.total_amount || 0)
      } catch (e) {
        row.transfer_in_cost = 0
      }
    }

    return rows
  }

  /**
   * 获取已锁定的成本结算数据
   */
  getLockedSettlement(productCode: string, warehouseId: number, year: number, month: number) {
    const stmt = this.db.prepare(`
      SELECT * FROM cost_settlements 
      WHERE product_code = ? 
        AND warehouse_id = ? 
        AND period_year = ? 
        AND period_month = ?
        AND is_locked = 1
    `)
    return stmt.get(productCode, warehouseId, year, month) as any
  }

  /**
   * 保存成本结算数据
   */
  saveSettlement(settlement: {
    product_code: string
    product_name?: string
    warehouse_id: number
    warehouse_name?: string
    period_year: number
    period_month: number
    opening_qty: number
    opening_cost: number
    inbound_qty: number
    inbound_cost: number
    outbound_qty: number
    outbound_cost: number
    closing_qty: number
    closing_cost: number
    avg_cost: number
    is_locked?: number
  }) {
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
    `)

    return stmt.run({
      ...settlement,
      is_locked: settlement.is_locked || 0
    })
  }

  /**
   * 批量保存成本结算数据
   */
  saveSettlements(settlements: Array<{
    product_code: string
    product_name?: string
    warehouse_id: number
    warehouse_name?: string
    period_year: number
    period_month: number
    opening_qty: number
    opening_cost: number
    inbound_qty: number
    inbound_cost: number
    outbound_qty: number
    outbound_cost: number
    closing_qty: number
    closing_cost: number
    avg_cost: number
    is_locked?: number
  }>) {
    const transaction = this.db.transaction((data) => {
      for (const settlement of data) {
        this.saveSettlement(settlement)
      }
    })

    transaction(settlements)
  }

  /**
   * 锁定指定期间的成本结算数据
   */
  lockSettlement(year: number, month: number) {
    const stmt = this.db.prepare(`
      UPDATE cost_settlements 
      SET is_locked = 1, updated_at = CURRENT_TIMESTAMP
      WHERE period_year = ? AND period_month = ?
    `)
    return stmt.run(year, month)
  }

  /**
   * 解锁指定期间的成本结算数据
   */
  unlockSettlement(year: number, month: number) {
    const stmt = this.db.prepare(`
      UPDATE cost_settlements 
      SET is_locked = 0, updated_at = CURRENT_TIMESTAMP
      WHERE period_year = ? AND period_month = ?
    `)
    return stmt.run(year, month)
  }

  isSettled(year: number, month: number): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM cost_settlements 
      WHERE period_year = ? AND period_month = ? AND is_locked = 1
    `)
    const result = stmt.get(year, month) as any
    return result.count > 0
  }

  hasSettlementData(year: number, month: number): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM cost_settlements 
      WHERE period_year = ? AND period_month = ?
    `)
    const result = stmt.get(year, month) as any
    return result.count > 0
  }

  getSettledPeriods() {
    const stmt = this.db.prepare(`
      SELECT DISTINCT period_year, period_month 
      FROM cost_settlements 
      WHERE is_locked = 1
      ORDER BY period_year DESC, period_month DESC
    `)
    return stmt.all() as Array<{ period_year: number; period_month: number }>
  }

  /**
   * 删除指定期间的成本结算数据
   */
  deleteSettlement(year: number, month: number) {
    const stmt = this.db.prepare(`
      DELETE FROM cost_settlements 
      WHERE period_year = ? AND period_month = ?
    `)
    return stmt.run(year, month)
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
    `)
    return stmt.get() as any
  }

  /**
   * 获取指定产品仓库的所有结算记录
   */
  getProductSettlements(productCode: string, warehouseId: number) {
    const stmt = this.db.prepare(`
      SELECT * FROM cost_settlements 
      WHERE product_code = ? AND warehouse_id = ?
      ORDER BY period_year DESC, period_month DESC
    `)
    return stmt.all(productCode, warehouseId) as any[]
  }

  /**
   * 保存库存快照（优化功能 1：月末快照机制）
   */
  saveSnapshot(
    productCode: string,
    productName: string,
    warehouseId: number,
    warehouseName: string,
    date: string,
    quantity: number,
    cost: number
  ) {
    try {
      const snapshotDate = new Date(date)
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO inventory_snapshots 
        (product_code, product_name, warehouse_id, warehouse_name, 
         snapshot_date, snapshot_year, snapshot_month, snapshot_day,
         quantity, cost, amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      
      stmt.run(
        productCode,
        productName,
        warehouseId,
        warehouseName,
        date,
        snapshotDate.getFullYear(),
        snapshotDate.getMonth() + 1,
        snapshotDate.getDate(),
        quantity,
        cost,
        quantity * cost
      )
      
      return true
    } catch (error) {
      console.error('保存库存快照失败:', error)
      return false
    }
  }

  /**
   * 获取指定日期的库存快照
   */
  getSnapshot(productCode: string, warehouseId: number, date: string) {
    const stmt = this.db.prepare(`
      SELECT * FROM inventory_snapshots 
      WHERE product_code = ? 
        AND warehouse_id = ? 
        AND snapshot_date = ?
    `)
    return stmt.get(productCode, warehouseId, date) as any
  }

  /**
   * 获取指定日期之前的最新快照
   */
  getLatestSnapshotBeforeDate(productCode: string, warehouseId: number, beforeDate: string) {
    const stmt = this.db.prepare(`
      SELECT * FROM inventory_snapshots 
      WHERE product_code = ? 
        AND warehouse_id = ? 
        AND snapshot_date <= ?
      ORDER BY snapshot_date DESC
      LIMIT 1
    `)
    return stmt.get(productCode, warehouseId, beforeDate) as any
  }

  /**
   * 获取月末最后一天的快照
   */
  getMonthEndSnapshot(productCode: string, warehouseId: number, year: number, month: number) {
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    
    const stmt = this.db.prepare(`
      SELECT * FROM inventory_snapshots 
      WHERE product_code = ? 
        AND warehouse_id = ? 
        AND snapshot_year = ? 
        AND snapshot_month = ?
      ORDER BY snapshot_day DESC
      LIMIT 1
    `)
    return stmt.get(productCode, warehouseId, year, month) as any
  }

  saveSalesCostItem(item: {
    doc_type: string
    doc_id: number
    doc_no: string
    product_code: string
    product_name: string
    warehouse_id: number
    warehouse_name: string
    quantity: number
    unit_price: number
    unit_price_ex?: number
    tax_amount?: number
    sales_amount: number
    sales_amount_ex?: number
    cost_unit_price: number
    cost_amount: number
    profit_amount?: number
    period_year?: number
    period_month?: number
    is_locked?: number
    date: string
  }) {
    this.ensureSalesCostTable()
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sales_cost_items (
        doc_type, doc_id, doc_no, product_code, product_name,
        warehouse_id, warehouse_name, quantity, unit_price, unit_price_ex,
        tax_amount, sales_amount, sales_amount_ex, cost_unit_price, cost_amount, profit_amount,
        period_year, period_month, is_locked, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    return stmt.run(
      item.doc_type, item.doc_id, item.doc_no, item.product_code, item.product_name,
      item.warehouse_id, item.warehouse_name, item.quantity, item.unit_price,
      item.unit_price_ex || 0, item.tax_amount || 0,
      item.sales_amount, item.sales_amount_ex || 0,
      item.cost_unit_price, item.cost_amount,
      item.profit_amount || 0,
      item.period_year || 0, item.period_month || 0, item.is_locked || 0,
      item.date
    )
  }

  saveTransferCostItem(item: {
    doc_type: string
    doc_id: number
    doc_no: string
    product_code: string
    product_name: string
    from_warehouse_id: number
    from_warehouse_name: string
    to_warehouse_id: number
    to_warehouse_name: string
    quantity: number
    unit_cost: number
    cost_amount: number
    period_year?: number
    period_month?: number
    is_locked?: number
    date: string
  }) {
    this.ensureTransferCostTable()
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO transfer_cost_items (
        doc_type, doc_id, doc_no, product_code, product_name,
        from_warehouse_id, from_warehouse_name, to_warehouse_id, to_warehouse_name,
        quantity, unit_cost, cost_amount,
        period_year, period_month, is_locked, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    return stmt.run(
      item.doc_type, item.doc_id, item.doc_no, item.product_code, item.product_name,
      item.from_warehouse_id, item.from_warehouse_name, item.to_warehouse_id, item.to_warehouse_name,
      item.quantity, item.unit_cost, item.cost_amount,
      item.period_year || 0, item.period_month || 0, item.is_locked || 0,
      item.date
    )
  }

  getSalesCostSummary(year: number, month: number, productSearch?: string, warehouseId?: number) {
    this.ensureSalesCostTable()
    let sql = `
      SELECT 
        sci.product_code, sci.product_name, sci.warehouse_id, sci.warehouse_name,
        p.spec AS specification,
        p.unit,
        SUM(sci.quantity) as total_qty,
        SUM(sci.sales_amount) as total_sales_amount,
        SUM(sci.sales_amount_ex) as total_sales_amount_ex,
        SUM(sci.tax_amount) as total_tax_amount,
        SUM(sci.cost_amount) as total_cost_amount,
        COUNT(*) as doc_count
      FROM sales_cost_items sci
      LEFT JOIN products p ON sci.product_code = p.code
      WHERE strftime('%Y', sci.date) = ? AND strftime('%m', sci.date) = ?
    `
    const params: any[] = [String(year), String(month).padStart(2, '0')]
    
    if (productSearch) {
      sql += ` AND (sci.product_code LIKE ? OR sci.product_name LIKE ?)`
      params.push(`%${productSearch}%`, `%${productSearch}%`)
    }
    if (warehouseId) {
      sql += ` AND sci.warehouse_id = ?`
      params.push(warehouseId)
    }
    
    sql += ` GROUP BY sci.product_code, sci.warehouse_id`
    
    return this.db.prepare(sql).all(...params) as any[]
  }

  getTransferCostSummary(year: number, month: number, productSearch?: string) {
    this.ensureTransferCostTable()
    let sql = `
      SELECT 
        product_code, product_name,
        from_warehouse_id, from_warehouse_name,
        to_warehouse_id, to_warehouse_name,
        SUM(quantity) as total_qty,
        SUM(cost_amount) as total_cost_amount,
        COUNT(*) as doc_count
      FROM transfer_cost_items
      WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?
    `
    const params: any[] = [String(year), String(month).padStart(2, '0')]
    
    if (productSearch) {
      sql += ` AND (product_code LIKE ? OR product_name LIKE ?)`
      params.push(`%${productSearch}%`, `%${productSearch}%`)
    }
    
    sql += ` GROUP BY product_code, from_warehouse_id, to_warehouse_id`
    
    return this.db.prepare(sql).all(...params) as any[]
  }

  getTransactionDetails(year: number, month: number, productSearch?: string, warehouseId?: number) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    let whereClause = 'WHERE pi.inbound_date >= ? AND pi.inbound_date < ? AND pi.status != \'deleted\''
    const params: any[] = [monthStart, monthEnd]

    if (productSearch) {
      whereClause += ' AND (p.code LIKE ? OR p.name LIKE ?)'
      params.push(`%${productSearch}%`, `%${productSearch}%`)
    }
    if (warehouseId) {
      whereClause += ' AND pi.warehouse_id = ?'
      params.push(warehouseId)
    }

    const inboundItems = this.db.prepare(`
      SELECT ii.*, pi.inbound_no, pi.inbound_date, p.code as product_code, p.name as product_name,
             w.name as warehouse_name, s.name as supplier_name,
             'purchase_inbound' as doc_type
      FROM purchase_inbound_items ii
      INNER JOIN purchase_inbound pi ON ii.inbound_id = pi.id
      INNER JOIN products p ON ii.product_id = p.id
      LEFT JOIN warehouses w ON pi.warehouse_id = w.id
      LEFT JOIN suppliers s ON pi.supplier_id = s.id
      ${whereClause}
      ORDER BY pi.inbound_date
    `).all(...params) as any[]

    whereClause = 'WHERE so.outbound_date >= ? AND so.outbound_date < ? AND so.status != \'deleted\''
    params.length = 0
    params.push(monthStart, monthEnd)

    if (productSearch) {
      whereClause += ' AND (p.code LIKE ? OR p.name LIKE ?)'
      params.push(`%${productSearch}%`, `%${productSearch}%`)
    }
    if (warehouseId) {
      whereClause += ' AND so.warehouse_id = ?'
      params.push(warehouseId)
    }

    const outboundItems = this.db.prepare(`
      SELECT oi.*, so.outbound_no, so.outbound_date, p.code as product_code, p.name as product_name,
             w.name as warehouse_name, c.name as customer_name,
             'sales_outbound' as doc_type
      FROM sales_outbound_items oi
      INNER JOIN sales_outbound so ON oi.outbound_id = so.id
      INNER JOIN products p ON oi.product_id = p.id
      LEFT JOIN warehouses w ON so.warehouse_id = w.id
      LEFT JOIN customers c ON so.customer_id = c.id
      ${whereClause}
      ORDER BY so.outbound_date
    `).all(...params) as any[]

    return [...inboundItems, ...outboundItems]
  }

  getProductDetailLedger(params: any) {
    const { productCode, warehouseId, year, month, startDate, endDate } = params
    console.log('[DB] getProductDetailLedger 调用参数:', params)
    
    let monthStart: string
    let monthEnd: string
    
    if (startDate && endDate) {
      monthStart = startDate
      monthEnd = endDate
      if (!monthEnd.includes('T') && monthEnd.length === 10) {
        const endDateObj = new Date(monthEnd)
        endDateObj.setDate(endDateObj.getDate() + 1)
        monthEnd = endDateObj.toISOString().split('T')[0]
      }
    } else if (year && month) {
      monthStart = `${year}-${String(month).padStart(2, '0')}-01`
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    } else {
      console.log('[DB] 缺少日期参数')
      return []
    }

    const product = this.db.prepare('SELECT id FROM products WHERE code = ?').get(productCode) as any
    if (!product) {
      console.log('[DB] 产品不存在:', productCode)
      return []
    }
    const productId = product.id
    console.log('[DB] 产品 ID:', productId)

    const effectiveYear = year || parseInt(monthStart.substring(0, 4))
    const effectiveMonth = month || parseInt(monthStart.substring(5, 7))
    
    const settlement = this.getSettlement(productCode, warehouseId, effectiveYear, effectiveMonth)
    console.log('[DB] 结算数据:', settlement ? '找到' : '未找到')

    // 辅助函数：构建退货备注
    const buildReturnRemark = (existingRemark: string, originalDocNo: string, docType: string) => {
      const parts = []
      if (existingRemark) {
        parts.push(existingRemark)
      }
      if (originalDocNo) {
        parts.push(`对应${docType}单号：${originalDocNo}`)
      }
      return parts.join('；') || ''
    }

    const items: any[] = []
    
    // 添加期初数据
    if (settlement) {
      items.push({
        date: monthStart,
        docNo: '期初',
        type: 'opening',
        direction: '',
        inboundQty: 0,
        inboundPrice: 0,
        inboundAmount: 0,
        outboundQty: 0,
        outboundPrice: 0,
        outboundAmount: 0,
        balanceQty: settlement.opening_qty,
        balanceAmount: settlement.opening_cost,
        balanceUnitPrice: settlement.opening_qty > 0 ? settlement.opening_cost / settlement.opening_qty : 0
      })
    }

    // 1. 获取入库单数据（采购入库）
    // 规则：当提取不含税单价时，金额也使用不含税金额；当提取含税单价时，金额也使用含税金额
    const purchaseInboundSql = `
      SELECT 
        pi.inbound_date as date,
        pi.inbound_no as docNo,
        ii.quantity as qty,
        CASE 
          WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.unit_price_ex
          WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.unit_price_ex
          ELSE ii.unit_price
        END as unit_price,
        CASE 
          WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.total_amount_ex
          WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.total_amount_ex
          ELSE ii.total_amount
        END as amount,
        CASE 
          WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.tax_amount
          WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.tax_amount
          ELSE 0
        END as tax_amount,
        COALESCE(ii.remark, pi.remark, '') as remark,
        'purchase_inbound' as type
      FROM purchase_inbound_items ii
      JOIN purchase_inbound pi ON ii.inbound_id = pi.id
      WHERE pi.warehouse_id = ?
        AND pi.inbound_date >= ?
        AND pi.inbound_date < ?
        AND ii.product_id = ?
        AND pi.status != 'deleted'
      ORDER BY pi.inbound_date, pi.id
    `
    const purchaseInboundItems = this.db.prepare(purchaseInboundSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]

    // 2. 获取采购退货单数据（作为入库的负数）
    // 应用与采购入库完全相同的单价提取规则，当无法关联原入库单时使用退货单自身价格回退
    const purchaseReturnSql = `
      SELECT 
        pr.return_date as date,
        pr.return_no as docNo,
        pri.quantity as qty,
        pri.unit_price as return_unit_price,
        pri.unit_price_ex as return_unit_price_ex,
        pri.total_amount as return_total_amount,
        pri.total_amount_ex as return_total_amount_ex,
        pr.invoice_type as return_invoice_type,
        pr.invoice_issued as return_invoice_issued,
        pri.tax_rate as return_tax_rate,
        pri.allow_deduction as return_allow_deduction,
        CASE 
          WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.unit_price_ex
          WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.unit_price_ex
          ELSE ii.unit_price
        END as unit_price,
        CASE 
          WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.total_amount_ex
          WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.total_amount_ex
          ELSE ii.total_amount
        END as amount,
        CASE 
          WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.tax_amount
          WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.tax_amount
          ELSE 0
        END as tax_amount,
        ii.quantity as original_qty,
        COALESCE(pri.remark, pr.remark, '') as remark,
        COALESCE(pi.inbound_no, '') as original_inbound_no,
        'purchase_return' as type
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pri.return_id = pr.id
      LEFT JOIN purchase_inbound pi ON pr.original_inbound_no = pi.inbound_no
      LEFT JOIN purchase_inbound_items ii ON pi.id = ii.inbound_id AND pri.product_id = ii.product_id
        AND ii.id = (
          SELECT MIN(ii2.id) FROM purchase_inbound_items ii2 
          WHERE ii2.inbound_id = pi.id AND ii2.product_id = pri.product_id
        )
      WHERE pr.warehouse_id = ?
        AND pr.return_date >= ?
        AND pr.return_date < ?
        AND pri.product_id = ?
        AND pr.status != 'deleted'
        AND pri.quantity != 0
      ORDER BY pr.return_date, pr.id
    `
    const purchaseReturnItems = this.db.prepare(purchaseReturnSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]
    
    console.log('[采购退货数据] 共', purchaseReturnItems.length, '条')

    // 5. 获取调拨出库数据
    const transferOutSql = `
      SELECT
        tr.transfer_date as date,
        tr.transfer_no as docNo,
        tri.quantity as qty,
        tri.cost as unit_price,
        tri.amount,
        COALESCE(tr.remark, '') as remark,
        'transfer_out' as type
      FROM transfer_record_items tri
      JOIN transfer_records tr ON tri.transfer_id = tr.id
      WHERE tr.from_warehouse_id = ?
        AND tr.transfer_date >= ?
        AND tr.transfer_date < ?
        AND tri.product_id = ?
        AND tr.status != 'deleted'
      ORDER BY tr.transfer_date, tr.id
    `
    const transferOutItems = this.db.prepare(transferOutSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]

    // 6. 获取调拨入库数据
    const transferInSql = `
      SELECT
        tr.transfer_date as date,
        tr.transfer_no as docNo,
        tri.quantity as qty,
        tri.cost as unit_price,
        tri.amount,
        COALESCE(tr.remark, '') as remark,
        'transfer_in' as type
      FROM transfer_record_items tri
      JOIN transfer_records tr ON tri.transfer_id = tr.id
      WHERE tr.to_warehouse_id = ?
        AND tr.transfer_date >= ?
        AND tr.transfer_date < ?
        AND tri.product_id = ?
        AND tr.status != 'deleted'
      ORDER BY tr.transfer_date, tr.id
    `
    const transferInItems = this.db.prepare(transferInSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]

    // 合并入库和采购退货、调拨入库，按日期排序
    const inboundTransactions = [
      ...purchaseInboundItems.map(item => ({
        date: item.date,
        docNo: item.docNo,
        type: item.type,
        direction: 'in' as const,
        inboundQty: Number(item.qty || 0),
        inboundPrice: Number(item.unit_price || (Number(item.qty || 0) !== 0 ? Number(item.amount || 0) / Number(item.qty || 0) : 0)),
        inboundAmount: Number(item.amount || 0),
        inboundTaxAmount: Number(item.tax_amount || 0),
        remark: item.remark || '',
        outboundQty: 0,
        outboundPrice: 0,
        outboundAmount: 0
      })),
      ...purchaseReturnItems.map(item => {
        let unitPrice = Number(item.unit_price || 0)
        if (unitPrice === 0) {
          const retIsSpecialInvoice = (item.return_invoice_type === '专票' || item.return_invoice_type === '专用发票')
          const retIsInvoiceIssued = item.return_invoice_issued === 1 || item.return_invoice_issued === true
          const retIsTaxExempt = (Number(item.return_tax_rate || 0) === 0)
          const retIsDeductionAllowed = item.return_allow_deduction === 1 || item.return_allow_deduction === true
          const useExPrice = (retIsSpecialInvoice && retIsInvoiceIssued) || (retIsInvoiceIssued && retIsTaxExempt && retIsDeductionAllowed)
          unitPrice = useExPrice
            ? Number(item.return_unit_price_ex || 0)
            : Number(item.return_unit_price || 0)
        }
        const qty = -Math.abs(Number(item.qty || 0))
        let amount = qty * unitPrice
        if (amount === 0 && unitPrice === 0) {
          const retIsSpecialInvoice2 = (item.return_invoice_type === '专票' || item.return_invoice_type === '专用发票')
          const retIsInvoiceIssued2 = item.return_invoice_issued === 1 || item.return_invoice_issued === true
          const retIsTaxExempt2 = (Number(item.return_tax_rate || 0) === 0)
          const retIsDeductionAllowed2 = item.return_allow_deduction === 1 || item.return_allow_deduction === true
          const useExPrice2 = (retIsSpecialInvoice2 && retIsInvoiceIssued2) || (retIsInvoiceIssued2 && retIsTaxExempt2 && retIsDeductionAllowed2)
          const fallbackAmount = useExPrice2
            ? Number(item.return_total_amount_ex || 0)
            : Number(item.return_total_amount || 0)
          if (fallbackAmount > 0) {
            amount = -fallbackAmount
            unitPrice = Math.abs(fallbackAmount / (Math.abs(qty) || 1))
          }
        }
        const originalQty = Number(item.original_qty || 0)
        const returnQty = Math.abs(Number(item.qty || 0))
        const fullTaxAmount = Number(item.tax_amount || 0)
        const taxAmount = (originalQty > 0 && returnQty > 0) ? fullTaxAmount * (returnQty / originalQty) : fullTaxAmount

        return {
          date: item.date,
          docNo: item.docNo,
          type: item.type,
          direction: 'in' as const,
          inboundQty: qty,
          inboundPrice: unitPrice,
          inboundAmount: amount,
          inboundTaxAmount: -Number(taxAmount.toFixed(2)),
          remark: buildReturnRemark(item.remark, item.original_inbound_no, '入库'),
          outboundQty: 0,
          outboundPrice: 0,
          outboundAmount: 0
        }
      }),
      ...transferInItems.map(item => ({
        date: item.date,
        docNo: item.docNo,
        type: item.type,
        direction: 'in' as const,
        inboundQty: Number(item.qty || 0),
        inboundPrice: Number(item.unit_price || 0),
        inboundAmount: Number(item.amount || 0),
        inboundTaxAmount: 0,
        remark: item.remark || '',
        outboundQty: 0,
        outboundPrice: 0,
        outboundAmount: 0
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // 3. 获取销售出库单数据
    const salesOutboundSql = `
      SELECT 
        so.outbound_date as date,
        so.outbound_no as docNo,
        oi.quantity as qty,
        oi.cost_price as unit_price,
        COALESCE(oi.remark, so.remark, '') as remark,
        'sales_outbound' as type
      FROM sales_outbound_items oi
      JOIN sales_outbound so ON oi.outbound_id = so.id
      WHERE so.warehouse_id = ?
        AND so.outbound_date >= ?
        AND so.outbound_date < ?
        AND oi.product_id = ?
        AND so.status != 'deleted'
      ORDER BY so.outbound_date, so.id
    `
    const salesOutboundItems = this.db.prepare(salesOutboundSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]

    // 4. 获取销售退货单数据（作为出库的负数）
    const salesReturnSql = `
      SELECT 
        sr.return_date as date,
        sr.return_no as docNo,
        sri.quantity as qty,
        sri.cost_price as unit_price,
        COALESCE(sri.remark, sr.remark, '') as remark,
        COALESCE(sr.original_order_no, '') as original_outbound_no,
        'sales_return' as type
      FROM sales_return_items sri
      JOIN sales_returns sr ON sri.return_id = sr.id
      WHERE sr.warehouse_id = ?
        AND sr.return_date >= ?
        AND sr.return_date < ?
        AND sri.product_id = ?
        AND sr.status != 'deleted'
      ORDER BY sr.return_date, sr.id
    `
    const salesReturnItems = this.db.prepare(salesReturnSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]

    // 合并出库和销售退货、调拨出库，按日期排序
    const outboundTransactions = [
      ...salesOutboundItems.map(item => ({
        date: item.date,
        docNo: item.docNo,
        type: item.type,
        direction: 'out' as const,
        inboundQty: 0,
        inboundPrice: 0,
        inboundAmount: 0,
        remark: item.remark || '',
        outboundQty: Number(item.qty || 0),
        outboundPrice: Number(item.unit_price || 0),
        outboundAmount: 0
      })),
      ...salesReturnItems.map(item => ({
        date: item.date,
        docNo: item.docNo,
        type: item.type,
        direction: 'out' as const,
        inboundQty: 0,
        inboundPrice: 0,
        inboundAmount: 0,
        remark: buildReturnRemark(item.remark, item.original_outbound_no, '出库'),
        outboundQty: -Math.abs(Number(item.qty || 0)),
        outboundPrice: Number(item.unit_price || 0),
        outboundAmount: 0
      })),
      ...transferOutItems.map(item => ({
        date: item.date,
        docNo: item.docNo,
        type: item.type,
        direction: 'out' as const,
        inboundQty: 0,
        inboundPrice: 0,
        inboundAmount: 0,
        remark: item.remark || '',
        outboundQty: Number(item.qty || 0),
        outboundPrice: Number(item.unit_price || 0),
        outboundAmount: Number(item.amount || 0)
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // 计算库存结余
    let runningQty = settlement?.opening_qty || 0
    let runningCost = settlement?.opening_cost || 0
    let lastValidUnitPrice = (runningQty > 0 && runningCost > 0) ? (runningCost / runningQty) : 0

    // 先添加所有入库交易
    for (const tx of inboundTransactions) {
      runningQty += tx.inboundQty
      runningCost += tx.inboundAmount

      const currentUnitPrice = runningQty > 0 ? runningCost / runningQty : 0
      if (currentUnitPrice > 0) lastValidUnitPrice = currentUnitPrice

      items.push({
        ...tx,
        balanceQty: runningQty,
        balanceAmount: runningCost,
        balanceUnitPrice: currentUnitPrice
      })
    }

    // 再添加所有出库交易
    // 规则：
    // - 销售出库/销售退货：使用出库前的库存结余单价（加权平均单价），为0时回溯最近有效单价
    // - 调拨出库：使用调拨单自身保存的成本价（tri.cost），因为调拨单创建时已取当时的实时单价
    for (const tx of outboundTransactions) {
      const isTransferOut = tx.type === 'transfer_out'
      let outboundPrice: number
      let costAmount: number

      if (isTransferOut) {
        outboundPrice = tx.outboundPrice || 0
        costAmount = tx.outboundAmount || 0
      } else {
        outboundPrice = runningQty > 0 ? (runningCost / runningQty) : lastValidUnitPrice
        costAmount = Math.abs(tx.outboundQty) * outboundPrice
      }

      runningQty -= tx.outboundQty
      if (isTransferOut) {
        runningCost -= costAmount
      } else {
        runningCost -= tx.outboundQty > 0 ? costAmount : -costAmount
      }

      const balanceUnitPrice = runningQty > 0 ? (runningCost / runningQty) : 0
      if (balanceUnitPrice > 0) lastValidUnitPrice = balanceUnitPrice

      items.push({
        ...tx,
        outboundPrice: outboundPrice,
        outboundAmount: tx.outboundQty > 0 ? costAmount : -costAmount,
        balanceQty: runningQty,
        balanceAmount: runningCost,
        balanceUnitPrice: balanceUnitPrice
      })
    }

    // 添加本月合计数据
    if (settlement) {
      let monthInQty = 0
      let monthInAmt = 0
      let monthInTax = 0
      let monthOutQty = 0
      let monthOutAmt = 0
      
      for (const item of items) {
        if (item.type === 'purchase_inbound' || item.type === 'purchase_return' || item.type === 'transfer_in') {
          monthInQty += item.inboundQty || 0
          monthInAmt += item.inboundAmount || 0
          monthInTax += item.inboundTaxAmount || 0
        }
        if (item.type === 'sales_outbound' || item.type === 'sales_return' || item.type === 'transfer_out') {
          monthOutQty += item.outboundQty || 0
          monthOutAmt += item.outboundAmount || 0
        }
      }
      
      const monthAvgPrice = (monthInQty + monthOutQty) > 0 ? ((monthInAmt + Math.abs(monthOutAmt)) / (monthInQty + monthOutQty)) : 0
      
      items.push({
        date: `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}`,
        docNo: '本月合计',
        type: 'monthly',
        direction: '',
        inboundQty: Number(monthInQty.toFixed(4)),
        inboundPrice: Number(monthInQty !== 0 ? (monthInAmt / monthInQty).toFixed(2) : 0),
        inboundTaxAmount: Number(monthInTax.toFixed(2)),
        inboundAmount: Number(monthInAmt.toFixed(2)),
        outboundQty: Number(monthOutQty.toFixed(4)),
        outboundPrice: Number(monthOutQty !== 0 ? (monthOutAmt / monthOutQty).toFixed(2) : 0),
        outboundAmount: Number(monthOutAmt.toFixed(2)),
        balanceQty: null,
        balanceAmount: null,
        balanceUnitPrice: null,
        remark: ''
      })
      
      let yearInQty = 0
      let yearInAmt = 0
      let yearInTax = 0
      let yearOutQty = 0
      let yearOutAmt = 0
      
      for (let m = 1; m <= effectiveMonth; m++) {
        const prevSettlement = this.getSettlement(productCode, warehouseId, effectiveYear, m)
        if (prevSettlement) {
          yearInQty += prevSettlement.inbound_qty || 0
          yearInAmt += prevSettlement.inbound_cost || 0
          yearOutQty += prevSettlement.outbound_qty || 0
          yearOutAmt += prevSettlement.outbound_cost || 0
        }
        
        const mStart = `${effectiveYear}-${String(m).padStart(2, '0')}-01`
        const mNext = m === 12 ? `${effectiveYear + 1}-01-01` : `${effectiveYear}-${String(m + 1).padStart(2, '0')}-01`
        try {
          const taxResult = this.db.prepare(`
            SELECT COALESCE(SUM(
              CASE
                WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.tax_amount
                WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.tax_amount
                ELSE 0
              END
            ), 0) as total_tax
            FROM purchase_inbound_items ii
            JOIN purchase_inbound pi ON ii.inbound_id = pi.id
            WHERE pi.warehouse_id = ?
              AND ii.product_id = ?
              AND pi.inbound_date >= ?
              AND pi.inbound_date < ?
              AND pi.status != 'deleted'
          `).get(warehouseId, productId, mStart, mNext) as any
          let monthTax = taxResult?.total_tax || 0

          const returnTaxResult = this.db.prepare(`
            SELECT COALESCE(SUM(
              CASE
                WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.tax_amount * 1.0 * pri.quantity / ii.quantity
                WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.tax_amount * 1.0 * pri.quantity / ii.quantity
                ELSE 0
              END
            ), 0) as return_tax
            FROM purchase_return_items pri
            JOIN purchase_returns pr ON pri.return_id = pr.id
            LEFT JOIN purchase_inbound pi ON pr.original_inbound_no = pi.inbound_no
            LEFT JOIN purchase_inbound_items ii ON pi.id = ii.inbound_id AND pri.product_id = ii.product_id
              AND ii.id = (
                SELECT MIN(ii2.id) FROM purchase_inbound_items ii2
                WHERE ii2.inbound_id = pi.id AND ii2.product_id = pri.product_id
              )
            WHERE pr.warehouse_id = ?
              AND pri.product_id = ?
              AND pr.return_date >= ?
              AND pr.return_date < ?
              AND pr.status != 'deleted'
              AND pri.quantity != 0
              AND ii.quantity > 0
          `).get(warehouseId, productId, mStart, mNext) as any
          monthTax -= (returnTaxResult?.return_tax || 0)

          yearInTax += monthTax
        } catch (e) {}
      }
      
      const yearAvgPrice = (yearInQty + Math.abs(yearOutQty)) > 0 ? ((yearInAmt + Math.abs(yearOutAmt)) / (yearInQty + Math.abs(yearOutQty))) : 0
      
      items.push({
        date: `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}`,
        docNo: '本年累计',
        type: 'yearly',
        direction: '',
        inboundQty: Number(yearInQty.toFixed(4)),
        inboundPrice: Number(yearInQty !== 0 ? (yearInAmt / yearInQty).toFixed(2) : 0),
        inboundTaxAmount: Number(yearInTax.toFixed(2)),
        inboundAmount: Number(yearInAmt.toFixed(2)),
        outboundQty: Number(yearOutQty.toFixed(4)),
        outboundPrice: Number(yearOutQty !== 0 ? (yearOutAmt / yearOutQty).toFixed(2) : 0),
        outboundAmount: Number(yearOutAmt.toFixed(2)),
        balanceQty: null,
        balanceAmount: null,
        balanceUnitPrice: null,
        remark: ''
      })
    }

    console.log('[DB] getProductDetailLedger 返回数据:', items.length, '条')
    return items
  }

  deleteSalesCostSummary(year: number, month: number) {
    try {
      this.db.exec(`DROP TABLE IF EXISTS sales_cost_items`)
      return true
    } catch (e) {
      return false
    }
  }

  deleteTransferCostSummary(year: number, month: number) {
    try {
      this.db.exec(`DROP TABLE IF EXISTS transfer_cost_items`)
      return true
    } catch (e) {
      return false
    }
  }

  deleteSalesCostItemsByPeriod(year: number, month: number) {
    const stmt = this.db.prepare(`
      DELETE FROM sales_cost_items 
      WHERE period_year = ? AND period_month = ?
    `)
    const result = stmt.run(year, month)
    return result.changes
  }

  deleteTransferCostItemsByPeriod(year: number, month: number) {
    const stmt = this.db.prepare(`
      DELETE FROM transfer_cost_items 
      WHERE period_year = ? AND period_month = ?
    `)
    const result = stmt.run(year, month)
    return result.changes
  }

  private ensureSalesCostTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_cost_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_type TEXT,
        doc_id INTEGER,
        doc_no TEXT,
        product_code TEXT,
        product_name TEXT,
        warehouse_id INTEGER,
        warehouse_name TEXT,
        quantity REAL DEFAULT 0,
        unit_price REAL DEFAULT 0,
        unit_price_ex REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        sales_amount REAL DEFAULT 0,
        sales_amount_ex REAL DEFAULT 0,
        cost_unit_price REAL DEFAULT 0,
        cost_amount REAL DEFAULT 0,
        profit_amount REAL DEFAULT 0,
        period_year INTEGER,
        period_month INTEGER,
        is_locked INTEGER DEFAULT 0,
        date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    try { this.db.exec(`ALTER TABLE sales_cost_items ADD COLUMN unit_price_ex REAL DEFAULT 0`) } catch (e) {}
    try { this.db.exec(`ALTER TABLE sales_cost_items ADD COLUMN tax_amount REAL DEFAULT 0`) } catch (e) {}
    try { this.db.exec(`ALTER TABLE sales_cost_items ADD COLUMN sales_amount_ex REAL DEFAULT 0`) } catch (e) {}
  }

  private ensureTransferCostTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transfer_cost_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_type TEXT,
        doc_id INTEGER,
        doc_no TEXT,
        product_code TEXT,
        product_name TEXT,
        from_warehouse_id INTEGER,
        from_warehouse_name TEXT,
        to_warehouse_id INTEGER,
        to_warehouse_name TEXT,
        quantity REAL DEFAULT 0,
        unit_cost REAL DEFAULT 0,
        cost_amount REAL DEFAULT 0,
        period_year INTEGER,
        period_month INTEGER,
        is_locked INTEGER DEFAULT 0,
        date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  checkSettlementExists(year: number, month: number): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM cost_settlements
      WHERE period_year = ? AND period_month = ?
    `)
    const result = stmt.get(year, month) as any
    return (result?.cnt || 0) > 0
  }

  getSettlementsByDateRange(startDate: string, endDate: string, productSearch?: string, warehouseId?: number) {
    const startYear = parseInt(startDate.substring(0, 4))
    const startMonth = parseInt(startDate.substring(5, 7))
    const endYear = parseInt(endDate.substring(0, 4))
    const endMonth = parseInt(endDate.substring(5, 7))

    let prevYear = startYear
    let prevMonth = startMonth - 1
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear = startYear - 1
    }

    let whereClause = "WHERE cs.period_year || '-' || printf('%02d', cs.period_month) >= ? AND cs.period_year || '-' || printf('%02d', cs.period_month) <= ?"
    const params: any[] = [startDate.substring(0, 7), endDate.substring(0, 7)]

    if (productSearch) {
      whereClause += ' AND (cs.product_code LIKE ? OR cs.product_name LIKE ?)'
      params.push(`%${productSearch}%`, `%${productSearch}%`)
    }
    if (warehouseId) {
      whereClause += ' AND cs.warehouse_id = ?'
      params.push(warehouseId)
    }

    const stmt = this.db.prepare(`
      SELECT 
        cs.product_code,
        cs.product_name,
        cs.warehouse_id,
        cs.warehouse_name,
        SUM(cs.opening_qty) as opening_qty,
        SUM(cs.opening_cost) as opening_cost,
        SUM(cs.inbound_qty) as inbound_qty,
        SUM(cs.inbound_cost) as inbound_cost,
        SUM(cs.outbound_qty) as outbound_qty,
        SUM(cs.outbound_cost) as outbound_cost,
        SUM(cs.closing_qty) as closing_qty,
        SUM(cs.closing_cost) as closing_cost,
        p.spec AS specification,
        p.unit
      FROM cost_settlements cs
      INNER JOIN products p ON cs.product_code = p.code
      ${whereClause}
      GROUP BY cs.product_code, cs.warehouse_id
      ORDER BY cs.warehouse_id, cs.product_code
    `)
    const rows = stmt.all(...params) as any[]

    const result: any[] = []

    for (const row of rows) {
      const openingData = this.getSettlement(row.product_code, row.warehouse_id, prevYear, prevMonth)
      const closingData = this.getSettlement(row.product_code, row.warehouse_id, endYear, endMonth)

      const totalInboundQty = Number(row.inbound_qty || 0)
      const totalInboundCost = Number(row.inbound_cost || 0)
      const totalOutboundQty = Number(row.outbound_qty || 0)
      const totalOutboundCost = Number(row.outbound_cost || 0)
      const openingQty = Number(openingData?.closing_qty || 0)
      const openingCost = Number(openingData?.closing_cost || 0)
      const closingQty = Number(closingData?.closing_qty || 0)
      const closingCost = Number(closingData?.closing_cost || 0)
      const availableQty = openingQty + totalInboundQty
      const availableCost = openingCost + totalInboundCost
      const avgCost = availableQty > 0 ? Number((availableCost / availableQty).toFixed(6)) : 0

      let totalTaxAmount = 0
      let totalTransferInCost = 0

      try {
        const taxResult = this.db.prepare(`
          SELECT COALESCE(SUM(
            CASE
              WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.tax_amount
              WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.tax_amount
              ELSE 0
            END
          ), 0) as total_tax
          FROM purchase_inbound_items ii
          JOIN purchase_inbound pi ON ii.inbound_id = pi.id
          WHERE pi.warehouse_id = ?
            AND ii.product_id = (SELECT id FROM products WHERE code = ?)
            AND pi.inbound_date >= ?
            AND pi.inbound_date <= ?
            AND pi.status != 'deleted'
        `).get(row.warehouse_id, row.product_code, startDate, endDate) as any
        totalTaxAmount = Number(taxResult?.total_tax || 0)

        const returnTaxResult = this.db.prepare(`
          SELECT COALESCE(SUM(
            CASE
              WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.tax_amount * 1.0 * pri.quantity / ii.quantity
              WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.tax_amount * 1.0 * pri.quantity / ii.quantity
              ELSE 0
            END
          ), 0) as return_tax
          FROM purchase_return_items pri
          JOIN purchase_returns pr ON pri.return_id = pr.id
          LEFT JOIN purchase_inbound pi ON pr.original_inbound_no = pi.inbound_no
          LEFT JOIN purchase_inbound_items ii ON pi.id = ii.inbound_id AND pri.product_id = ii.product_id
            AND ii.id = (
              SELECT MIN(ii2.id) FROM purchase_inbound_items ii2
              WHERE ii2.inbound_id = pi.id AND ii2.product_id = pri.product_id
            )
          WHERE pr.warehouse_id = ?
            AND pri.product_id = (SELECT id FROM products WHERE code = ?)
            AND pr.return_date >= ?
            AND pr.return_date <= ?
            AND pr.status != 'deleted'
            AND pri.quantity != 0
            AND ii.quantity > 0
        `).get(row.warehouse_id, row.product_code, startDate, endDate) as any
        totalTaxAmount -= Number(returnTaxResult?.return_tax || 0)

        const transferInResult = this.db.prepare(`
          SELECT COALESCE(SUM(tri.amount), 0) as total_amount
          FROM transfer_record_items tri
          JOIN transfer_records tr ON tri.transfer_id = tr.id
          WHERE tr.to_warehouse_id = ?
            AND tri.product_id = (SELECT id FROM products WHERE code = ?)
            AND tr.transfer_date >= ?
            AND tr.transfer_date <= ?
            AND tr.status != 'deleted'
        `).get(row.warehouse_id, row.product_code, startDate, endDate) as any
        totalTransferInCost = Number(transferInResult?.total_amount || 0)
      } catch (e) {
        totalTaxAmount = 0
        totalTransferInCost = 0
      }

      result.push({
        product_code: row.product_code,
        product_name: row.product_name,
        productCode: row.product_code,
        productName: row.product_name,
        specification: row.specification || '',
        unit: row.unit || '',
        warehouse_id: row.warehouse_id,
        warehouseName: row.warehouse_name,
        openingQty: openingQty,
        openingCost: openingCost,
        inboundQty: totalInboundQty,
        inboundUnitPrice: totalInboundQty > 0 ? Number((totalInboundCost / totalInboundQty).toFixed(2)) : 0,
        inboundTaxAmount: Number(totalTaxAmount.toFixed(2)),
        inboundCost: totalInboundCost,
        transferInCost: totalTransferInCost,
        outboundQty: totalOutboundQty,
        outboundCost: totalOutboundCost,
        avgCost: avgCost,
        avgPrice: avgCost,
        closingQty: closingQty,
        closingUnitPrice: closingQty > 0 ? Number((closingCost / closingQty).toFixed(2)) : 0,
        closingCost: closingCost,
        period_year: endYear,
        period_month: endMonth
      })
    }

    return result
  }

  getSalesCostSummaryByDateRange(startDate: string, endDate: string, productSearch?: string, warehouseId?: number) {
    this.ensureSalesCostTable()
    let sql = `
      SELECT 
        sci.product_code, sci.product_name, sci.warehouse_id, sci.warehouse_name,
        p.spec AS specification,
        p.unit,
        SUM(sci.quantity) as total_qty,
        SUM(sci.sales_amount) as total_sales_amount,
        SUM(sci.sales_amount_ex) as total_sales_amount_ex,
        SUM(sci.tax_amount) as total_tax_amount,
        SUM(sci.cost_amount) as total_cost_amount,
        COUNT(*) as doc_count
      FROM sales_cost_items sci
      LEFT JOIN products p ON sci.product_code = p.code
      WHERE sci.date >= ? AND sci.date < ?
    `
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const endDateNext = nextDay.toISOString().split('T')[0]
    const params: any[] = [startDate, endDateNext]
    
    if (productSearch) {
      sql += ` AND (sci.product_code LIKE ? OR sci.product_name LIKE ?)`
      params.push(`%${productSearch}%`, `%${productSearch}%`)
    }
    if (warehouseId) {
      sql += ` AND sci.warehouse_id = ?`
      params.push(warehouseId)
    }
    
    sql += ` GROUP BY sci.product_code, sci.warehouse_id`
    
    return this.db.prepare(sql).all(...params) as any[]
  }

  getSalesCostDetailByDateRange(startDate: string, endDate: string, productCode?: string, warehouseId?: number) {
    this.ensureSalesCostTable()
    let sql = `
      SELECT sci.*, p.spec AS specification, p.unit
      FROM sales_cost_items sci
      LEFT JOIN products p ON sci.product_code = p.code
      WHERE sci.date >= ? AND sci.date < ?
    `
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const endDateNext = nextDay.toISOString().split('T')[0]
    const params: any[] = [startDate, endDateNext]
    
    if (productCode) {
      sql += ` AND sci.product_code = ?`
      params.push(productCode)
    }
    if (warehouseId) {
      sql += ` AND sci.warehouse_id = ?`
      params.push(warehouseId)
    }
    
    sql += ` ORDER BY sci.date, sci.doc_no`
    
    return this.db.prepare(sql).all(...params) as any[]
  }

  getSalesCostDetail(year: number, month: number, productCode?: string, warehouseId?: number) {
    this.ensureSalesCostTable()
    let sql = `
      SELECT sci.*, p.spec AS specification, p.unit
      FROM sales_cost_items sci
      LEFT JOIN products p ON sci.product_code = p.code
      WHERE strftime('%Y', sci.date) = ? AND strftime('%m', sci.date) = ?
    `
    const params: any[] = [String(year), String(month).padStart(2, '0')]
    
    if (productCode) {
      sql += ` AND sci.product_code = ?`
      params.push(productCode)
    }
    if (warehouseId) {
      sql += ` AND sci.warehouse_id = ?`
      params.push(warehouseId)
    }
    
    sql += ` ORDER BY sci.date, sci.doc_no`
    
    return this.db.prepare(sql).all(...params) as any[]
  }

  getSalesCostDailySummary(startDate: string, endDate: string) {
    this.ensureSalesCostTable()
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const endDateNext = nextDay.toISOString().split('T')[0]
    const sql = `
      SELECT 
        date,
        SUM(quantity) as total_qty,
        SUM(sales_amount) as total_sales_amount,
        SUM(cost_amount) as total_cost_amount,
        SUM(profit_amount) as total_profit_amount
      FROM sales_cost_items
      WHERE date >= ? AND date < ?
      GROUP BY date
      ORDER BY date
    `
    return this.db.prepare(sql).all(startDate, endDateNext) as any[]
  }

  getSalesCostMonthlySummary(startDate: string, endDate: string) {
    this.ensureSalesCostTable()
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const endDateNext = nextDay.toISOString().split('T')[0]
    const sql = `
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(quantity) as total_qty,
        SUM(sales_amount) as total_sales_amount,
        SUM(cost_amount) as total_cost_amount,
        SUM(profit_amount) as total_profit_amount
      FROM sales_cost_items
      WHERE date >= ? AND date < ?
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month
    `
    return this.db.prepare(sql).all(startDate, endDateNext) as any[]
  }

  getSalesProfitDailySummary(startDate: string, endDate: string) {
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const endDateNext = nextDay.toISOString().split('T')[0]
    const sql = `
      SELECT 
        so.outbound_date as date,
        COUNT(DISTINCT so.id) as outbound_count,
        SUM(COALESCE(soi.total_amount, soi.quantity * soi.unit_price)) as total_sales_amount,
        SUM(COALESCE(soi.total_amount_ex, soi.quantity * COALESCE(soi.unit_price_ex, 
          CASE WHEN soi.tax_rate > 0 AND soi.unit_price > 0 THEN soi.unit_price / (1 + soi.tax_rate / 100) ELSE soi.unit_price END))) as total_sales_amount_ex,
        SUM(COALESCE(soi.tax_amount, 0)) as total_tax_amount,
        SUM(soi.quantity * COALESCE(cs.avg_cost, p.cost_price, 0)) as total_stock_cost_amount,
        SUM(COALESCE(soi.total_amount_ex, soi.quantity * COALESCE(soi.unit_price_ex, 
          CASE WHEN soi.tax_rate > 0 AND soi.unit_price > 0 THEN soi.unit_price / (1 + soi.tax_rate / 100) ELSE soi.unit_price END))) - SUM(soi.quantity * COALESCE(cs.avg_cost, p.cost_price, 0)) as total_profit_amount
      FROM sales_outbound_items soi
      JOIN sales_outbound so ON soi.outbound_id = so.id
      LEFT JOIN products p ON soi.product_id = p.id
      LEFT JOIN cost_settlements cs ON cs.product_code = p.code AND cs.warehouse_id = so.warehouse_id
        AND cs.id = (SELECT cs2.id FROM cost_settlements cs2 WHERE cs2.product_code = p.code AND cs2.warehouse_id = so.warehouse_id ORDER BY cs2.period_year DESC, cs2.period_month DESC LIMIT 1)
      WHERE so.outbound_date >= ? AND so.outbound_date < ?
        AND so.status != 'deleted'
      GROUP BY so.outbound_date
      ORDER BY so.outbound_date
    `
    return this.db.prepare(sql).all(startDate, endDateNext) as any[]
  }

  getSalesProfitMonthlySummary(startDate: string, endDate: string) {
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const endDateNext = nextDay.toISOString().split('T')[0]
    const sql = `
      SELECT 
        strftime('%Y-%m', so.outbound_date) as month,
        COUNT(DISTINCT so.id) as outbound_count,
        SUM(COALESCE(soi.total_amount, soi.quantity * soi.unit_price)) as total_sales_amount,
        SUM(COALESCE(soi.total_amount_ex, soi.quantity * COALESCE(soi.unit_price_ex,
          CASE WHEN soi.tax_rate > 0 AND soi.unit_price > 0 THEN soi.unit_price / (1 + soi.tax_rate / 100) ELSE soi.unit_price END))) as total_sales_amount_ex,
        SUM(COALESCE(soi.tax_amount, 0)) as total_tax_amount,
        SUM(soi.quantity * COALESCE(cs.avg_cost, p.cost_price, 0)) as total_stock_cost_amount,
        SUM(COALESCE(soi.total_amount_ex, soi.quantity * COALESCE(soi.unit_price_ex,
          CASE WHEN soi.tax_rate > 0 AND soi.unit_price > 0 THEN soi.unit_price / (1 + soi.tax_rate / 100) ELSE soi.unit_price END))) - SUM(soi.quantity * COALESCE(cs.avg_cost, p.cost_price, 0)) as total_profit_amount
      FROM sales_outbound_items soi
      JOIN sales_outbound so ON soi.outbound_id = so.id
      LEFT JOIN products p ON soi.product_id = p.id
      LEFT JOIN cost_settlements cs ON cs.product_code = p.code AND cs.warehouse_id = so.warehouse_id
        AND cs.id = (SELECT cs2.id FROM cost_settlements cs2 WHERE cs2.product_code = p.code AND cs2.warehouse_id = so.warehouse_id ORDER BY cs2.period_year DESC, cs2.period_month DESC LIMIT 1)
      WHERE so.outbound_date >= ? AND so.outbound_date < ?
        AND so.status != 'deleted'
      GROUP BY strftime('%Y-%m', so.outbound_date)
      ORDER BY month
    `
    return this.db.prepare(sql).all(startDate, endDateNext) as any[]
  }

  getSalesCostItemsPeriods(startDate: string, endDate: string) {
    this.ensureSalesCostTable()
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const endDateNext = nextDay.toISOString().split('T')[0]
    const sql = `
      SELECT DISTINCT period_year, period_month
      FROM sales_cost_items
      WHERE date >= ? AND date < ?
      ORDER BY period_year, period_month
    `
    return this.db.prepare(sql).all(startDate, endDateNext) as any[]
  }

  getSalesProfitByProduct(startDate: string, endDate: string) {
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const endDateNext = nextDay.toISOString().split('T')[0]
    const sql = `
      SELECT 
        p.code as product_code, p.name as product_name,
        SUM(soi.quantity) as total_qty,
        SUM(COALESCE(soi.total_amount, soi.quantity * soi.unit_price)) as total_sales_amount,
        SUM(COALESCE(soi.total_amount_ex, soi.quantity * COALESCE(soi.unit_price_ex,
          CASE WHEN soi.tax_rate > 0 AND soi.unit_price > 0 THEN soi.unit_price / (1 + soi.tax_rate / 100) ELSE soi.unit_price END))) as total_sales_amount_ex,
        SUM(COALESCE(soi.tax_amount, 0)) as total_tax_amount,
        SUM(soi.quantity * COALESCE(cs.avg_cost, p.cost_price, 0)) as total_stock_cost_amount,
        SUM(COALESCE(soi.total_amount_ex, soi.quantity * COALESCE(soi.unit_price_ex,
          CASE WHEN soi.tax_rate > 0 AND soi.unit_price > 0 THEN soi.unit_price / (1 + soi.tax_rate / 100) ELSE soi.unit_price END))) - SUM(soi.quantity * COALESCE(cs.avg_cost, p.cost_price, 0)) as total_profit_amount
      FROM sales_outbound_items soi
      JOIN sales_outbound so ON soi.outbound_id = so.id
      LEFT JOIN products p ON soi.product_id = p.id
      LEFT JOIN cost_settlements cs ON cs.product_code = p.code AND cs.warehouse_id = so.warehouse_id
        AND cs.id = (SELECT cs2.id FROM cost_settlements cs2 WHERE cs2.product_code = p.code AND cs2.warehouse_id = so.warehouse_id ORDER BY cs2.period_year DESC, cs2.period_month DESC LIMIT 1)
      WHERE so.outbound_date >= ? AND so.outbound_date < ?
        AND so.status != 'deleted'
      GROUP BY p.code, p.name
      ORDER BY total_profit_amount DESC
    `
    return this.db.prepare(sql).all(startDate, endDateNext) as any[]
  }

  getSalesProfitByCategory(startDate: string, endDate: string) {
    const nextDay = new Date(endDate)
    nextDay.setDate(nextDay.getDate() + 1)
    const endDateNext = nextDay.toISOString().split('T')[0]
    const sql = `
      SELECT 
        p.category,
        SUM(soi.quantity) as total_qty,
        SUM(COALESCE(soi.total_amount, soi.quantity * soi.unit_price)) as total_sales_amount,
        SUM(COALESCE(soi.total_amount_ex, soi.quantity * COALESCE(soi.unit_price_ex,
          CASE WHEN soi.tax_rate > 0 AND soi.unit_price > 0 THEN soi.unit_price / (1 + soi.tax_rate / 100) ELSE soi.unit_price END))) as total_sales_amount_ex,
        SUM(COALESCE(soi.tax_amount, 0)) as total_tax_amount,
        SUM(soi.quantity * COALESCE(cs.avg_cost, p.cost_price, 0)) as total_stock_cost_amount,
        SUM(COALESCE(soi.total_amount_ex, soi.quantity * COALESCE(soi.unit_price_ex,
          CASE WHEN soi.tax_rate > 0 AND soi.unit_price > 0 THEN soi.unit_price / (1 + soi.tax_rate / 100) ELSE soi.unit_price END))) - SUM(soi.quantity * COALESCE(cs.avg_cost, p.cost_price, 0)) as total_profit_amount
      FROM sales_outbound_items soi
      JOIN sales_outbound so ON soi.outbound_id = so.id
      LEFT JOIN products p ON soi.product_id = p.id
      LEFT JOIN cost_settlements cs ON cs.product_code = p.code AND cs.warehouse_id = so.warehouse_id
        AND cs.id = (SELECT cs2.id FROM cost_settlements cs2 WHERE cs2.product_code = p.code AND cs2.warehouse_id = so.warehouse_id ORDER BY cs2.period_year DESC, cs2.period_month DESC LIMIT 1)
      WHERE so.outbound_date >= ? AND so.outbound_date < ?
        AND so.status != 'deleted'
      GROUP BY p.category
      ORDER BY total_profit_amount DESC
    `
    return this.db.prepare(sql).all(startDate, endDateNext) as any[]
  }
}
