# 实时库存查询模块 - 采购退货和销售退货修复说明

## 问题描述

在实时库存查询模块的明细功能中，采购退货和销售退货的计算逻辑存在问题：

### 1. 采购退货问题
- **问题**：采购退货只有数量，没有单价和金额
- **需求**：应该提取原入库单的单价（含税）和金额进行显示

### 2. 销售退货问题  
- **问题**：销售退货在出库数据中显示了金额
- **需求**：销售退货应该像采购退货那样，数量以负数表示，只显示单价，不显示金额

## 修复方案

### 一、数据库层面修复

#### 1. 扩展 `purchase_return_items` 表结构

**新增字段：**
- `product_name VARCHAR(200)` - 产品名称
- `specification VARCHAR(200)` - 规格
- `unit VARCHAR(50)` - 单位
- `unit_price DECIMAL(14,4)` - 单价（含税）
- `unit_price_ex DECIMAL(14,4)` - 单价（不含税）
- `tax_rate VARCHAR(20)` - 税率
- `tax_amount DECIMAL(14,2)` - 税额
- `total_amount DECIMAL(14,2)` - 金额

**SQL 语句：**
```sql
ALTER TABLE purchase_return_items ADD COLUMN product_name VARCHAR(200);
ALTER TABLE purchase_return_items ADD COLUMN specification VARCHAR(200);
ALTER TABLE purchase_return_items ADD COLUMN unit VARCHAR(50);
ALTER TABLE purchase_return_items ADD COLUMN unit_price DECIMAL(14,4);
ALTER TABLE purchase_return_items ADD COLUMN unit_price_ex DECIMAL(14,4);
ALTER TABLE purchase_return_items ADD COLUMN tax_rate VARCHAR(20);
ALTER TABLE purchase_return_items ADD COLUMN tax_amount DECIMAL(14,2);
ALTER TABLE purchase_return_items ADD COLUMN total_amount DECIMAL(14,2);
```

**位置：** `electron/database.ts` - `createTables()` 和 `migrateDatabase()` 方法

#### 2. 数据库迁移代码

在 `migrateDatabase()` 方法中添加自动迁移逻辑，检查并添加缺失字段：

```typescript
// 检查 purchase_return_items 表是否有单价和金额字段
const prNewCols = [
  { name: 'product_name', sql: 'ALTER TABLE purchase_return_items ADD COLUMN product_name VARCHAR(200)' },
  { name: 'specification', sql: 'ALTER TABLE purchase_return_items ADD COLUMN specification VARCHAR(200)' },
  { name: 'unit', sql: 'ALTER TABLE purchase_return_items ADD COLUMN unit VARCHAR(50)' },
  { name: 'unit_price', sql: 'ALTER TABLE purchase_return_items ADD COLUMN unit_price DECIMAL(14,4)' },
  { name: 'unit_price_ex', sql: 'ALTER TABLE purchase_return_items ADD COLUMN unit_price_ex DECIMAL(14,4)' },
  { name: 'tax_rate', sql: 'ALTER TABLE purchase_return_items ADD COLUMN tax_rate VARCHAR(20)' },
  { name: 'tax_amount', sql: 'ALTER TABLE purchase_return_items ADD COLUMN tax_amount DECIMAL(14,2)' },
  { name: 'total_amount', sql: 'ALTER TABLE purchase_return_items ADD COLUMN total_amount DECIMAL(14,2)' },
];
for (const col of prNewCols) {
  if (!prColumns.some(c => c.name === col.name)) {
    console.log(`添加 purchase_return_items.${col.name} 字段`);
    this.db!.exec(col.sql);
  }
}
```

### 二、后端逻辑修复

#### 1. 修改 `addPurchaseReturn` 方法

**位置：** `electron/database.ts` - `addPurchaseReturn()` 方法

**修改内容：** 保存采购退货单时，同时保存单价和金额字段：

```typescript
const itemData = {
  return_id: id,
  product_id: item.product_id,
  product_name: item.product_name || '',
  specification: item.specification || '',
  unit: item.unit || '',
  quantity: item.quantity,
  unit_price: item.unit_price || item.cost_price || 0,
  unit_price_ex: item.unit_price_ex || 0,
  tax_rate: item.tax_rate || 0,
  tax_amount: item.tax_amount || 0,
  total_amount: item.total_amount || 0,
  cost_price: item.cost_price || item.unit_price || 0,
  remark: item.remark || '',
  original_item_index: item.original_item_index
}
```

#### 2. 修改 `getProductLedger` 方法 - 采购退货处理

**位置：** `electron/database.ts` - `getProductLedger()` 方法

**修改内容：**

```typescript
const purchaseReturnItems = this.db!.prepare(`
  SELECT pri.*, pri_table.return_no, pri_table.return_date, pri_table.supplier_id,
         pri_table.original_inbound_no,
         s.name as supplier_name, w.name as warehouse_name,
         'purchase_return' as doc_type, pri_table.created_at as _timestamp
  FROM purchase_return_items pri
  INNER JOIN purchase_returns pri_table ON pri.return_id = pri_table.id
  LEFT JOIN suppliers s ON pri_table.supplier_id = s.id
  LEFT JOIN warehouses w ON pri_table.warehouse_id = w.id
  WHERE pri.product_id = ? AND pri_table.warehouse_id = ?
    AND pri_table.status != 'deleted'${dateFilter('pri_table.return_date')}
  ORDER BY pri_table.return_date, pri_table.created_at
