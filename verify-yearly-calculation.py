"""
验证本年累计计算逻辑
"""
import sqlite3
from pathlib import Path
from datetime import datetime

# 连接数据库
db_path = Path(__file__).parent / 'electron' / 'database.db'
conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=" * 80)
print("验证本年累计计算逻辑")
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

# 查询本年（2026 年）1-4 月的所有入库和出库数据
year = 2026
month = 4

print(f"\n【{year}年{month}月 本年累计数据验证】")

# 1. 采购入库
print("\n1. 采购入库数据:")
cursor.execute("""
    SELECT 
        pi.inbound_no,
        pi.inbound_date,
        ii.quantity,
        ii.unit_price,
        ii.total_amount,
        ii.total_amount_ex,
        pi.invoice_type,
        pi.invoice_issued
    FROM purchase_inbound_items ii
    JOIN purchase_inbound pi ON ii.inbound_id = pi.id
    WHERE pi.warehouse_id = ?
      AND strftime('%Y', pi.inbound_date) = ?
      AND strftime('%m', pi.inbound_date) <= printf('%02d', ?)
      AND ii.product_id = ?
    ORDER BY pi.inbound_date
""", (warehouse_id, str(year), month, product_id))

inbound_rows = cursor.fetchall()
total_in_qty = 0
total_in_amt = 0
for row in inbound_rows:
    # 应用发票类型逻辑
    if (row['invoice_type'] in ['专票', '专用发票'] and row['invoice_issued'] in [1, True]):
        amount = row['total_amount_ex'] or 0
    else:
        amount = row['total_amount'] or 0
    
    qty = row['quantity'] or 0
    total_in_qty += qty
    total_in_amt += amount
    print(f"  {row['inbound_date']} {row['inbound_no']}: 数量={qty:.2f}, 金额={amount:.2f}")

print(f"  采购入库小计：数量={total_in_qty:.2f}, 金额={total_in_amt:.2f}")

# 2. 采购退货
print("\n2. 采购退货数据:")
cursor.execute("""
    SELECT 
        pr.return_no,
        pr.return_date,
        pri.quantity,
        ii.total_amount,
        ii.total_amount_ex,
        pi.invoice_type,
        pi.invoice_issued
    FROM purchase_return_items pri
    JOIN purchase_returns pr ON pri.return_id = pr.id
    LEFT JOIN purchase_inbound pi ON pr.original_inbound_no = pi.inbound_no
    LEFT JOIN purchase_inbound_items ii ON pi.id = ii.inbound_id 
        AND pri.product_id = ii.product_id
    WHERE pr.warehouse_id = ?
      AND strftime('%Y', pr.return_date) = ?
      AND strftime('%m', pr.return_date) <= printf('%02d', ?)
      AND pri.product_id = ?
    ORDER BY pr.return_date
""", (warehouse_id, str(year), month, product_id))

return_rows = cursor.fetchall()
total_return_qty = 0
total_return_amt = 0
for row in return_rows:
    # 应用发票类型逻辑
    if (row['invoice_type'] in ['专票', '专用发票'] and row['invoice_issued'] in [1, True]):
        amount = row['total_amount_ex'] or 0
    else:
        amount = row['total_amount'] or 0
    
    qty = -(abs(row['quantity']) or 0)  # 退货为负数
    total_return_qty += qty
    total_return_amt += -abs(amount)  # 退货金额为负数
    print(f"  {row['return_date']} {row['return_no']}: 数量={qty:.2f}, 金额={-abs(amount):.2f}")

print(f"  采购退货小计：数量={total_return_qty:.2f}, 金额={total_return_amt:.2f}")

# 3. 销售出库
print("\n3. 销售出库数据:")
cursor.execute("""
    SELECT 
        so.outbound_no,
        so.outbound_date,
        oi.quantity,
        oi.unit_price,
        oi.total_amount,
        oi.cost_price
    FROM sales_outbound_items oi
    JOIN sales_outbound so ON oi.outbound_id = so.id
    WHERE so.warehouse_id = ?
      AND strftime('%Y', so.outbound_date) = ?
      AND strftime('%m', so.outbound_date) <= printf('%02d', ?)
      AND oi.product_id = ?
    ORDER BY so.outbound_date
""", (warehouse_id, str(year), month, product_id))

outbound_rows = cursor.fetchall()
total_out_qty = 0
total_out_amt = 0
for row in outbound_rows:
    qty = row['quantity'] or 0
    # 注意：这里使用 total_amount（销售金额），但实际成本计算应该用加权平均法
    amount = row['total_amount'] or 0
    total_out_qty += qty
    total_out_amt += amount
    print(f"  {row['outbound_date']} {row['outbound_no']}: 数量={qty:.2f}, 销售金额={amount:.2f}, 成本价={row['cost_price']}")

print(f"  销售出库小计：数量={total_out_qty:.2f}, 销售金额={total_out_amt:.2f}")

