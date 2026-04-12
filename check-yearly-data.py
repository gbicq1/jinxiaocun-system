"""
检查本年累计数据的诊断脚本
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
print("本年累计数据诊断报告")
print("=" * 80)

# 查询产品
cursor.execute("SELECT id, code, name FROM products LIMIT 5")
products = cursor.fetchall()
print("\n可选产品：")
for p in products:
    print(f"  ID: {p['id']}, Code: {p['code']}, Name: {p['name']}")

# 默认产品 ID 和仓库 ID（可以根据实际情况修改）
product_id = "1"  # 苹果的产品 ID
warehouse_id = "1"  # 驿站的仓库 ID
print(f"\n使用默认产品 ID: {product_id}, 仓库 ID: {warehouse_id}")

# 获取产品信息
cursor.execute("SELECT code, name FROM products WHERE id = ?", (product_id,))
product = cursor.fetchone()
print(f"\n检查产品：{product['code']} - {product['name']}")
print(f"仓库 ID: {warehouse_id}")
print("-" * 80)

# 1. 查询本年采购入库数据
print("\n【1】本年采购入库数据 (2026-01-01 到 2026-04-30)")
cursor.execute("""
    SELECT 
        pi.inbound_no,
        pi.inbound_date,
        ii.quantity,
        ii.unit_price,
        ii.unit_price_ex,
        ii.total_amount,
        ii.total_amount_ex,
        pi.invoice_type,
        pi.invoice_issued,
        ii.tax_rate,
        ii.allow_deduction
    FROM purchase_inbound_items ii
    JOIN purchase_inbound pi ON ii.inbound_id = pi.id
    WHERE pi.warehouse_id = ?
      AND pi.inbound_date >= '2026-01-01'
      AND pi.inbound_date < '2026-05-01'
      AND ii.product_id = ?
    ORDER BY pi.inbound_date
""", (warehouse_id, product_id))

inbound_data = cursor.fetchall()
print(f"记录数：{len(inbound_data)}")
total_in_qty = 0
total_in_amt = 0
for row in inbound_data:
    # 应用与代码相同的逻辑
    if (row['invoice_type'] in ['专票', '专用发票'] and row['invoice_issued'] in [1, True]):
        amount = row['total_amount_ex'] or 0
    elif (row['invoice_issued'] in [1, True] and 
          (row['tax_rate'] in [0, None, '0%'] or row['tax_rate'] == '0') and 
          row['allow_deduction'] in [1, True]):
        amount = row['total_amount_ex'] or 0
    else:
        amount = row['total_amount'] or 0
    
    qty = row['quantity'] or 0
    total_in_qty += qty
    total_in_amt += amount
    print(f"  {row['inbound_date']} {row['inbound_no']}: 数量={qty}, 单价={row['unit_price']}, 金额={amount:.2f}")

print(f"\n采购入库合计：数量={total_in_qty:.2f}, 金额={total_in_amt:.2f}")

# 2. 查询本年采购退货数据
print("\n【2】本年采购退货数据 (2026-01-01 到 2026-04-30)")
cursor.execute("""
    SELECT 
        pr.return_no,
        pr.return_date,
        pri.quantity,
        pi.invoice_type,
        pi.invoice_issued,
        ii.unit_price,
        ii.unit_price_ex,
        ii.total_amount,
        ii.total_amount_ex,
        ii.tax_rate,
        ii.allow_deduction
    FROM purchase_return_items pri
    JOIN purchase_returns pr ON pri.return_id = pr.id
    LEFT JOIN purchase_inbound pi ON pr.original_inbound_no = pi.inbound_no
    LEFT JOIN purchase_inbound_items ii ON pi.id = ii.inbound_id 
        AND pri.product_id = ii.product_id
        AND ii.id = (
            SELECT MIN(ii2.id) FROM purchase_inbound_items ii2 
            WHERE ii2.inbound_id = pi.id AND ii2.product_id = pri.product_id
        )
    WHERE pr.warehouse_id = ?
      AND pr.return_date >= '2026-01-01'
      AND pr.return_date < '2026-05-01'
      AND pri.product_id = ?
    ORDER BY pr.return_date
