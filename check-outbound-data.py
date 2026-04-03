import sqlite3

# 数据库路径
db_path = r'C:\Users\Administrator\AppData\Roaming\Electron\inventory.db'

print(f"🔍 检查出库单数据...")
print(f"数据库路径：{db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 查询所有出库单
    print("\n📋 查询所有出库单...")
    cursor.execute("""
        SELECT id, outbound_no, outbound_date, total_amount, status, created_at 
        FROM sales_outbound 
        ORDER BY created_at DESC 
        LIMIT 5
    """)
    outbounds = cursor.fetchall()
    
    if not outbounds:
        print("❌ 没有找到出库单记录")
    else:
        print(f"\n✅ 找到 {len(outbounds)} 条出库单记录:")
        for outbound in outbounds:
            print(f"\n  出库单 #{outbound[0]}: {outbound[1]}")
            print(f"    日期：{outbound[2]}")
            print(f"    总金额：{outbound[3]}")
            print(f"    状态：{outbound[4]}")
            print(f"    创建时间：{outbound[5]}")
            
            # 查询明细
            cursor.execute("""
                SELECT product_id, product_name, specification, unit, 
                       quantity, unit_price, sale_price, tax_rate, tax_amount, total_amount, cost_price, remark
                FROM sales_outbound_items 
                WHERE outbound_id = ?
            """, (outbound[0],))
            
            items = cursor.fetchall()
            print(f"    明细数量：{len(items)}")
            
            for i, item in enumerate(items, 1):
                print(f"\n      明细 #{i}:")
                print(f"        产品 ID: {item[0]}")
                print(f"        产品名称：{item[1] or '(空)'}")
                print(f"        规格：{item[2] or '(空)'}")
                print(f"        单位：{item[3] or '(空)'}")
                print(f"        数量：{item[4]}")
                print(f"        进货价：{item[5] or '(空)'}")
                print(f"        售价：{item[6] or '(空)'}")
                print(f"        税率：{item[7] or '(空)'}")
                print(f"        税额：{item[8] or '(空)'}")
                print(f"        总金额：{item[9] or '(空)'}")
                print(f"        成本价：{item[10] or '(空)'}")
                print(f"        备注：{item[11] or '(空)'}")
    
    conn.close()
    print("\n✅ 检查完成")
    
except Exception as e:
    print(f"❌ 检查失败：{e}")
    import traceback
    traceback.print_exc()
