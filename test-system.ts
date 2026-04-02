/**
 * 系统测试脚本
 * 用于验证各个功能模块是否正常运行
 */

import { Database } from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, unlinkSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEST_DB_PATH = join(__dirname, '../test-database.sqlite')

// 测试计数器
let passedTests = 0
let failedTests = 0

/**
 * 测试断言
 */
function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`)
    passedTests++
  } else {
    console.log(`❌ FAIL: ${message}`)
    failedTests++
  }
}

/**
 * 测试数据库连接
 */
function testDatabaseConnection() {
  console.log('\n📋 测试数据库连接...')
  
  try {
    // 删除测试数据库
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH)
    }
    
    const db = new Database(TEST_DB_PATH)
    assert(db !== null, '数据库连接成功')
    
    // 测试基本查询
    const result = db.prepare('SELECT 1 as test').get()
    assert(result?.test === 1, '基本 SQL 查询成功')
    
    db.close()
    console.log('✅ 数据库连接测试通过')
  } catch (error: any) {
    console.log(`❌ 数据库连接测试失败：${error.message}`)
    failedTests++
  }
}

/**
 * 测试表创建
 */
function testTableCreation() {
  console.log('\n📋 测试表创建...')
  
  try {
    const db = new Database(TEST_DB_PATH)
    
    // 测试产品表
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        spec TEXT,
        unit TEXT,
        cost_price REAL DEFAULT 0,
        sell_price REAL DEFAULT 0,
        stock_quantity REAL DEFAULT 0,
        warning_quantity REAL DEFAULT 0,
        status INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    assert(true, '产品表创建成功')
    
    // 测试仓库表
    db.exec(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        address TEXT,
        contact_person TEXT,
        contact_phone TEXT,
        contact_email TEXT,
        status INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    assert(true, '仓库表创建成功')
    
    // 测试采购入库表
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_inbound (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inbound_no TEXT UNIQUE NOT NULL,
        order_id INTEGER,
        warehouse_id INTEGER NOT NULL,
        inbound_date DATE NOT NULL,
        total_amount REAL DEFAULT 0,
        status INTEGER DEFAULT 0,
        remark TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES purchase_orders(id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      )
    `)
    assert(true, '采购入库表创建成功')
    
    // 测试采购入库明细表
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_inbound_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inbound_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        tax_rate REAL DEFAULT 0,
        amount REAL NOT NULL,
        amount_ex_tax REAL NOT NULL,
        FOREIGN KEY (inbound_id) REFERENCES purchase_inbound(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `)
    assert(true, '采购入库明细表创建成功')
    
    db.close()
    console.log('✅ 表创建测试通过')
  } catch (error: any) {
    console.log(`❌ 表创建测试失败：${error.message}`)
    failedTests++
  }
}

/**
 * 测试数据插入
 */
function testDataInsertion() {
  console.log('\n📋 测试数据插入...')
  
  try {
    const db = new Database(TEST_DB_PATH)
    
    // 插入产品
    const insertProduct = db.prepare(`
      INSERT INTO products (code, name, spec, unit, cost_price, sell_price, stock_quantity, warning_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const productResult = insertProduct.run('P001', '测试产品', '规格 A', '个', 100, 150, 0, 10)
    assert(productResult.lastInsertRowid !== undefined, '产品插入成功')
    
    // 插入仓库
    const insertWarehouse = db.prepare(`
      INSERT INTO warehouses (code, name, address, contact_person, contact_phone)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    const warehouseResult = insertWarehouse.run('W001', '测试仓库', '测试地址', '张三', '13800138000')
    assert(warehouseResult.lastInsertRowid !== undefined, '仓库插入成功')
    
    // 插入采购入库单
    const insertInbound = db.prepare(`
      INSERT INTO purchase_inbound (inbound_no, warehouse_id, inbound_date, total_amount, status)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    const inboundResult = insertInbound.run('IN' + Date.now(), warehouseResult.lastInsertRowid, '2026-04-01', 1000, 1)
    assert(inboundResult.lastInsertRowid !== undefined, '采购入库单插入成功')
    
    // 插入采购入库明细
    const insertInboundItem = db.prepare(`
      INSERT INTO purchase_inbound_items (inbound_id, product_id, quantity, unit_price, amount, amount_ex_tax)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    const itemResult = insertInboundItem.run(
      inboundResult.lastInsertRowid,
      productResult.lastInsertRowid,
      10,
      100,
      1000,
      1000
    )
    assert(itemResult.lastInsertRowid !== undefined, '采购入库明细插入成功')
    
    db.close()
    console.log('✅ 数据插入测试通过')
  } catch (error: any) {
    console.log(`❌ 数据插入测试失败：${error.message}`)
    failedTests++
  }
}

/**
 * 测试数据查询
 */
function testDataQuery() {
  console.log('\n📋 测试数据查询...')
  
  try {
    const db = new Database(TEST_DB_PATH)
    
    // 查询产品
    const products = db.prepare('SELECT * FROM products').all()
    assert(Array.isArray(products) && products.length > 0, '产品查询成功')
    
    // 查询仓库
    const warehouses = db.prepare('SELECT * FROM warehouses').all()
    assert(Array.isArray(warehouses) && warehouses.length > 0, '仓库查询成功')
    
    // 查询采购入库单
    const inbounds = db.prepare('SELECT * FROM purchase_inbound').all()
    assert(Array.isArray(inbounds) && inbounds.length > 0, '采购入库单查询成功')
    
    // 查询采购入库明细
    const inboundItems = db.prepare('SELECT * FROM purchase_inbound_items').all()
    assert(Array.isArray(inboundItems) && inboundItems.length > 0, '采购入库明细查询成功')
    
    // 测试关联查询
    const joinedData = db.prepare(`
      SELECT 
        i.inbound_no,
        w.name as warehouse_name,
        p.code as product_code,
        p.name as product_name,
        ii.quantity,
        ii.unit_price,
        ii.amount
      FROM purchase_inbound i
      JOIN warehouses w ON i.warehouse_id = w.id
      JOIN purchase_inbound_items ii ON i.id = ii.inbound_id
      JOIN products p ON ii.product_id = p.id
    `).all()
    
    assert(Array.isArray(joinedData) && joinedData.length > 0, '关联查询成功')
    
    db.close()
    console.log('✅ 数据查询测试通过')
  } catch (error: any) {
    console.log(`❌ 数据查询测试失败：${error.message}`)
    failedTests++
  }
}

/**
 * 测试数据更新
 */
function testDataUpdate() {
  console.log('\n📋 测试数据更新...')
  
  try {
    const db = new Database(TEST_DB_PATH)
    
    // 更新产品库存
    const updateProduct = db.prepare(`
      UPDATE products 
      SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    
    const result = updateProduct.run(10, 1)
    assert(result.changes > 0, '产品库存更新成功')
    
    // 验证更新
    const product = db.prepare('SELECT stock_quantity FROM products WHERE id = 1').get()
    assert(product?.stock_quantity === 10, '产品库存验证成功')
    
    db.close()
    console.log('✅ 数据更新测试通过')
  } catch (error: any) {
    console.log(`❌ 数据更新测试失败：${error.message}`)
    failedTests++
  }
}

/**
 * 测试事务
 */
function testTransaction() {
  console.log('\n📋 测试事务...')
  
  try {
    const db = new Database(TEST_DB_PATH)
    
    // 开始事务
    const transaction = db.transaction((inboundNo: string, warehouseId: number, productId: number, quantity: number, unitPrice: number) => {
      // 插入入库单
      const insertInbound = db.prepare(`
        INSERT INTO purchase_inbound (inbound_no, warehouse_id, inbound_date, total_amount, status)
        VALUES (?, ?, ?, ?, ?)
      `)
      
      const amount = quantity * unitPrice
      const inboundResult = insertInbound.run(inboundNo, warehouseId, '2026-04-01', amount, 1)
      
      // 插入入库明细
      const insertInboundItem = db.prepare(`
        INSERT INTO purchase_inbound_items (inbound_id, product_id, quantity, unit_price, amount, amount_ex_tax)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      
      insertInboundItem.run(inboundResult.get().lastInsertRowid, productId, quantity, unitPrice, amount, amount)
      
      // 更新产品库存
      const updateProduct = db.prepare(`
        UPDATE products 
        SET stock_quantity = stock_quantity + ?
        WHERE id = ?
      `)
      
      updateProduct.run(quantity, productId)
    })
    
    // 执行事务
    transaction('IN' + Date.now(), 1, 1, 20, 100)
    
    // 验证事务结果
    const product = db.prepare('SELECT stock_quantity FROM products WHERE id = 1').get()
    assert(product?.stock_quantity === 30, '事务执行成功，库存正确更新')
    
    const inbounds = db.prepare('SELECT COUNT(*) as count FROM purchase_inbound').get()
    assert(inbounds?.count === 2, '事务执行成功，入库单数量正确')
    
    db.close()
    console.log('✅ 事务测试通过')
  } catch (error: any) {
    console.log(`❌ 事务测试失败：${error.message}`)
    failedTests++
  }
}

/**
 * 测试数据删除
 */
function testDataDeletion() {
  console.log('\n📋 测试数据删除...')
  
  try {
    const db = new Database(TEST_DB_PATH)
    
    // 删除最后一条入库记录
    const lastInbound = db.prepare('SELECT id FROM purchase_inbound ORDER BY id DESC LIMIT 1').get()
    
    if (lastInbound) {
      // 先删除明细
      db.prepare('DELETE FROM purchase_inbound_items WHERE inbound_id = ?').run(lastInbound.id)
      
      // 再删除主表
      const result = db.prepare('DELETE FROM purchase_inbound WHERE id = ?').run(lastInbound.id)
      assert(result.changes > 0, '数据删除成功')
      
      // 验证删除
      const count = db.prepare('SELECT COUNT(*) as count FROM purchase_inbound').get()
      assert(count?.count === 1, '数据删除验证成功')
    }
    
    db.close()
    console.log('✅ 数据删除测试通过')
  } catch (error: any) {
    console.log(`❌ 数据删除测试失败：${error.message}`)
    failedTests++
  }
}

/**
 * 清理测试数据库
 */
function cleanup() {
  try {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH)
      console.log('\n🧹 测试数据库已清理')
    }
  } catch (error) {
    console.log('\n⚠️ 清理测试数据库失败:', error)
  }
}

/**
 * 主测试函数
 */
function runTests() {
  console.log('🚀 开始系统测试...\n')
  console.log('=' .repeat(60))
  
  try {
    testDatabaseConnection()
    testTableCreation()
    testDataInsertion()
    testDataQuery()
    testDataUpdate()
    testTransaction()
    testDataDeletion()
  } finally {
    cleanup()
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 测试结果汇总:')
  console.log(`   ✅ 通过：${passedTests}`)
  console.log(`   ❌ 失败：${failedTests}`)
  console.log(`   📈 成功率：${((passedTests / (passedTests + failedTests)) * 100).toFixed(2)}%`)
  console.log('='.repeat(60))
  
  if (failedTests === 0) {
    console.log('\n🎉 所有测试通过！系统运行正常！')
    process.exit(0)
  } else {
    console.log('\n⚠️ 部分测试失败，请检查上述错误信息')
    process.exit(1)
  }
}

// 运行测试
runTests()
