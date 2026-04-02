/**
 * 数据库表结构修复脚本
 * 添加缺失的字段到各个表
 */

const Database = require('better-sqlite3')
const path = require('path')

// 数据库路径
const dbPath = path.join(__dirname, '../electron/database.db')
const db = new Database(dbPath)

console.log('开始修复数据库表结构...')

try {
  // 1. 创建产品表（如果不存在）
  console.log('创建产品表...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      category VARCHAR(100),
      spec VARCHAR(100),
      unit VARCHAR(20),
      barcode VARCHAR(100),
      costPrice DECIMAL(10,2) DEFAULT 0,
      sellPrice DECIMAL(10,2) DEFAULT 0,
      stockQuantity INTEGER DEFAULT 0,
      warningQuantity INTEGER DEFAULT 10,
      status INTEGER DEFAULT 1,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✓ 创建产品表')

  // 2. 创建仓库表（如果不存在）
  console.log('创建仓库表...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      address VARCHAR(255),
      contactPerson VARCHAR(100),
      contactPhone VARCHAR(20),
      status INTEGER DEFAULT 1,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✓ 创建仓库表')

  // 3. 创建客户表（如果不存在）
  console.log('创建客户表...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      contactPerson VARCHAR(100),
      contactPhone VARCHAR(20),
      address VARCHAR(255),
      status INTEGER DEFAULT 1,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✓ 创建客户表')

  // 4. 创建供应商表（如果不存在）
  console.log('创建供应商表...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      contactPerson VARCHAR(100),
      contactPhone VARCHAR(20),
      address VARCHAR(255),
      status INTEGER DEFAULT 1,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✓ 创建供应商表')

  // 5. 创建采购入库表（如果不存在）
  console.log('创建采购入库表...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_inbound (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inbound_no VARCHAR(50) UNIQUE NOT NULL,
      supplier_id INTEGER,
      warehouse_id INTEGER,
      inbound_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount DECIMAL(10,2),
      status VARCHAR(20) DEFAULT 'completed',
      remark TEXT,
      handler_name VARCHAR(100),
      created_by VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )
  `)
  console.log('✓ 创建采购入库表')

  // 6. 创建销售出库表（如果不存在）
  console.log('创建销售出库表...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_outbound (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outbound_no VARCHAR(50) UNIQUE NOT NULL,
      customer_id INTEGER,
      warehouse_id INTEGER,
      outbound_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount DECIMAL(10,2),
      status VARCHAR(20) DEFAULT 'completed',
      remark TEXT,
      handler_name VARCHAR(100),
      created_by VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )
  `)
  console.log('✓ 创建销售出库表')

  // 7. 创建采购入库明细表（如果不存在）
  console.log('创建采购入库明细表...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_inbound_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inbound_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      cost_price DECIMAL(10,2) NOT NULL,
      remark TEXT,
      FOREIGN KEY (inbound_id) REFERENCES purchase_inbound(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `)
  console.log('✓ 创建采购入库明细表')

  // 8. 创建销售出库明细表（如果不存在）
  console.log('创建销售出库明细表...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_outbound_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outbound_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      cost_price DECIMAL(10,2) NOT NULL,
      remark TEXT,
      FOREIGN KEY (outbound_id) REFERENCES sales_outbound(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `)
  console.log('✓ 创建销售出库明细表')

  // 9. 修复销售出库表 - 添加 outbound_no 索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_outbound_no ON sales_outbound(outbound_no)
  `)
  console.log('✓ 创建 outbound_no 索引')

  // 10. 修复采购入库表 - 添加 inbound_no 索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_inbound_no ON purchase_inbound(inbound_no)
  `)
  console.log('✓ 创建 inbound_no 索引')

  // 11. 创建销售退货表（如果不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no VARCHAR(50) UNIQUE NOT NULL,
      customer_id INTEGER,
      warehouse_id INTEGER,
      return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount DECIMAL(10,2),
      status VARCHAR(20) DEFAULT 'completed',
      remark TEXT,
      created_by VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )
  `)
  console.log('✓ 创建销售退货表')

  // 12. 创建采购退货表（如果不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no VARCHAR(50) UNIQUE NOT NULL,
      supplier_id INTEGER,
      warehouse_id INTEGER,
      return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount DECIMAL(10,2),
      status VARCHAR(20) DEFAULT 'completed',
      remark TEXT,
      created_by VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )
  `)
  console.log('✓ 创建采购退货表')

  // 13. 创建库存明细表（用于实时库存查询）
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 0,
      cost_price DECIMAL(10,2) DEFAULT 0,
      last_inbound_date DATETIME,
      last_outbound_date DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, warehouse_id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )
  `)
  console.log('✓ 创建库存明细表')

  // 14. 创建员工表（如果不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      department VARCHAR(100),
      position VARCHAR(100),
      phone VARCHAR(20),
      email VARCHAR(100),
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✓ 创建员工表')

  console.log('\n数据库表结构修复完成！')
  
  // 输出统计信息
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
  console.log('\n当前数据库表列表:')
  tables.forEach(table => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get()
    console.log(`  - ${table.name}: ${count.count} 条记录`)
  })
  
} catch (error) {
  console.error('修复数据库表结构失败:', error)
} finally {
  db.close()
}