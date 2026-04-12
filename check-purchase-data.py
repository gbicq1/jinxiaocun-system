"""
检查实际数据库中的采购入库数据
"""
import sqlite3
from pathlib import Path
import os

# 实际使用的数据库文件
db_path = Path(os.environ['APPDATA']) / 'electron' / 'inventory.db'

conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=" * 80)
print("检查采购入库数据")
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

# 使用示例产品
product_id = 1
warehouse_id = 1

print(f"\n测试产品 ID: {product_id}, 仓库 ID: {warehouse_id}")
print("-" * 80)

# 查询 2026 年 1-4 月的采购入库数据
print("\n【2026 年 1-4 月 采购入库数据】")
cursor.execute("""
    SELECT 
        pi.inbound_no,
        pi.inbound_date,
        ii.quantity,
        ii.unit_price,
        ii.total_amount,
        ii.total_amount_ex,
        ii.tax_rate,
        ii.allow_deduction,
        pi.invoice_type,
        pi.invoice_issued,
        pi.supplier_id
    FROM purchase_inbound_items ii
    JOIN purchase_inbound pi ON ii.inbound_id = pi.id
    WHERE pi.warehouse_id = ?
      AND strftime('%Y', pi.inbound_date) = '2026'
      AND strftime('%m', pi.inbound_date) BETWEEN '01' AND '04'
      AND ii.product_id = ?
    ORDER BY pi.inbound_date
""", (warehouse_id, product_id))

inbound_rows = cursor.fetchall()
total_qty = 0
total_amt = 0
total_amt_ex = 0

for row in inbound_rows:
    qty = row['quantity'] or 0
    amt = row['total_amount'] or 0
    amt_ex = row['total_amount_ex'] or 0
    
    # 应用发票类型逻辑
    is_special = row['invoice_type'] in ['专票', '专用发票']
    is_issued = row['invoice_issued'] in [1, True]
    is_tax_exempt = float(row['tax_rate'] or 0) == 0
    is_deduction = row['allow_deduction'] in [1, True]
    
    if is_special and is_issued:
        cost = amt_ex
    elif is_issued and is_tax_exempt and is_deduction:
        cost = amt_ex
    else:
        cost = amt
    
    total_qty += qty
    total_amt += amt
    total_amt_ex += amt_ex
    
    print(f"\n{row['inbound_date']} {row['inbound_no']}:")
    print(f"  数量={qty:.2f}, 单价={row['unit_price']}, 总金额={amt:.2f}, 不含税金额={amt_ex:.2f}")
    print(f"  发票类型={row['invoice_type']}, 已开票={row['invoice_issued']}, 税率={row['tax_rate']}, 可抵扣={row['allow_deduction']}")
    print(f"  → 成本金额={cost:.2f}")

print(f"\n汇总:")
print(f"  总数量={total_qty:.2f}")
print(f"  总金额（含税）={total_amt:.2f}")
print(f"  总金额（不含税）={total_amt_ex:.2f}")

# 查询成本结算表中的数据
print("\n" + "=" * 80)
print("检查成本结算表中的数据")
print("=" * 80)

cursor.execute("""
    SELECT 
        period_month,
        inbound_qty,
        inbound_cost
    FROM cost_settlements
    WHERE product_code = (SELECT code FROM products WHERE id = ?)
      AND warehouse_id = ?
      AND period_year = 2026
    ORDER BY period_month
""", (product_id, warehouse_id))

settlements = cursor.fetchall()
for s in settlements:
    print(f"{s['period_month']:02d}月：入库数量={s['inbound_qty']}, 入库金额={s['inbound_cost']}")

conn.close()

print("\n" + "=" * 80)
print("检查完成")
print("=" * 80)
