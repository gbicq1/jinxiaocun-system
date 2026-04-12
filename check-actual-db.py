"""
检查实际数据库中的成本结算数据
"""
import sqlite3
from pathlib import Path
import os

# 实际使用的数据库文件
db_path = Path(os.environ['APPDATA']) / 'electron' / 'inventory.db'
print(f"使用数据库：{db_path}")
print(f"存在：{db_path.exists()}")

conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=" * 80)
print("检查成本结算数据")
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
    SELECT DISTINCT period_year, period_month 
    FROM cost_settlements 
    WHERE period_year = 2026
    ORDER BY period_month
""")
settlements = cursor.fetchall()
print(f"2026 年结算记录数：{len(settlements)}")
for s in settlements:
    print(f"  {s['period_year']}-{s['period_month']:02d}")

# 查询 4 月份的具体数据
print("\n【4 月份成本结算数据示例】")
cursor.execute("""
    SELECT 
        product_code,
        warehouse_id,
        opening_qty,
        opening_cost,
        inbound_qty,
        inbound_cost,
        outbound_qty,
        outbound_cost,
        closing_qty,
        closing_cost
    FROM cost_settlements
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

# 测试本年累计计算
print("\n" + "=" * 80)
print("测试本年累计计算")
print("=" * 80)

if products:
    product_code = products[0]['code']
    warehouse_id = warehouses[0]['id'] if warehouses else 1
    
    print(f"\n测试产品：{product_code}, 仓库：{warehouse_id}")
    
    # 累加 1-4 月数据
    cursor.execute("""
        SELECT 
            SUM(inbound_qty) as total_in_qty,
            SUM(inbound_cost) as total_in_amt,
            SUM(outbound_qty) as total_out_qty,
            SUM(outbound_cost) as total_out_amt
        FROM cost_settlements
        WHERE product_code = ?
          AND warehouse_id = ?
          AND period_year = 2026
          AND period_month BETWEEN 1 AND 4
    """, (product_code, warehouse_id))
    
    result = cursor.fetchone()
    if result:
        print(f"\n本年累计（1-4 月）:")
        print(f"  入库：数量={result['total_in_qty']}, 金额={result['total_in_amt']}")
        print(f"  出库：数量={result['total_out_qty']}, 金额={result['total_out_amt']}")
        
        if result['total_in_qty'] and result['total_in_amt']:
            avg_price = result['total_in_amt'] / result['total_in_qty']
            print(f"  入库平均单价：{avg_price:.2f}")
        
        if result['total_out_qty'] and result['total_out_amt']:
            avg_price = abs(result['total_out_amt']) / abs(result['total_out_qty'])
            print(f"  出库平均单价：{abs(result['total_out_amt']) / abs(result['total_out_qty']):.2f}")

conn.close()

print("\n" + "=" * 80)
print("检查完成")
print("=" * 80)