`).all(productId, warehouseId) as any[]

// 为每个采购退货明细项查询原入库单的单价和金额（如果没有保存的话）
purchaseReturnItems.forEach(item => {
  let unitPrice = item.unit_price || 0
  let totalAmount = item.total_amount || 0
  
  // 如果退货单中没有保存单价和金额，尝试从原入库单查询
  if ((!unitPrice || !totalAmount) && item.original_inbound_no) {
    const originalInbound = this.db!.prepare(`
      SELECT ii.unit_price, ii.total_amount
      FROM purchase_inbound_items ii
      INNER JOIN purchase_inbound pi ON ii.inbound_id = pi.id
      WHERE pi.inbound_no = ? AND ii.product_id = ?
      LIMIT 1
    `).get(item.original_inbound_no, productId) as any
    
    if (originalInbound) {
      unitPrice = originalInbound.unit_price || unitPrice
      totalAmount = originalInbound.total_amount || totalAmount
    }
  }
  
  items.push({
    ...item,
    _sortDate: item.return_date,
    direction: 'in',
    qty: -item.quantity,
    price: -unitPrice,
    amount: -totalAmount
  })
})
```

**逻辑说明：**
1. 优先使用 `purchase_return_items` 表中保存的 `unit_price` 和 `total_amount`
2. 如果没有保存（旧数据），则通过 `original_inbound_no` 查询原入库单的单价和金额
3. 采购退货以负数形式计入入库数据区域（`direction: 'in'`）

#### 3. 修改 `getProductLedger` 方法 - 销售退货处理

**位置：** `electron/database.ts` - `getProductLedger()` 方法

**修改内容：**

```typescript
const salesReturnItems = this.db!.prepare(`
  SELECT sri.*, sr.return_no, sr.return_date, sr.customer_id,
         c.name as customer_name, w.name as warehouse_name,
         'sales_return' as doc_type, sr.created_at as _timestamp
  FROM sales_return_items sri
  INNER JOIN sales_returns sr ON sri.return_id = sr.id
  LEFT JOIN customers c ON sr.customer_id = c.id
  LEFT JOIN warehouses w ON sr.warehouse_id = w.id
  WHERE sri.product_id = ? AND sr.warehouse_id = ?
    AND sr.status != 'deleted'${dateFilter('sr.return_date')}
  ORDER BY sr.return_date, sr.created_at
`).all(productId, warehouseId) as any[]

// 销售退货：数量以负数表示在出库数据中，单价显示，金额不显示（为 0）
salesReturnItems.forEach(item => {
  items.push({
    ...item,
    _sortDate: item.return_date,
    direction: 'out',
    qty: -item.quantity,
    price: item.unit_price || 0,
    amount: 0  // 金额设为 0，不显示
  })
})
```

**逻辑说明：**
1. 销售退货以负数形式计入出库数据区域（`direction: 'out'`）
2. 单价正常显示（`price: item.unit_price`）
3. 金额设为 0（`amount: 0`），表示不显示金额

### 三、前端逻辑修复

#### 1. 修改采购退货单保存逻辑

**位置：** `src/views/purchase/returns.vue` - `handleSubmit()` 方法

**修改内容：** 保存时将单价和金额字段传递给后端：

```typescript
const dbData = {
  return_no: formData.voucherNo,
  original_inbound_no: formData.originalVoucherNo,
  supplier_id: formData.supplierId,
  warehouse_id: formData.warehouseId,
  return_date: formData.voucherDate,
  total_amount: formData.totalAmount,
  return_reason: formData.returnReason,
  remark: formData.remark,
  operator: formData.operator,
  items: formData.items
    .filter((item: any) => item.quantity > 0)
    .map((item: any) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,        // 含税单价
      unit_price_ex: item.unitPriceEx,   // 不含税单价
      total_amount: item.totalAmount,    // 金额
      tax_rate: item.taxRate,            // 税率
      tax_amount: item.taxAmount,        // 税额
      cost_price: item.unitPrice,
      remark: item.remark,
      original_item_index: item.originalItemIndex
    }))
}
```

#### 2. 修改数据映射逻辑

**位置：** `src/utils/db-ipc.ts` - `getProductLedger()` 方法

**修改内容：** 移除 `Math.abs()`，保留原始的正负号：

