const sqlite3 = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'inventory-system', 'inventory.db');
console.log('数据库路径:', dbPath, '\n');

const db = new sqlite3(dbPath);

// 检查入库单主表
console.log('=== purchase_inbound 表数据 ===');
const inbounds = db.prepare('SELECT * FROM purchase_inbound ORDER BY created_at DESC LIMIT 5').all();
console.log('入库单数量:', inbounds.length);
inbounds.forEach(r => console.log(r));

console.log('\n=== purchase_inbound_items 表数据 ===');
const items = db.prepare('SELECT * FROM purchase_inbound_items ORDER BY id DESC LIMIT 10').all();
console.log('明细项数量:', items.length);
items.forEach(r => console.log(r));

// 检查是否有孤立的主表记录（没有明细）
console.log('\n=== 检查没有明细的入库单 ===');
const orphans = db.prepare(`
  SELECT i.* FROM purchase_inbound i 
  LEFT JOIN purchase_inbound_items it ON i.id = it.inbound_id 
  WHERE it.id IS NULL
`).all();
console.log('没有明细的入库单数量:', orphans.length);
orphans.forEach(r => console.log('孤立记录:', r.id, r.inbound_no));

db.close();
