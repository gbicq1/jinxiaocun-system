
const Database = require('better-sqlite3')
const path = require('path')
const { app } = require('electron')

// 获取用户数据目录
const userDataPath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Electron'
const dbPath = path.join(userDataPath, 'inventory.db')

console.log('数据库路径:', dbPath)

// 打开数据库
const db = new Database(dbPath)

console.log('\n=== 检查 sales_outbound 表结构 ===')
const columns = db.prepare("PRAGMA table_info(sales_outbound)").all()
console.log('当前列:')
columns.forEach(col =&gt; {
  console.log(`  - ${col.name}: ${col.type}`)
})

// 检查是否有 customer_id 字段
const hasCustomerId = columns.some(col =&gt; col.name === 'customer_id')
const hasHandlerName = columns.some(col =&gt; col.name === 'handler_name')

if (!hasCustomerId) {
  console.log('\n添加 customer_id 字段...')
  try {
    db.exec('ALTER TABLE sales_outbound ADD COLUMN customer_id INTEGER')
    console.log('✅ customer_id 字段添加成功')
  } catch (error) {
    console.error('❌ 添加 customer_id 失败:', error.message)
  }
} else {
  console.log('\n✅ customer_id 字段已存在')
}

if (!hasHandlerName) {
  console.log('添加 handler_name 字段...')
  try {
    db.exec('ALTER TABLE sales_outbound ADD COLUMN handler_name TEXT')
    console.log('✅ handler_name 字段添加成功')
  } catch (error) {
    console.error('❌ 添加 handler_name 失败:', error.message)
  }
} else {
  console.log('✅ handler_name 字段已存在')
}

// 再次验证
console.log('\n=== 验证修改后的表结构 ===')
const newColumns = db.prepare("PRAGMA table_info(sales_outbound)").all()
console.log('修改后的列:')
newColumns.forEach(col =&gt; {
  console.log(`  - ${col.name}: ${col.type}`)
})

db.close()
console.log('\n✅ 数据库修复完成！')