""", (warehouse_id, product_id))

return_data = cursor.fetchall()
print(f"记录数：{len(return_data)}")
total_return_qty = 0
total_return_amt = 0
for row in return_data:
    # 应用与代码相同的逻辑
    if (row['invoice_type'] in ['专票', '专用发票'] and row['invoice_issued'] in [1, True]):
        amount = row['total_amount_ex'] or 0
    elif (row['invoice_issued'] in [1, True] and 
          (row['tax_rate'] in [0, None, '0%'] or row['tax_rate'] == '0') and 
          row['allow_deduction'] in [1, True]):
        amount = row['total_amount_ex'] or 0
    else:
        amount = row['total_amount'] or 0
    
    qty = -(abs(row['quantity']) or 0)  # 退货为负数
    total_return_qty += qty
    total_return_amt += -abs(amount)  # 退货金额为负数
    print(f"  {row['return_date']} {row['return_no']}: 数量={qty:.2f}, 金额={-abs(amount):.2f}")

print(f"\n采购退货合计：数量={total_return_qty:.2f}, 金额={total_return_amt:.2f}")

# 3. 查询本年调拨入库数据
print("\n【3】本年调拨入库数据 (2026-01-01 到 2026-04-30)")
cursor.execute("""
    SELECT 
        tr.transfer_no,
        tr.transfer_date,
        tri.quantity,
        tri.amount,
        tri.cost,
        fw.name as from_warehouse,
        tw.name as to_warehouse
    FROM transfer_record_items tri
    JOIN transfer_records tr ON tri.transfer_id = tr.id
    LEFT JOIN warehouses fw ON tr.from_warehouse_id = fw.id
    LEFT JOIN warehouses tw ON tr.to_warehouse_id = tw.id
    WHERE tr.to_warehouse_id = ?
      AND tr.transfer_date >= '2026-01-01'
      AND tr.transfer_date < '2026-05-01'
      AND tri.product_id = ?
    ORDER BY tr.transfer_date
""", (warehouse_id, product_id))

transfer_in_data = cursor.fetchall()
print(f"记录数：{len(transfer_in_data)}")
total_transfer_in_qty = 0
total_transfer_in_amt = 0
for row in transfer_in_data:
    qty = row['quantity'] or 0
    amount = row['amount'] or 0
    total_transfer_in_qty += qty
    total_transfer_in_amt += amount
    print(f"  {row['transfer_date']} {row['transfer_no']}: 数量={qty:.2f}, 金额={amount:.2f}, 从={row['from_warehouse']}")

print(f"\n调拨入库合计：数量={total_transfer_in_qty:.2f}, 金额={total_transfer_in_amt:.2f}")

# 4. 查询本年销售出库数据
print("\n【4】本年销售出库数据 (2026-01-01 到 2026-04-30)")
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
      AND so.outbound_date >= '2026-01-01'
      AND so.outbound_date < '2026-05-01'
      AND oi.product_id = ?
    ORDER BY so.outbound_date
""", (warehouse_id, product_id))

outbound_data = cursor.fetchall()
print(f"记录数：{len(outbound_data)}")
total_out_qty = 0
total_out_amt = 0
for row in outbound_data:
    qty = row['quantity'] or 0
    amount = row['total_amount'] or 0
    total_out_qty += qty
    total_out_amt += amount
    print(f"  {row['outbound_date']} {row['outbound_no']}: 数量={qty:.2f}, 销售金额={amount:.2f}, 成本价={row['cost_price']}")

print(f"\n销售出库合计：数量={total_out_qty:.2f}, 销售金额={total_out_amt:.2f}")

# 5. 查询本年销售退货数据
print("\n【5】本年销售退货数据 (2026-01-01 到 2026-04-30)")
cursor.execute("""
    SELECT 
        sr.return_no,
        sr.return_date,
        sri.quantity,
        sri.unit_price,
        sri.total_amount,
        sri.cost_price
    FROM sales_return_items sri
    JOIN sales_returns sr ON sri.return_id = sr.id
    WHERE sr.warehouse_id = ?
      AND sr.return_date >= '2026-01-01'
      AND sr.return_date < '2026-05-01'
      AND sri.product_id = ?
    ORDER BY sr.return_date
""", (warehouse_id, product_id))

sales_return_data = cursor.fetchall()
print(f"记录数：{len(sales_return_data)}")
total_sales_return_qty = 0
total_sales_return_amt = 0
for row in sales_return_data:
    qty = -(abs(row['quantity']) or 0)  # 退货为负数
    amount = -(abs(row['total_amount']) or 0)  # 退货金额为负数
    total_sales_return_qty += qty
    total_sales_return_amt += amount
    print(f"  {row['return_date']} {row['return_no']}: 数量={qty:.2f}, 金额={amount:.2f}")

