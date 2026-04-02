/**
 * 检查出库单数据
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'database.sqlite');

console.log('🔍 检查数据库文件:', DB_PATH);

try {
  const db = new Database(DB_PATH, { readonly: true });
  
  console.log('\n📋 检查表是否存在...');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sales_outbound', 'sales_outbound_items', 'customers', 'warehouses', 'products')").all();
  console.log('找到的表:', tables.map(t => t.name));
  
  console.log('\n📋 检查销售出库主表数据...');
  const outbounds = db.prepare('SELECT * FROM sales_outbound').all();
  console.log(`出库单数量：${outbounds.length}`);
  
  if (outbounds.length > 0) {
    const firstOutbound = outbounds[0];
    console.log('\n第一条出库单数据:');
    console.log('ID:', firstOutbound.id);
    console.log('凭证号:', firstOutbound.outbound_no);
    console.log('客户 ID:', firstOutbound.customer_id);
    console.log('仓库 ID:', firstOutbound.warehouse_id);
    console.log('经办人:', firstOutbound.handler_name);
    console.log('操作员:', firstOutbound.created_by);
    console.log('总金额:', firstOutbound.total_amount);
    
    console.log('\n📋 检查客户表...');
    const customers = db.prepare('SELECT * FROM customers').all();
    console.log(`客户数量：${customers.length}`);
    if (customers.length > 0) {
      console.log('第一个客户:', customers[0]);
    }
    
    console.log('\n📋 检查仓库表...');
    const warehouses = db.prepare('SELECT * FROM warehouses').all();
    console.log(`仓库数量：${warehouses.length}`);
    if (warehouses.length > 0) {
      console.log('第一个仓库:', warehouses[0]);
    }
    
    console.log('\n📋 检查出库单明细...');
    const items = db.prepare('SELECT * FROM sales_outbound_items WHERE outbound_id = ?').all(firstOutbound.id);
    console.log(`明细数量：${items.length}`);
    
    if (items.length > 0) {
      console.log('\n第一条明细数据:');
      const firstItem = items[0];
      console.log('商品 ID:', firstItem.product_id);
      console.log('商品名称:', firstItem.product_name);
      console.log('规格:', firstItem.specification);
      console.log('单位:', firstItem.unit);
      console.log('数量:', firstItem.quantity);
      console.log('单价 (不含税):', firstItem.unit_price);
      console.log('单价 (含税):', firstItem.sale_price);
      console.log('税率:', firstItem.tax_rate);
      console.log('税额:', firstItem.tax_amount);
      console.log('总额:', firstItem.total_amount);
      console.log('成本价:', firstItem.cost_price);
      
      console.log('\n📋 检查商品表...');
      const products = db.prepare('SELECT * FROM products').all();
      console.log(`商品数量：${products.length}`);
      if (products.length > 0) {
        const product = products.find(p => p.id === firstItem.product_id);
        console.log('对应的商品:', product);
      }
    }
  } else {
    console.log('❌ 没有找到出库单数据！');
  }
  
  db.close();
  console.log('\n✅ 检查完成');
} catch (error) {
  console.error('❌ 检查失败:', error.message);
  console.error(error.stack);
}