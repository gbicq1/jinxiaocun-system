import Database from 'better-sqlite3'
import { resolve } from 'path'
import { CostSettlementDatabase } from './database-cost'

export class InventoryDatabase {
  public db: Database.Database | null = null
  private dbPath: string
  public costDb!: CostSettlementDatabase

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  initialize(): boolean {
    try {
      this.db = new Database(this.dbPath)
      this.db.pragma('foreign_keys = OFF')
      // 设置数据库忙碌超时时间（5秒），避免并发操作时立即失败
      this.db.pragma('busy_timeout = 5000')
      // 使用 WAL 模式提高并发性能
      this.db.pragma('journal_mode = WAL')
      
      // 检查数据库是否已经初始化过（通过检查是否存在 products 表）
      const tableExists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get()
      
      if (!tableExists) {
        // 数据库是新的，创建表并插入基础数据
        console.log('新数据库，开始创建表...')
        this.createTables()
        this.insertDefaultData()
      } else {
        // 数据库已存在，只确保表结构正确
        console.log('数据库已存在，检查并添加缺失字段...')
        this.createTables() // 使用 IF NOT EXISTS，不会重复创建
        this.migrateDatabase() // 添加缺失字段
      }
      
      // 初始化成本结算数据库
      this.costDb = new CostSettlementDatabase(this.db)
      this.costDb.initialize()
      
      return true
    } catch (error) {
      console.error('数据库初始化失败:', error)
      return false
    }
  }

  /**
   * 删除所有表（用于重置数据库）
   */
  private dropAllTables(): void {
    try {
      const tables = [
        'purchase_inbound_items',
        'purchase_inbound',
        'sales_outbound_items',
        'sales_outbound',
        'purchase_return_items',
        'purchase_returns',
        'sales_return_items',
        'sales_returns',
        'inventory_transfer_items',
        'inventory_transfer',
        'purchase_order_items',
        'purchase_orders',
        'purchase_request_items',
        'purchase_requests',
        'sales_quote_items',
        'sales_quotes',
        'customers',
        'suppliers',
        'warehouses',
        'products',
        'employees'
      ]
      
      tables.forEach(table => {
        this.db!.exec(`DROP TABLE IF EXISTS ${table}`)
      })
      
      console.log('所有旧表已删除')
    } catch (error) {
      console.error('删除旧表失败:', error)
    }
  }

  private migrateDatabase() {
    try {
      console.log('开始数据库迁移...')
      
      // 检查 purchase_return_items 表是否有 original_item_index 字段
      const prColumns = this.db!.prepare("PRAGMA table_info(purchase_return_items)").all() as any[]
      const hasOriginalItemIndex = prColumns.some(col => col.name === 'original_item_index')
      if (!hasOriginalItemIndex) {
        console.log('添加 purchase_return_items.original_item_index 字段')
        this.db!.exec('ALTER TABLE purchase_return_items ADD COLUMN original_item_index INTEGER')
      }
      
      // 检查 sales_return_items 表是否有 original_item_index 字段
      const srColumns = this.db!.prepare("PRAGMA table_info(sales_return_items)").all() as any[]
      const hasSrOriginalItemIndex = srColumns.some(col => col.name === 'original_item_index')
      if (!hasSrOriginalItemIndex) {
        console.log('添加 sales_return_items.original_item_index 字段')
        this.db!.exec('ALTER TABLE sales_return_items ADD COLUMN original_item_index INTEGER')
      }
      
      // 检查 sales_outbound 表是否有 customer_id 字段
      const soColumns = this.db!.prepare("PRAGMA table_info(sales_outbound)").all() as any[]
      const hasCustomerId = soColumns.some(col => col.name === 'customer_id')
      if (!hasCustomerId) {
        console.log('添加 sales_outbound.customer_id 字段')
        this.db!.exec('ALTER TABLE sales_outbound ADD COLUMN customer_id INTEGER')
      }
      
      // 检查 sales_outbound 表是否有 handler_name 字段
      const hasHandlerName = soColumns.some(col => col.name === 'handler_name')
      if (!hasHandlerName) {
        console.log('添加 sales_outbound.handler_name 字段')
        this.db!.exec('ALTER TABLE sales_outbound ADD COLUMN handler_name TEXT')
      }
      
      console.log('数据库迁移完成')
    } catch (error) {
      console.error('数据库迁移失败:', error)
    }
  }

  private createTables() {
    // 产品表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(100),
        unit VARCHAR(20),
        barcode VARCHAR(100),
        spec VARCHAR(200),
        cost_price DECIMAL(10,2),
        sell_price DECIMAL(10,2),
        stock_quantity INTEGER DEFAULT 0,
        warning_quantity INTEGER DEFAULT 10,
        status INTEGER DEFAULT 1,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 仓库表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        address TEXT,
        contact_person VARCHAR(100),
        contact_phone VARCHAR(20),
        status INTEGER DEFAULT 1,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 供应商表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        contact_person VARCHAR(100),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(100),
        address TEXT,
        bank_name VARCHAR(100),
        bank_account VARCHAR(50),
        status INTEGER DEFAULT 1,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 客户表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        contact_person VARCHAR(100),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(100),
        address TEXT,
        credit_limit DECIMAL(10,2),
        status INTEGER DEFAULT 1,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 员工表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        position VARCHAR(100),
        department VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(100),
        status VARCHAR(20) DEFAULT 'active',
        join_date DATE,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 销售报价单表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_no VARCHAR(50) UNIQUE NOT NULL,
        customer_id INTEGER,
        quote_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        valid_date DATETIME,
        total_amount DECIMAL(10,2),
        discount DECIMAL(5,2) DEFAULT 0,
        final_amount DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'draft',
        remark TEXT,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `)

    // 销售报价单明细表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_quote_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        unit_price DECIMAL(10,2),
        amount DECIMAL(10,2),
        remark TEXT,
        FOREIGN KEY (quote_id) REFERENCES sales_quotes(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    // 销售订单表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no VARCHAR(50) UNIQUE NOT NULL,
        quote_id INTEGER,
        customer_id INTEGER,
        order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivery_date DATETIME,
        total_amount DECIMAL(10,2),
        discount DECIMAL(5,2) DEFAULT 0,
        final_amount DECIMAL(10,2),
        paid_amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        remark TEXT,
        created_by VARCHAR(50),
        approved_by VARCHAR(50),
        approved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quote_id) REFERENCES sales_quotes(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `)

