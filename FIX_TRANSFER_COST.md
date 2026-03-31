# 调拨单成本价不一致问题修复

## 问题描述

库存调拨单在添加产品时自动获取的成本价与成本结算模块显示的加权平均单价不一致。

### 问题表现

- **调拨单获取的成本价**：¥20.54
- **成本结算模块显示的加权平均单价**：¥22.15
- **差异**：¥1.61

## 根本原因

在 `src/utils/cost.ts` 的 `getCostFromSettlement()` 函数中，存在以下逻辑问题：

```typescript
// 原有逻辑（有问题）
if (matchingSettlement) {
  const periodEnd = new Date(matchingSettlement.periodRange[1])
  const transferDateObj = new Date(transferDate)
  
  // 问题：当调拨日期是期间结束日期时，不使用已结算的 avgPrice
  if (transferDateObj.getTime() < periodEnd.getTime()) {
    // 调拨日期在期间中间，使用本月合计的加权平均单价
    if (matchingSettlement.avgPrice != null) {
      return matchingSettlement.avgPrice
    }
  } else {
    // 调拨日期是期间结束日期，需要计算当天的实时成本价
    // 回退到动态计算逻辑，导致成本价不一致
  }
}
```

### 问题场景

- 调拨日期：2026-03-31
- 成本结算期间：2026-03-01 至 2026-03-31
- 调拨日期 **正好是** 期间结束日期

原有逻辑会认为"调拨日期是期间结束日期，需要计算当天的实时成本价"，从而回退到动态计算逻辑，而不是使用已结算的 `avgPrice`。

## 解决方案

### 修复逻辑

**核心思想**：无论调拨日期是否在期间结束日期，都优先使用成本结算模块已计算的 `avgPrice`。

```typescript
// 修复后的逻辑（正确）
if (matchingSettlement) {
  // 关键修复：无论调拨日期是否在期间结束日期，都优先使用已结算的 avgPrice
  // 因为成本结算模块已经计算了整个月的加权平均成本
  if (matchingSettlement.avgPrice != null) {
    const result = Number(matchingSettlement.avgPrice.toFixed(2))
    console.log('✅ 找到已结算数据，使用本月合计加权平均单价:', result)
    return result
  }
  
  // 如果 avgPrice 为空，但有关闭成本和数量，手动计算
  if (matchingSettlement.closingQty != null && matchingSettlement.closingCost != null) {
    const closingQty = Number(matchingSettlement.closingQty || 0)
    const closingCost = Number(matchingSettlement.closingCost || 0)
    if (closingQty > 0) {
      const result = Number((closingCost / closingQty).toFixed(2))
      console.log('✅ 从期末结存计算成本价:', result)
      return result
    }
  }
}

// 只有没有找到已结算数据时，才动态计算
return calculateCostBeforeDate(productId, warehouseId, transferDate)
```

### 修复文件

- `src/utils/cost.ts` - `getCostFromSettlement()` 函数（约 303-340 行）

## 修复效果

### 修复前

```
调拨日期：2026-03-31
成本结算期间：2026-03-01 至 2026-03-31
调拨单获取的成本价：¥20.54（动态计算）
成本结算模块显示：¥22.15（已结算）
差异：¥1.61 ❌
```

### 修复后

```
调拨日期：2026-03-31
成本结算期间：2026-03-01 至 2026-03-31
调拨单获取的成本价：¥22.15（使用已结算数据）✅
成本结算模块显示：¥22.15（已结算）✅
差异：¥0.00 ✅
```

## 成本价获取优先级

修复后的成本价获取逻辑遵循以下优先级：

### 第一优先级：已结算的 avgPrice
```typescript
if (matchingSettlement.avgPrice != null) {
  return matchingSettlement.avgPrice  // 直接使用
}
```

### 第二优先级：从期末结存计算
```typescript
if (matchingSettlement.closingQty != null && matchingSettlement.closingCost != null) {
  return closingCost / closingQty  // 手动计算
}
```

### 第三优先级：动态计算（兜底方案）
```typescript
return calculateCostBeforeDate(productId, warehouseId, transferDate)
```

## 测试验证

### 测试场景 1：期间中间日期

```
调拨日期：2026-03-15
成本结算期间：2026-03-01 至 2026-03-31
预期：使用已结算的 avgPrice
结果：✅ 通过
```

### 测试场景 2：期间结束日期

```
调拨日期：2026-03-31
成本结算期间：2026-03-01 至 2026-03-31
预期：使用已结算的 avgPrice
结果：✅ 通过（修复前失败）
```

### 测试场景 3：未结算期间

```
调拨日期：2026-04-15
成本结算期间：无
预期：动态计算 2026-04-01 至 2026-04-15 的成本
结果：✅ 通过
```

## 调试日志

修复后，在浏览器控制台可以看到详细的调试信息：

```javascript
========== getCostFromSettlement 调试 ==========
输入参数：{ productId: 1, warehouseId: 1, transferDate: '2026-03-31' }
所有结算数据数量：15
✅ 找到匹配的结算数据：{ ... }
有效结算数据数量：1
最新结算数据：{ ... }
✅ 找到已结算数据，使用本月合计加权平均单价：22.15
结算数据详情：{
  periodRange: ['2026-03-01', '2026-03-31'],
  avgPrice: 22.15,
  closingQty: 10,
  closingCost: 221.538
}
```

## 注意事项

### 1. 成本结算必须先执行

调拨单要获取正确的成本价，前提是成本结算模块已经对该期间进行了结算。

**建议流程**：
1. 月末先进行成本结算
2. 然后再创建调拨单

### 2. 反结算后的影响

如果进行了反结算操作，已结算数据会被删除，调拨单将回退到动态计算逻辑。

**建议**：
- 反结算后，重新创建调拨单
- 或者重新进行成本结算

### 3. 跨期间调拨

如果调拨日期跨越多个已结算期间，系统会使用最新的已结算数据。

```
调拨日期：2026-03-31
已结算期间：
  - 2026-01-01 至 2026-01-31
  - 2026-02-01 至 2026-02-28
  - 2026-03-01 至 2026-03-31  ← 使用这个
```

## 相关文件

- `src/utils/cost.ts` - 成本计算工具（已修复）
- `src/views/inventory/transfer.vue` - 库存调拨单（使用 `getCostFromSettlement`）
- `src/views/finance/cost-settlement.vue` - 成本结算模块

## 总结

本次修复确保了调拨单获取的成本价始终与成本结算模块保持一致：

✅ **修复前**：调拨日期是期间结束日期时，使用动态计算，成本价不一致  
✅ **修复后**：无论调拨日期如何，都优先使用已结算的 `avgPrice`，成本价一致  

修复后，调拨单、出库单等所有使用 `getCostFromSettlement()` 的地方，都将获取到与成本结算模块一致的成本价。
