# 前后端数据格式一致性修复记录

## 问题概述

系统存在多处前后端字段命名和数据格式不一致的问题，导致：
- 编辑单据时新增行无法保存
- 金额数据丢失
- 商品信息不完整

## 根本原因

1. **后端 get*List 返回的 items 缺少字段** - 如 remark 字段
2. **前端 addItem 新增行的字段不完整**
3. **更新逻辑未正确处理 items 数据** - 只更新主表未更新明细表

## 已修复模块

### 1. 销售出库单 (sales_outbound) ✅

**前端修复** (`src/views/sales/outbound.vue`):
- 第 762-776 行：`addItem` 添加 `remark` 字段
- 第 1018-1077 行：统一新增和更新的数据结构，使用 `outboundUpdate` 方法处理编辑

**后端修复** (`electron/database.js`):
- 第 1052-1069 行：`getOutboundList` 添加 `remark` 字段返回

### 2. 采购入库单 (purchase_inbound) ✅

**前端修复** (`src/views/inventory/inbound.vue`):
- 第 809-826 行：`addItem` 添加 `remark` 字段

**后端修复** (`electron/database.js`):
- 第 885-904 行：`getInboundList` 添加 `remark` 字段返回

## 已修复模块

### 3. 采购退货 (purchase_return) ✅

**前端修复** (`src/views/purchase/returns.vue`):
- 第 1504-1526 行：`addItem` 添加 `remark` 字段

### 4. 销售退货 (sales_return) ✅

**前端修复** (`src/views/sales/returns.vue`):
- 第 1080-1092 行：`addItem` 添加 `remark` 字段

## 待修复模块

- [ ] 库存调拨 (inventory_transfer)
- [ ] 应收单据 (finance_receipt)
- [ ] 应付单据 (finance_payment)

## 标准字段对照表

### 采购入库明细 (purchase_inbound_items)
| 数据库字段 | 前端字段 | 说明 |
|-----------|---------|------|
| id | id | 主键 |
| inbound_id | inboundId | 入库单 ID |
| product_id | productId | 产品 ID |
| product_name | productName | 产品名称 |
| specification | specification | 规格 |
| unit | unit | 单位 |
| quantity | quantity | 数量 |
| unit_price | unitPrice | 含税单价 |
| unit_price_ex | unitPriceEx | 不含税单价 |
| tax_rate | taxRate | 税率 |
| tax_amount | taxAmount | 税额 |
| total_amount | totalAmount | 含税总额 |
| total_amount_ex | totalAmountEx | 不含税总额 |
| allow_deduction | allowDeduction | 允许折让 |
| deduction_amount | deductionAmount | 折让金额 |
| remark | remark | 备注 |

### 销售出库明细 (sales_outbound_items)
同上，只是主表关联字段为 `outbound_id` / `outboundId`

## 修复标准

1. **后端 get*List 方法**：items 必须包含完整字段
2. **前端 addItem 函数**：新增行必须包含完整字段
3. **前端保存逻辑**：新增和更新使用统一的数据结构
