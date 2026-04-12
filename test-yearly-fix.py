"""
测试本年累计计算逻辑修复
"""
import sqlite3
from pathlib import Path

# 连接数据库
db_path = Path(__file__).parent / 'electron' / 'database.db'
conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=" * 80)
print("测试本年累计计算逻辑")
print("=" * 80)

# 查询产品
cursor.execute("SELECT id, code, name FROM products WHERE status = 1 LIMIT 5")
products = cursor.fetchall()
print("\n产品列表:")
for p in products:
    print(f"  ID: {p['id']}, Code: {p['code']}, Name: {p['name']}")

# 查询仓库
cursor.execute("SELECT id, name FROM warehouses")
warehouses = cursor.fetchall()
print("\n仓库列表:")
for w in warehouses:
    print(f"  ID: {w['id']}, Name: {w['name']}")

# 使用示例产品
product_id = 1
warehouse_id = 1

print(f"\n测试产品 ID: {product_id}, 仓库 ID: {warehouse_id}")
print("-" * 80)

# 查询本年（2026 年）的成本结算数据
year = 2026

print(f"\n【{year}年 成本结算数据】")
cursor.execute("""
    SELECT 
        period_month,
        opening_qty,
        opening_cost,
        inbound_qty,
        inbound_cost,
        outbound_qty,
        outbound_cost,
        closing_qty,
        closing_cost
    FROM cost_settlements
    WHERE product_code = (SELECT code FROM products WHERE id = ?)
      AND warehouse_id = ?
      AND period_year = ?
    ORDER BY period_month
""", (product_id, warehouse_id, year))

settlements = cursor.fetchall()

if not settlements:
    print("\n⚠️  未找到成本结算记录！请先进行成本结算操作。")
    print("提示：在系统中进入【成本管理】→【成本结算】，选择产品和月份进行结算。")
else:
    print(f"\n找到 {len(settlements)} 条结算记录:\n")
    
    # 累加计算本年累计
    total_in_qty = 0
    total_in_amt = 0
    total_out_qty = 0
    total_out_amt = 0
    
    for s in settlements:
        month = s['period_month']
        in_qty = s['inbound_qty'] or 0
        in_amt = s['inbound_cost'] or 0
        out_qty = s['outbound_qty'] or 0
        out_amt = s['outbound_cost'] or 0
        
        # 累加
        total_in_qty += in_qty
        total_in_amt += in_amt
        total_out_qty += out_qty
        total_out_amt += out_amt
        
        print(f"{month:02d}月:")
        print(f"  入库：数量={in_qty:.2f}, 金额={in_amt:.2f}")
        print(f"  出库：数量={out_qty:.2f}, 金额={out_amt:.2f}")
        print(f"  期末：数量={s['closing_qty']:.2f}, 金额={s['closing_cost']:.2f}")
        print()
    
    print("=" * 80)
    print("【本年累计结果】")
    print("=" * 80)
    print(f"入库合计：数量={total_in_qty:.2f}, 金额={total_in_amt:.2f}")
    print(f"出库合计：数量={total_out_qty:.2f}, 金额={total_out_amt:.2f}")
    
    # 计算加权平均单价
    if (total_in_qty + total_out_qty) > 0:
        weighted_avg_price = (total_in_amt + abs(total_out_amt)) / (total_in_qty + abs(total_out_qty))
        print(f"\n加权平均单价 = ({total_in_amt:.2f} + {abs(total_out_amt):.2f}) / ({total_in_qty:.2f} + {abs(total_out_qty):.2f}) = {weighted_avg_price:.2f}")

print("\n" + "=" * 80)
print("测试完成")
print("=" * 80)

conn.close()
