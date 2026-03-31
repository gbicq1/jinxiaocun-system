# 月度成本自动结转功能 - 使用指南

## 📋 功能概述

本系统实现了**月度成本自动结转**功能，采用数据库存储方式，确保成本价的准确性和一致性。

### 核心特性

1. **自动月度结转**：每天凌晨 2 点自动检查并结算上月成本
2. **历史单据检测**：新增/修改历史日期单据时自动触发重算
3. **数据库优先**：成本价优先从数据库读取已结算数据
4. **动态计算后备**：如果数据库没有数据，使用动态计算作为后备

## 🏗️ 系统架构

### 数据库表结构

```sql
cost_settlements 表：
- product_code: 产品编码
- warehouse_id: 仓库 ID
- period_year: 年度
- period_month: 月份
- opening_qty/cost: 期初数量/成本
- inbound_qty/cost: 本期入库数量/成本
- outbound_qty/cost: 本期出库数量/成本
- closing_qty/cost: 期末数量/成本
- avg_cost: 加权平均单价
- is_locked: 是否已锁定（已结算）
```

### 文件结构

```
electron/
  ├── database-cost.ts              # 成本结算数据库模块
  ├── cost-settlement-service.ts    # 月度成本结转服务
  ├── cost-settlement-handler.ts    # IPC 处理器
  ├── scheduled-task-service.ts     # 定时任务服务
  └── main.ts                       # 主进程（集成以上模块）

src/utils/
  └── cost-database.ts              # 前端成本价获取工具

src/views/inventory/
  └── transfer.vue                  # 调拨单（使用新的成本价获取逻辑）
```

## 🚀 使用方法

### 1. 自动结转（推荐）

系统会在**每天凌晨 2 点**自动检查并结算上月成本：

- 如果上月已结算：跳过
- 如果上月未结算：自动执行结算并锁定

**通知方式**：
- 系统托盘通知
- 前端弹窗提示

### 2. 手动结算

在成本结算模块，点击"开始计算"按钮手动结算指定期间：

```
1. 选择会计期间（开始日期至结束日期）
2. 点击"开始计算"
3. 系统自动计算并保存
4. 数据自动锁定（is_locked = 1）
```

### 3. 历史单据处理

当新增或修改单据时：

```typescript
// 系统自动检测单据日期
if (billDate < currentMonth) {
  // 单据日期在当前月份之前
  // 自动触发从该月到当前月的重新结算
  await ipcRenderer.invoke('cost:check-bill-date-and-recalculate', { billDate })
}
```

**示例**：
- 当前月份：2026-03
- 新增单据日期：2026-02-15
- 触发操作：重新结算 2026-02 和 2026-03

## 💡 成本价获取逻辑

### 优先级顺序

```
1. 数据库已结算数据（is_locked = 1）
   ↓ （如果没有）
2. 数据库上月期末数据
   ↓ （如果没有）
3. localStorage 动态计算
```

### 代码示例

```typescript
import { getCostPrice } from '@/utils/cost-database'

// 获取成本价
const costPrice = await getCostPrice(
  productCode,    // 产品编码
  warehouseId,    // 仓库 ID
  targetDate      // 目标日期
)

console.log('成本价:', costPrice)
```

### IPC 调用示例

```typescript
// 获取已锁定的结算数据
const settled = await (window as any).electron?.invoke?.(
  'cost:get-locked-settlement',
  {
    productCode: '01',
    warehouseId: 1,
    year: 2026,
    month: 2
  }
)

if (settled && settled.closing_qty > 0) {
  const unitCost = settled.closing_cost / settled.closing_qty
  console.log('单位成本:', unitCost)
}
```

## 📊 测试场景

### 场景 1：新增调拨单（当月）

```
调拨日期：2026-03-31
产品：01 - 再生稻
仓库：农服

预期结果：
- 如果 3 月已结算：使用结算数据（avg_cost）
- 如果 3 月未结算：动态计算
```

### 场景 2：新增调拨单（历史月份）

```
调拨日期：2026-02-15
产品：01 - 再生稻
仓库：农服

预期结果：
- 如果 2 月已结算：使用结算数据
- 如果 2 月未结算：动态计算
- 自动触发 2 月和 3 月的重新结算
```

### 场景 3：修改历史单据

```
原单据日期：2026-03-15
修改为：2026-02-20

预期结果：
- 检测到日期变化
- 触发从 2 月开始的重新结算
- 解锁 2 月和 3 月
- 重新计算并锁定
```

## 🔧 配置选项

### 定时任务配置

在 `electron/scheduled-task-service.ts` 中修改：

```typescript
// 每天凌晨 2 点执行
const dailyCheckTimer = setInterval(() => {
  this.checkAndSettlePreviousMonth()
}, 24 * 60 * 60 * 1000)

// 修改为每天凌晨 3 点
// }, 24 * 60 * 60 * 1000 + 3600 * 1000)
```

### 自动锁定配置

```typescript
// 结算时自动锁定
settleMonth(year, month, lock = true)

// 如果不自动锁定
settleMonth(2026, 2, false)
```

## 📝 注意事项

1. **首次使用**：建议先执行"初始化成本数据"，建立基础数据
2. **反结算**：如果修改历史数据，系统会自动解锁并重新结算
3. **性能优化**：数据库查询有索引优化，大量数据也能快速响应
4. **数据备份**：定期备份数据库文件（inventory.db）

## 🐛 故障排查

### 问题 1：成本价显示为 0

**原因**：
- 数据库没有结算数据
- 动态计算也没有找到业务记录

**解决方法**：
1. 检查是否有出入库单据
2. 手动执行成本结算
3. 查看浏览器控制台日志

### 问题 2：自动结算未执行

**原因**：
- 定时任务未启动
- 系统未运行到凌晨 2 点

**解决方法**：
1. 检查 electron 主进程日志
2. 手动触发结算
3. 等待第二天检查

### 问题 3：历史单据未触发重算

**原因**：
- IPC 调用失败
- 日期检测逻辑错误

**解决方法**：
1. 检查浏览器控制台错误
2. 查看 electron 主进程日志
3. 确认单据日期格式正确（YYYY-MM-DD）

## 📖 API 参考

### IPC Handlers

```typescript
// 结算指定月份
'cost:settle-month' => { success: boolean; count: number }

// 重新结算从指定月份到现在
'cost:recalculate-from' => { success: boolean; message: string }

// 获取结算数据
'cost:get-settlement' => SettlementData

// 获取已锁定的结算数据
'cost:get-locked-settlement' => SettlementData

// 检查是否已结算
'cost:is-settled' => boolean

// 检测单据日期并触发重算
'cost:check-bill-date-and-recalculate' => { needRecalculate: boolean; message: string }
```

### 前端函数

```typescript
// 从数据库获取成本价
getCostFromDatabase(productCode, warehouseId, targetDate): Promise<number>

// 从 localStorage 动态计算
getCostFromSettlement(productId, warehouseId, transferDate): number

// 统一接口（优先数据库）
getCostPrice(productCode, warehouseId, targetDate): Promise<number>
```

## ✅ 完成清单

- [x] 数据库表结构创建
- [x] 月度成本结转服务
- [x] IPC 处理器
- [x] 定时任务服务
- [x] 前端成本价获取逻辑
- [x] 调拨单集成
- [ ] 采购单集成
- [ ] 销售单集成
- [ ] 其他单据集成

## 🎯 下一步计划

1. **集成到其他单据**：采购入库、销售出库等
2. **成本分析报表**：基于数据库数据生成报表
3. **成本预警**：成本价异常波动提醒
4. **多仓库调拨**：优化调拨单成本处理逻辑