```typescript
const result = rawResult.map((item: any) => {
  if (item.date && item.docNo && item.inboundQty !== undefined) {
    return item
  }
  return {
    date: item.inbound_date || item.outbound_date || item.return_date || item.transfer_date || '',
    docNo: item.inbound_no || item.outbound_no || item.return_no || item.transfer_no || '',
    type: item.doc_type || '',
    docType: item.doc_type || '',
    docId: item.inbound_id || item.outbound_id || item.return_id || item.transfer_id || 0,
    inboundQty: item.direction === 'in' ? (item.qty || 0) : (item.inboundQty || 0),
    inboundUnitPrice: item.direction === 'in' ? (item.price || 0) : (item.inboundUnitPrice || 0),
    inboundAmount: item.direction === 'in' ? (item.amount || 0) : (item.inboundAmount || 0),
    outboundQty: item.direction === 'out' ? (item.qty || 0) : (item.outboundQty || 0),
    outboundUnitPrice: item.direction === 'out' ? (item.price || 0) : (item.outboundUnitPrice || 0),
    outboundAmount: item.direction === 'out' ? (item.amount || 0) : (item.outboundAmount || 0),
    counter: item.supplier_name || item.customer_name || item.from_warehouse_name || item.counter || '',
    remark: item.remark || ''
  }
})
```

**重要：** 移除了 `Math.abs()`，这样销售退货的负数数量才能正确显示。

#### 3. 修改前端显示逻辑

**位置：** `src/views/inventory/stock.vue` - 库存明细表格

**修改内容：** 优化出库数据的显示逻辑：

```vue
<!-- 出库数据区域 -->
<el-table-column label="出库数据" align="center">
  <el-table-column prop="outboundQty" label="数量" width="90" min-width="80" class-name="outbound-col">
    <template #default="{ row }">
      <span v-if="row.outboundQty > 0" style="color: #f56c6c; font-weight: 600">{{ row.outboundQty }}</span>
      <span v-else-if="row.outboundQty < 0" style="color: #67c23a; font-weight: 600">{{ row.outboundQty }}</span>
      <span v-else>-</span>
    </template>
  </el-table-column>
  <el-table-column prop="outboundUnitPrice" label="单价" width="90" min-width="80" class-name="outbound-col">
    <template #default="{ row }">
      <span v-if="row.outboundUnitPrice !== 0 && row.outboundUnitPrice !== undefined">{{ Math.abs(row.outboundUnitPrice).toFixed(2) }}</span>
      <span v-else>-</span>
    </template>
  </el-table-column>
  <el-table-column prop="outboundAmount" label="金额" width="110" min-width="90" class-name="outbound-col">
    <template #default="{ row }">
      <span v-if="row.outboundAmount !== 0 && row.outboundAmount !== undefined" :style="{ color: row.outboundAmount > 0 ? '#f56c6c' : '#67c23a', fontWeight: 600 }">{{ row.outboundAmount.toFixed(2) }}</span>
      <span v-else>-</span>
    </template>
  </el-table-column>
</el-table-column>
```

**显示规则：**
- 正数出库（正常销售出库）：红色显示
- 负数出库（销售退货）：绿色显示
- 单价：使用 `Math.abs()` 取绝对值显示
- 金额：为 0 时显示 `-`

## 修复效果

### 采购退货显示效果

在库存明细表格中：
- **入库数据区域**显示采购退货
- **数量**：负数（红色或绿色，取决于正负）
- **单价**：从原入库单提取的含税单价
- **金额**：从原入库单提取的金额

### 销售退货显示效果

在库存明细表格中：
- **出库数据区域**显示销售退货
- **数量**：负数（绿色，表示退货）
- **单价**：正常显示
- **金额**：显示为 `-`（不显示）

## 测试验证

### 1. 数据库表结构验证

运行测试脚本验证表结构：
```bash
node test-return-fix.js
```

### 2. 功能测试步骤

1. **采购退货测试：**
   - 创建一张采购入库单
   - 创建一张采购退货单，选择原入库单
   - 查看实时库存明细
   - 验证：采购退货是否显示原入库单的单价和金额

2. **销售退货测试：**
   - 创建一张销售出库单
   - 创建一张销售退货单
   - 查看实时库存明细
   - 验证：销售退货的数量是否为负数，单价是否显示，金额是否为 `-`

### 3. 预期结果

**采购退货：**
```
日期       单号           产品名称    入库数据                出库数据
                        数量    单价      金额      数量    单价    金额
2026-04-10  CH20260410   金悦桶    -1      -50.00    -50.00   -      -
```

**销售退货：**
```
日期       单号           产品名称    入库数据                出库数据
                        数量    单价      金额      数量    单价    金额
2026-04-10  XS20260410   金悦桶    -      -        -        -1     50.00   -
```

## 注意事项

1. **旧数据兼容性**：
   - 对于已存在的采购退货单，如果 `unit_price` 和 `total_amount` 为空，系统会自动从原入库单查询
   - 建议重新保存旧的退货单以更新数据

2. **数据库迁移**：
   - 系统启动时会自动执行数据库迁移，添加缺失字段
   - 无需手动执行 SQL 脚本

3. **成本计算**：
   - 采购退货的负数金额会影响库存成本计算
   - 销售退货不影响成本，只影响库存数量

## 修改文件清单

1. `electron/database.ts` - 数据库表结构和查询逻辑
2. `src/views/purchase/returns.vue` - 采购退货单保存逻辑
3. `src/utils/db-ipc.ts` - 数据映射逻辑
4. `src/views/inventory/stock.vue` - 库存明细显示逻辑
5. `test-return-fix.js` - 测试脚本（新增）

## 完成时间

2026-04-10
