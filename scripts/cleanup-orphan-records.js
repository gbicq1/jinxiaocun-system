/**
 * 数据库清理脚本
 * 用于删除没有明细的孤立入库单记录
 * 运行方式：node scripts/cleanup-orphan-records.js
 */

const sqlite3 = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// 获取数据库路径
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'inventory-system', 'inventory.db');

console.log('='.repeat(60));
console.log('数据库清理工具');
console.log('='.repeat(60));
console.log('数据库路径:', dbPath);
console.log('');

// 检查数据库文件是否存在
if (!fs.existsSync(dbPath)) {
  console.error('错误: 数据库文件不存在!');
  console.error('请确保 Electron 应用已经运行过并创建了数据库。');
  process.exit(1);
}

const db = new sqlite3(dbPath);

try {
  console.log('连接数据库成功!\n');

  // 检查表是否存在
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('数据库中的表:', tables.map(t => t.name).join(', '));
  console.log('');

  // 1. 检查并删除没有明细的入库单
  console.log('--- 检查孤立入库单 ---');
  const orphanInbounds = db.prepare(`
    SELECT i.id, i.inbound_no, i.created_at
    FROM purchase_inbound i
    LEFT JOIN purchase_inbound_items it ON i.id = it.inbound_id
    WHERE it.id IS NULL
  `).all();

  console.log('没有明细的入库单数量:', orphanInbounds.length);
  if (orphanInbounds.length > 0) {
    console.log('孤立入库单列表:');
    orphanInbounds.forEach(r => {
      console.log(`  ID: ${r.id}, 凭证号: ${r.inbound_no}, 创建时间: ${r.created_at}`);
    });

    // 删除孤立记录
    const deleteStmt = db.prepare('DELETE FROM purchase_inbound WHERE id = ?');
    const deleteTransaction = db.transaction((records) => {
      for (const r of records) {
        deleteStmt.run(r.id);
        console.log(`  已删除: ID ${r.id}`);
      }
    });

    deleteTransaction(orphanInbounds);
    console.log(`已删除 ${orphanInbounds.length} 条孤立入库单记录\n`);
  } else {
    console.log('没有发现孤立的入库单记录\n');
  }

  // 2. 检查并删除没有明细的销售出库单
  console.log('--- 检查孤立销售出库单 ---');
  const orphanOutbounds = db.prepare(`
    SELECT s.id, s.outbound_no, s.created_at
    FROM sales_outbound s
    LEFT JOIN sales_outbound_items it ON s.id = it.outbound_id
    WHERE it.id IS NULL
  `).all();

  console.log('没有明细的销售出库单数量:', orphanOutbounds.length);
  if (orphanOutbounds.length > 0) {
    console.log('孤立销售出库单列表:');
    orphanOutbounds.forEach(r => {
      console.log(`  ID: ${r.id}, 凭证号: ${r.outbound_no}, 创建时间: ${r.created_at}`);
    });

    const deleteStmt = db.prepare('DELETE FROM sales_outbound WHERE id = ?');
    const deleteTransaction = db.transaction((records) => {
      for (const r of records) {
        deleteStmt.run(r.id);
        console.log(`  已删除: ID ${r.id}`);
      }
    });

    deleteTransaction(orphanOutbounds);
    console.log(`已删除 ${orphanOutbounds.length} 条孤立销售出库单记录\n`);
  } else {
    console.log('没有发现孤立的销售出库单记录\n');
  }

  // 3. 显示清理后的统计
  console.log('--- 清理后的数据统计 ---');
  const inboundCount = db.prepare('SELECT COUNT(*) as count FROM purchase_inbound').get();
  const inboundItemCount = db.prepare('SELECT COUNT(*) as count FROM purchase_inbound_items').get();
  const outboundCount = db.prepare('SELECT COUNT(*) as count FROM sales_outbound').get();
  const outboundItemCount = db.prepare('SELECT COUNT(*) as count FROM sales_outbound_items').get();

  console.log('purchase_inbound 表:', inboundCount.count, '条记录');
  console.log('purchase_inbound_items 表:', inboundItemCount.count, '条记录');
  console.log('sales_outbound 表:', outboundCount.count, '条记录');
  console.log('sales_outbound_items 表:', outboundItemCount.count, '条记录');

  console.log('\n' + '='.repeat(60));
  console.log('清理完成!');
  console.log('='.repeat(60));

} catch (error) {
  console.error('\n错误:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  db.close();
}
