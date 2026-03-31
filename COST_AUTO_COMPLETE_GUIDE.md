# 成本自动结转增强功能 - 完整方案

## 📋 功能概述

本系统实现了**智能成本自动结转**功能，完全解决了以下问题：

1. ✅ **历史月份自动补全**：系统启动时自动补全所有历史月份的结算数据
2. ✅ **前期单据变更检测**：新增/修改历史日期单据时自动触发重新结算
3. ✅ **成本数据连续性保证**：确保每月成本数据正确结转，不会遗漏
4. ✅ **实时更新机制**：检测到前期单据变更时自动更新相关月份的结算数据

## 🎯 核心特性

### 1. 历史月份自动补全

**触发时机**：系统启动后 10 秒自动执行

**工作原理**：
1. 扫描所有库存单据（采购入库、销售出库、调拨单等）
2. 找出系统最早的单据日期
3. 从该月份开始，逐月结算到上月
4. 已结算的月份自动跳过

**示例**：
```
系统最早单据：2025 年 3 月
当前月份：2026 年 3 月

自动结算：
- 2025 年 3 月 → 结算
- 2025 年 4 月 → 结算
- ...
- 2026 年 2 月 → 结算
- 2026 年 3 月 → 不结算（当前月份）

结果：共结算 12 个月
```

### 2. 前期单据变更检测

**触发时机**：保存采购单、销售单、调拨单时

**工作原理**：
1. 检测单据日期是否在当前月份之前
2. 如果是历史单据，检查该月份之后是否有未锁定的结算
3. 如果有，自动从该月份开始重新结算到现在

**示例**：
```
场景：用户在 2026-03-31 新增了一张 2026-02-15 的调拨单

检测流程：
1. 单据日期：2026-02-15
2. 当前月份：2026 年 3 月
3. 检查 2026 年 2 月之后的结算状态
4. 发现 2 月、3 月已结算但未锁定
5. 自动解锁并重新结算 2 月和 3 月

结果：成本数据自动更新
```

### 3. 成本数据连续性保证

**实现方式**：
- 每月结算时，自动从上月结转期初数据
- 如果上月未结算，递归查找上上月
- 确保期初数据始终正确

**数据流**：
```
2025 年 3 月（期初：0）
  ↓ 期末结转
2025 年 4 月（期初 = 3 月期末）
  ↓ 期末结转
2025 年 5 月（期初 = 4 月期末）
  ↓ 期末结转
...
```

### 4. 实时更新机制

**自动触发场景**：
1. 新增历史日期单据
2. 修改历史日期单据
3. 删除历史日期单据（待实现）
4. 系统启动时自动检查

**通知机制**：
- 前端显示提示信息
- 后台自动执行重新结算
- 完成后显示结算结果

## 🔧 技术实现

### 后端模块（Electron）

#### 1. `electron/cost-settlement-service.ts`

**新增方法**：

```typescript
// 自动补全历史月份
autoCompleteHistory(): {
  success: boolean,
  message: string,
  settledMonths: number
}

// 检测并重新结算
checkAndRecalculateIfNeeded(
  productCode: string,
  warehouseId: number,
  documentDate: string
): {
  needsRecalculation: boolean,
  message?: string
}

// 从指定月份重新结算
recalculateFromMonth(
  year: number,
  month: number
): {
  success: boolean,
  message: string
}
```

#### 2. `electron/scheduled-task-service.ts`

**新增任务**：

```typescript
// 系统启动时自动补全历史月份
setTimeout(() => {
  this.autoCompleteHistory()
}, 10000) // 10 秒后

// 每天凌晨 2 点检查上月结算
const dailyCheckTimer = setInterval(() => {
  this.checkAndSettlePreviousMonth()
}, 24 * 60 * 60 * 1000)
```

#### 3. `electron/cost-settlement-handler.ts`

**新增 IPC 接口**：

```typescript
// 自动补全历史月份
'cost:auto-complete-history'

// 检测并重新结算
'cost:check-and-recalculate'
```

### 前端集成

#### 1. `src/utils/cost-database.ts`

**增强成本价获取逻辑**：

```typescript
export const getCostFromDatabase = async (
  productCode: string | number,
  warehouseId: number | string,
  targetDate: string
): Promise<number> => {
  // 1. 尝试从数据库获取已结算数据
  const dbCost = await getFromDatabase(...)
  if (dbCost > 0) return dbCost

  // 2. 尝试从 localStorage 获取（兼容旧数据）
  const localStorageCost = getFromLocalStorage(...)
  if (localStorageCost > 0) return localStorageCost

  // 3. 动态计算
  return getCostFromSettlement(...)
}
```

#### 2. `src/views/inventory/transfer.vue`

**自动检测并触发重算**：

```typescript
const checkAndRecalculateCost = async () => {
  for (const item of formData.items) {
    const result = await window.electron?.invoke?.(
      'cost:check-and-recalculate',
      {
        productCode: String(item.productId),
        warehouseId: Number(formData.fromWarehouseId),
        documentDate: formData.transferDate
      }
    )
    
    if (result && result.needsRecalculation) {
      ElMessage.info(result.message)
    }
  }
}
```

## 📊 数据库表结构

### `cost_settlements` 表

