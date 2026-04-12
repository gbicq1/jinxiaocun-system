"""
快速检查数据库中的产品和成本结算数据
"""
import sqlite3
from pathlib import Path
import json

# 连接数据库
db_path = Path(__file__).parent / 'electron' / 'database.db'
conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=" * 80)
print("数据库快速诊断")
print("=" * 80)

# 查询产品
print("\n【产品列表】")
cursor.execute("SELECT id, code, name FROM products WHERE status = 1 LIMIT 10")
products = cursor.fetchall()
for p in products:
    print(f"  ID: {p['id']}, Code: {p['code']}, Name: {p['name']}")

# 查询仓库
print("\n【仓库列表】")
cursor.execute("SELECT id, name FROM warehouses")
warehouses = cursor.fetchall()
for w in warehouses:
    print(f"  ID: {w['id']}, Name: {w['name']}")

# 查询成本结算记录
print("\n【成本结算记录】")
cursor.execute("""
    SELECT DISTINCT period_year, period_month, product_code, warehouse_id 
    FROM cost_settlement_items 
    WHERE period_year = 2026 
    ORDER BY period_month, product_code
""")
settlements = cursor.fetchall()
print(f"2026 年结算记录数：{len(settlements)}")
for s in settlements:
    print(f"  {s['period_year']}-{s['period_month']:02d}, 产品：{s['product_code']}, 仓库：{s['warehouse_id']}")

# 查询 cost_settlement_items 表结构
print("\n【cost_settlement_items 表结构】")
cursor.execute("PRAGMA table_info(cost_settlement_items)")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col['name']}: {col['type']}")

# 查询 4 月份的数据
print("\n【4 月份成本结算数据】")
cursor.execute("""
    SELECT * FROM cost_settlement_items 
    WHERE period_year = 2026 AND period_month = 4
    LIMIT 3
""")
april_data = cursor.fetchall()
for row in april_data:
    print(f"\n  产品：{row['product_code']}, 仓库：{row['warehouse_id']}")
    print(f"    期初：数量={row['opening_qty']}, 金额={row['opening_cost']}")
    print(f"    入库：数量={row['inbound_qty']}, 金额={row['inbound_cost']}")
    print(f"    出库：数量={row['outbound_qty']}, 金额={row['outbound_cost']}")
    print(f"    期末：数量={row['closing_qty']}, 金额={row['closing_cost']}")

# 查询 cost_snapshot 表（明细账）
print("\n【cost_snapshot 表结构】")
cursor.execute("PRAGMA table_info(cost_snapshot)")
columns = cursor.fetchall()
for col in columns:
    print(f"  {col['name']}: {col['type']}")

# 查询 snapshot 数据
print("\n【cost_snapshot 数据示例】")
cursor.execute("""
    SELECT * FROM cost_snapshot 
    WHERE period_year = 2026 AND period_month = 4
    LIMIT 5
""")
snapshots = cursor.fetchall()
print(f"记录数：{len(snapshots)}")
for s in snapshots:
    print(f"\n  类型：{s['snapshot_type']}, 产品：{s['product_code']}, 仓库：{s['warehouse_id']}")
    print(f"    入库：数量={s['inbound_qty']}, 金额={s['inbound_amount']}")
    print(f"    出库：数量={s['outbound_qty']}, 金额={s['outbound_amount']}")

conn.close()

print("\n" + "=" * 80)
print("诊断完成")
print("=" * 80)
