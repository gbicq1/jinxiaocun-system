const Database = require('better-sqlite3');
const path = require('path');

// 数据库路径
const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'Electron', 'inventory.db');
const db = new Database(dbPath);

console.log('开始修复出库单表结构...');
console.log('数据库路径:', dbPath);

try {
  // 检查 sales_outbound_items 表的当前结构
  const tableInfo = db.prepare("PRAGMA table_info(sales_outbound_items)").all();
  console.log('当前 sales_outbound_items 表结构:');
  tableInfo.forEach(col => {
    console.log(`  - ${col.name}: ${col.type}`);
  });

  // 检查缺失的字段
  const existingColumns = tableInfo.map(col => col.name);
  const missingColumns = [];

  if (!existingColumns.includes('unit_price')) missingColumns.push('unit_price');
  if (!existingColumns.includes('sale_price')) missingColumns.push('sale_price');
  if (!existingColumns.includes('tax_rate')) missingColumns.push('tax_rate');
  if (!existingColumns.includes('tax_amount')) missingColumns.push('tax_amount');
  if (!existingColumns.includes('total_amount')) missingColumns.push('total_amount');
  if (!existingColumns.includes('product_name')) missingColumns.push('product_name');
  if (!existingColumns.includes('specification')) missingColumns.push('specification');
  if (!existingColumns.includes('unit')) missingColumns.push('unit');

  if (missingColumns.length === 0) {
    console.log('✅ 所有字段已存在，无需迁移');
  } else {
    console.log('发现缺失字段:', missingColumns);

    // 添加缺失的字段
    if (missingColumns.includes('unit_price')) {
      db.exec('ALTER TABLE sales_outbound_items ADD COLUMN unit_price DECIMAL(10,2)');
      console.log('✅ 添加 unit_price 字段');
    }

    if (missingColumns.includes('sale_price')) {
      db.exec('ALTER TABLE sales_outbound_items ADD COLUMN sale_price DECIMAL(10,2)');
      console.log('✅ 添加 sale_price 字段');
    }

    if (missingColumns.includes('tax_rate')) {
      db.exec('ALTER TABLE sales_outbound_items ADD COLUMN tax_rate DECIMAL(5,2)');
      console.log('✅ 添加 tax_rate 字段');
    }

    if (missingColumns.includes('tax_amount')) {
      db.exec('ALTER TABLE sales_outbound_items ADD COLUMN tax_amount DECIMAL(10,2)');
      console.log('✅ 添加 tax_amount 字段');
    }

    if (missingColumns.includes('total_amount')) {
      db.exec('ALTER TABLE sales_outbound_items ADD COLUMN total_amount DECIMAL(10,2)');
      console.log('✅ 添加 total_amount 字段');
    }

    if (missingColumns.includes('product_name')) {
      db.exec('ALTER TABLE sales_outbound_items ADD COLUMN product_name TEXT');
      console.log('✅ 添加 product_name 字段');
    }

    if (missingColumns.includes('specification')) {
      db.exec('ALTER TABLE sales_outbound_items ADD COLUMN specification TEXT');
      console.log('✅ 添加 specification 字段');
    }

    if (missingColumns.includes('unit')) {
      db.exec('ALTER TABLE sales_outbound_items ADD COLUMN unit TEXT');
      console.log('✅ 添加 unit 字段');
    }

    console.log('✅ 表结构迁移完成！');
  }

  // 检查 sales_outbound 表是否有 customer_id 字段
  const outboundInfo = db.prepare("PRAGMA table_info(sales_outbound)").all();
  const outboundColumns = outboundInfo.map(col => col.name);
  
  if (!outboundColumns.includes('customer_id')) {
    db.exec('ALTER TABLE sales_outbound ADD COLUMN customer_id INTEGER');
    db.exec('ALTER TABLE sales_outbound ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id)');
    console.log('✅ 添加 customer_id 字段到 sales_outbound 表');
  }

  console.log('✅ 所有迁移完成！');

} catch (error) {
  console.error('❌ 迁移失败:', error.message);
  process.exit(1);
} finally {
  db.close();
  console.log('数据库连接已关闭');
}