    // 销售订单明细表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        unit_price DECIMAL(10,2),
        amount DECIMAL(10,2),
        delivered_quantity INTEGER DEFAULT 0,
        remark TEXT,
        FOREIGN KEY (order_id) REFERENCES sales_orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    // 销售出库表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_outbound (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outbound_no VARCHAR(50) UNIQUE NOT NULL,
        order_id INTEGER,
        customer_id INTEGER,
        warehouse_id INTEGER,
        outbound_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'completed',
        remark TEXT,
        handler_name TEXT,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES sales_orders(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    `)

    // 销售出库明细表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_outbound_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outbound_id INTEGER,
        product_id INTEGER,
        product_name VARCHAR(200),
        specification VARCHAR(200),
        quantity DECIMAL(14,4),
        unit VARCHAR(50),
        unit_price_ex DECIMAL(14,4),
        unit_price DECIMAL(14,4),
        tax_rate VARCHAR(20),
        tax_amount DECIMAL(14,2),
        total_amount DECIMAL(14,2),
        deduction_amount DECIMAL(14,2),
        allow_deduction INTEGER DEFAULT 0,
        cost_price DECIMAL(10,2),
        remark TEXT,
        FOREIGN KEY (outbound_id) REFERENCES sales_outbound(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    try {
      this.db.exec(`ALTER TABLE sales_outbound_items ADD COLUMN product_name VARCHAR(200)`)
    } catch(e) { try { this.db.exec(`ALTER TABLE sales_outbound_items ADD COLUMN specification VARCHAR(200)`) } catch(_) {} }
    try {
      this.db.exec(`ALTER TABLE sales_outbound_items ADD COLUMN specification VARCHAR(200)`)
    } catch(e) {}
    try {
      this.db.exec(`ALTER TABLE sales_outbound_items ADD COLUMN unit VARCHAR(50)`)
    } catch(e) {}
    try {
      this.db.exec(`ALTER TABLE sales_outbound_items ADD COLUMN unit_price_ex DECIMAL(14,4)`)
    } catch(e) {}
    try {
      this.db.exec(`ALTER TABLE sales_outbound_items ADD COLUMN unit_price DECIMAL(14,4)`)
    } catch(e) {}
    try {
      this.db.exec(`ALTER TABLE sales_outbound_items ADD COLUMN tax_rate VARCHAR(20)`)
    } catch(e) {}
    try {
      this.db.exec(`ALTER TABLE sales_outbound_items ADD COLUMN tax_amount DECIMAL(14,2)`)
    } catch(e) {}
    try {
      this.db.exec(`ALTER TABLE sales_outbound_items ADD COLUMN total_amount DECIMAL(14,2)`)
    } catch(e) {}
    try {
      this.db.exec(`ALTER TABLE sales_outbound_items ADD COLUMN deduction_amount DECIMAL(14,2)`)
    } catch(e) {}
    try {
      this.db.exec(`ALTER TABLE sales_outbound_items ADD COLUMN allow_deduction INTEGER DEFAULT 0`)
    } catch(e) {}

    // 采购申请单表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_no VARCHAR(50) UNIQUE NOT NULL,
        supplier_id INTEGER,
        request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        expected_date DATETIME,
        total_amount DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'pending',
        remark TEXT,
        created_by VARCHAR(50),
        approved_by VARCHAR(50),
        approved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )
    `)

    // 采购申请单明细表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        unit_price DECIMAL(10,2),
        amount DECIMAL(10,2),
        remark TEXT,
        FOREIGN KEY (request_id) REFERENCES purchase_requests(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    // 采购订单表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no VARCHAR(50) UNIQUE NOT NULL,
        request_id INTEGER,
        supplier_id INTEGER,
        order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivery_date DATETIME,
        total_amount DECIMAL(10,2),
        final_amount DECIMAL(10,2),
        paid_amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        remark TEXT,
        created_by VARCHAR(50),
        approved_by VARCHAR(50),
        approved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES purchase_requests(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      )
    `)

    // 采购订单明细表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        unit_price DECIMAL(10,2),
        amount DECIMAL(10,2),
        received_quantity INTEGER DEFAULT 0,
        remark TEXT,
        FOREIGN KEY (order_id) REFERENCES purchase_orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    // 采购入库表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_inbound (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inbound_no VARCHAR(50) UNIQUE NOT NULL,
        order_id INTEGER,
        supplier_id INTEGER,
        warehouse_id INTEGER,
        inbound_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(10,2),
        paid_amount DECIMAL(10,2) DEFAULT 0,
        invoice_type VARCHAR(20),
        invoice_issued BOOLEAN DEFAULT 0,
        status VARCHAR(20) DEFAULT 'completed',
        remark TEXT,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES purchase_orders(id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    `)

