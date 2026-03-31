"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryDatabase = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const database_cost_1 = require("./database-cost");
class InventoryDatabase {
    constructor(dbPath) {
        this.db = null;
        this.dbPath = dbPath;
    }
    initialize() {
        try {
            this.db = new better_sqlite3_1.default(this.dbPath);
            this.createTables();
            // 初始化成本结算数据库
            this.costDb = new database_cost_1.CostSettlementDatabase(this.db);
            this.costDb.initialize();
            return true;
        }
        catch (error) {
            console.error('数据库初始化失败:', error);
            return false;
        }
    }
    createTables() {
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
    `);
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
    `);
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
    `);
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
    `);
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
    `);
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
    `);
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
    `);
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
    `);
        // 销售出库表
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_outbound (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outbound_no VARCHAR(50) UNIQUE NOT NULL,
        order_id INTEGER,
        warehouse_id INTEGER,
        outbound_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'completed',
        remark TEXT,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES sales_orders(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    `);
        // 销售出库明细表
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales_outbound_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outbound_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        cost_price DECIMAL(10,2),
        remark TEXT,
        FOREIGN KEY (outbound_id) REFERENCES sales_outbound(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);
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
    `);
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
    `);
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
    `);
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
    `);
        // 采购入库表
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_inbound (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inbound_no VARCHAR(50) UNIQUE NOT NULL,
        order_id INTEGER,
        warehouse_id INTEGER,
        inbound_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'completed',
        remark TEXT,
        created_by VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES purchase_orders(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    `);
        // 采购入库明细表
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_inbound_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inbound_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        cost_price DECIMAL(10,2),
        remark TEXT,
        FOREIGN KEY (inbound_id) REFERENCES purchase_inbound(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);
        // 库存调拨表
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS stock_transfer (
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
    `);
        // 库存调拨明细表
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS stock_transfer_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        remark TEXT,
        FOREIGN KEY (transfer_id) REFERENCES stock_transfer(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);
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
    `);
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
    `);
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
    `);
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
    `);
        console.log('数据库表创建完成');
    }
    query(sql, params = []) {
        return this.db.prepare(sql).all(...params);
    }
    insert(table, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(',');
        const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
        const stmt = this.db.prepare(sql);
        const result = stmt.run(...values);
        return Number(result.lastInsertRowid);
    }
    update(table, data, where, whereParams = []) {
        const keys = Object.keys(data);
        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const values = Object.values(data);
        const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
        const stmt = this.db.prepare(sql);
        const result = stmt.run(...values, ...whereParams);
        return result.changes;
    }
    delete(table, where, whereParams = []) {
        const sql = `DELETE FROM ${table} WHERE ${where}`;
        const stmt = this.db.prepare(sql);
        const result = stmt.run(...whereParams);
        return result.changes;
    }
    // 产品相关方法
    getProductList(page = 1, pageSize = 10) {
        const offset = (page - 1) * pageSize;
        const total = this.db.prepare('SELECT COUNT(*) as count FROM products').get();
        const products = this.db.prepare(`
      SELECT * FROM products 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(pageSize, offset);
        return {
            total: total.count,
            page,
            pageSize,
            data: products
        };
    }
    addProduct(product) {
        return this.insert('products', product);
    }
    updateProduct(product) {
        const id = product.id;
        delete product.id;
        return this.update('products', product, 'id = ?', [id]);
    }
    deleteProduct(id) {
        return this.delete('products', 'id = ?', [id]);
    }
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}
exports.InventoryDatabase = InventoryDatabase;
exports.default = InventoryDatabase;