print(f"\n销售退货合计：数量={total_sales_return_qty:.2f}, 金额={total_sales_return_amt:.2f}")

# 6. 查询调拨出库数据
print("\n【6】本年调拨出库数据 (2026-01-01 到 2026-04-30)")
cursor.execute("""
    SELECT 
        tr.transfer_no,
        tr.transfer_date,
        tri.quantity,
        tri.amount,
        tri.cost,
        fw.name as from_warehouse,
        tw.name as to_warehouse
    FROM transfer_record_items tri
    JOIN transfer_records tr ON tri.transfer_id = tr.id
    LEFT JOIN warehouses fw ON tr.from_warehouse_id = fw.id
    LEFT JOIN warehouses tw ON tr.to_warehouse_id = tw.id
    WHERE tr.from_warehouse_id = ?
      AND tr.transfer_date >= '2026-01-01'
      AND tr.transfer_date < '2026-05-01'
      AND tri.product_id = ?
    ORDER BY tr.transfer_date
""", (warehouse_id, product_id))

transfer_out_data = cursor.fetchall()
print(f"记录数：{len(transfer_out_data)}")
total_transfer_out_qty = 0
total_transfer_out_amt = 0
for row in transfer_out_data:
    qty = row['quantity'] or 0
    amount = row['amount'] or 0
    total_transfer_out_qty += qty
    total_transfer_out_amt += amount
    print(f"  {row['transfer_date']} {row['transfer_no']}: 数量={qty:.2f}, 金额={amount:.2f}, 到={row['to_warehouse']}")

print(f"\n调拨出库合计：数量={total_transfer_out_qty:.2f}, 金额={total_transfer_out_amt:.2f}")

# 7. 汇总本年累计数据
print("\n" + "=" * 80)
print("【本年累计汇总】")
print("=" * 80)

# 入库合计（采购入库 + 采购退货 + 调拨入库）
total_year_in_qty = total_in_qty + total_return_qty + total_transfer_in_qty
total_year_in_amt = total_in_amt + total_return_amt + total_transfer_in_amt

# 出库合计（销售出库 + 销售退货 + 调拨出库）
total_year_out_qty = total_out_qty + total_sales_return_qty + total_transfer_out_qty
total_year_out_amt = total_out_amt + total_sales_return_amt + total_transfer_out_amt

print(f"""
入库数据:
  - 采购入库：数量={total_in_qty:.2f}, 金额={total_in_amt:.2f}
  - 采购退货：数量={total_return_qty:.2f}, 金额={total_return_amt:.2f}
  - 调拨入库：数量={total_transfer_in_qty:.2f}, 金额={total_transfer_in_amt:.2f}
  → 入库合计：数量={total_year_in_qty:.2f}, 金额={total_year_in_amt:.2f}

出库数据:
  - 销售出库：数量={total_out_qty:.2f}, 金额={total_out_amt:.2f}
  - 销售退货：数量={total_sales_return_qty:.2f}, 金额={total_sales_return_amt:.2f}
  - 调拨出库：数量={total_transfer_out_qty:.2f}, 金额={total_transfer_out_amt:.2f}
  → 出库合计：数量={total_year_out_qty:.2f}, 金额={total_year_out_amt:.2f}
""")

# 8. 检查 cost_settlement_items 表中的本年累计数据
print("\n【7】cost_settlement_items 表中的本年累计记录")
cursor.execute("""
    SELECT * FROM cost_settlement_items 
    WHERE product_code = ? 
      AND warehouse_id = ?
      AND period_year = 2026
      AND period_month = 4
    ORDER BY snapshot_type, created_at
""", (product['code'], warehouse_id))

settlement_items = cursor.fetchall()
print(f"记录数：{len(settlement_items)}")
for row in settlement_items:
    print(f"\n  类型：{row['snapshot_type']}")
    print(f"    入库：数量={row['inbound_qty']}, 金额={row['inbound_cost']}")
    print(f"    出库：数量={row['outbound_qty']}, 金额={row['outbound_cost']}")

conn.close()

print("\n" + "=" * 80)
print("诊断完成")
print("=" * 80)
