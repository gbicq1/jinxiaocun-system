# 进销存系统 - 数据库模式使用指南

## 📋 系统架构

### 当前模式：纯数据库模式
- ✅ 所有数据保存在 SQLite 数据库
- ✅ 通过 Electron IPC 进行数据库访问
- ✅ 支持调试日志输出
- ⚠️ 需要在 Electron 环境中运行

### 技术栈
- **前端**: Vue 3 + TypeScript + Element Plus
- **后端**: Electron + Node.js
- **数据库**: SQLite (better-sqlite3)
- **通信**: IPC (Inter-Process Communication)

## 🚀 启动方式

### 开发模式（推荐）

1. **启动 Vite 开发服务器**（可选，Electron 会自动连接）
```bash
npm run dev
```

2. **启动 Electron 应用**
```bash
npm run electron:dev
```

Electron 会自动：
- 编译 TypeScript 代码
- 连接到 Vite 开发服务器 (http://localhost:5173)
- 打开应用窗口
- 自动打开 DevTools

### 数据库位置
```
C:\Users\Administrator\AppData\Roaming\Electron\inventory.db
```

## 📊 数据库表结构

### 基础数据表
- `products` - 产品信息
- `warehouses` - 仓库信息
- `suppliers` - 供应商信息
- `customers` - 客户信息

### 业务单据表
- `purchase_inbound_records` - 采购入库单
- `sales_outbound_records` - 销售出库单
- `transfer_records` - 库存调拨单

### 库存和成本表
- `inventory_balance` - 库存余额表
- `cost_settlement_history` - 成本结算历史表

## 🔧 数据库服务使用

### 在前端组件中使用

```typescript
import { dbService } from '@/utils/db-service'

// 查询所有产品
const result = await dbService.getAll('products')
if (result.success) {
  console.log('产品列表:', result.data)
}

// 分页查询
const pageResult = await dbService.getPage('products', 1, 10)
if (result.success) {
  console.log('产品分页:', pageResult.data)
}

// 插入数据
const insertResult = await dbService.insert('products', {
  code: 'P001',
  name: '测试产品',
  category: '电子产品'
})

// 更新数据
const updateResult = await dbService.update(
  'products',
  { name: '新产品名称' },
  'id = ?',
  [1]
)

// 删除数据
const deleteResult = await dbService.delete(
  'products',
  'id = ?',
  [1]
)
```

### 使用专用的 IPC 接口

```typescript
// 获取产品列表（分页）
const products = await window.electron.productList(1, 10)

// 添加产品
const productId = await window.electron.productAdd({
  code: 'P001',
  name: '测试产品'
})

// 获取仓库列表
const warehouses = await window.electron.warehouseList()

// 获取采购入库单列表
const inbounds = await window.electron.inboundList(1, 10, 'voucher_date >= ?', ['2026-01-01'])
```

## 🐛 调试日志

### 使用调试日志工具

```typescript
import { createLogger } from '@/utils/debug-logger'

const logger = createLogger('采购入库')

// 输出日志
logger.info('保存采购入库单', { id: 1, code: 'CG001' })
logger.warn('库存不足', { product: 'P001', quantity: 10 })
logger.error('保存失败', error)
logger.debug('详细数据', { data: {...} })
```

### 查看日志

日志会输出到：
1. **Electron 主进程控制台** - 在启动 Electron 的终端窗口中
2. **渲染进程 DevTools** - 按 F12 打开开发者工具

### 日志格式
```
[21:45:30] [采购入库] [INFO] 保存采购入库单 { id: 1, code: 'CG001' }
[21:45:31] [采购入库] [ERROR] 保存失败 Database error
```

## 📝 开发指南

### 1. 添加新的数据库表

在 `electron/database.ts` 的 `createTables()` 方法中添加表结构：

```typescript
this.db.exec(`
  CREATE TABLE IF NOT EXISTS new_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)
```

### 2. 添加数据库操作方法

在 `electron/database.ts` 中添加方法：

```typescript
getNewTableList(page: number = 1, pageSize: number = 10): any {
  const offset = (page - 1) * pageSize
  const total = this.db!.prepare('SELECT COUNT(*) as count FROM new_table').get() as any
  const data = this.db!.prepare(`
    SELECT * FROM new_table ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(pageSize, offset)
  
  return {
    total: total.count,
    page,
    pageSize,
    data
  }
}
```

### 3. 添加 IPC 处理器

在 `electron/main.ts` 的 `setupIpcHandlers()` 中添加：

```typescript
ipcMain.handle('newtable-list', async (event, page, pageSize) => {
  return db.getNewTableList(page, pageSize)
})

ipcMain.handle('newtable-add', async (event, data: any) => {
  return db.addNewTable(data)
})
```

### 4. 添加 preload 接口

在 `electron/preload.js` 中添加：

```javascript
newTableList: (page, pageSize) => electron_1.ipcRenderer.invoke('newtable-list', page, pageSize),
newTableAdd: (data) => electron_1.ipcRenderer.invoke('newtable-add', data),
```

### 5. 在前端使用

```typescript
// 使用通用 dbService
const result = await dbService.getAll('new_table')

// 或使用专用 IPC
const data = await window.electron.newTableList(1, 10)
```

## 🔍 常见问题

### Q: 为什么控制台没有日志输出？

A: 检查以下几点：
1. 确保在 Electron 窗口中，而不是浏览器中
2. 检查终端窗口，Electron 的日志输出在启动它的终端中
3. 按 F12 打开 DevTools 查看渲染进程日志

### Q: 数据库在哪里？

A: Windows 系统默认位置：
```
C:\Users\Administrator\AppData\Roaming\Electron\inventory.db
```

### Q: 如何备份数据库？

A: 直接复制 `inventory.db` 文件即可

### Q: 如何查看数据库内容？

A: 使用 SQLite 客户端工具：
- DB Browser for SQLite (免费)
- SQLiteStudio (免费)
- DBeaver (免费)

### Q: 遇到 "localStorage is not defined" 错误？

A: 这是正常的，因为系统已改为纯数据库模式。如果还有代码使用 localStorage，需要改为使用 `dbService` 或 IPC 接口。

## 📦 构建发布（未来）

当系统测试完成后，可以构建为 EXE：

```bash
npm run electron:build
```

生成的文件会在 `dist/` 目录中。

## 🎯 下一步

1. ✅ 数据库服务已完成
2. ✅ IPC 接口已完成
3. ✅ 调试日志已完成
4. ⏳ 测试各个业务模块
5. ⏳ 修复发现的问题
6. ⏳ 完善功能
7. ⏳ 打包发布

## 📞 技术支持

遇到问题时：
1. 查看终端日志输出
2. 检查 DevTools 控制台
3. 查看数据库文件是否损坏
4. 重启 Electron 应用
