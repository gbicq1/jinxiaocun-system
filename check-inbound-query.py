"""
检查成本结算查询的日期范围
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
print("检查成本结算查询的日期范围")
print("=" * 80)

# 查询 4 月份的入库数据
year = 2026
month = 4

month_start = f"{year}-{str(month).zfill(2)}-01"
next_month = 1 if month == 12 else month + 1
next_year = year + 1 if month == 12 else year
month_end = f"{next_year}-{str(next_month).zfill(2)}-01"

print(f"\n查询期间：{month_start} 到 {month_end}")

# 查询产品
product_id = 1
warehouse_id = 1

print(f"产品 ID: {product_id}, 仓库 ID: {warehouse_id}")
print("-" * 80)

# 1. 采购入库
print("\n【采购入库】")
sql = """
  SELECT
    ii.quantity,
    ii.total_amount_ex,
    ii.total_amount,
    ii.tax_rate,
    ii.allow_deduction,
    pi.invoice_type,
    pi.invoice_issued,
    pi.inbound_date
  FROM purchase_inbound_items ii
  JOIN purchase_inbound pi ON ii.inbound_id = pi.id
  WHERE pi.warehouse_id = ?
    AND pi.inbound_date >= ?
    AND pi.inbound_date < ?
    AND ii.product_id = ?
"""

cursor.execute(sql, (warehouse_id, month_start, month_end, product_id))
rows = cursor.fetchall()
print(f"记录数：{len(rows)}")

total_qty = 0
total_cost = 0

for row in rows:
    qty = row['quantity'] or 0
    is_special = row['invoice_type'] in ['专票', '专用发票']
    is_issued = row['invoice_issued'] in [1, True]
    is_tax_exempt = float(row['tax_rate'] or 0) == 0
    is_deduction = row['allow_deduction'] in [1, True]
    
    if is_special and is_issued:
        cost = row['total_amount_ex'] or 0
    elif is_issued and is_tax_exempt and is_deduction:
        cost = row['total_amount_ex'] or 0
    else:
        cost = row['total_amount'] or 0
    
    total_qty += qty
    total_cost += cost
    
    print(f"  {row['inbound_date']}: 数量={qty}, 成本={cost}")

print(f"采购入库小计：数量={total_qty}, 成本={total_cost}")

# 2. 采购退货
print("\n【采购退货】")
sql = """
  SELECT
    pri.quantity,
    ii.total_amount
  FROM purchase_return_items pri
  JOIN purchase_returns pr ON pri.return_id = pr.id
  LEFT JOIN purchase_inbound pi ON pr.original_inbound_no = pi.inbound_no
  LEFT JOIN purchase_inbound_items ii ON pi.id = ii.inbound_id AND pri.product_id = ii.product_id
    AND ii.id = (
      SELECT MIN(ii2.id) FROM purchase_inbound_items ii2
      WHERE ii2.inbound_id = pi.id AND ii2.product_id = pri.product_id
    )
  WHERE pr.warehouse_id = ?
    AND pr.return_date >= ?
    AND pr.return_date < ?
    AND pri.product_id = ?
"""

cursor.execute(sql, (warehouse_id, month_start, month_end, product_id))
rows = cursor.fetchall()
print(f"记录数：{len(rows)}")

return_qty = 0
return_cost = 0

for row in rows:
    qty = row['quantity'] or 0
    cost = row['total_amount'] or 0
    
    return_qty += qty
    return_cost += cost
    
    print(f"  退货：数量={qty}, 成本={cost}")

print(f"采购退货小计：数量={return_qty}, 成本={return_cost}")

# 3. 调拨入库
print("\n【调拨入库】")
sql = """
  SELECT tri.quantity, tri.cost, tri.amount
  FROM transfer_record_items tri
  JOIN transfer_records tr ON tri.transfer_id = tr.id
  WHERE tr.to_warehouse_id = ?
    AND tr.transfer_date >= ?
    AND tr.transfer_date < ?
    AND tri.product_id = ?
"""

cursor.execute(sql, (warehouse_id, month_start, month_end, product_id))
rows = cursor.fetchall()
print(f"记录数：{len(rows)}")

transfer_qty = 0
transfer_cost = 0

for row in rows:
    qty = row['quantity'] or 0
    cost = row['amount'] or (row['cost'] * qty if row['cost'] else 0)
    
    transfer_qty += qty
    transfer_cost += cost
    
    print(f"  调拨入库：数量={qty}, 成本={cost}")

print(f"调拨入库小计：数量={transfer_qty}, 成本={transfer_cost}")

# 汇总
print("\n" + "=" * 80)
print("入库汇总")
print("=" * 80)
total_in_qty = total_qty - abs(return_qty) + transfer_qty
total_in_cost = total_cost - abs(return_cost) + transfer_cost
print(f"总入库数量：{total_in_qty}")
print(f"总入库成本：{total_in_cost}")

conn.close()

print("\n" + "=" * 80)
print("检查完成")
print("=" * 80)