```sql
CREATE TABLE cost_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_code TEXT NOT NULL,
  product_name TEXT,
  warehouse_id INTEGER NOT NULL,
  warehouse_name TEXT,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  opening_qty REAL DEFAULT 0,
  opening_cost REAL DEFAULT 0,
  inbound_qty REAL DEFAULT 0,
  inbound_cost REAL DEFAULT 0,
  outbound_qty REAL DEFAULT 0,
  outbound_cost REAL DEFAULT 0,
  closing_qty REAL DEFAULT 0,
  closing_cost REAL DEFAULT 0,
  avg_cost REAL DEFAULT 0,
  is_locked INTEGER DEFAULT 0,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_code, warehouse_id, period_year, period_month)
)
```

**索引**：
- `idx_cost_settlements_period` (period_year, period_month)
- `idx_cost_settlements_product` (product_code, warehouse_id)
- `idx_cost_settlements_locked` (is_locked)

## 🎯 使用场景

### 场景 1：新系统初始化

**问题**：新系统从 2025 年 3 月开始使用，但没有做成本结算

**解决方案**：
1. 启动系统
2. 自动补全功能在 10 秒后触发
3. 从 2025 年 3 月结算到 2026 年 2 月
4. 显示通知："历史成本结算完成，共结算 12 个月"

**结果**：所有历史月份成本数据完整

### 场景 2：补录历史单据

**问题**：2026 年 3 月 31 日补录一张 2026 年 2 月 15 日的采购入库单

**解决方案**：
1. 保存采购单
2. 检测到单据日期是 2026-02-15
3. 自动检查 2 月之后的结算状态
4. 发现 2 月、3 月已结算但未锁定
5. 自动解锁并重新结算 2 月、3 月
6. 显示提示："检测到历史单据变更，已重新结算从 2026 年 2 月 开始的数据"

**结果**：成本数据自动更新，无需手动操作

### 场景 3：修改历史单据

**问题**：修改 2026 年 1 月的调拨单数量

**解决方案**：
1. 保存修改后的调拨单
2. 检测到单据日期是 2026-01-xx
3. 自动从 1 月开始重新结算到现在
4. 更新 1 月、2 月、3 月的成本数据

**结果**：成本数据连续性得到保证

### 场景 4：日常使用

**问题**：每天新增当月的调拨单

**解决方案**：
1. 保存调拨单
2. 检测到单据日期在当前月份
3. 不触发重新结算
4. 成本价从数据库获取已结算数据

**结果**：性能最优，无额外计算

## 🔍 调试和日志

### 控制台日志示例

```
[主进程] 启动定时任务服务...
[主进程] 定时任务已启动：每天凌晨 2 点检查成本结算
[主进程] 开始自动补全历史月份结算数据...
[主进程] 从 2025 年 3 月 到 2026 年 2 月
[主进程] 结算 2025 年 3 月 ...
[主进程]   ✓ 成功结算 15 条记录
[主进程] 结算 2025 年 4 月 ...
[主进程]   ✓ 成功结算 15 条记录
[主进程] ...
[主进程] 完成！结算 12 个月，跳过 0 个月
[主进程] 历史月份补全完成：完成！结算 12 个月，跳过 0 个月

[渲染进程] ✅ 从数据库获取成本价：25.50 期间：2026-2
```

### 前端调试

```javascript
// 查看成本结算数据
const settlements = JSON.parse(localStorage.getItem('cost_settlements') || '[]')
console.log('总结算数据:', settlements.length)

// 查看特定产品的结算记录
const product01 = settlements.filter(s => 
  s.productCode === '01' || String(s.productId) === '01'
)
console.log('再生稻记录数:', product01.length)
console.log('再生稻数据:', JSON.stringify(product01, null, 2))

// 手动触发自动补全
await window.electron?.invoke?.('cost:auto-complete-history')
```

## ✅ 测试步骤

### 测试 1：验证历史月份自动补全

1. 清空成本结算数据
2. 重启系统
3. 等待 10 秒
4. 查看控制台日志
5. 确认所有历史月份已结算

**预期结果**：
- 控制台显示"开始自动补全历史月份结算数据..."
- 逐月结算从最早月份到上月
- 显示完成通知

### 测试 2：验证前期单据变更检测

1. 新增一张历史日期的调拨单（如 2 月 15 日）
2. 保存单据
3. 查看是否显示提示信息
4. 检查 2 月和 3 月的成本数据是否更新

**预期结果**：
- 显示"检测到历史单据变更，正在重新结算成本..."
- 2 月和 3 月的成本数据自动更新

### 测试 3：验证成本价获取

1. 新增调拨单，选择 3 月 31 日
2. 选择再生稻
3. 查看成本价是否正确

**预期结果**：
- 成本价 = 2 月份结算的期末单位成本
- 控制台显示"✅ 从数据库获取成本价：25.50 期间：2026-2"

## 📝 注意事项

1. **首次启动时间较长**：如果历史月份较多，自动补全可能需要几分钟
2. **锁定机制**：已锁定的月份不会自动重新结算，需要手动解锁
3. **性能优化**：当前月份的新增单据不会触发重新结算
4. **数据备份**：建议定期备份数据库文件

## 🚀 下一步优化

1. **批量处理优化**：对于大量历史月份，采用分批处理
2. **进度显示**：前端显示自动补全的进度条
3. **反结算功能**：支持删除历史单据时自动反结算
4. **成本分析报表**：基于结算数据生成成本趋势分析
5. **成本预警**：成本价异常波动时发出预警

## 📖 相关文档

- [成本自动结转功能使用指南](./COST_SETTLEMENT_GUIDE.md)
- [成本自动结转功能测试步骤](./TEST_COST_SETTLEMENT.md)