    // 采购入库明细表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_inbound_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inbound_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        unit_price DECIMAL(10,2),
        unit_price_ex DECIMAL(10,2),
        tax_rate DECIMAL(5,2),
        tax_amount DECIMAL(10,2),
        total_amount_ex DECIMAL(10,2),
        total_amount DECIMAL(10,2),
        allow_deduction BOOLEAN DEFAULT 0,
        deduction_amount DECIMAL(10,2) DEFAULT 0,
        remark TEXT,
        FOREIGN KEY (inbound_id) REFERENCES purchase_inbound(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    // 销售出库明细表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_outbound_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outbound_id INTEGER,
        product_id INTEGER,
        product_name VARCHAR(200),
        specification VARCHAR(200),
        quantity DECIMAL(14,4),
        unit VARCHAR(50),
        unit_price_ex DECIMAL(14,4),
        unit_price DECIMAL(14,4),
        tax_rate VARCHAR(20),
        tax_amount DECIMAL(14,2),
        total_amount DECIMAL(14,2),
        deduction_amount DECIMAL(14,2),
        allow_deduction INTEGER DEFAULT 0,
        cost_price DECIMAL(10,2),
        remark TEXT,
        FOREIGN KEY (outbound_id) REFERENCES sales_outbound(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    // 采购退货表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_no VARCHAR(50) UNIQUE NOT NULL,
        original_inbound_no VARCHAR(50),
        supplier_id INTEGER,
        warehouse_id INTEGER,
        return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(10,2),
        return_reason TEXT,
        status VARCHAR(20) DEFAULT 'completed',
        remark TEXT,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    `)

    // 采购退货明细表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        cost_price DECIMAL(10,2),
        remark TEXT,
        original_item_index INTEGER,
        FOREIGN KEY (return_id) REFERENCES purchase_returns(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    // 销售退货表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_no VARCHAR(50) UNIQUE NOT NULL,
        original_order_no VARCHAR(50),
        customer_id INTEGER,
        warehouse_id INTEGER,
        return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(10,2),
        return_reason TEXT,
        status VARCHAR(20) DEFAULT 'completed',
        remark TEXT,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    `)

    // 销售退货明细表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        cost_price DECIMAL(10,2),
        remark TEXT,
        original_item_index INTEGER,
        FOREIGN KEY (return_id) REFERENCES sales_returns(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    // 库存调拨表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transfer_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_no VARCHAR(50) UNIQUE NOT NULL,
        from_warehouse_id INTEGER,
        to_warehouse_id INTEGER,
        transfer_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        remark TEXT,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id)
      )
    `)

    // 库存调拨明细表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transfer_record_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        cost DECIMAL(10,2) DEFAULT 0,
        amount DECIMAL(10,2) DEFAULT 0,
        remark TEXT,
        FOREIGN KEY (transfer_id) REFERENCES transfer_records(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    // 库存盘点表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stock_count (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        count_no VARCHAR(50) UNIQUE NOT NULL,
        warehouse_id INTEGER,
        count_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        remark TEXT,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    `)

    // 库存盘点明细表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stock_count_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        count_id INTEGER,
        product_id INTEGER,
        warehouse_id INTEGER,
        system_quantity INTEGER,
        actual_quantity INTEGER,
        difference INTEGER,
        adjust_quantity INTEGER,
        remark TEXT,
        FOREIGN KEY (count_id) REFERENCES stock_count(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    `)

    // 应收应付账款表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_no VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL,
        partner_type VARCHAR(20),
        partner_id INTEGER,
        reference_type VARCHAR(50),
        reference_id INTEGER,
        amount DECIMAL(10,2),
        paid_amount DECIMAL(10,2) DEFAULT 0,
        balance DECIMAL(10,2),
        due_date DATETIME,
        status VARCHAR(20) DEFAULT 'unpaid',
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 收付款记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_no VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL,
        account_id INTEGER,
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        amount DECIMAL(10,2),
        payment_method VARCHAR(20),
        remark TEXT,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )
    `)

    console.log('数据库表创建完成')
    
    // 创建索引以优化查询性能
    this.createIndexes()
  }

  private createIndexes() {
    try {
      // 产品索引
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_products_code ON products(code)
      `)
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)
      `)
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)
      `)

      // 仓库索引
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_warehouses_code ON warehouses(code)
      `)

      // 供应商索引
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code)
      `)

      // 客户索引
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code)
      `)

      // 采购入库索引
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_inbound_date ON purchase_inbound(inbound_date)
      `)
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_inbound_warehouse ON purchase_inbound(warehouse_id)
      `)

      // 销售出库索引
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_outbound_date ON sales_outbound(outbound_date)
      `)
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_outbound_warehouse ON sales_outbound(warehouse_id)
      `)

      // 库存调拨索引
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_transfer_date ON transfer_records(transfer_date)
      `)

      // 成本结算索引
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_cost_period ON cost_settlements(period_year, period_month)
      `)
      this.db!.exec(`
        CREATE INDEX IF NOT EXISTS idx_cost_product ON cost_settlements(product_code, warehouse_id)
      `)

      console.log('数据库索引创建完成')
    } catch (error) {
      console.error('创建索引失败:', error)
    }
  }

  /**
   * 插入基础数据（只在第一次创建数据库时执行）
   */
  private insertDefaultData(): void {
    try {
      // 插入产品（如果不存在）
      this.db!.exec(`
        INSERT OR IGNORE INTO products (code, name, category, unit, spec, status)
        VALUES ('01', '苹果', '水果', '个', '红富士', 1)
      `)

      // 插入仓库（如果不存在）
      this.db!.exec(`
        INSERT OR IGNORE INTO warehouses (code, name, address, status)
        VALUES 
          ('01', '农服', '农服仓库', 1),
          ('02', '驿站', '驿站仓库', 1)
      `)

      // 插入供应商（如果不存在）
      this.db!.exec(`
        INSERT OR IGNORE INTO suppliers (code, name, status)
        VALUES ('01', '聚珍园', 1)
      `)

      // 插入客户（如果不存在）
      this.db!.exec(`
        INSERT OR IGNORE INTO customers (code, name, status)
        VALUES ('01', '集团', 1)
      `)
      
      console.log('基础数据已插入')
    } catch (error) {
      console.error('插入基础数据失败:', error)
    }
  }

  query(sql: string, params: any[] = []): any[] {
    return this.db!.prepare(sql).all(...params)
  }

  insert(table: string, data: any): number {
    const keys = Object.keys(data)
    const values = Object.values(data)
    const placeholders = keys.map(() => '?').join(',')
    
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`
    const stmt = this.db!.prepare(sql)
    const result = stmt.run(...values)
    return Number(result.lastInsertRowid)
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

  // 产品相关方法
  getProductList(page: number = 1, pageSize: number = 10): any {
    const offset = (page - 1) * pageSize
    const total = this.db!.prepare('SELECT COUNT(*) as count FROM products').get() as any
    const products = this.db!.prepare(`
      SELECT * FROM products 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(pageSize, offset)
    
    return {
      total: total.count,
      page,
      pageSize,
      data: products
    }
  }

  /**
   * 获取所有产品（不分页）
   */
  getAllProducts(): any[] {
    return this.db!.prepare('SELECT * FROM products ORDER BY code').all()
  }

  addProduct(product: any): number {
    return this.insert('products', product)
  }

  updateProduct(product: any): number {
    const id = product.id
    delete product.id
    return this.update('products', product, 'id = ?', [id])
  }

  deleteProduct(id: number): number {
    return this.delete('products', 'id = ?', [id])
  }

  // 仓库相关方法
  getAllWarehouses(): any[] {
    return this.db!.prepare('SELECT * FROM warehouses ORDER BY id').all()
  }

  addWarehouse(warehouse: any): number {
    return this.insert('warehouses', warehouse)
  }

  updateWarehouse(warehouse: any): number {
    const id = warehouse.id
    delete warehouse.id
    return this.update('warehouses', warehouse, 'id = ?', [id])
  }

  deleteWarehouse(id: number): number {
    return this.delete('warehouses', 'id = ?', [id])
  }

  // 供应商相关方法
  getAllSuppliers(): any[] {
    return this.db!.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all()
  }

  addSupplier(supplier: any): number {
    return this.insert('suppliers', supplier)
  }

  updateSupplier(supplier: any): number {
    const id = supplier.id
    delete supplier.id
    return this.update('suppliers', supplier, 'id = ?', [id])
  }

  deleteSupplier(id: number): number {
    return this.delete('suppliers', 'id = ?', [id])
  }

  // 客户相关方法
  getAllCustomers(): any[] {
    return this.db!.prepare('SELECT * FROM customers ORDER BY created_at DESC').all()
  }

  addCustomer(customer: any): number {
    return this.insert('customers', customer)
  }

  updateCustomer(customer: any): number {
    const id = customer.id
    delete customer.id
    return this.update('customers', customer, 'id = ?', [id])
  }

  deleteCustomer(id: number): number {
    return this.delete('customers', 'id = ?', [id])
  }

  // 采购入库相关方法
  getInboundList(page: number = 1, pageSize: number = 10, where?: string, params?: any[]): any {
    let whereClause = where ? `WHERE ${where}` : ''
    const offset = (page - 1) * pageSize
    
    const countSql = `SELECT COUNT(*) as count FROM purchase_inbound ${whereClause}`
    const total = whereClause && params && params.length > 0
      ? this.db!.prepare(countSql).get(...params)
      : this.db!.prepare(countSql).get()
    
    const dataSql = `SELECT * FROM purchase_inbound ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    const data = whereClause && params && params.length > 0
      ? this.db!.prepare(dataSql).all(...params, pageSize, offset)
      : this.db!.prepare(dataSql).all(pageSize, offset)
    
    // 为每个入库单加载明细数据
    const enrichedData = data.map((record: any) => {
      const itemsSql = `SELECT * FROM purchase_inbound_items WHERE inbound_id = ?`
      const items = this.db!.prepare(itemsSql).all(record.id)
      
      // 加载供应商和仓库信息
      const supplier = this.db!.prepare('SELECT name FROM suppliers WHERE id = ?').get(record.supplier_id) as any
      const warehouse = this.db!.prepare('SELECT name FROM warehouses WHERE id = ?').get(record.warehouse_id) as any
      
      return {
        id: record.id,
        voucherNo: record.inbound_no,
        voucherDate: record.inbound_date,
        supplierId: record.supplier_id,
        supplierName: supplier?.name || '',
        warehouseId: record.warehouse_id,
        warehouseName: warehouse?.name || '',
        totalAmount: record.total_amount,
        paidAmount: record.paid_amount,
        invoiceType: record.invoice_type,
        invoiceIssued: record.invoice_issued === 1,
        status: record.status,
        remark: record.remark,
        createdBy: record.created_by,
        createdAt: record.created_at,
        items: items.map((item: any) => {
          // 加载产品信息
          const product = this.db!.prepare('SELECT name, spec, unit FROM products WHERE id = ?').get(item.product_id) as any
          return {
            id: item.id,
            inboundId: item.inbound_id,
            productId: item.product_id,
            productName: product?.name || '',
            specification: product?.spec || '',
            unit: product?.unit || '',
            quantity: item.quantity,
            unitPrice: item.unit_price,
            unitPriceEx: item.unit_price_ex,
            taxRate: item.tax_rate === 0 ? '免税' : item.tax_rate,
            taxAmount: item.tax_amount,
            totalAmount: item.total_amount,
            totalAmountEx: item.total_amount_ex,
            allowDeduction: item.allow_deduction === 1,
            deductionAmount: item.deduction_amount
          }
        })
      }
    })
    
    return {
      total: total.count,
      page,
      pageSize,
      data: enrichedData
    }
  }

  addInbound(inbound: any): number {
    try {
      console.log('【Electron 后端】收到入库单数据:', inbound)
      
      // 开启事务
      const transaction = this.db!.transaction(() => {
        // 提取 items 数据
        const items = inbound.items || []
        console.log('【Electron 后端】明细项数量:', items.length)
        
        delete inbound.items
        
        // 插入主表
        const id = this.insert('purchase_inbound', inbound)
        console.log('【Electron 后端】主表插入成功，ID:', id)
        
        // 插入明细表
        if (items.length > 0) {
          items.forEach((item: any, index: number) => {
            const itemData = {
              inbound_id: id,
              ...item
            }
            console.log(`【Electron 后端】插入明细项 ${index + 1}:`, itemData)
            this.insert('purchase_inbound_items', itemData)
          })
          console.log('【Electron 后端】所有明细项插入完成')
        } else {
          console.warn('【Electron 后端】没有明细项需要插入')
        }
        
        return id
      })
      
      const id = transaction()
      console.log('【Electron 后端】事务执行完成，返回 ID:', id)
      return id
    } catch (error) {
      console.error('【Electron 后端】添加入库单失败:', error)
      throw error
    }
  }

  updateInbound(inbound: any): number {
    try {
      console.log('【Electron 后端】更新入库单数据:', inbound)
      
      // 开启事务
      const transaction = this.db!.transaction(() => {
        const id = inbound.id
        const items = inbound.items || []
        
        // 删除原有明细
        this.db!.prepare('DELETE FROM purchase_inbound_items WHERE inbound_id = ?').run(id)
        console.log('【Electron 后端】已删除原有明细项')
        
        // 提取主表数据，确保不包含 items 字段
        const mainData: any = {}
        for (const key in inbound) {
          if (key !== 'items' && key !== 'id') {
            mainData[key] = inbound[key]
          }
        }
        
        // 更新主表
        this.update('purchase_inbound', mainData, 'id = ?', [id])
        console.log('【Electron 后端】主表更新成功，ID:', id)
        
        // 插入新明细
        if (items.length > 0) {
          items.forEach((item: any, index: number) => {
            const itemData = {
              inbound_id: id,
              ...item
            }
            console.log(`【Electron 后端】更新明细项 ${index + 1}:`, itemData)
            this.insert('purchase_inbound_items', itemData)
          })
          console.log('【Electron 后端】所有明细项更新完成')
        } else {
          console.warn('【Electron 后端】没有明细项需要插入')
        }
        
        return id
      })
      
      const resultId = transaction()
      console.log('【Electron 后端】事务执行完成，返回 ID:', resultId)
      return resultId
    } catch (error) {
      console.error('【Electron 后端】更新入库单失败:', error)
      throw error
    }
  }

  deleteInbound(id: number): number {
    try {
      console.log('【Electron 后端】删除入库单，ID:', id)
      
      const transaction = this.db!.transaction(() => {
        // 先删除明细
        this.db!.prepare('DELETE FROM purchase_inbound_items WHERE inbound_id = ?').run(id)
        console.log('【Electron 后端】已删除入库单明细项')
        
        // 再删除主表
        const result = this.delete('purchase_inbound', 'id = ?', [id])
        console.log('【Electron 后端】主表删除完成')
        
        return result
      })
      
      const result = transaction()
      return result
    } catch (error) {
      console.error('【Electron 后端】删除入库单失败:', error)
      throw error
    }
  }

  // 销售出库相关方法
  getOutboundList(page: number = 1, pageSize: number = 10, where?: string, params?: any[]): any {
    let whereClause = where ? `WHERE ${where}` : ''
    const offset = (page - 1) * pageSize
    
    const countSql = `SELECT COUNT(*) as count FROM sales_outbound ${whereClause}`
    const total = whereClause && params && params.length > 0
      ? this.db!.prepare(countSql).get(...params)
      : this.db!.prepare(countSql).get()
    
    const dataSql = `SELECT * FROM sales_outbound ${whereClause} ORDER BY outbound_date DESC LIMIT ? OFFSET ?`
    const data = whereClause && params && params.length > 0
      ? this.db!.prepare(dataSql).all(...params, pageSize, offset)
      : this.db!.prepare(dataSql).all(pageSize, offset)
    
    // 为每个出库单加载明细数据
    const enrichedData = data.map((record: any) => {
      const itemsSql = `SELECT * FROM sales_outbound_items WHERE outbound_id = ?`
      const items = this.db!.prepare(itemsSql).all(record.id)
      
      // 加载客户和仓库信息
      const customer = this.db!.prepare('SELECT name FROM customers WHERE id = ?').get(record.customer_id) as any
      const warehouse = this.db!.prepare('SELECT name FROM warehouses WHERE id = ?').get(record.warehouse_id) as any
      
      return {
        id: record.id,
        voucherNo: record.outbound_no,
        voucherDate: record.outbound_date,
        customerId: record.customer_id,
        customerName: customer?.name || '',
        warehouseId: record.warehouse_id,
        warehouseName: warehouse?.name || '',
        totalAmount: record.total_amount,
        status: record.status,
        remark: record.remark,
        createdBy: record.created_by,
        createdAt: record.created_at,
        items: items.map((item: any) => {
          return {
            id: item.id,
            outboundId: item.outbound_id,
            productId: item.product_id,
            productName: item.product_name || '',
            specification: item.specification || '',
            unit: item.unit || '',
            quantity: item.quantity,
            unitPriceEx: item.unit_price_ex || 0,
            unitPrice: item.unit_price || 0,
            taxRate: item.tax_rate ?? item.taxRate ?? 0,
            taxAmount: item.tax_amount ?? item.taxAmount ?? 0,
            totalAmount: item.total_amount ?? item.totalAmount ?? ((item.quantity || 0) * (item.unit_price || 0)),
            deductionAmount: item.deduction_amount ?? item.deductionAmount ?? 0,
            allowDeduction: !!item.allow_deduction,
            costPrice: item.cost_price || 0
          }
        })
      }
    })
    
    return {
      total: total.count,
      page,
      pageSize,
      data: enrichedData
    }
  }

  addOutbound(outbound: any): number {
    try {
      console.log('【Electron 后端】收到出库单数据:', outbound)
      
      const transaction = this.db!.transaction(() => {
        const items = outbound.items || []
        console.log('【Electron 后端】明细项数量:', items.length)
        console.log('【Electron 后端】明细项原始数据:', JSON.stringify(items))
        
        delete outbound.items
        
        const id = this.insert('sales_outbound', outbound)
        console.log('【Electron 后端】主表插入成功，ID:', id)
        
        if (items.length > 0) {
          items.forEach((item: any, index: number) => {
            const enrichedItem = this.enrichOutboundItem(item)
            const itemData = {
              outbound_id: id,
              product_id: enrichedItem.product_id,
              product_name: enrichedItem.product_name || '',
              specification: enrichedItem.specification || '',
              quantity: enrichedItem.quantity || 0,
              unit: enrichedItem.unit || '',
              unit_price_ex: enrichedItem.unit_price_ex || 0,
              unit_price: enrichedItem.unit_price || 0,
              tax_rate: String(enrichedItem.tax_rate ?? ''),
              tax_amount: enrichedItem.tax_amount ?? 0,
              total_amount: enrichedItem.total_amount ?? 0,
              deduction_amount: enrichedItem.deduction_amount ?? 0,
              allow_deduction: enrichedItem.allow_deduction ? 1 : 0,
              cost_price: enrichedItem.cost_price || 0,
              remark: enrichedItem.remark || ''
            }
            console.log(`【Electron 后端】插入销售出库明细项 ${index + 1}:`, itemData)
            this.insert('sales_outbound_items', itemData)
          })
          console.log('【Electron 后端】所有销售出库明细项插入完成')
        } else {
          console.warn('【Electron 后端】没有销售出库明细项需要插入')
        }
        
        return id
      })
      
      const id = transaction()
      console.log('【Electron 后端】事务执行完成，返回 ID:', id)
      return id
    } catch (error) {
      console.error('【Electron 后端】添加销售出库单失败:', error)
      throw error
    }
  }

  enrichOutboundItem(item: any): any {
    const result = { ...item }
    if (!result.product_name || !result.specification || !result.unit || !result.unit_price || !result.unit_price_ex) {
      try {
        const product = this.db!.prepare('SELECT name, spec, unit, cost_price, sell_price FROM products WHERE id = ?').get(result.product_id) as any
        if (product) {
          if (!result.product_name) result.product_name = product.name || ''
          if (!result.specification) result.specification = product.spec || ''
          if (!result.unit) result.unit = product.unit || ''
          if (!result.unit_price_ex || result.unit_price_ex === 0) result.unit_price_ex = product.cost_price || 0
          if (!result.unit_price || result.unit_price === 0) result.unit_price = product.sell_price || product.cost_price || 0
        }
      } catch (e) { /* ignore */ }
    }
    if (!result.product_name) result.product_name = item.product_name || ''
    if (!result.specification) result.specification = item.specification || ''
    if (!result.unit) result.unit = item.unit || ''
    result.product_id = item.product_id
    result.quantity = item.quantity || 0
    result.unit_price_ex = result.unit_price_ex || item.unit_price_ex || item.unitPriceEx || 0
    result.unit_price = result.unit_price || item.unit_price || item.unitPrice || 0
    result.tax_rate = item.taxRate ?? item.tax_rate ?? ''
    result.tax_amount = item.taxAmount ?? item.tax_amount ?? 0
    result.total_amount = item.totalAmount ?? item.total_amount ?? ((result.quantity || 0) * (result.unit_price || 0))
    result.deduction_amount = item.deductionAmount ?? item.deduction_amount ?? 0
    result.allow_deduction = item.allowDeduction ?? item.allow_deduction ?? 0
    result.cost_price = result.cost_price || item.cost_price || result.unit_price_ex || 0
    result.remark = item.remark || ''
    return result
  }

  updateOutbound(outbound: any): number {
    try {
      const id = outbound.id
      const items = outbound.items || []
      delete outbound.items
      delete outbound.id
      
      const transaction = this.db!.transaction(() => {
        this.db!.prepare('DELETE FROM sales_outbound_items WHERE outbound_id = ?').run(id)
        
        this.update('sales_outbound', outbound, 'id = ?', [id])
        
        if (items.length > 0) {
          items.forEach((item: any) => {
            const enrichedItem = this.enrichOutboundItem(item)
            const itemData = {
              outbound_id: id,
              product_id: enrichedItem.product_id,
              product_name: enrichedItem.product_name || '',
              specification: enrichedItem.specification || '',
              quantity: enrichedItem.quantity || 0,
              unit: enrichedItem.unit || '',
              unit_price_ex: enrichedItem.unit_price_ex || 0,
              unit_price: enrichedItem.unit_price || 0,
              tax_rate: String(enrichedItem.tax_rate ?? ''),
              tax_amount: enrichedItem.tax_amount ?? 0,
              total_amount: enrichedItem.total_amount ?? 0,
              deduction_amount: enrichedItem.deduction_amount ?? 0,
              allow_deduction: enrichedItem.allow_deduction ? 1 : 0,
              cost_price: enrichedItem.cost_price || 0,
              remark: enrichedItem.remark || ''
            }
            this.insert('sales_outbound_items', itemData)
          })
        }
        
        return id
      })
      
      return transaction()
    } catch (error) {
      console.error('【Electron 后端】更新销售出库单失败:', error)
      throw error
    }
  }

  deleteOutbound(id: number): number {
    return this.delete('sales_outbound', 'id = ?', [id])
  }

  // 采购退货相关方法
  addPurchaseReturn(returnData: any): number {
    try {
      console.log('【Electron 后端】收到采购退货单数据:', returnData)
      
      // 开启事务
      const transaction = this.db!.transaction(() => {
        // 提取 items 数据，只保存数量>0的商品
        const items = (returnData.items || []).filter((item: any) => item.quantity > 0)
        console.log('【Electron 后端】需要保存的退货明细项数量（数量>0）:', items.length)
        
        delete returnData.items
        
        // 插入主表
        const id = this.insert('purchase_returns', returnData)
        console.log('【Electron 后端】采购退货主表插入成功，ID:', id)
        
        // 插入明细表
        if (items.length > 0) {
          items.forEach((item: any, index: number) => {
            const itemData = {
              return_id: id,
              product_id: item.product_id,
              quantity: item.quantity,
              cost_price: item.cost_price || item.unit_price || 0,
              remark: item.remark || '',
              original_item_index: item.original_item_index
            }
            console.log(`【Electron 后端】插入采购退货明细项 ${index + 1}:`, itemData)
            this.insert('purchase_return_items', itemData)
          })
          console.log('【Electron 后端】所有采购退货明细项插入完成')
        } else {
          console.warn('【Electron 后端】没有采购退货明细项需要插入')
        }
        
        return id
      })
      
      const id = transaction()
      console.log('【Electron 后端】采购退货事务执行完成，返回 ID:', id)
      return id
    } catch (error) {
      console.error('【Electron 后端】添加采购退货单失败:', error)
      throw error
    }
  }

  getPurchaseReturns(page: number = 1, pageSize: number = 10): any {
    const offset = (page - 1) * pageSize
    
    const countSql = `SELECT COUNT(*) as count FROM purchase_returns`
    const total = this.db!.prepare(countSql).get() as any
    
    const dataSql = `SELECT * FROM purchase_returns ORDER BY created_at DESC LIMIT ? OFFSET ?`
    const data = this.db!.prepare(dataSql).all(pageSize, offset)
    
    // 为每个退货单加载明细数据
    const enrichedData = data.map((record: any) => {
      const itemsSql = `SELECT * FROM purchase_return_items WHERE return_id = ?`
      const items = this.db!.prepare(itemsSql).all(record.id)
      return {
        ...record,
        items
      }
    })
    
    return {
      total: total.count,
      page,
      pageSize,
      data: enrichedData
    }
  }

  updatePurchaseReturn(returnData: any): number {
    try {
      console.log('【Electron 后端】更新采购退货单数据:', returnData)
      
      // 开启事务
      const transaction = this.db!.transaction(() => {
        const id = returnData.id
        const items = (returnData.items || []).filter((item: any) => item.quantity > 0) // 只保存数量>0的商品
        
        // 删除原有明细
        this.db!.prepare('DELETE FROM purchase_return_items WHERE return_id = ?').run(id)
        console.log('【Electron 后端】已删除原有退货明细项')
        
        // 提取主表数据，确保不包含 items 字段
        const mainData: any = {}
        for (const key in returnData) {
          if (key !== 'items' && key !== 'id') {
            mainData[key] = returnData[key]
          }
        }
        
        // 更新主表
        this.update('purchase_returns', mainData, 'id = ?', [id])
        console.log('【Electron 后端】退货主表更新成功，ID:', id)
        
        // 插入新明细
        if (items.length > 0) {
          items.forEach((item: any, index: number) => {
            const itemData = {
              return_id: id,
              product_id: item.product_id,
              quantity: item.quantity,
              cost_price: item.cost_price || item.unit_price || 0,
              remark: item.remark || '',
              original_item_index: item.original_item_index
            }
            console.log(`【Electron 后端】更新退货明细项 ${index + 1}:`, itemData)
            this.insert('purchase_return_items', itemData)
          })
          console.log('【Electron 后端】所有退货明细项更新完成')
        } else {
          console.warn('【Electron 后端】没有退货明细项需要插入')
        }
        
        return id
      })
      
      const resultId = transaction()
      console.log('【Electron 后端】退货事务执行完成，返回 ID:', resultId)
      return resultId
    } catch (error) {
      console.error('【Electron 后端】更新采购退货单失败:', error)
      throw error
    }
  }

  deletePurchaseReturn(id: number): number {
    try {
      console.log('【Electron 后端】删除采购退货单，ID:', id)
      
      if (!this.db) {
        throw new Error('数据库未初始化')
      }
      
      // 先删除明细
      this.db.prepare('DELETE FROM purchase_return_items WHERE return_id = ?').run(id)
      console.log('【Electron 后端】已删除采购退货单明细项')
      
      // 再删除主表
      const result = this.db.prepare('DELETE FROM purchase_returns WHERE id = ?').run(id)
      console.log('【Electron 后端】采购退货单主表删除完成，影响行数:', result.changes)
      
      return result.changes
    } catch (error: any) {
      console.error('【Electron 后端】删除采购退货单失败:', error)
      console.error('【Electron 后端】错误详情:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      })
      throw error
    }
  }

  // 销售退货相关方法
  addSalesReturn(returnData: any): number {
    try {
      console.log('【Electron 后端】收到销售退货单数据:', returnData)
      
      // 开启事务
      const transaction = this.db!.transaction(() => {
        // 提取 items 数据
        const items = returnData.items || []
        console.log('【Electron 后端】退货明细项数量:', items.length)
        
        delete returnData.items
        
        // 插入主表
        const id = this.insert('sales_returns', returnData)
        console.log('【Electron 后端】销售退货主表插入成功，ID:', id)
        
        // 插入明细表
        if (items.length > 0) {
          items.forEach((item: any, index: number) => {
            const itemData = {
              return_id: id,
              product_id: item.product_id,
              quantity: item.quantity,
              cost_price: item.cost_price || item.unit_price || 0,
              remark: item.remark || ''
            }
            console.log(`【Electron 后端】插入销售退货明细项 ${index + 1}:`, itemData)
            this.insert('sales_return_items', itemData)
          })
          console.log('【Electron 后端】所有销售退货明细项插入完成')
        } else {
          console.warn('【Electron 后端】没有销售退货明细项需要插入')
        }
        
        return id
      })
      
      const id = transaction()
      console.log('【Electron 后端】销售退货事务执行完成，返回 ID:', id)
      return id
    } catch (error) {
      console.error('【Electron 后端】添加销售退货单失败:', error)
      throw error
    }
  }

  getSalesReturns(page: number = 1, pageSize: number = 10): any {
    const offset = (page - 1) * pageSize
    
    const countSql = `SELECT COUNT(*) as count FROM sales_returns`
    const total = this.db!.prepare(countSql).get() as any
    
    const dataSql = `SELECT * FROM sales_returns ORDER BY created_at DESC LIMIT ? OFFSET ?`
    const data = this.db!.prepare(dataSql).all(pageSize, offset)
    
    // 为每个退货单加载明细数据
    const enrichedData = data.map((record: any) => {
      const itemsSql = `SELECT * FROM sales_return_items WHERE return_id = ?`
      const items = this.db!.prepare(itemsSql).all(record.id)
      return {
        ...record,
        items
      }
    })
    
    return {
      total: total.count,
      page,
      pageSize,
      data: enrichedData
    }
  }

  updateSalesReturn(returnData: any): number {
    const id = returnData.id
    delete returnData.id
    return this.update('sales_returns', returnData, 'id = ?', [id])
  }

  deleteSalesReturn(id: number): number {
    let tempDb: Database.Database | null = null
    try {
      console.log('【Electron 后端】删除销售退货单，ID:', id)
      console.log('【Electron 后端】使用独立数据库连接进行删除操作')
      
      // 创建独立的数据库连接，避免与其他操作的冲突
      tempDb = new Database(this.dbPath)
      tempDb.pragma('journal_mode = WAL')
      
      // 先删除明细
      tempDb.prepare('DELETE FROM sales_return_items WHERE return_id = ?').run(id)
      console.log('【Electron 后端】已删除销售退货单明细项')
      
      // 再删除主表
      const result = tempDb.prepare('DELETE FROM sales_returns WHERE id = ?').run(id)
      console.log('【Electron 后端】销售退货单主表删除完成，影响行数:', result.changes)
      
      return result.changes
    } catch (error: any) {
      console.error('【Electron 后端】删除销售退货单失败:', error)
      console.error('【Electron 后端】错误详情:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
        dbPath: this.dbPath
      })
      throw error
    } finally {
      // 确保关闭临时连接
      if (tempDb) {
        try {
          tempDb.close()
          console.log('【Electron 后端】临时数据库连接已关闭')
        } catch (closeError) {
          console.error('【Electron 后端】关闭临时连接失败:', closeError)
        }
      }
    }
  }

  // 库存调拨相关方法
  getTransferList(page: number = 1, pageSize: number = 10, where?: string, params?: any[]): any {
    let whereClause = where ? `WHERE ${where}` : ''
    const offset = (page - 1) * pageSize
    
    const countSql = `SELECT COUNT(*) as count FROM transfer_records ${whereClause}`
    const total = this.db!.prepare(countSql).get(...(params || [])) as any
    
    const dataSql = `SELECT * FROM transfer_records ${whereClause} ORDER BY transfer_date DESC LIMIT ? OFFSET ?`
    const data = this.db!.prepare(dataSql).all(...(params || []), pageSize, offset)
    
    // 为每个调拨单加载明细数据
    const enrichedData = data.map((record: any) => {
      const itemsSql = `SELECT * FROM transfer_record_items WHERE transfer_id = ?`
      const items = this.db!.prepare(itemsSql).all(record.id)
      return {
        ...record,
        items
      }
    })
    
    return {
      total: total.count,
      page,
      pageSize,
      data: enrichedData
    }
  }

  addTransfer(transfer: any): number {
    try {
      // 开启事务
      const transaction = this.db!.transaction(() => {
        // 提取 items 数据
        const items = transfer.items || []
        delete transfer.items
        
        // 插入主表
        const id = this.insert('transfer_records', transfer)
        
        // 插入明细表
        if (items.length > 0) {
          items.forEach((item: any) => {
            const itemData = {
              transfer_id: id,
              product_id: item.product_id,
              quantity: item.quantity,
              cost: item.cost || 0,
              amount: item.amount || 0,
              remark: item.remark || ''
            }
            this.insert('transfer_record_items', itemData)
          })
        }
        
        return id
      })
      
      return transaction()
    } catch (error) {
      console.error('添加调拨单失败:', error)
      throw error
    }
  }

  updateTransfer(transfer: any): number {
    const id = transfer.id
    delete transfer.id
    return this.update('transfer_records', transfer, 'id = ?', [id])
  }

  deleteTransfer(id: number): number {
    return this.delete('transfer_records', 'id = ?', [id])
  }

  // 库存查询
  getInventory(warehouseId?: number, productCode?: string): any[] {
    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    
    if (warehouseId) {
      whereClause += ' AND warehouse_id = ?'
      params.push(warehouseId)
    }
    
    if (productCode) {
      whereClause += ' AND product_code = ?'
      params.push(productCode)
    }
    
    const sql = `SELECT * FROM inventory_balance ${whereClause} ORDER BY warehouse_id, product_code`
    return this.db!.prepare(sql).all(...params)
  }

  // 获取单个产品在单个仓库的实时库存
  getProductStock(productId: number, warehouseId: number): number {
    let stock = 0

    // 1. 加入库单
    const inboundItems = this.db!.prepare(`
      SELECT ii.* 
      FROM purchase_inbound_items ii
      JOIN purchase_inbound pi ON ii.inbound_id = pi.id
      WHERE ii.product_id = ? AND pi.warehouse_id = ?
    `).all(productId, warehouseId) as any[]

    inboundItems.forEach(item => {
      stock += item.quantity
    })

    // 2. 加销售退货单
    const salesReturnItems = this.db!.prepare(`
      SELECT sri.* 
      FROM sales_return_items sri
      JOIN sales_returns sr ON sri.return_id = sr.id
      WHERE sri.product_id = ? AND sr.warehouse_id = ?
    `).all(productId, warehouseId) as any[]

    salesReturnItems.forEach(item => {
      stock += item.quantity
    })

    // 3. 减销售出库单
    const outboundItems = this.db!.prepare(`
      SELECT soi.* 
      FROM sales_outbound_items soi
      JOIN sales_outbound so ON soi.outbound_id = so.id
      WHERE soi.product_id = ? AND so.warehouse_id = ?
    `).all(productId, warehouseId) as any[]

    outboundItems.forEach(item => {
      stock -= item.quantity
    })

    // 4. 减采购退货单
    const purchaseReturnItems = this.db!.prepare(`
      SELECT pri.* 
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pri.return_id = pr.id
      WHERE pri.product_id = ? AND pr.warehouse_id = ?
    `).all(productId, warehouseId) as any[]

    purchaseReturnItems.forEach(item => {
      stock -= item.quantity
    })

    return stock
  }

  close() {
    if (this.db) {
      this.db.close()
    }
  }
}

export default InventoryDatabase
