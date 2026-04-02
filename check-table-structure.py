import sqlite3
import os

# 数据库路径
db_path = r'C:\Users\Administrator\AppData\Roaming\Electron\inventory.db'

print(f"🔍 检查数据库文件：{db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 检查销售出库明细表结构
    print("\n📋 检查销售出库明细表结构...")
    cursor.execute("PRAGMA table_info(sales_outbound_items)")
    columns = cursor.fetchall()
    print(f"销售出库明细表字段:")
    for col in columns:
        print(f"  {col[1]}: {col[2]}")
    
    # 检查销售出库主表结构
    print("\n📋 检查销售出库主表结构...")
    cursor.execute("PRAGMA table_info(sales_outbound)")
    columns = cursor.fetchall()
    print(f"销售出库主表字段:")
    for col in columns:
        print(f"  {col[1]}: {col[2]}")
    
    conn.close()
    print("\n✅ 检查完成")
    
except Exception as e:
    print(f"❌ 检查失败：{e}")
    import traceback
    traceback.print_exc()
