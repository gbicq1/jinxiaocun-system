"""
检查数据库中的所有表
"""
import sqlite3
from pathlib import Path

# 连接数据库
db_path = Path(__file__).parent / 'electron' / 'database.db'
conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=" * 80)
print("数据库表列表")
print("=" * 80)

# 查询所有表
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()
print(f"\n共有 {len(tables)} 个表:")
for t in tables:
    print(f"  - {t['name']}")

# 查询与成本相关的表
print("\n" + "=" * 80)
print("成本相关表")
print("=" * 80)
cost_tables = [t for t in tables if 'cost' in t['name'].lower() or 'settlement' in t['name'].lower()]
for t in cost_tables:
    table_name = t['name']
    print(f"\n【{table_name}】")
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    for col in columns:
        print(f"  {col['name']}: {col['type']}")
    
    # 查询记录数
    cursor.execute(f"SELECT COUNT(*) as cnt FROM {table_name}")
    count = cursor.fetchone()['cnt']
    print(f"  记录数：{count}")

conn.close()

print("\n" + "=" * 80)
print("检查完成")
print("=" * 80)