# 4. 销售退货
print("\n4. 销售退货数据:")
cursor.execute("""
    SELECT 
        sr.return_no,
        sr.return_date,
        sri.quantity,
        sri.total_amount
    FROM sales_return_items sri
    JOIN sales_returns sr ON sri.return_id = sr.id
    WHERE sr.warehouse_id = ?
      AND strftime('%Y', sr.return_date) = ?
      AND strftime('%m', sr.return_date) <= printf('%02d', ?)
      AND sri.product_id = ?
    ORDER BY sr.return_date
""", (warehouse_id, str(year), month, product_id))

sales_return_rows = cursor.fetchall()
total_sales_return_qty = 0
total_sales_return_amt = 0
for row in sales_return_rows:
    qty = -(abs(row['quantity']) or 0)  # 退货为负数
    amount = -(abs(row['total_amount']) or 0)  # 退货金额为负数
    total_sales_return_qty += qty
    total_sales_return_amt += amount
    print(f"  {row['return_date']} {row['return_no']}: 数量={qty:.2f}, 金额={amount:.2f}")

print(f"  销售退货小计：数量={total_sales_return_qty:.2f}, 金额={total_sales_return_amt:.2f}")

# 汇总
print("\n" + "=" * 80)
print("【本年累计汇总】")
print("=" * 80)

# 入库合计
total_year_in_qty = total_in_qty + total_return_qty
total_year_in_amt = total_in_amt + total_return_amt

# 出库合计（注意：这里的金额是销售金额，不是成本金额）
total_year_out_qty = total_out_qty + total_sales_return_qty
total_year_out_amt_sales = total_out_amt + total_sales_return_amt  # 销售金额

print(f"""
入库数据:
  - 采购入库：数量={total_in_qty:.2f}, 金额={total_in_amt:.2f}
  - 采购退货：数量={total_return_qty:.2f}, 金额={total_return_amt:.2f}
  → 入库合计：数量={total_year_in_qty:.2f}, 金额={total_year_in_amt:.2f}

出库数据:
  - 销售出库：数量={total_out_qty:.2f}, 销售金额={total_out_amt_sales:.2f}
  - 销售退货：数量={total_sales_return_qty:.2f}, 销售金额={total_sales_return_amt:.2f}
  → 出库合计：数量={total_year_out_qty:.2f}, 销售金额={total_year_out_amt_sales:.2f}

注意：出库金额应该使用加权平均法计算的成本金额，而不是销售金额！
加权平均单价 = (期初金额 + 入库金额) / (期初数量 + 入库数量)
出库成本 = 出库数量 × 加权平均单价
""")

# 计算加权平均单价
print("\n【加权平均法计算】")
cursor.execute("""
    SELECT opening_qty, opening_cost, inbound_qty, inbound_cost, outbound_qty, outbound_cost
    FROM cost_settlements
    WHERE product_code = (SELECT code FROM products WHERE id = ?)
      AND warehouse_id = ?
      AND period_year = ?
      AND period_month = ?
""", (product_id, warehouse_id, year, month))

settlement = cursor.fetchone()
if settlement:
    opening_qty = settlement['opening_qty'] or 0
    opening_cost = settlement['opening_cost'] or 0
    inbound_qty = settlement['inbound_qty'] or 0
    inbound_cost = settlement['inbound_cost'] or 0
    outbound_qty = settlement['outbound_qty'] or 0
    outbound_cost = settlement['outbound_cost'] or 0
    
    print(f"期初：数量={opening_qty:.2f}, 金额={opening_cost:.2f}")
    print(f"入库：数量={inbound_qty:.2f}, 金额={inbound_cost:.2f}")
    print(f"出库：数量={outbound_qty:.2f}, 金额={outbound_cost:.2f}")
    
    # 计算加权平均单价
    if (opening_qty + inbound_qty) > 0:
        weighted_avg_price = (opening_cost + inbound_cost) / (opening_qty + inbound_qty)
        print(f"\n加权平均单价 = ({opening_cost:.2f} + {inbound_cost:.2f}) / ({opening_qty:.2f} + {inbound_qty:.2f}) = {weighted_avg_price:.2f}")
        
        expected_outbound_cost = outbound_qty * weighted_avg_price
        print(f"预期出库成本 = {outbound_qty:.2f} × {weighted_avg_price:.2f} = {expected_outbound_cost:.2f}")
        print(f"实际出库成本 = {outbound_cost:.2f}")
        
        if abs(expected_outbound_cost - outbound_cost) > 0.01:
            print(f"⚠️  出库成本计算不正确！差异：{abs(expected_outbound_cost - outbound_cost):.2f}")
        else:
            print("✓ 出库成本计算正确")
else:
    print("⚠️  未找到成本结算记录，请先进行成本结算")

conn.close()

print("\n" + "=" * 80)
print("验证完成")
print("=" * 80)
