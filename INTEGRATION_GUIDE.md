# 成本自动检测集成指南

## 📋 概述

本指南说明如何在所有影响库存的单据中集成成本自动检测和重新结算功能。

## ✅ 已完成集成的单据

1. ✅ **采购入库单** (`src/views/purchase/inbound.vue`)
2. ✅ **采购退货单** (`src/views/purchase/returns.vue`)
3. ✅ **库存调拨单** (`src/views/inventory/transfer.vue`)

## 📝 待集成单据清单

### 销售模块

#### 1. 销售退货单 (`src/views/sales/returns.vue`)

**修改位置 1**：添加导入语句
```typescript
import { handleDocumentSave, DocumentType } from '@/utils/cost-recalculation'
```

**修改位置 2**：在保存函数中调用
```typescript
await handleDocumentSave(
  DocumentType.SALES_RETURN,
  formData.items,
  formData.voucherDate
)
```

### 库存模块

#### 2. 其他入库单 (`src/views/inventory/inbound.vue`)

**修改位置 1**：添加导入语句
```typescript
import { handleDocumentSave, DocumentType } from '@/utils/cost-recalculation'
```

**修改位置 2**：在保存函数中调用
```typescript
await handleDocumentSave(
  DocumentType.INVENTORY_INBOUND,
  formData.items,
  formData.voucherDate
)
```

#### 3. 其他出库单 (`src/views/inventory/outbound.vue`)

**修改位置 1**：添加导入语句
```typescript
import { handleDocumentSave, DocumentType } from '@/utils/cost-recalculation'
```

**修改位置 2**：在保存函数中调用
```typescript
await handleDocumentSave(
  DocumentType.INVENTORY_OUTBOUND,
  formData.items,
  formData.voucherDate
)
```

## 🔧 集成步骤

### 步骤 1：添加导入语句

在每个单据文件的 `script setup` 部分添加：

```typescript
import { handleDocumentSave, DocumentType } from '@/utils/cost-recalculation'
```

### 步骤 2：找到保存函数

在每个单据中找到 `handleSubmit` 或类似的保存函数。

### 步骤 3：调用检测函数

在保存成功后（`localStorage.setItem` 之后），添加：

```typescript
// 检测是否需要重新结算成本
await handleDocumentSave(
  DocumentType.单据类型，
  formData.items,
  formData.日期字段
)
```

### 步骤 4：选择正确的单据类型

根据单据类型选择对应的枚举值：

- 采购入库：`DocumentType.PURCHASE_INBOUND`
- 采购退货：`DocumentType.PURCHASE_RETURN`
- 销售出库：`DocumentType.SALES_OUTBOUND`
- 销售退货：`DocumentType.SALES_RETURN`
- 其他入库：`DocumentType.INVENTORY_INBOUND`
- 其他出库：`DocumentType.INVENTORY_OUTBOUND`
- 库存调拨：`DocumentType.INVENTORY_TRANSFER`
- 库存盘点：`DocumentType.INVENTORY_COUNT`
- 其他出入库：`DocumentType.INVENTORY_OTHER`

### 步骤 5：选择正确的日期字段

根据单据的日期字段名称选择：

- `voucherDate` - 凭证日期（采购/销售单据）
- `transferDate` - 调拨日期
- `countDate` - 盘点日期
- `adjustmentDate` - 调整日期

##  单据类型和日期字段对照表

| 单据文件 | 单据类型 | 日期字段 |
|---------|---------|---------|
| purchase/inbound.vue | PURCHASE_INBOUND | voucherDate |
| purchase/returns.vue | PURCHASE_RETURN | voucherDate |
| sales/outbound.vue | SALES_OUTBOUND | voucherDate |
| sales/returns.vue | SALES_RETURN | voucherDate |
| inventory/transfer.vue | INVENTORY_TRANSFER | transferDate |
| inventory/inbound.vue | INVENTORY_INBOUND | voucherDate |
| inventory/outbound.vue | INVENTORY_OUTBOUND | voucherDate |

## 🎯 集成示例

### 完整示例：销售出库单

**1. 添加导入**：
```typescript
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { handleDocumentSave, DocumentType } from '@/utils/cost-recalculation'

// ... 其他代码
</script>
```

**2. 修改保存函数**：
```typescript
const handleSubmit = async () => {
  try {
    // ... 验证逻辑
    
    // 保存数据
    localStorage.setItem('salesOutbounds', JSON.stringify(allRecords))
    ElMessage.success('保存成功')
    
    // 检测是否需要重新结算成本
    await handleDocumentSave(
      DocumentType.SALES_OUTBOUND,
      formData.items,
      formData.voucherDate
    )
    
    dialogVisible.value = false
    loadList()
  } catch (error) {
    console.error(error)
  }
}
```

## ✅ 集成检查清单

完成每个单据的集成后，请检查：

- [ ] 已添加导入语句
- [ ] 已选择正确的单据类型
- [ ] 已选择正确的日期字段
- [ ] 调用位置在保存成功之后
- [ ] 使用 `await` 调用
- [ ] 测试保存时显示成本重新结算提示

## 🧪 测试步骤

### 测试 1：采购入库单

1. 新增采购入库单，选择历史日期（如 2026-02-15）
2. 保存单据
3. 检查是否显示"检测到历史单据变更，正在重新结算成本..."
4. 查看控制台日志确认重新结算

### 测试 2：销售出库单

1. 新增销售出库单，选择历史日期
2. 保存单据
3. 检查成本是否重新结算

### 测试 3：当月单据

1. 新增当月日期的单据
2. 保存单据
3. 确认**不触发**重新结算（性能优化）

## 📖 相关文档

- [成本自动结转增强功能完整方案](./COST_AUTO_COMPLETE_GUIDE.md)
- [成本自动结转功能使用指南](./COST_SETTLEMENT_GUIDE.md)
- [成本自动结转功能测试步骤](./TEST_COST_SETTLEMENT.md)

## 🛠️ 工具函数说明

### `handleDocumentSave`

```typescript
export const handleDocumentSave = async (
  documentType: DocumentType,
  items: DocumentItem[],
  defaultDate?: string,
  showMessage: boolean = true
): Promise<{ needsRecalculation: boolean; message?: string }>
```

**参数**：
- `documentType`: 单据类型枚举
- `items`: 单据明细（包含产品和仓库信息）
- `defaultDate`: 单据日期
- `showMessage`: 是否显示提示（默认 true）

**返回值**：
- `needsRecalculation`: 是否需要重新结算
- `message`: 提示信息

### `checkAndRecalculateCost`

```typescript
export const checkAndRecalculateCost = async (
  documentType: DocumentType,
  items: DocumentItem[],
  defaultDate?: string
): Promise<{ needsRecalculation: boolean; message?: string }>
```

**说明**：底层检测函数，`handleDocumentSave` 内部调用此函数。

## 🚨 注意事项

1. **性能考虑**：
   - 当月单据不触发重新结算
   - 只有历史单据（当前月份之前）才触发
   - 已锁定月份不自动重新结算

2. **用户体验**：
   - 显示友好的提示信息
   - 后台自动执行，不阻塞操作
   - 支持批量单据保存

3. **数据一致性**：
   - 保存成功后才触发检测
   - 如果保存失败，不触发检测
   - 支持事务性操作

## 📞 技术支持

如有问题，请查看：
- 浏览器控制台日志
- Electron 主进程日志
- 成本结算数据库状态
