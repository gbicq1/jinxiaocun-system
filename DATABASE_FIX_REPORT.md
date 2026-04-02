# 进销存系统数据库迁移修复报告

## 📋 问题概述

由于系统从 localStorage 迁移到 SQLite 数据库，导致多个模块代码运行异常。本次全面审查发现以下关键问题：

---

## 🔴 严重问题（已修复）

### 1. 数据库表名不一致
**问题**: `sales_outbound_records` vs `sales_outbound`

**影响范围**:
- 销售出库模块无法查询、新增、更新、删除数据
- 数据库索引创建在错误的表名上

**修复内容**:
- ✅ 修复 `electron/database.ts` 中所有 `sales_outbound_records` 引用
- ✅ 更新索引创建语句使用正确的表名
- ✅ 修复字段名：`voucher_date` → `outbound_date`

**修复文件**:
- `electron/database.ts` (Line 458-468, 704-731)

---

### 2. 数据库表结构缺失字段
**问题**: `sales_outbound` 表缺少必要字段

**缺失字段**:
- `customer_id` - 客户 ID
- `handler_name` - 经办人姓名

**修复方案**:
- ✅ 创建数据库修复脚本 `scripts/fix-database-schema.js`
- ✅ 添加缺失字段到各个表
- ✅ 创建缺失的表（sales_returns, purchase_returns, employees, inventory_details）

**执行方式**:
```bash
npm run fix-db-schema
```

---

### 3. 销售出库模块重复函数定义
**问题**: `sales/outbound.vue` 中存在重复的加载函数

**重复函数**:
- `loadProducts()` - 2 个定义（一个用数据库，一个用 localStorage）
- `loadCustomers()` - 2 个定义
- `loadWarehouses()` - 2 个定义
- `loadEmployees()` - 2 个定义

**修复内容**:
- ✅ 删除所有使用 localStorage 的旧版本
- ✅ 保留使用数据库的新版本
- ✅ 移除无关的 localStorage 代码（price_list 等）

**修复文件**:
- `src/views/sales/outbound.vue` (Line 543-643)

---

## 🟡 中等问题（需要进一步优化）

### 4. 其他模块仍使用 localStorage
**影响模块**:
- `inventory/inbound.vue` - 采购入库
- `inventory/outbound.vue` - 库存出库
- `sales/returns.vue` - 销售退货
- `purchase/returns.vue` - 采购退货
- `finance/cost-settlement.vue` - 成本结算
- `finance/payment.vue` - 付款
- `finance/receipt.vue` - 收款
- `inventory/stock.vue` - 库存管理

**修复策略**:
1. 优先级：核心业务模块 > 财务模块 > 辅助功能
2. 使用统一的数据库访问工具 `src/utils/db.ts`
3. 保留部分配置型 localStorage（如默认仓库 ID、默认经办人 ID）

---

### 5. 数据库字段映射问题
**问题**: 前端使用驼峰命名，数据库使用下划线命名

**已处理**:
- ✅ 在 `src/utils/db.ts` 中添加字段映射表
- ✅ 自动转换字段名（如 `voucherNo` → `voucher_no`）

**需要注意的字段**:
```typescript
const fieldMappings = {
  voucherNo: 'inbound_no',
  voucherDate: 'inbound_date',
  warehouseId: 'warehouse_id',
  totalAmount: 'total_amount',
  // ... 更多映射
}
```

---

## 🟢 轻微问题（可延后处理）

### 6. 配置型数据仍可使用 localStorage
**建议保留的 localStorage 数据**:
- `defaultHandlerId` - 默认经办人 ID
- `defaultWarehouseId` - 默认仓库 ID
- `currentUser` - 当前登录用户
- `companyName` - 公司名称
- `barcode_scanner_settings` - 扫码枪设置
- `recycle_bin` - 回收站（临时数据）

**理由**: 这些是用户偏好设置，适合使用 localStorage

---

## 📊 修复进度

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据库表结构 | ✅ 已修复 | 修复表名不一致，添加缺失字段 |
| 销售出库模块 | ✅ 已修复 | 删除重复函数，统一使用数据库 |
| 采购入库模块 | ⚠️ 待修复 | 仍使用 localStorage |
| 销售退货模块 | ⚠️ 待修复 | 仍使用 localStorage |
| 采购退货模块 | ⚠️ 待修复 | 仍使用 localStorage |
| 财务模块 | ⚠️ 待修复 | 仍使用 localStorage |
| 库存管理模块 | ⚠️ 待修复 | 仍使用 localStorage |

---

## 🚀 下一步行动

### 立即执行
1. ✅ 运行数据库修复脚本
2. ✅ 重启 Electron 应用
3. ✅ 测试销售出库功能

### 后续优化
1. 逐步迁移其他模块到数据库
2. 添加数据库迁移工具（从 localStorage 导入数据）
3. 完善错误处理和日志记录
4. 添加数据库备份和恢复功能

---

## 📝 测试清单

### 销售出库模块测试
- [ ] 新增出库单（包含所有必填字段）
- [ ] 编辑出库单
- [ ] 删除出库单
- [ ] 查看出库单
- [ ] 打印出库单
- [ ] 客户列表加载
- [ ] 仓库列表加载
- [ ] 产品列表加载
- [ ] 员工列表加载
- [ ] 库存检查功能

### 数据库完整性测试
- [ ] 重启应用后数据不丢失
- [ ] 多次新增/删除操作正常
- [ ] 数据查询性能良好

---

## 🔧 技术细节

### 数据库访问方式
```typescript
// 方式 1: 使用 Electron IPC（推荐）
if (window.electron && window.electron.dbQuery) {
  const result = await window.electron.dbQuery('SELECT * FROM sales_outbound')
}

// 方式 2: 使用统一工具
import { dbQuery } from '@/utils/db'
const result = await dbQuery('SELECT * FROM sales_outbound')
```

### 数据库表结构
```sql
CREATE TABLE sales_outbound (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outbound_no VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER,
  warehouse_id INTEGER,
  outbound_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'completed',
  remark TEXT,
  handler_name VARCHAR(100),
  created_by VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## 📞 问题反馈

如果在测试过程中发现任何问题，请提供以下信息：
1. 操作步骤
2. 错误提示（截图或文字）
3. 控制台日志
4. 数据库文件位置

---

**修复时间**: 2026-04-01
**修复版本**: v1.2.0
**修复状态**: 核心问题已修复，其他模块待优化
