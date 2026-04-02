
const Database = require('better-sqlite3');
const path = require('path');

const userDataPath = 'C:\\Users\\Administrator\\AppData\\Roaming\\Electron';
const dbPath = path.join(userDataPath, 'inventory.db');

console.log('数据库路径:', dbPath);

const db = new Database(dbPath);

console.log('\n检查 sales_outbound 表...');
const columns = db.prepare("PRAGMA table_info(sales_outbound)").all();
console.log('当前列:');
for (let i = 0; i < columns.length; i++) {
  console.log('  - ' + columns[i].name + ': ' + columns[i].type);
}

// 检查 customer_id
let hasCustomerId = false;
let hasHandlerName = false;
for (let i = 0; i < columns.length; i++) {
  if (columns[i].name === 'customer_id') hasCustomerId = true;
  if (columns[i].name === 'handler_name') hasHandlerName = true;
}

if (!hasCustomerId) {
  console.log('\n添加 customer_id 字段...');
  try {
    db.exec('ALTER TABLE sales_outbound ADD COLUMN customer_id INTEGER');
    console.log('customer_id 添加成功');
  } catch (e) {
    console.log('添加 customer_id 失败:', e.message);
  }
} else {
  console.log('\ncustomer_id 已存在');
}

if (!hasHandlerName) {
  console.log('添加 handler_name 字段...');
  try {
    db.exec('ALTER TABLE sales_outbound ADD COLUMN handler_name TEXT');
    console.log('handler_name 添加成功');
  } catch (e) {
    console.log('添加 handler_name 失败:', e.message);
  }
} else {
  console.log('handler_name 已存在');
}

// 验证
console.log('\n验证结果:');
const newCols = db.prepare("PRAGMA table_info(sales_outbound)").all();
for (let i = 0; i < newCols.length; i++) {
  console.log('  - ' + newCols[i].name + ': ' + newCols[i].type);
}

db.close();
console.log('\n修复完成！');
