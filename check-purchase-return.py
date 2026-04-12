"""
检查采购退货单数据
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
print("检查采购退货单数据")
print("=" * 80)

# 查询所有采购退货单
print("\n【采购退货单】")
cursor.execute("""
    SELECT 
        pr.id,
        pr.return_no,
        pr.return_date,
        pr.original_inbound_no,
        pr.warehouse_id,
        pri.product_id,
        pri.quantity,
        pri.unit_price,
        pri.total_amount,
        pi.inbound_date,
        pi.invoice_type,
        pi.invoice_issued,
        ii.unit_price as inbound_unit_price,
        ii.total_amount as inbound_total_amount,
        ii.total_amount_ex as inbound_total_amount_ex
    FROM purchase_return_items pri
    JOIN purchase_returns pr ON pri.return_id = pr.id
    LEFT JOIN purchase_inbound pi ON pr.original_inbound_no = pi.inbound_no
    LEFT JOIN purchase_inbound_items ii ON ii.inbound_id = pi.id AND ii.product_id = pri.product_id
    ORDER BY pr.return_date
""")

rows = cursor.fetchall()
for row in rows:
    print(f"\n退货单：{row['return_no']}")
    print(f"  退货日期：{row['return_date']}")
    print(f"  原入库单号：{row['original_inbound_no']}")
    print(f"  原入库日期：{row['inbound_date']}")
    print(f"  产品 ID: {row['product_id']}, 仓库 ID: {row['warehouse_id']}")
    print(f"  退货数量：{row['quantity']}")
    print(f"  退货单价：{row['unit_price']}")
    print(f"  退货总金额：{row['total_amount']}")
    print(f"  原入库单价：{row['inbound_unit_price']}")
    print(f"  原入库总金额（含税）：{row['inbound_total_amount']}")
    print(f"  原入库总金额（不含税）：{row['inbound_total_amount_ex']}")
    print(f"  原发票类型：{row['invoice_type']}")
    print(f"  原发票已开具：{row['invoice_issued']}")

conn.close()

print("\n" + "=" * 80)
print("检查完成")
print("=" * 80)
