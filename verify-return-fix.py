"""
验证采购退货成本计算修复
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
print("验证采购退货成本计算修复")
print("=" * 80)

# 查询产品
product_id = 1
warehouse_id = 1

print(f"\n测试产品 ID: {product_id}, 仓库 ID: {warehouse_id}")
print("-" * 80)

# 查询 2026 年 4 月的入库数据
year = 2026
month = 4

month_start = f"{year}-{str(month).zfill(2)}-01"
next_month = 1 if month == 12 else month + 1
next_year = year + 1 if month == 12 else year
month_end = f"{next_year}-{str(next_month).zfill(2)}-01"

print(f"\n查询期间：{month_start} 到 {month_end}")

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
    pi.invoice_issued
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

total_in_qty = 0
total_in_cost = 0

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
    
    total_in_qty += qty
    total_in_cost += cost
    
    print(f"  采购入库：数量={qty}, 成本={cost:.2f}")

print(f"采购入库小计：数量={total_in_qty}, 成本={total_in_cost:.2f}")

# 2. 采购退货（使用修复后的逻辑）
print("\n【采购退货】（修复后：按比例计算成本）")
sql = """
  SELECT
    pri.quantity,
    ii.quantity as inbound_qty,
    CASE 
      WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.total_amount_ex
      WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.total_amount_ex
      ELSE ii.total_amount
    END as inbound_total_amount
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
    inbound_qty = row['inbound_qty'] or 0
    inbound_total_amt = row['inbound_total_amount'] or 0
    
    # 按比例计算成本
    cost_amt = 0
    if inbound_qty > 0:
        cost_amt = inbound_total_amt * (qty / inbound_qty)
    
    return_qty += qty
    return_cost += cost_amt
    
    print(f"  退货：数量={qty}, 原入库数量={inbound_qty}, 原入库金额={inbound_total_amt:.2f}")
    print(f"    → 退货成本 = {inbound_total_amt:.2f} × ({qty}/{inbound_qty}) = {cost_amt:.2f}")

print(f"采购退货小计：数量={return_qty}, 成本={return_cost:.2f}")

# 3. 汇总
print("\n" + "=" * 80)
print("入库汇总（修复后）")
print("=" * 80)
net_in_qty = total_in_qty - abs(return_qty)
net_in_cost = total_in_cost - abs(return_cost)
print(f"净入库数量：{total_in_qty} - {abs(return_qty)} = {net_in_qty}")
print(f"净入库成本：{total_in_cost:.2f} - {abs(return_cost):.2f} = {net_in_cost:.2f}")

# 4. 对比成本结算表中的数据
print("\n" + "=" * 80)
print("成本结算表中的数据")
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

print("\n提示：如果 4 月份数据仍不正确，请重新进行成本结算")

conn.close()

print("\n" + "=" * 80)
print("验证完成")
print("=" * 80)
