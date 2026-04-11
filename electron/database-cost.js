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
      `);
            this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_date 
        ON inventory_snapshots(snapshot_year, snapshot_month, snapshot_day)
      `);
            this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_product 
        ON inventory_snapshots(product_code, warehouse_id)
      `);
            console.log('成本结算表和库存快照表初始化成功');
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
     * 获取指定期间的所有成本结算数据
     */
    getSettlements(year, month, productCode, warehouseId) {
        let whereClause = 'WHERE cs.period_year = ? AND cs.period_month = ?';
        const params = [year, month];
        if (productCode) {
            whereClause += ' AND cs.product_code = ?';
            params.push(productCode);
        }
        if (warehouseId) {
            whereClause += ' AND cs.warehouse_id = ?';
            params.push(warehouseId);
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
      INNER JOIN products p ON cs.product_code = p.code AND p.status = 1
      ${whereClause}
      ORDER BY cs.warehouse_id, cs.product_code
    `);
        return stmt.all(...params);
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
    /**
     * 保存库存快照（优化功能 1：月末快照机制）
     */
    saveSnapshot(productCode, productName, warehouseId, warehouseName, date, quantity, cost) {
        try {
            const snapshotDate = new Date(date);
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO inventory_snapshots 
        (product_code, product_name, warehouse_id, warehouse_name, 
         snapshot_date, snapshot_year, snapshot_month, snapshot_day,
         quantity, cost, amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
            stmt.run(productCode, productName, warehouseId, warehouseName, date, snapshotDate.getFullYear(), snapshotDate.getMonth() + 1, snapshotDate.getDate(), quantity, cost, quantity * cost);
            return true;
        }
        catch (error) {
            console.error('保存库存快照失败:', error);
            return false;
        }
    }
    /**
     * 获取指定日期的库存快照
     */
    getSnapshot(productCode, warehouseId, date) {
        const stmt = this.db.prepare(`
      SELECT * FROM inventory_snapshots 
      WHERE product_code = ? 
        AND warehouse_id = ? 
        AND snapshot_date = ?
    `);
        return stmt.get(productCode, warehouseId, date);
    }
    /**
     * 获取指定日期之前的最新快照
     */
    getLatestSnapshotBeforeDate(productCode, warehouseId, beforeDate) {
        const stmt = this.db.prepare(`
      SELECT * FROM inventory_snapshots 
      WHERE product_code = ? 
        AND warehouse_id = ? 
        AND snapshot_date <= ?
      ORDER BY snapshot_date DESC
      LIMIT 1
    `);
        return stmt.get(productCode, warehouseId, beforeDate);
    }
    /**
     * 获取月末最后一天的快照
     */
    getMonthEndSnapshot(productCode, warehouseId, year, month) {
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const stmt = this.db.prepare(`
      SELECT * FROM inventory_snapshots 
      WHERE product_code = ? 
        AND warehouse_id = ? 
        AND snapshot_year = ? 
        AND snapshot_month = ?
      ORDER BY snapshot_day DESC
      LIMIT 1
    `);
        return stmt.get(productCode, warehouseId, year, month);
    }
    saveSalesCostItem(item) {
        this.ensureSalesCostTable();
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sales_cost_items (
        doc_type, doc_id, doc_no, product_code, product_name,
        warehouse_id, warehouse_name, quantity, unit_price,
        sales_amount, cost_unit_price, cost_amount, profit_amount,
        period_year, period_month, is_locked, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        return stmt.run(item.doc_type, item.doc_id, item.doc_no, item.product_code, item.product_name, item.warehouse_id, item.warehouse_name, item.quantity, item.unit_price, item.sales_amount, item.cost_unit_price, item.cost_amount, item.profit_amount || 0, item.period_year || 0, item.period_month || 0, item.is_locked || 0, item.date);
    }
    saveTransferCostItem(item) {
        this.ensureTransferCostTable();
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO transfer_cost_items (
        doc_type, doc_id, doc_no, product_code, product_name,
        from_warehouse_id, from_warehouse_name, to_warehouse_id, to_warehouse_name,
        quantity, unit_cost, cost_amount,
        period_year, period_month, is_locked, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        return stmt.run(item.doc_type, item.doc_id, item.doc_no, item.product_code, item.product_name, item.from_warehouse_id, item.from_warehouse_name, item.to_warehouse_id, item.to_warehouse_name, item.quantity, item.unit_cost, item.cost_amount, item.period_year || 0, item.period_month || 0, item.is_locked || 0, item.date);
    }
    getSalesCostSummary(year, month, productSearch) {
        this.ensureSalesCostTable();
        let sql = `
      SELECT 
        product_code, product_name, warehouse_id, warehouse_name,
        SUM(quantity) as total_qty,
        SUM(sales_amount) as total_sales_amount,
        SUM(cost_amount) as total_cost_amount,
        COUNT(*) as doc_count
      FROM sales_cost_items
      WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?
    `;
        const params = [String(year), String(month).padStart(2, '0')];
        if (productSearch) {
            sql += ` AND (product_code LIKE ? OR product_name LIKE ?)`;
            params.push(`%${productSearch}%`, `%${productSearch}%`);
        }
        sql += ` GROUP BY product_code, warehouse_id`;
        return this.db.prepare(sql).all(...params);
    }
    getTransferCostSummary(year, month, productSearch) {
        this.ensureTransferCostTable();
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
    `;
        const params = [String(year), String(month).padStart(2, '0')];
        if (productSearch) {
            sql += ` AND (product_code LIKE ? OR product_name LIKE ?)`;
            params.push(`%${productSearch}%`, `%${productSearch}%`);
        }
        sql += ` GROUP BY product_code, from_warehouse_id, to_warehouse_id`;
        return this.db.prepare(sql).all(...params);
    }
    getTransactionDetails(year, month, productSearch, warehouseId) {
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
        let whereClause = 'WHERE pi.inbound_date >= ? AND pi.inbound_date < ? AND pi.status != \'deleted\'';
        const params = [monthStart, monthEnd];
        if (productSearch) {
            whereClause += ' AND (p.code LIKE ? OR p.name LIKE ?)';
            params.push(`%${productSearch}%`, `%${productSearch}%`);
        }
        if (warehouseId) {
            whereClause += ' AND pi.warehouse_id = ?';
            params.push(warehouseId);
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
    `).all(...params);
        whereClause = 'WHERE so.outbound_date >= ? AND so.outbound_date < ? AND so.status != \'deleted\'';
        params.length = 0;
        params.push(monthStart, monthEnd);
        if (productSearch) {
            whereClause += ' AND (p.code LIKE ? OR p.name LIKE ?)';
            params.push(`%${productSearch}%`, `%${productSearch}%`);
        }
        if (warehouseId) {
            whereClause += ' AND so.warehouse_id = ?';
            params.push(warehouseId);
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
    `).all(...params);
        return [...inboundItems, ...outboundItems];
    }
    getProductDetailLedger(params) {
        const { productCode, warehouseId, year, month } = params;
        console.log('[DB] getProductDetailLedger 调用参数:', params);
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
        const product = this.db.prepare('SELECT id FROM products WHERE code = ?').get(productCode);
        if (!product) {
            console.log('[DB] 产品不存在:', productCode);
            return [];
        }
        const productId = product.id;
        console.log('[DB] 产品 ID:', productId);
        const settlement = this.getSettlement(productCode, warehouseId, year, month);
        console.log('[DB] 结算数据:', settlement ? '找到' : '未找到');
        // 辅助函数：构建退货备注
        const buildReturnRemark = (existingRemark, originalDocNo, docType) => {
            const parts = [];
            if (existingRemark) {
                parts.push(existingRemark);
            }
            if (originalDocNo) {
                parts.push(`对应${docType}单号：${originalDocNo}`);
            }
            return parts.join('；') || '';
        };
        const items = [];
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
            });
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
    `;
        const purchaseInboundItems = this.db.prepare(purchaseInboundSql).all(warehouseId, monthStart, monthEnd, productId);
        // 2. 获取采购退货单数据（作为入库的负数）
        // 应用与采购入库完全相同的单价提取规则
        const purchaseReturnSql = `
      SELECT 
        pr.return_date as date,
        pr.return_no as docNo,
        pri.quantity as qty,
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
    `;
        const purchaseReturnItems = this.db.prepare(purchaseReturnSql).all(warehouseId, monthStart, monthEnd, productId);
        console.log('[采购退货数据] 共', purchaseReturnItems.length, '条');
        // 合并入库和采购退货，按日期排序
        const inboundTransactions = [
            ...purchaseInboundItems.map(item => ({
                date: item.date,
                docNo: item.docNo,
                type: item.type,
                direction: 'in',
                inboundQty: Number(item.qty || 0),
                inboundPrice: Number(item.unit_price || (Number(item.qty || 0) !== 0 ? Number(item.amount || 0) / Number(item.qty || 0) : 0)),
                inboundAmount: Number(item.amount || 0),
                remark: item.remark || '',
                outboundQty: 0,
                outboundPrice: 0,
                outboundAmount: 0
            })),
            ...purchaseReturnItems.map(item => ({
                date: item.date,
                docNo: item.docNo,
                type: item.type,
                direction: 'in',
                inboundQty: -Math.abs(Number(item.qty || 0)),
                inboundPrice: Number(item.unit_price || (Number(item.qty || 0) !== 0 ? Number(item.amount || 0) / Number(item.qty || 0) : 0)),
                inboundAmount: -Math.abs(Number(item.amount || 0)),
                remark: buildReturnRemark(item.remark, item.original_inbound_no, '入库'),
                outboundQty: 0,
                outboundPrice: 0,
                outboundAmount: 0
            }))
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
    `;
        const salesOutboundItems = this.db.prepare(salesOutboundSql).all(warehouseId, monthStart, monthEnd, productId);
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
    `;
        const salesReturnItems = this.db.prepare(salesReturnSql).all(warehouseId, monthStart, monthEnd, productId);
        // 合并出库和销售退货，按日期排序
        const outboundTransactions = [
            ...salesOutboundItems.map(item => ({
                date: item.date,
                docNo: item.docNo,
                type: item.type,
                direction: 'out',
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
                direction: 'out',
                inboundQty: 0,
                inboundPrice: 0,
                inboundAmount: 0,
                remark: buildReturnRemark(item.remark, item.original_outbound_no, '出库'),
                outboundQty: -Math.abs(Number(item.qty || 0)),
                outboundPrice: Number(item.unit_price || 0),
                outboundAmount: 0
            }))
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // 计算库存结余
        let runningQty = settlement?.opening_qty || 0;
        let runningCost = settlement?.opening_cost || 0;
        // 先添加所有入库交易
        for (const tx of inboundTransactions) {
            runningQty += tx.inboundQty;
            runningCost += tx.inboundAmount;
            items.push({
                ...tx,
                balanceQty: runningQty,
                balanceAmount: runningCost,
                balanceUnitPrice: runningQty > 0 ? runningCost / runningQty : 0
            });
        }
        // 再添加所有出库交易
        // 规则：出库单价 = 出库前最后一笔入库/采购退货后的库存结余单价（加权平均单价）
        for (const tx of outboundTransactions) {
            // 出库前的库存结余单价（即当期最后一笔入库或采购退货后的单价）
            const outboundPrice = runningQty > 0 ? runningCost / runningQty : 0;
            // 出库减少库存，退货增加库存（outboundQty 正数表示出库，负数表示退货）
            runningQty -= tx.outboundQty; // 注意：这里是减去出库数量（负数时相当于加）
            // 出库金额 = 出库数量 * 出库前的库存结余单价
            const costAmount = Math.abs(tx.outboundQty) * outboundPrice;
            // 出库减少成本，退货增加成本
            runningCost -= tx.outboundQty > 0 ? costAmount : -costAmount;
            items.push({
                ...tx,
                outboundPrice: outboundPrice,
                outboundAmount: tx.outboundQty > 0 ? costAmount : -costAmount,
                balanceQty: runningQty,
                balanceAmount: runningCost,
                balanceUnitPrice: runningQty > 0 ? runningCost / runningQty : 0
            });
        }
        // 添加本月合计数据
        if (settlement) {
            // 计算本月入库和出库的汇总数据
            let monthInQty = 0;
            let monthInAmt = 0;
            let monthOutQty = 0;
            let monthOutAmt = 0;
            for (const item of items) {
                if (item.type === 'purchase_inbound' || item.type === 'purchase_return') {
                    monthInQty += item.inboundQty || 0;
                    monthInAmt += item.inboundAmount || 0;
                }
                if (item.type === 'sales_outbound' || item.type === 'sales_return') {
                    monthOutQty += item.outboundQty || 0;
                    monthOutAmt += item.outboundAmount || 0;
                }
            }
            const monthAvgPrice = (monthInQty + monthOutQty) > 0 ? ((monthInAmt + Math.abs(monthOutAmt)) / (monthInQty + monthOutQty)) : 0;
            items.push({
                date: `${year}-${String(month).padStart(2, '0')}`,
                docNo: '本月合计',
                type: 'monthly',
                direction: '',
                inboundQty: Number(monthInQty.toFixed(4)),
                inboundPrice: Number(monthAvgPrice.toFixed(2)),
                inboundAmount: Number(monthInAmt.toFixed(2)),
                outboundQty: Number(monthOutQty.toFixed(4)),
                outboundPrice: Number(monthAvgPrice.toFixed(2)),
                outboundAmount: Number(monthOutAmt.toFixed(2)),
                balanceQty: settlement.closing_qty,
                balanceAmount: settlement.closing_cost,
                balanceUnitPrice: settlement.avg_cost,
                remark: ''
            });
            // 添加本年累计数据
            const yearStart = `${year}-01-01`;
            const yearEnd = `${year}-12-31`;
            // 获取本年累计数据
            const yearSql = `
        SELECT 
          ii.quantity as inboundQty,
          CASE 
            WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.total_amount_ex
            WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.total_amount_ex
            ELSE ii.total_amount
          END as inboundAmount,
          'in' as direction
        FROM purchase_inbound_items ii
        JOIN purchase_inbound pi ON ii.inbound_id = pi.id
        WHERE pi.warehouse_id = ?
          AND pi.inbound_date >= ?
          AND pi.inbound_date <= ?
          AND ii.product_id = ?
          AND pi.status != 'deleted'
        UNION ALL
        SELECT 
          -ABS(pri.quantity) as inboundQty,
          -ABS(CASE 
            WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.total_amount_ex
            WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.total_amount_ex
            ELSE ii.total_amount
          END) as inboundAmount,
          'in' as direction
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
          AND pr.return_date <= ?
          AND pri.product_id = ?
          AND pr.status != 'deleted'
      `;
            const yearInboundData = this.db.prepare(yearSql).all(warehouseId, yearStart, yearEnd, productId, warehouseId, yearStart, yearEnd, productId);
            let yearInQty = 0;
            let yearInAmt = 0;
            for (const row of yearInboundData) {
                yearInQty += Number(row.inboundQty || 0);
                yearInAmt += Number(row.inboundAmount || 0);
            }
            // 获取本年出库数据
            const yearOutboundSql = `
        SELECT 
          oi.quantity as outboundQty,
          oi.cost_price as unit_price,
          'out' as direction
        FROM sales_outbound_items oi
        JOIN sales_outbound so ON oi.outbound_id = so.id
        WHERE so.warehouse_id = ?
          AND so.outbound_date >= ?
          AND so.outbound_date <= ?
          AND oi.product_id = ?
          AND so.status != 'deleted'
        UNION ALL
        SELECT 
          -ABS(sri.quantity) as outboundQty,
          sri.cost_price as unit_price,
          'out' as direction
        FROM sales_return_items sri
        JOIN sales_returns sr ON sri.return_id = sr.id
        WHERE sr.warehouse_id = ?
          AND sr.return_date >= ?
          AND sr.return_date <= ?
          AND sri.product_id = ?
          AND sr.status != 'deleted'
      `;
            const yearOutboundData = this.db.prepare(yearOutboundSql).all(warehouseId, yearStart, yearEnd, productId, warehouseId, yearStart, yearEnd, productId);
            let yearOutQty = 0;
            let yearOutAmt = 0;
            for (const row of yearOutboundData) {
                const qty = Number(row.outboundQty || 0);
                const price = Number(row.unit_price || 0);
                yearOutQty += qty;
                yearOutAmt += Math.abs(qty * price);
            }
            const yearAvgPrice = (yearInQty + yearOutQty) > 0 ? ((yearInAmt + Math.abs(yearOutAmt)) / (yearInQty + yearOutQty)) : 0;
            items.push({
                date: `${year}-${String(month).padStart(2, '0')}`,
                docNo: '本年累计',
                type: 'yearly',
                direction: '',
                inboundQty: Number(yearInQty.toFixed(4)),
                inboundPrice: Number(yearAvgPrice.toFixed(2)),
                inboundAmount: Number(yearInAmt.toFixed(2)),
                outboundQty: Number(yearOutQty.toFixed(4)),
                outboundPrice: Number(yearAvgPrice.toFixed(2)),
                outboundAmount: Number(yearOutAmt.toFixed(2)),
                balanceQty: settlement.closing_qty,
                balanceAmount: settlement.closing_cost,
                balanceUnitPrice: settlement.avg_cost,
                remark: ''
            });
        }
        console.log('[DB] getProductDetailLedger 返回数据:', items.length, '条');
        return items;
    }
    deleteSalesCostSummary(year, month) {
        try {
            this.db.exec(`DROP TABLE IF EXISTS sales_cost_items`);
            return true;
        }
        catch (e) {
            return false;
        }
    }
    deleteTransferCostSummary(year, month) {
        try {
            this.db.exec(`DROP TABLE IF EXISTS transfer_cost_items`);
            return true;
        }
        catch (e) {
            return false;
        }
    }
    ensureSalesCostTable() {
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
        sales_amount REAL DEFAULT 0,
        cost_unit_price REAL DEFAULT 0,
        cost_amount REAL DEFAULT 0,
        profit_amount REAL DEFAULT 0,
        period_year INTEGER,
        period_month INTEGER,
        is_locked INTEGER DEFAULT 0,
        date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }
    ensureTransferCostTable() {
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
    `);
    }
}
exports.CostSettlementDatabase = CostSettlementDatabase;
