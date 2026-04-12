"""
检查实际使用的数据库文件
"""
import sqlite3
import os
from pathlib import Path

# 查找可能的数据库文件
possible_paths = [
    Path(__file__).parent / 'electron' / 'database.db',
    Path(__file__).parent / 'inventory.db',
]

# 在 Windows 上，Electron 的 userData 通常在 AppData 目录
if os.name == 'nt':
    appdata = Path(os.environ.get('APPDATA', ''))
    possible_paths.append(appdata / 'electron' / 'inventory.db')
    possible_paths.append(appdata / '进销存系统' / 'inventory.db')
    possible_paths.append(appdata / 'jiaoben' / '进销存系统' / 'inventory.db')

print("=" * 80)
print("查找数据库文件")
print("=" * 80)

for path in possible_paths:
    if path.exists():
        print(f"\n✓ 找到数据库文件：{path}")
        print(f"  大小：{path.stat().st_size} 字节")
        
        # 检查表
        conn = sqlite3.connect(str(path))
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = cursor.fetchall()
        print(f"  表数量：{len(tables)}")
        
        # 检查是否有成本结算表
        cost_tables = [t for t in tables if 'cost' in t[0].lower() or 'settlement' in t[0].lower()]
        if cost_tables:
            print(f"  成本相关表：{cost_tables}")
        else:
            print(f"  ⚠️  没有找到成本相关表")
        
        conn.close()
    else:
        print(f"\n✗ 不存在：{path}")

print("\n" + "=" * 80)
