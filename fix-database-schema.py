import sqlite3
import os

# 数据库路径
db_path = r'C:\Users\Administrator\AppData\Roaming\Electron\inventory.db'

print(f"🔧 开始修复出库单表结构...")
print(f"数据库路径：{db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 检查 sales_outbound_items 表的当前结构
    print("\n📋 检查当前表结构...")
    cursor.execute("PRAGMA table_info(sales_outbound_items)")
    table_info = cursor.fetchall()
    print("当前 sales_outbound_items 表结构:")
    existing_columns = []
    for col in table_info:
        print(f"  - {col[1]}: {col[2]}")
        existing_columns.append(col[1])
    
    # 检查缺失的字段
    missing_columns = []
    
    if 'unit_price' not in existing_columns:
        missing_columns.append('unit_price')
    if 'sale_price' not in existing_columns:
        missing_columns.append('sale_price')
    if 'tax_rate' not in existing_columns:
        missing_columns.append('tax_rate')
    if 'tax_amount' not in existing_columns:
        missing_columns.append('tax_amount')
    if 'total_amount' not in existing_columns:
        missing_columns.append('total_amount')
    if 'product_name' not in existing_columns:
        missing_columns.append('product_name')
    if 'specification' not in existing_columns:
        missing_columns.append('specification')
    if 'unit' not in existing_columns:
        missing_columns.append('unit')
    
    if len(missing_columns) == 0:
        print("✅ 所有字段已存在，无需迁移")
    else:
        print(f"\n⚠️ 发现缺失字段：{missing_columns}")
        
        # 添加缺失的字段
        if 'unit_price' in missing_columns:
            cursor.execute('ALTER TABLE sales_outbound_items ADD COLUMN unit_price DECIMAL(10,2)')
            print('✅ 添加 unit_price 字段')
        
        if 'sale_price' in missing_columns:
            cursor.execute('ALTER TABLE sales_outbound_items ADD COLUMN sale_price DECIMAL(10,2)')
            print('✅ 添加 sale_price 字段')
        
        if 'tax_rate' in missing_columns:
            cursor.execute('ALTER TABLE sales_outbound_items ADD COLUMN tax_rate DECIMAL(5,2)')
            print('✅ 添加 tax_rate 字段')
        
        if 'tax_amount' in missing_columns:
            cursor.execute('ALTER TABLE sales_outbound_items ADD COLUMN tax_amount DECIMAL(10,2)')
            print('✅ 添加 tax_amount 字段')
        
        if 'total_amount' in missing_columns:
            cursor.execute('ALTER TABLE sales_outbound_items ADD COLUMN total_amount DECIMAL(10,2)')
            print('✅ 添加 total_amount 字段')
        
        if 'product_name' in missing_columns:
            cursor.execute('ALTER TABLE sales_outbound_items ADD COLUMN product_name TEXT')
            print('✅ 添加 product_name 字段')
        
        if 'specification' in missing_columns:
            cursor.execute('ALTER TABLE sales_outbound_items ADD COLUMN specification TEXT')
            print('✅ 添加 specification 字段')
        
        if 'unit' in missing_columns:
            cursor.execute('ALTER TABLE sales_outbound_items ADD COLUMN unit TEXT')
            print('✅ 添加 unit 字段')
        
        conn.commit()
        print('✅ 表结构迁移完成！')
    
    # 检查 sales_outbound 表是否有 customer_id 字段
    print("\n📋 检查 sales_outbound 表...")
    cursor.execute("PRAGMA table_info(sales_outbound)")
    outbound_info = cursor.fetchall()
    outbound_columns = [col[1] for col in outbound_info]
    
    if 'customer_id' not in outbound_columns:
        cursor.execute('ALTER TABLE sales_outbound ADD COLUMN customer_id INTEGER')
        print('✅ 添加 customer_id 字段到 sales_outbound 表')
        conn.commit()
    else:
        print('✅ customer_id 字段已存在')
    
    print('\n✅ 所有迁移完成！')
    
    conn.close()
    
except Exception as e:
    print(f'❌ 迁移失败：{e}')
    import traceback
    traceback.print_exc()
