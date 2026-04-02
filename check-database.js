const Database = require('better-sqlite3');
const db = new Database('./electron/database.db');

console.log('=== 数据库状态检查 ===');

try {
  // 检查所有表
  const tables = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'').all();
  console.log('所有表:', tables);
  
  // 检查表结构
  if (tables.length > 0) {
    console.log('\n=== 表结构检查 ===');
    tables.forEach(table => {
      console.log(`\n${table.name} 表结构:`);
      const schema = db.prepare(`PRAGMA table_info(${table.name})`).all();
      console.log(schema);
    });
  } else {
    console.log('数据库中没有表，需要初始化');
  }
  
} catch (error) {
  console.error('检查数据库失败:', error);
} finally {
  db.close();
  console.log('\n=== 检查完成 ===');
}