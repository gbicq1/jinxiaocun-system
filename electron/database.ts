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
      
      // 检查 purchase_return_items 表是否有单价和金额字段
      const prNewCols = [
        { name: 'product_name', sql: 'ALTER TABLE purchase_return_items ADD COLUMN product_name VARCHAR(200)' },
        { name: 'specification', sql: 'ALTER TABLE purchase_return_items ADD COLUMN specification VARCHAR(200)' },
        { name: 'unit', sql: 'ALTER TABLE purchase_return_items ADD COLUMN unit VARCHAR(50)' },
        { name: 'unit_price', sql: 'ALTER TABLE purchase_return_items ADD COLUMN unit_price DECIMAL(14,4)' },
        { name: 'unit_price_ex', sql: 'ALTER TABLE purchase_return_items ADD COLUMN unit_price_ex DECIMAL(14,4)' },
        { name: 'tax_rate', sql: 'ALTER TABLE purchase_return_items ADD COLUMN tax_rate VARCHAR(20)' },
        { name: 'tax_amount', sql: 'ALTER TABLE purchase_return_items ADD COLUMN tax_amount DECIMAL(14,2)' },
        { name: 'total_amount', sql: 'ALTER TABLE purchase_return_items ADD COLUMN total_amount DECIMAL(14,2)' },
      ]
      for (const col of prNewCols) {
        if (!prColumns.some(c => c.name === col.name)) {
          console.log(`添加 purchase_return_items.${col.name} 字段`)
          this.db!.exec(col.sql)
        }
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
      
      // 检查 sales_returns 表是否有 handler_name 字段
      const srMainColumns = this.db!.prepare("PRAGMA table_info(sales_returns)").all() as any[]
      const hasSrHandlerName = srMainColumns.some(col => col.name === 'handler_name')
      if (!hasSrHandlerName) {
        console.log('添加 sales_returns.handler_name 字段')
        this.db!.exec('ALTER TABLE sales_returns ADD COLUMN handler_name TEXT')
      }
      
      const hasTotalInc = srMainColumns.some(col => col.name === 'total_inc')
      if (!hasTotalInc) {
        console.log('添加 sales_returns.total_inc 字段')
        this.db!.exec('ALTER TABLE sales_returns ADD COLUMN total_inc DECIMAL(10,2)')
      }
      
      // 检查 sales_return_items 表是否缺少字段
      const sriColumns = this.db!.prepare("PRAGMA table_info(sales_return_items)").all() as any[]
      const sriNewCols = [
        { name: 'product_name', sql: 'ALTER TABLE sales_return_items ADD COLUMN product_name VARCHAR(200)' },
        { name: 'specification', sql: 'ALTER TABLE sales_return_items ADD COLUMN specification VARCHAR(200)' },
        { name: 'unit', sql: 'ALTER TABLE sales_return_items ADD COLUMN unit VARCHAR(50)' },
        { name: 'unit_price', sql: 'ALTER TABLE sales_return_items ADD COLUMN unit_price DECIMAL(14,4)' },
        { name: 'unit_price_incl', sql: 'ALTER TABLE sales_return_items ADD COLUMN unit_price_incl DECIMAL(14,4)' },
        { name: 'tax_rate', sql: 'ALTER TABLE sales_return_items ADD COLUMN tax_rate DECIMAL(10,2)' },
        { name: 'tax_amount', sql: 'ALTER TABLE sales_return_items ADD COLUMN tax_amount DECIMAL(14,2)' },
        { name: 'amount', sql: 'ALTER TABLE sales_return_items ADD COLUMN amount DECIMAL(14,2)' },
        { name: 'total_inc', sql: 'ALTER TABLE sales_return_items ADD COLUMN total_inc DECIMAL(14,2)' },
        { name: 'original_quantity', sql: 'ALTER TABLE sales_return_items ADD COLUMN original_quantity DECIMAL(14,4)' },
      ]
      for (const col of sriNewCols) {
        if (!sriColumns.some(c => c.name === col.name)) {
          console.log(`添加 sales_return_items.${col.name} 字段`)
          this.db!.exec(col.sql)
        }
      }
      
      // 检查 purchase_returns 表是否有 operator 字段
      const prMainColumns = this.db!.prepare("PRAGMA table_info(purchase_returns)").all() as any[]
      const hasOperator = prMainColumns.some(col => col.name === 'operator')
      if (!hasOperator) {
        console.log('添加 purchase_returns.operator 字段')
        this.db!.exec('ALTER TABLE purchase_returns ADD COLUMN operator TEXT')
      }
      
      // 检查 purchase_returns 表是否有 invoice_issued 字段
      const hasInvoiceIssued = prMainColumns.some(col => col.name === 'invoice_issued')
      if (!hasInvoiceIssued) {
        console.log('添加 purchase_returns.invoice_issued 字段')
        this.db!.exec('ALTER TABLE purchase_returns ADD COLUMN invoice_issued BOOLEAN DEFAULT 0')
      }
      
      // 检查 purchase_returns 表是否有 invoice_type 字段
      const hasInvoiceType = prMainColumns.some(col => col.name === 'invoice_type')
      if (!hasInvoiceType) {
        console.log('添加 purchase_returns.invoice_type 字段')
        this.db!.exec('ALTER TABLE purchase_returns ADD COLUMN invoice_type VARCHAR(20)')
      }
      
      // 检查 purchase_return_items 表是否缺少字段
      const priColumns = this.db!.prepare("PRAGMA table_info(purchase_return_items)").all() as any[]
      const priNewCols = [
        { name: 'product_name', sql: 'ALTER TABLE purchase_return_items ADD COLUMN product_name VARCHAR(200)' },
        { name: 'specification', sql: 'ALTER TABLE purchase_return_items ADD COLUMN specification VARCHAR(200)' },
        { name: 'unit', sql: 'ALTER TABLE purchase_return_items ADD COLUMN unit VARCHAR(50)' },
        { name: 'unit_price', sql: 'ALTER TABLE purchase_return_items ADD COLUMN unit_price DECIMAL(14,4)' },
        { name: 'unit_price_ex', sql: 'ALTER TABLE purchase_return_items ADD COLUMN unit_price_ex DECIMAL(14,4)' },
        { name: 'tax_rate', sql: 'ALTER TABLE purchase_return_items ADD COLUMN tax_rate VARCHAR(20)' },
        { name: 'tax_amount', sql: 'ALTER TABLE purchase_return_items ADD COLUMN tax_amount DECIMAL(14,2)' },
        { name: 'total_amount', sql: 'ALTER TABLE purchase_return_items ADD COLUMN total_amount DECIMAL(14,2)' },
        { name: 'allow_deduction', sql: 'ALTER TABLE purchase_return_items ADD COLUMN allow_deduction BOOLEAN DEFAULT 0' },
        { name: 'deduction_amount', sql: 'ALTER TABLE purchase_return_items ADD COLUMN deduction_amount DECIMAL(14,2) DEFAULT 0' }
      ]
      for (const col of priNewCols) {
        if (!priColumns.some(c => c.name === col.name)) {
          console.log(`添加 purchase_return_items.${col.name} 字段`)
          this.db!.exec(col.sql)
        }
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

    // 销售出库明细表（已在前面创建，此处跳过避免重复）
    // 注意：sales_outbound_items 表的定义和字段扩展已在前面完成

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
        operator VARCHAR(50),
        invoice_issued BOOLEAN DEFAULT 0,
        invoice_type VARCHAR(20),
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
        product_name VARCHAR(200),
        specification VARCHAR(200),
        unit VARCHAR(50),
        quantity INTEGER,
        unit_price DECIMAL(14,4),
        unit_price_ex DECIMAL(14,4),
        tax_rate VARCHAR(20),
        tax_amount DECIMAL(14,2),
        total_amount DECIMAL(14,2),
        cost_price DECIMAL(10,2),
        allow_deduction BOOLEAN DEFAULT 0,
        deduction_amount DECIMAL(14,2) DEFAULT 0,
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
        product_name VARCHAR(200),
        specification VARCHAR(200),
        unit VARCHAR(50),
        quantity INTEGER,
        unit_price DECIMAL(14,4),
        total_amount DECIMAL(14,2),
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

    // 收款单表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_no VARCHAR(50) UNIQUE NOT NULL,
        customer_id INTEGER,
        receipt_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        amount DECIMAL(10,2),
        payment_method VARCHAR(20),
        remark TEXT,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `)

    // 库存期初期末表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inventory_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        warehouse_id INTEGER,
        period_date DATE NOT NULL,
        period_type VARCHAR(20) DEFAULT 'opening',
        quantity DECIMAL(14,4) DEFAULT 0,
        amount DECIMAL(14,2) DEFAULT 0,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    `)

    // 角色表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(50) NOT NULL,
        code VARCHAR(50) UNIQUE,
        description TEXT,
        permissions TEXT,
        status INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 用户表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(200),
        real_name VARCHAR(50),
        role_id INTEGER,
        phone VARCHAR(20),
        email VARCHAR(100),
        status INTEGER DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      )
    `)

    // 价格表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS price_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        product_code VARCHAR(50),
        supplier_id INTEGER,
        purchase_price DECIMAL(10,2),
        sale_price DECIMAL(10,2),
        effective_date DATE,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)

    // 添加缺失的字段到 purchase_inbound 表
    try { this.db.exec(`ALTER TABLE purchase_inbound ADD COLUMN invoice_date DATETIME`) } catch(_) {}
    try { this.db.exec(`ALTER TABLE purchase_inbound ADD COLUMN invoiced_amount DECIMAL(10,2) DEFAULT 0`) } catch(_) {}
    
    // 采购开票记录表（独立存储开票信息，不影响原始入库单）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_invoice_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inbound_no VARCHAR(50) NOT NULL,
        inbound_id INTEGER,
        invoice_amount DECIMAL(10,2),
        invoice_date DATETIME,
        invoice_issued BOOLEAN DEFAULT 0,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inbound_id) REFERENCES purchase_inbound(id)
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

  getSuppliers(): any[] {
    return this.getAllSuppliers()
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

  getCustomers(): any[] {
    return this.getAllCustomers()
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
        invoiceDate: record.invoice_date,
        invoicedAmount: record.invoiced_amount,
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
        const items = inbound.items
        
        // 只有当传入 items 时才删除并重新插入明细
        if (items !== undefined) {
          // 删除原有明细
          this.db!.prepare('DELETE FROM purchase_inbound_items WHERE inbound_id = ?').run(id)
          console.log('【Electron 后端】已删除原有明细项')
          
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
        } else {
          console.log('【Electron 后端】未传入 items，跳过明细更新')
        }
        
        // 只更新必要的字段
        const mainData: any = {
          id: id
        }
        
        // 只映射需要更新的字段
        if (inbound.inbound_no !== undefined) mainData.inbound_no = inbound.inbound_no
        if (inbound.inbound_date !== undefined) mainData.inbound_date = inbound.inbound_date
        if (inbound.supplier_id !== undefined) mainData.supplier_id = inbound.supplier_id
        if (inbound.warehouse_id !== undefined) mainData.warehouse_id = inbound.warehouse_id
        if (inbound.total_amount !== undefined) mainData.total_amount = inbound.total_amount
        if (inbound.paid_amount !== undefined) mainData.paid_amount = inbound.paid_amount
        if (inbound.invoice_type !== undefined) mainData.invoice_type = inbound.invoice_type
        if (inbound.invoice_issued !== undefined) mainData.invoice_issued = inbound.invoice_issued
        if (inbound.invoice_date !== undefined) mainData.invoice_date = inbound.invoice_date
        if (inbound.invoiced_amount !== undefined) mainData.invoiced_amount = inbound.invoiced_amount
        if (inbound.status !== undefined) mainData.status = inbound.status
        if (inbound.remark !== undefined) mainData.remark = inbound.remark
        
        console.log('【Electron 后端】更新入库单主表数据:', mainData)
        
        // 更新主表
        this.update('purchase_inbound', mainData, 'id = ?', [id])
        console.log('【Electron 后端】主表更新成功，ID:', id)
        
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
    try {
      console.log('【Electron 后端】删除销售出库单，ID:', id)
      
      const transaction = this.db!.transaction(() => {
        // 先删除明细
        this.db!.prepare('DELETE FROM sales_outbound_items WHERE outbound_id = ?').run(id)
        console.log('【Electron 后端】已删除销售出库单明细项')
        
        // 再删除主表
        const result = this.delete('sales_outbound', 'id = ?', [id])
        console.log('【Electron 后端】销售出库单主表删除完成')
        
        return result
      })
      
      const result = transaction()
      return result
    } catch (error) {
      console.error('【Electron 后端】删除销售出库单失败:', error)
      throw error
    }
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
              product_name: item.product_name || '',
              specification: item.specification || '',
              unit: item.unit || '',
              quantity: item.quantity,
              unit_price: item.unit_price || item.cost_price || 0,
              unit_price_ex: item.unit_price_ex || 0,
              tax_rate: item.tax_rate || 0,
              tax_amount: item.tax_amount || 0,
              total_amount: item.total_amount || 0,
              cost_price: item.cost_price || item.unit_price || 0,
              allow_deduction: item.allow_deduction || 0,
              deduction_amount: item.deduction_amount || 0,
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
      console.log('[数据库] 退货单 ID:', record.id, '明细数量:', items.length)
      if (items.length > 0) {
        console.log('[数据库] 第一个退货明细项:', items[0])
        console.log('[数据库] 第一个退货明细项字段:', Object.keys(items[0]))
      }
      return {
        ...record,
        voucherNo: record.return_no,
        originalVoucherNo: record.original_inbound_no,
        voucherDate: record.return_date,
        supplierId: record.supplier_id,
        warehouseId: record.warehouse_id,
        supplierName: record.supplier_name || '',
        warehouseName: record.warehouse_name || '',
        operator: record.operator || '',
        returnReason: record.return_reason || '',
        totalAmount: record.total_amount,
        invoiceIssued: record.invoice_issued === 1,
        invoiceType: record.invoice_type || '普票',
        items: items.map((item: any) => {
          // 如果退货明细中没有商品信息，从产品表中获取
          let productName = item.product_name
          let specification = item.specification
          let unit = item.unit
          
          if (!productName && item.product_id) {
            const product = this.db!.prepare('SELECT name, spec, unit FROM products WHERE id = ?').get(item.product_id) as any
            if (product) {
              productName = product.name
              specification = product.spec
              unit = product.unit
            }
          }
          
          // 优先使用退货明细中已保存的价格信息
          let unitPrice = item.unit_price
          let unitPriceEx = item.unit_price_ex
          let taxRate = item.tax_rate
          let taxAmount = item.tax_amount
          let totalAmount = item.total_amount
          
          console.log('[数据库] 退货明细已保存的价格:', { unitPrice, unitPriceEx, taxRate, taxAmount, totalAmount })
          
          // 只有当已保存的价格信息为空时，才从原入库单中获取
          if ((!unitPrice || unitPrice === 0 || !totalAmount || totalAmount === 0) && item.product_id) {
            try {
              // 获取退货单主表信息
              const returnMain = this.db!.prepare(
                'SELECT original_inbound_no FROM purchase_returns WHERE id = ?'
              ).get(item.return_id) as any
              
              console.log('[数据库] 退货单主表信息:', returnMain)
              
              if (returnMain && returnMain.original_inbound_no) {
                // 从原入库单中获取对应商品的价格
                const inbound = this.db!.prepare(
                  'SELECT id FROM purchase_inbound WHERE inbound_no = ?'
                ).get(returnMain.original_inbound_no) as any
                
                console.log('[数据库] 原入库单 ID:', inbound)
                
                if (inbound) {
                  const inboundItem = this.db!.prepare(
                    'SELECT unit_price, unit_price_ex, tax_rate, tax_amount, total_amount FROM purchase_inbound_items WHERE inbound_id = ? AND product_id = ?'
                  ).get(inbound.id, item.product_id) as any
                  
                  console.log('[数据库] 原入库单明细项:', inboundItem)
                  
                  if (inboundItem) {
                    unitPrice = unitPrice || inboundItem.unit_price
                    unitPriceEx = unitPriceEx || inboundItem.unit_price_ex
                    taxRate = taxRate || inboundItem.tax_rate
                    taxAmount = taxAmount || inboundItem.tax_amount
                    // 根据退货数量重新计算总金额
                    if (item.quantity && unitPrice) {
                      totalAmount = Math.abs(item.quantity) * unitPrice
                    } else {
                      totalAmount = totalAmount || inboundItem.total_amount
                    }
                  }
                }
              }
            } catch (e) {
              console.log('从原入库单获取价格信息失败:', e)
            }
          }
          
          console.log('[数据库] 退货明细最终价格:', { unitPrice, unitPriceEx, taxRate, taxAmount, totalAmount })
          
          return {
            productId: item.product_id,
            productName: productName || '',
            specification: specification || '',
            unit: unit || '',
            quantity: item.quantity,
            unitPrice: unitPrice || 0,
            unitPriceEx: unitPriceEx || 0,
            taxRate: taxRate || 0,
            taxAmount: taxAmount || 0,
            totalAmount: totalAmount || 0,
            deductionAmount: item.deduction_amount || 0,
            allowDeduction: item.allow_deduction === 1 || item.allow_deduction === true,
            original_item_index: item.original_item_index
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
              product_name: item.product_name || '',
              specification: item.specification || '',
              unit: item.unit || '',
              quantity: item.quantity,
              unit_price: item.unit_price || item.cost_price || 0,
              unit_price_ex: item.unit_price_ex || 0,
              tax_rate: item.tax_rate || 0,
              tax_amount: item.tax_amount || 0,
              total_amount: item.total_amount || 0,
              cost_price: item.cost_price || item.unit_price || 0,
              allow_deduction: item.allow_deduction || 0,
              deduction_amount: item.deduction_amount || 0,
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
              product_name: item.product_name || '',
              specification: item.specification || '',
              unit: item.unit || '',
              quantity: item.quantity,
              original_quantity: item.original_quantity || 0,
              unit_price: item.unit_price || 0,
              unit_price_incl: item.unit_price_incl || 0,
              tax_rate: item.tax_rate || 0,
              tax_amount: item.tax_amount || 0,
              amount: item.amount || 0,
              total_inc: item.total_inc || 0,
              cost_price: item.cost_price || 0,
              remark: item.remark || '',
              original_item_index: item.original_item_index !== undefined ? item.original_item_index : index
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
    try {
      const id = returnData.id
      console.log('【Electron 后端】更新销售退货单，ID:', id)
      
      // 开启事务
      const transaction = this.db!.transaction(() => {
        // 提取 items 数据
        const items = returnData.items || []
        delete returnData.id
        delete returnData.items  // 重要：删除 items，避免传给 update 方法
        
        // 更新主表
        this.update('sales_returns', returnData, 'id = ?', [id])
        console.log('【Electron 后端】销售退货主表更新成功，ID:', id)
        
        // 删除原有明细
        this.db!.prepare('DELETE FROM sales_return_items WHERE return_id = ?').run(id)
        console.log('【Electron 后端】已删除原有销售退货明细项')
        
        // 插入新明细
        if (items.length > 0) {
          items.forEach((item: any, index: number) => {
            const itemData = {
              return_id: id,
              product_id: item.product_id,
              product_name: item.product_name || '',
              specification: item.specification || '',
              unit: item.unit || '',
              quantity: item.quantity,
              original_quantity: item.original_quantity || 0,
              unit_price: item.unit_price || 0,
              unit_price_incl: item.unit_price_incl || 0,
              tax_rate: item.tax_rate || 0,
              tax_amount: item.tax_amount || 0,
              amount: item.amount || 0,
              total_inc: item.total_inc || 0,
              cost_price: item.cost_price || 0,
              remark: item.remark || '',
              original_item_index: item.original_item_index !== undefined ? item.original_item_index : index
            }
            console.log(`【Electron 后端】更新销售退货明细项 ${index + 1}:`, itemData)
            this.insert('sales_return_items', itemData)
          })
          console.log('【Electron 后端】所有销售退货明细项更新完成')
        } else {
          console.warn('【Electron 后端】没有销售退货明细项需要更新')
        }
        
        return id
      })
      
      transaction()
      return id
    } catch (error) {
      console.error('【Electron 后端】更新销售退货单失败:', error)
      throw error
    }
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
    console.log(`[getProductLedger] 销售退货: ${salesReturnItems.length} 条`)

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
    console.log(`[getProductLedger] 销售出库: ${outboundItems.length} 条`)

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
    console.log(`[getProductLedger] 采购退货: ${purchaseReturnItems.length} 条`)

    purchaseReturnItems.forEach(item => {
      stock -= item.quantity
    })

    return stock
  }

  // ==================== 采购订单 ====================

  getPurchaseOrders(): any[] {
    const orders = this.db!.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.status != 'deleted'
      ORDER BY po.created_at DESC
    `).all() as any[]

    return orders.map(order => ({
      ...order,
      items: this.db!.prepare(`
        SELECT poi.*, p.code as product_code, p.name as product_name, p.unit
        FROM purchase_order_items poi
        LEFT JOIN products p ON poi.product_id = p.id
        WHERE poi.order_id = ?
      `).all(order.id)
    }))
  }

  addPurchaseOrder(data: any): number {
    const id = this.insert('purchase_orders', data)
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        this.insert('purchase_order_items', { ...item, order_id: id })
      }
    }
    return id
  }

  updatePurchaseOrder(data: any): number {
    const id = data.id
    delete data.id
    delete data.items
    delete data.supplier_name
    this.update('purchase_orders', data, 'id = ?', [id])
    if (data.items && Array.isArray(data.items)) {
      this.db!.prepare('DELETE FROM purchase_order_items WHERE order_id = ?').run(id)
      for (const item of data.items) {
        this.insert('purchase_order_items', { ...item, order_id: id })
      }
    }
    return id
  }

  deletePurchaseOrder(id: number): number {
    this.update('purchase_orders', { status: 'deleted' }, 'id = ?', [id])
    return 1
  }

  // ==================== 采购申请 ====================

  getPurchaseRequests(): any[] {
    const requests = this.db!.prepare(`
      SELECT * FROM purchase_requests
      WHERE status != 'deleted'
      ORDER BY created_at DESC
    `).all() as any[]

    return requests.map(request => ({
      ...request,
      items: this.db!.prepare(`
        SELECT pri.*, p.code as product_code, p.name as product_name, p.unit
        FROM purchase_request_items pri
        LEFT JOIN products p ON pri.product_id = p.id
        WHERE pri.request_id = ?
      `).all(request.id)
    }))
  }

  addPurchaseRequest(data: any): number {
    const id = this.insert('purchase_requests', data)
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        this.insert('purchase_request_items', { ...item, request_id: id })
      }
    }
    return id
  }

  updatePurchaseRequest(data: any): number {
    const id = data.id
    delete data.id
    delete data.items
    this.update('purchase_requests', data, 'id = ?', [id])
    if (data.items && Array.isArray(data.items)) {
      this.db!.prepare('DELETE FROM purchase_request_items WHERE request_id = ?').run(id)
      for (const item of data.items) {
        this.insert('purchase_request_items', { ...item, request_id: id })
      }
    }
    return id
  }

  deletePurchaseRequest(id: number): number {
    this.update('purchase_requests', { status: 'deleted' }, 'id = ?', [id])
    return 1
  }

  // ==================== 销售订单/报价 ====================

  getSalesOrders(): any[] {
    const orders = this.db!.prepare(`
      SELECT so.*, c.name as customer_name
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      WHERE so.status != 'deleted'
      ORDER BY so.created_at DESC
    `).all() as any[]

    return orders.map(order => ({
      ...order,
      items: this.db!.prepare(`
        soi.*, p.code as product_code, p.name as product_name, p.unit
        FROM sales_order_items soi
        LEFT JOIN products p ON soi.product_id = p.id
        WHERE soi.order_id = ?
      `).all(order.id)
    }))
  }

  getSalesQuotes(): any[] {
    const quotes = this.db!.prepare(`
      SELECT sq.*, c.name as customer_name
      FROM sales_quotes sq
      LEFT JOIN customers c ON sq.customer_id = c.id
      WHERE sq.status != 'deleted'
      ORDER BY sq.created_at DESC
    `).all() as any[]

    return quotes.map(quote => ({
      ...quote,
      items: this.db!.prepare(`
        si.*, p.code as product_code, p.name as product_name, p.unit
        FROM sales_quote_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.quote_id = ?
      `).all(quote.id)
    }))
  }

  // ==================== 系统管理 ====================

  getRoles(): any[] {
    return this.db!.prepare('SELECT * FROM roles ORDER BY id').all() as any[]
  }

  addRole(data: any): number {
    return this.insert('roles', data)
  }

  updateRole(data: any): number {
    const id = data.id
    delete data.id
    return this.update('roles', data, 'id = ?', [id])
  }

  deleteRole(id: number): number {
    return this.delete('roles', 'id = ?', [id])
  }

  getUsers(): any[] {
    return this.db!.prepare(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.id
    `).all() as any[]
  }

  addUser(data: any): number {
    return this.insert('users', data)
  }

  updateUser(data: any): number {
    const id = data.id
    delete data.id
    delete data.role_name
    return this.update('users', data, 'id = ?', [id])
  }

  deleteUser(id: number): number {
    return this.delete('users', 'id = ?', [id])
  }

  // ==================== 回收站 ====================

  getRecycleBinItems(): any[] {
    return this.db!.prepare(`
      SELECT 'product' as type, id, code || ' - ' || name as title, updated_at as deleted_at FROM products WHERE status = 0
      UNION ALL
      SELECT 'warehouse' as type, id, code || ' - ' || name as title, updated_at as deleted_at FROM warehouses WHERE status = 0
      UNION ALL
      SELECT 'supplier' as type, id, code || ' - ' || name as title, updated_at as deleted_at FROM suppliers WHERE status = 0
      UNION ALL
      SELECT 'customer' as type, id, code || ' - ' || name as title, updated_at as deleted_at FROM customers WHERE status = 0
      ORDER BY deleted_at DESC
    `).all() as any[]
  }

  saveRecycleBinItems(items: any[]): void {
    for (const item of items) {
      if (item.type === 'product') {
        this.update('products', { status: 1 }, 'id = ?', [item.id])
      } else if (item.type === 'warehouse') {
        this.update('warehouses', { status: 1 }, 'id = ?', [item.id])
      } else if (item.type === 'supplier') {
        this.update('suppliers', { status: 1 }, 'id = ?', [item.id])
      } else if (item.type === 'customer') {
        this.update('customers', { status: 1 }, 'id = ?', [item.id])
      }
    }
  }

  // ==================== 价格表 ====================

  getPriceList(): any[] {
    return this.db!.prepare(`
      SELECT pl.*, p.code as product_code, p.name as product_name, s.name as supplier_name
      FROM price_list pl
      LEFT JOIN products p ON pl.product_id = p.id
      LEFT JOIN suppliers pl_s ON pl.supplier_id = pl_s.id
      ORDER BY pl.product_code, pl.supplier_id
    `).all() as any[]
  }

  savePriceList(items: any[]): void {
    this.db!.prepare('DELETE FROM price_list').run()
    for (const item of items) {
      this.insert('price_list', item)
    }
  }

  // ==================== 收款单 ====================

  getReceiptList(): any[] {
    return this.db!.prepare(`
      SELECT r.*, c.name as customer_name
      FROM receipts r
      LEFT JOIN customers c ON r.customer_id = c.id
      ORDER BY r.created_at DESC
    `).all() as any[]
  }

  addReceipt(data: any): number {
    return this.insert('receipts', data)
  }

  updateReceipt(data: any): number {
    const id = data.id
    delete data.id
    return this.update('receipts', data, 'id = ?', [id])
  }

  deleteReceipt(id: number): number {
    return this.delete('receipts', 'id = ?', [id])
  }

  // ==================== 付款单 ====================

  getPaymentList(): any[] {
    return this.db!.prepare(`
      SELECT p.*, s.name as supplier_name
      FROM payments p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ORDER BY p.created_at DESC
    `).all() as any[]
  }

  addPayment(data: any): number {
    return this.insert('payments', data)
  }

  updatePayment(data: any): number {
    const id = data.id
    delete data.id
    return this.update('payments', data, 'id = ?', [id])
  }

  deletePayment(id: number): number {
    return this.delete('payments', 'id = ?', [id])
  }

  // ==================== 库存查询 ====================

  getAllStocks(endDate?: string): any[] {
    const df = (dateCol: string) => endDate ? ` AND ${dateCol} <= '${endDate}'` : ''

    const products = this.db!.prepare('SELECT id, code, name, category, unit, spec, cost_price, warning_quantity FROM products WHERE status = 1').all() as any[]
    const warehouses = this.db!.prepare('SELECT id, code, name FROM warehouses WHERE status = 1').all() as any[]

    const result: any[] = []

    for (const product of products) {
      for (const warehouse of warehouses) {
        const stock = this.calculateStockForProductAndWarehouse(product.id, warehouse.id, endDate)
        result.push({
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          specification: product.spec || '',
          category: product.category || '',
          unit: product.unit || '',
          warehouseId: warehouse.id,
          warehouseCode: warehouse.code,
          warehouseName: warehouse.name,
          stockQuantity: stock.stockQuantity || 0,
          warningQuantity: product.warning_quantity || 0,
          costPrice: product.cost_price || 0
        })
      }
    }

    return result
  }

  private calculateStockForProductAndWarehouse(productId: number, warehouseId: number, endDate?: string): { stockQuantity: number } {
    let totalStock = 0
    const df = (dateCol: string) => endDate ? ` AND ${dateCol} <= '${endDate}'` : ''

    try {
      const inboundQty = this.db!.prepare(`
        SELECT COALESCE(SUM(ii.quantity), 0) as total_qty
        FROM purchase_inbound_items ii
        INNER JOIN purchase_inbound pi ON ii.inbound_id = pi.id
        WHERE ii.product_id = ? AND pi.warehouse_id = ? AND pi.status != 'deleted'${df('pi.inbound_date')}
      `).get(productId, warehouseId) as any
      totalStock += Number(inboundQty?.total_qty || 0)
    } catch (e) {
      console.warn('[calculateStockForProductAndWarehouse] 采购入库查询失败:', e)
    }

    try {
      const salesReturnQty = this.db!.prepare(`
        SELECT COALESCE(SUM(sri.quantity), 0) as total_qty
        FROM sales_return_items sri
        INNER JOIN sales_returns sr ON sri.return_id = sr.id
        WHERE sri.product_id = ? AND sr.warehouse_id = ? AND sr.status != 'deleted'${df('sr.return_date')}
      `).get(productId, warehouseId) as any
      totalStock += Number(salesReturnQty?.total_qty || 0)
    } catch (e) {
      console.warn('[calculateStockForProductAndWarehouse] 销售退货查询失败:', e)
    }

    try {
      const outboundQty = this.db!.prepare(`
        SELECT COALESCE(SUM(soi.quantity), 0) as total_qty
        FROM sales_outbound_items soi
        INNER JOIN sales_outbound so ON soi.outbound_id = so.id
        WHERE soi.product_id = ? AND so.warehouse_id = ? AND so.status != 'deleted'${df('so.outbound_date')}
      `).get(productId, warehouseId) as any
      totalStock -= Number(outboundQty?.total_qty || 0)
    } catch (e) {
      console.warn('[calculateStockForProductAndWarehouse] 销售出库查询失败:', e)
    }

    try {
      const purchaseReturnQty = this.db!.prepare(`
        SELECT COALESCE(SUM(pri.quantity), 0) as total_qty
        FROM purchase_return_items pri
        INNER JOIN purchase_returns pr ON pri.return_id = pr.id
        WHERE pri.product_id = ? AND pr.warehouse_id = ? AND pr.status != 'deleted'${df('pr.return_date')}
      `).get(productId, warehouseId) as any
      totalStock -= Number(purchaseReturnQty?.total_qty || 0)
    } catch (e) {
      console.warn('[calculateStockForProductAndWarehouse] 采购退货查询失败:', e)
    }

    try {
      const transferOutQty = this.db!.prepare(`
        SELECT COALESCE(SUM(tri.quantity), 0) as total_qty
        FROM transfer_record_items tri
        INNER JOIN transfer_records tr ON tri.transfer_id = tr.id
        WHERE tri.product_id = ? AND tr.from_warehouse_id = ? AND tr.status != 'deleted'${df('tr.transfer_date')}
      `).get(productId, warehouseId) as any || { total_qty: 0 }
      totalStock -= Number(transferOutQty.total_qty || 0)
    } catch (e) {}

    try {
      const transferInQty = this.db!.prepare(`
        SELECT COALESCE(SUM(tri.quantity), 0) as total_qty
        FROM transfer_record_items tri
        INNER JOIN transfer_records tr ON tri.transfer_id = tr.id
        WHERE tri.product_id = ? AND tr.to_warehouse_id = ? AND tr.status != 'deleted'${df('tr.transfer_date')}
      `).get(productId, warehouseId) as any || { total_qty: 0 }
      totalStock += Number(transferInQty.total_qty || 0)
    } catch (e) {}

    return { stockQuantity: totalStock }
  }

  getProductLedger(productId: number, warehouseId: number, startDate?: string, endDate?: string): any[] {
    const items: any[] = []

    const dateFilter = (col: string) => {
      if (startDate && endDate) {
        return ` AND ${col} >= '${startDate}' AND ${col} <= '${endDate}'`
      }
      return ''
    }

    console.log(`[getProductLedger] 开始查询 产品${productId} 仓库${warehouseId} 日期范围: ${startDate || '全部'} ~ ${endDate || '全部'}`)

    const inboundItems = this.db!.prepare(`
      SELECT ii.*, pi.inbound_no, pi.inbound_date, pi.supplier_id,
             s.name as supplier_name, w.name as warehouse_name,
             'purchase_inbound' as doc_type, pi.created_at as _timestamp
      FROM purchase_inbound_items ii
      INNER JOIN purchase_inbound pi ON ii.inbound_id = pi.id
      LEFT JOIN suppliers s ON pi.supplier_id = s.id
      LEFT JOIN warehouses w ON pi.warehouse_id = w.id
      WHERE ii.product_id = ? AND pi.warehouse_id = ?
        AND pi.status != 'deleted'${dateFilter('pi.inbound_date')}
      ORDER BY pi.inbound_date, pi.created_at
    `).all(productId, warehouseId) as any[]
    console.log(`[getProductLedger] 采购入库: ${inboundItems.length} 条`)

    inboundItems.forEach(item => {
      items.push({
        ...item,
        _sortDate: item.inbound_date,
        direction: 'in',
        qty: item.quantity,
        price: item.unit_price || 0,
        amount: item.total_amount || 0
      })
    })

    const outboundItems = this.db!.prepare(`
      SELECT oi.*, so.outbound_no, so.outbound_date, so.customer_id,
             c.name as customer_name, w.name as warehouse_name,
             'sales_outbound' as doc_type, so.created_at as _timestamp
      FROM sales_outbound_items oi
      INNER JOIN sales_outbound so ON oi.outbound_id = so.id
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN warehouses w ON so.warehouse_id = w.id
      WHERE oi.product_id = ? AND so.warehouse_id = ?
        AND so.status != 'deleted'${dateFilter('so.outbound_date')}
      ORDER BY so.outbound_date, so.created_at
    `).all(productId, warehouseId) as any[]

    outboundItems.forEach(item => {
      items.push({
        ...item,
        _sortDate: item.outbound_date,
        direction: 'out',
        qty: item.quantity,
        price: item.unit_price || 0,
        amount: item.total_amount || 0
      })
    })

    const purchaseReturnItems = this.db!.prepare(`
      SELECT pri.*, pri_table.return_no, pri_table.return_date, pri_table.supplier_id,
             pri_table.original_inbound_no,
             -- 备注：显示原入库单号
             CASE 
               WHEN pri_table.original_inbound_no IS NOT NULL AND pri_table.original_inbound_no != '' 
               THEN '原入库单：' || pri_table.original_inbound_no
               ELSE ''
             END as remark,
             -- 采购退货：优先使用已保存的含税单价，如果没有则从原入库单获取含税单价
             COALESCE(pri.unit_price, ii.unit_price) as unit_price,
             COALESCE(pri.total_amount, ii.total_amount) as total_amount,
             s.name as supplier_name, w.name as warehouse_name,
             'purchase_return' as doc_type, pri_table.created_at as _timestamp
      FROM purchase_return_items pri
      INNER JOIN purchase_returns pri_table ON pri.return_id = pri_table.id
      LEFT JOIN purchase_inbound pi ON pri_table.original_inbound_no = pi.inbound_no
      LEFT JOIN purchase_inbound_items ii ON pi.id = ii.inbound_id AND pri.product_id = ii.product_id
        AND ii.id = (
          SELECT MIN(ii2.id) FROM purchase_inbound_items ii2
          WHERE ii2.inbound_id = pi.id AND ii2.product_id = pri.product_id
        )
      LEFT JOIN suppliers s ON pri_table.supplier_id = s.id
      LEFT JOIN warehouses w ON pri_table.warehouse_id = w.id
      WHERE pri.product_id = ? AND pri_table.warehouse_id = ?
        AND pri_table.status != 'deleted'${dateFilter('pri_table.return_date')}
      ORDER BY pri_table.return_date, pri_table.created_at
    `).all(productId, warehouseId) as any[]

    // 为每个采购退货明细项应用单价
    purchaseReturnItems.forEach(item => {
      const unitPrice = Number(item.unit_price || 0)
      const totalAmount = Number(item.total_amount || 0)
      
      items.push({
        ...item,
        _sortDate: item.return_date,
        direction: 'in',
        qty: -item.quantity,
        price: -unitPrice,
        amount: -totalAmount
      })
    })

    const salesReturnItems = this.db!.prepare(`
      SELECT sri.*, sr.return_no, sr.return_date, sr.customer_id, sr.original_order_no,
             -- 备注：显示原出库单号
             CASE 
               WHEN sr.original_order_no IS NOT NULL AND sr.original_order_no != '' 
               THEN '原出库单：' || sr.original_order_no
               ELSE ''
             END as remark,
             c.name as customer_name, w.name as warehouse_name,
             'sales_return' as doc_type, sr.created_at as _timestamp
      FROM sales_return_items sri
      INNER JOIN sales_returns sr ON sri.return_id = sr.id
      LEFT JOIN customers c ON sr.customer_id = c.id
      LEFT JOIN warehouses w ON sr.warehouse_id = w.id
      WHERE sri.product_id = ? AND sr.warehouse_id = ?
        AND sr.status != 'deleted'${dateFilter('sr.return_date')}
      ORDER BY sr.return_date, sr.created_at
    `).all(productId, warehouseId) as any[]
    console.log(`[getProductLedger] 销售退货: ${salesReturnItems.length} 条`)
    if (salesReturnItems.length > 0) {
      console.log('[getProductLedger] 销售退货原始数据:', JSON.stringify(salesReturnItems[0]))
    }

    // 销售退货：数量以负数表示在出库数据中，单价和金额使用含税单价和含税金额（与其他单据保持一致）
    salesReturnItems.forEach(item => {
      // 优先使用含税单价和含税金额（与采购入库、销售出库保持一致）
      let unitPrice = item.unit_price_incl || item.unit_price || 0
      let totalAmount = item.total_inc || item.total_amount || 0
      
      console.log(`[getProductLedger] 销售退货处理: quantity=${item.quantity}, unit_price=${item.unit_price}, amount=${item.amount}, original_item_index=${item.original_item_index}`)
      
      // 如果没有保存单价和金额，尝试从原出库单查询
      if ((!unitPrice || !totalAmount) && item.original_item_index !== undefined) {
        // 需要先找到原出库单（通过 original_order_no）
        const originalOutbound = this.db!.prepare(`
          SELECT soi.unit_price, soi.total_amount
          FROM sales_outbound_items soi
          INNER JOIN sales_outbound so ON soi.outbound_id = so.id
          WHERE so.outbound_no = (
            SELECT sr.original_order_no FROM sales_returns sr WHERE sr.id = ?
          ) AND soi.product_id = ?
          LIMIT 1
        `).get(item.return_id, productId) as any
        
        console.log(`[getProductLedger] 原出库单查询结果:`, originalOutbound)
        
        if (originalOutbound) {
          unitPrice = originalOutbound.unit_price || unitPrice
          totalAmount = originalOutbound.total_amount || totalAmount
        }
      }
      
      console.log(`[getProductLedger] 销售退货最终: qty=${-item.quantity}, price=${-unitPrice}, amount=${-totalAmount}`)
      
      items.push({
        ...item,
        _sortDate: item.return_date,
        direction: 'out',
        qty: -item.quantity,
        price: -unitPrice,
        amount: -totalAmount
      })
    })

    const transferOutItems = this.db!.prepare(`
      SELECT tri.*, tr.transfer_no, tr.transfer_date,
             fw.name as from_warehouse_name, tw.name as to_warehouse_name,
             'transfer_out' as doc_type, tr.created_at as _timestamp
      FROM transfer_record_items tri
      INNER JOIN transfer_records tr ON tri.transfer_id = tr.id
      LEFT JOIN warehouses fw ON tr.from_warehouse_id = fw.id
      LEFT JOIN warehouses tw ON tr.to_warehouse_id = tw.id
      WHERE tri.product_id = ? AND tr.from_warehouse_id = ?
        AND tr.status != 'deleted'${dateFilter('tr.transfer_date')}
      ORDER BY tr.transfer_date, tr.created_at
    `).all(productId, warehouseId) as any[]
    console.log(`[getProductLedger] 调拨出库: ${transferOutItems.length} 条`)

    transferOutItems.forEach(item => {
      items.push({
        ...item,
        _sortDate: item.transfer_date,
        direction: 'out',
        qty: item.quantity,
        price: 0,
        amount: 0
      })
    })

    const transferInItems = this.db!.prepare(`
      SELECT tri.*, tr.transfer_no, tr.transfer_date,
             fw.name as from_warehouse_name, tw.name as to_warehouse_name,
             'transfer_in' as doc_type, tr.created_at as _timestamp
      FROM transfer_record_items tri
      INNER JOIN transfer_records tr ON tri.transfer_id = tr.id
      LEFT JOIN warehouses fw ON tr.from_warehouse_id = fw.id
      LEFT JOIN warehouses tw ON tr.to_warehouse_id = tw.id
      WHERE tri.product_id = ? AND tr.to_warehouse_id = ?
        AND tr.status != 'deleted'${dateFilter('tr.transfer_date')}
      ORDER BY tr.transfer_date, tr.created_at
    `).all(productId, warehouseId) as any[]
    console.log(`[getProductLedger] 调拨入库: ${transferInItems.length} 条`)
    console.log(`[getProductLedger] 合计: ${items.length} 条明细`)

    transferInItems.forEach(item => {
      items.push({
        ...item,
        _sortDate: item.transfer_date,
        direction: 'in',
        qty: item.quantity,
        price: 0,
        amount: 0
      })
    })

    items.sort((a, b) => {
      if (a._sortDate !== b._sortDate) return a._sortDate > b._sortDate ? 1 : -1
      if (a._timestamp !== b._timestamp) return a._timestamp > b._timestamp ? 1 : -1
      return 0
    })

    const mappedItems = items.map(item => ({
      date: item.inbound_date || item.outbound_date || item.return_date || item.transfer_date,
      docNo: item.inbound_no || item.outbound_no || item.return_no || item.transfer_no,
      type: item.doc_type,
      inboundQty: item.direction === 'in' ? (item.qty || 0) : 0,
      inboundUnitPrice: item.direction === 'in' ? (item.price || 0) : 0,
      inboundAmount: item.direction === 'in' ? (item.amount || 0) : 0,
      outboundQty: item.direction === 'out' ? (item.qty || 0) : 0,
      outboundUnitPrice: item.direction === 'out' ? (item.price || 0) : 0,
      outboundAmount: item.direction === 'out' ? (item.amount || 0) : 0,
      counter: item.supplier_name || item.customer_name || item.from_warehouse_name || '',
      remark: item.remark || '',
      _sortDate: item._sortDate,
      _timestamp: item._timestamp
    }))

    console.log(`[getProductLedger] 产品${productId}仓库${warehouseId} 映射后返回 ${mappedItems.length} 条记录`)
    if (mappedItems.length > 0) {
      console.log('[getProductLedger] 第一条数据示例:', JSON.stringify(mappedItems[0]))
    }

    return mappedItems
  }

  getStockBeforeDate(productId: number, warehouseId: number, date: string): number {
    const result = this.calculateStockForProductAndWarehouse(productId, warehouseId, date)
    return result.stockQuantity
  }

  // ==================== 库存期初期末 ====================

  getInventoryPeriodList(): any[] {
    return this.db!.prepare(`
      SELECT ip.*, p.code as product_code, p.name as product_name, w.name as warehouse_name
      FROM inventory_periods ip
      LEFT JOIN products p ON ip.product_id = p.id
      LEFT JOIN warehouses w ON ip.warehouse_id = w.id
      ORDER BY ip.period_date DESC
    `).all() as any[]
  }

  saveInventoryPeriod(data: any): number {
    const existing = this.db!.prepare(`
      SELECT id FROM inventory_periods 
      WHERE product_id = ? AND warehouse_id = ? AND period_date = ?
    `).get(data.product_id, data.warehouse_id, data.period_date) as any

    if (existing) {
      return this.update('inventory_periods', data, 'id = ?', [existing.id])
    }
    return this.insert('inventory_periods', data)
  }

  deleteInventoryPeriod(id: number): number {
    return this.delete('inventory_periods', 'id = ?', [id])
  }

  // ==================== 单据详情查询 ====================

  getInboundById(id: number): any {
    const inbound = this.db!.prepare(`
      SELECT pi.*, w.name as warehouse_name, s.name as supplier_name
      FROM purchase_inbound pi
      LEFT JOIN warehouses w ON pi.warehouse_id = w.id
      LEFT JOIN suppliers s ON pi.supplier_id = s.id
      WHERE pi.id = ?
    `).get(id) as any

    if (!inbound) return null

    inbound.items = this.db!.prepare(`
      SELECT ii.*, p.code as product_code, p.name as product_name, p.unit
      FROM purchase_inbound_items ii
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE ii.inbound_id = ?
    `).all(id) as any[]

    return inbound
  }

  getOutboundById(id: number): any {
    const outbound = this.db!.prepare(`
      SELECT so.*, w.name as warehouse_name, c.name as customer_name
      FROM sales_outbound so
      LEFT JOIN warehouses w ON so.warehouse_id = w.id
      LEFT JOIN customers c ON so.customer_id = c.id
      WHERE so.id = ?
    `).get(id) as any

    if (!outbound) return null

    outbound.items = this.db!.prepare(`
      SELECT oi.*, p.code as product_code, p.name as product_name, p.unit
      FROM sales_outbound_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.outbound_id = ?
    `).all(id) as any[]

    return outbound
  }

  getPurchaseReturnById(id: number): any {
    const returnRecord = this.db!.prepare(`
      SELECT pr.*, w.name as warehouse_name, s.name as supplier_name
      FROM purchase_returns pr
      LEFT JOIN warehouses w ON pr.warehouse_id = w.id
      LEFT JOIN suppliers s ON pr.supplier_id = s.id
      WHERE pr.id = ?
    `).get(id) as any

    if (!returnRecord) return null

    returnRecord.items = this.db!.prepare(`
      SELECT pri.*, p.code as product_code, p.name as product_name, p.unit
      FROM purchase_return_items pri
      LEFT JOIN products p ON pri.product_id = p.id
      WHERE pri.return_id = ?
    `).all(id) as any[]

    return returnRecord
  }

  getSalesReturnById(id: number): any {
    const returnRecord = this.db!.prepare(`
      SELECT sr.*, w.name as warehouse_name, c.name as customer_name
      FROM sales_returns sr
      LEFT JOIN warehouses w ON sr.warehouse_id = w.id
      LEFT JOIN customers c ON sr.customer_id = c.id
      WHERE sr.id = ?
    `).get(id) as any

    if (!returnRecord) return null

    returnRecord.items = this.db!.prepare(`
      SELECT sri.*, p.code as product_code, p.name as product_name, p.unit
      FROM sales_return_items sri
      LEFT JOIN products p ON sri.product_id = p.id
      WHERE sri.return_id = ?
    `).all(id) as any[]

    return returnRecord
  }

  getTransferById(id: number): any {
    const transfer = this.db!.prepare(`
      SELECT tr.*, 
             fw.name as from_warehouse_name, 
             tw.name as to_warehouse_name
      FROM transfer_records tr
      LEFT JOIN warehouses fw ON tr.from_warehouse_id = fw.id
      LEFT JOIN warehouses tw ON tr.to_warehouse_id = tw.id
      WHERE tr.id = ?
    `).get(id) as any

    if (!transfer) return null

    transfer.items = this.db!.prepare(`
      SELECT tri.*, p.code as product_code, p.name as product_name, p.unit
      FROM transfer_record_items tri
      LEFT JOIN products p ON tri.product_id = p.id
      WHERE tri.transfer_id = ?
    `).all(id) as any[]

    return transfer
  }

  // 采购开票记录相关方法
  getInvoiceRecord(inboundNo: string): any {
    try {
      const record = this.db!.prepare(`
        SELECT * FROM purchase_invoice_records
        WHERE inbound_no = ?
      `).get(inboundNo) as any
      
      return record
    } catch (error) {
      console.error('【Electron 后端】获取开票记录失败:', error)
      return null
    }
  }

  saveInvoiceRecord(recordData: any): number {
    try {
      console.log('【Electron 后端】保存开票记录:', recordData)
      
      // 先检查是否已存在记录
      const existing = this.getInvoiceRecord(recordData.inbound_no)
      
      if (existing) {
        // 更新现有记录
        const updatedData = {
          invoice_amount: recordData.invoice_amount,
          invoice_date: recordData.invoice_date,
          invoice_issued: recordData.invoice_issued,
          updated_at: new Date().toISOString()
        }
        
        this.update('purchase_invoice_records', updatedData, 'inbound_no = ?', [recordData.inbound_no])
        console.log('【Electron 后端】开票记录更新成功')
        return existing.id
      } else {
        // 插入新记录
        const id = this.insert('purchase_invoice_records', {
          inbound_no: recordData.inbound_no,
          inbound_id: recordData.inbound_id,
          invoice_amount: recordData.invoice_amount,
          invoice_date: recordData.invoice_date,
          invoice_issued: recordData.invoice_issued || 0,
          created_by: recordData.created_by
        })
        console.log('【Electron 后端】开票记录插入成功，ID:', id)
        return id
      }
    } catch (error) {
      console.error('【Electron 后端】保存开票记录失败:', error)
      throw error
    }
  }

  close() {
    if (this.db) {
      this.db.close()
    }
  }

  // ==================== 系统设置管理 ====================
  
  getSystemSettings() {
    try {
      // 确保系统设置表存在
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          setting_key TEXT UNIQUE NOT NULL,
          setting_value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      const settings: any = {}
      const rows = this.db!.prepare('SELECT setting_key, setting_value FROM system_settings').all() as any[]
      
      rows.forEach(row => {
        settings[row.setting_key] = row.setting_value
      })
      
      return settings
    } catch (error) {
      console.error('获取系统设置失败:', error)
      return {}
    }
  }

  saveSystemSettings(settings: any) {
    try {
      // 确保系统设置表存在
      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          setting_key TEXT UNIQUE NOT NULL,
          setting_value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      const insert = this.db!.prepare(`
        INSERT OR REPLACE INTO system_settings (setting_key, setting_value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `)
      
      for (const [key, value] of Object.entries(settings)) {
        insert.run(key, String(value))
      }
      
      return true
    } catch (error) {
      console.error('保存系统设置失败:', error)
      return false
    }
  }
}

export default InventoryDatabase
