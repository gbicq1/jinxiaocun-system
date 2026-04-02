import sqlite3
import os

# 数据库路径
db_path = r'C:\Users\Administrator\AppData\Roaming\Electron\inventory.db'

print(f"🔍 检查数据库文件：{db_path}")

if not os.path.exists(db_path):
    print(f"❌ 数据库文件不存在：{db_path}")
    exit(1)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("\n📋 检查表是否存在...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"找到的表：{tables}")
    
    # 检查销售出库主表
    print("\n📋 检查销售出库主表数据...")
    cursor.execute("SELECT COUNT(*) FROM sales_outbound")
    count = cursor.fetchone()[0]
    print(f"出库单数量：{count}")
    
    if count > 0:
        cursor.execute("SELECT * FROM sales_outbound LIMIT 1")
        first_outbound = cursor.fetchone()
        columns = [description[0] for description in cursor.description]
        print("\n第一条出库单数据:")
        for i, column in enumerate(columns):
            print(f"  {column}: {first_outbound[i]}")
        
        # 检查明细表
        print("\n📋 检查出库单明细...")
        outbound_id = first_outbound[0]  # 假设第一列是 ID
        cursor.execute("SELECT * FROM sales_outbound_items WHERE outbound_id = ?", (outbound_id,))
        items = cursor.fetchall()
        print(f"明细数量：{len(items)}")
        
        if len(items) > 0:
            first_item = items[0]
            item_columns = [description[0] for description in cursor.description]
            print("\n第一条明细数据:")
            for i, column in enumerate(item_columns):
                print(f"  {column}: {first_item[i]}")
    
    # 检查客户表
    print("\n📋 检查客户表...")
    cursor.execute("SELECT COUNT(*) FROM customers")
    customer_count = cursor.fetchone()[0]
    print(f"客户数量：{customer_count}")
    
    # 检查仓库表
    print("\n📋 检查仓库表...")
    cursor.execute("SELECT COUNT(*) FROM warehouses")
    warehouse_count = cursor.fetchone()[0]
    print(f"仓库数量：{warehouse_count}")
    
    # 检查商品表
    print("\n📋 检查商品表...")
    cursor.execute("SELECT COUNT(*) FROM products")
    product_count = cursor.fetchone()[0]
    print(f"商品数量：{product_count}")
    
    conn.close()
    print("\n✅ 检查完成")
    
except Exception as e:
    print(f"❌ 检查失败：{e}")
    import traceback
    traceback.print_exc()
