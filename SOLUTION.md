# 成本价不一致问题解决方案

## 问题描述

在不同的会计期间查询时，同一产品的库存结余成本价出现不一致：
- 查询 **2025-03-01 至 2026-03-31**（整年）：期末结存成本价 = ¥21.36
- 查询 **2026-03-01 至 2026-03-31**（单月）：期末结存成本价 = ¥21.20

## 根本原因分析

### 1. 当前系统架构问题

**问题 1：依赖 localStorage 存储**
- 系统使用 localStorage 存储所有业务数据（出入库记录、成本结算数据）
- localStorage 数据易丢失、易被覆盖、无事务保证

**问题 2：期初数据来源不稳定**
- 当前系统从 `cost_settlements` 表（localStorage）获取期初数据
- 查找逻辑：当前期间之前的最后一个已结算期间
- **关键问题**：如果中间有月份未结算，期初数据就会取自更早的期间，导致成本价计算基准不同

### 2. 成本计算逻辑问题

**上月结转取数逻辑**（代码位置：`cost-settlement.vue` 第 1154-1200 行）：

```typescript
// 当前逻辑
const previousSettlements = allSettlements
  .filter((s: any) => {
    const periodEnd = s.periodRange[1]
    return periodEnd < periodStart  // 查找当前期间之前的所有结算
  })
  .sort((a: any, b: any) => {
    return new Date(b.periodRange[1]).getTime() - new Date(a.periodRange[1]).getTime()  // 倒序
  })

// 取最新的作为期初
const previousRecord = previousSettlements.length > 0 ? previousSettlements[0] : null
```

**问题示例**：
- 2026-01 已结算：期末成本价 ¥9.45
- 2026-02 **未结算**
- 2026-03 计算时：
  - 查找 2026-03 之前的结算 → 找到 2026-01（跳过 2026-02，因为未结算）
  - 使用 2026-01 的期末成本价 ¥9.45 作为期初
  - **但 2026-02 实际有业务发生，真实成本价已变化**

### 3. 为什么数据库能解决？

**数据库的四大优势**：

1. **持久化存储**
   - 数据不会因浏览器缓存清理而丢失
   - 支持事务，确保数据一致性

2. **库存快照机制**
   - 每月月末自动保存库存快照（数量、成本价、总金额）
   - 快照表包含：`inventory_snapshots`
   - 即使某月未结算，也有准确的库存快照

3. **多层级期初获取策略**
   - 第一层：库存快照表（最准确）
   - 第二层：成本结算历史表（已结算期间）
   - 第三层：出入库流水表（全量计算）
   - 第四层：localStorage（兼容旧数据）

4. **可追溯性**
   - 每次成本计算都记录日志
   - 可以追溯任意时间点的库存和成本

## 解决方案实现

### 1. 数据库增强模块

**文件**: `electron/database-enhanced.ts`

**新增表结构**：

#### (1) 库存快照表 (`inventory_snapshots`)
```sql
CREATE TABLE inventory_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  product_code VARCHAR(50) NOT NULL,
  warehouse_id INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  snapshot_type VARCHAR(20) NOT NULL,  -- 'monthly' 或 'yearly'
  
  quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(15,6) NOT NULL DEFAULT 0,
  total_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  monthly_inbound_qty DECIMAL(15,4) DEFAULT 0,
  monthly_inbound_cost DECIMAL(15,2) DEFAULT 0,
  monthly_outbound_qty DECIMAL(15,4) DEFAULT 0,
  monthly_outbound_cost DECIMAL(15,2) DEFAULT 0,
  
  source VARCHAR(20) DEFAULT 'calculated',  -- 'calculated' 或 'settled'
  is_locked BOOLEAN DEFAULT 0,  -- 是否已锁定
  
  UNIQUE(product_id, warehouse_id, snapshot_date)
)
```

**作用**：每月月末保存准确的库存快照，确保期初数据可追溯

#### (2) 成本结算历史表 (`cost_settlement_history`)
```sql
CREATE TABLE cost_settlement_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_no VARCHAR(50) UNIQUE NOT NULL,
  product_id INTEGER NOT NULL,
  product_code VARCHAR(50) NOT NULL,
  warehouse_id INTEGER NOT NULL,
  
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  opening_qty DECIMAL(15,4) DEFAULT 0,
  opening_cost DECIMAL(15,2) DEFAULT 0,
  opening_unit_cost DECIMAL(15,6) DEFAULT 0,
  
  inbound_qty DECIMAL(15,4) DEFAULT 0,
  inbound_cost DECIMAL(15,2) DEFAULT 0,
  
  outbound_qty DECIMAL(15,4) DEFAULT 0,
  outbound_cost DECIMAL(15,2) DEFAULT 0,
  
  weighted_avg_unit_cost DECIMAL(15,6) NOT NULL DEFAULT 0,
  
  closing_qty DECIMAL(15,4) DEFAULT 0,
  closing_cost DECIMAL(15,2) DEFAULT 0,
  closing_unit_cost DECIMAL(15,6) DEFAULT 0,
  
  status VARCHAR(20) DEFAULT 'draft',
  settled_at DATETIME,
  settled_by VARCHAR(50),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**作用**：保存每次成本结算的完整历史，支持追溯和审计

#### (3) 出入库流水表 (`inventory_transactions`)
```sql
CREATE TABLE inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_no VARCHAR(50) NOT NULL,
  product_id INTEGER NOT NULL,
  product_code VARCHAR(50) NOT NULL,
  warehouse_id INTEGER NOT NULL,
  
  transaction_date DATE NOT NULL,
  transaction_time TIME,
  timestamp DATETIME,
  
  transaction_type VARCHAR(20) NOT NULL,
  bill_type VARCHAR(50),
  bill_no VARCHAR(50),
  
  quantity DECIMAL(15,4) NOT NULL,
  unit_cost DECIMAL(15,6) NOT NULL,
  total_cost DECIMAL(15,2) NOT NULL,
  
  -- 交易前后的库存结余（关键）
  pre_quantity DECIMAL(15,4),
  pre_unit_cost DECIMAL(15,6),
  pre_total_cost DECIMAL(15,2),
  
  post_quantity DECIMAL(15,4),
  post_unit_cost DECIMAL(15,6),
  post_total_cost DECIMAL(15,2),
  
  source_key VARCHAR(100),
  source_id VARCHAR(50),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_product_warehouse (product_id, warehouse_id),
  INDEX idx_date (transaction_date),
  INDEX idx_timestamp (timestamp)
)
```

**作用**：从 localStorage 同步所有出入库记录，支持全量计算

#### (4) 成本计算日志表 (`cost_calculation_log`)
```sql
CREATE TABLE cost_calculation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  product_id INTEGER NOT NULL,
  product_code VARCHAR(50) NOT NULL,
  warehouse_id INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  opening_qty_used DECIMAL(15,4),
  opening_cost_used DECIMAL(15,2),
  opening_source VARCHAR(100),
  
  calculated_avg_cost DECIMAL(15,6),
  closing_qty DECIMAL(15,4),
  closing_cost DECIMAL(15,2),
  
  calculation_details TEXT,  -- JSON 格式
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**作用**：记录每次成本计算的详细过程，便于调试和审计

### 2. 成本计算增强工具

**文件**: `src/utils/cost-enhanced.ts`

#### 核心方法 1：获取准确的期初数据

```typescript
export const getAccurateOpeningBalance = (
  productId: number | undefined,
  warehouseId: number | undefined,
  periodStart: string
): {
  quantity: number
  cost: number
  unitCost: number
  source: string
}
```

**四层获取策略**：

1. **第一层：数据库库存快照表**（最准确）
   ```typescript
   const openingBalance = db.getOpeningBalance(productId, warehouseId, periodStart)
   // 查询 snapshot_date <= periodStart 的最新快照
   ```

2. **第二层：数据库成本结算历史表**（已结算期间）
   ```typescript
   SELECT closing_qty, closing_cost, closing_unit_cost
   FROM cost_settlement_history
   WHERE product_id = ? AND warehouse_id = ? AND period_end <= ?
   ORDER BY period_end DESC LIMIT 1
   ```

3. **第三层：数据库出入库流水表**（全量计算）
   ```typescript
   // 从第一笔业务开始，逐笔计算到 periodStart 前一天
   SELECT quantity, unit_cost, total_cost, transaction_type
   FROM inventory_transactions
   WHERE product_id = ? AND warehouse_id = ? AND transaction_date <= ?
   ORDER BY transaction_date, transaction_time
   ```

4. **第四层：localStorage 成本结算数据**（兼容旧方案）
   ```typescript
   // 原有的 localStorage 查找逻辑
   const settlements = JSON.parse(localStorage.getItem('cost_settlements'))
   ```

**优势**：
- 确保期初数据始终准确
- 即使某月未结算，也有快照作为期初
- 完全向后兼容，不影响现有功能

#### 核心方法 2：保存成本结算结果

```typescript
export const saveCostSettlementToDatabase = (data: {
  productId: number
  productCode: string
  warehouseId: number
  periodStart: string
  periodEnd: string
  openingQty: number
  openingCost: number
  inboundQty: number
  inboundCost: number
  outboundQty: number
  outboundCost: number
  avgPrice: number
  closingQty: number
  closingCost: number
}): boolean
```

**保存内容**：
1. 保存到 `cost_settlement_history` 表
2. 同时保存到 `inventory_snapshots` 表（作为月末快照）
3. 标记为 `is_locked = 1`（已结算月份不可修改）

### 3. 集成到现有系统

#### 修改 `cost-settlement.vue`

在原有的成本计算逻辑基础上，增加数据库支持：

```typescript
// 在 loadSettlementData() 方法中

// 1. 使用增强版工具获取期初数据
import { 
  getAccurateOpeningBalance,
  saveCostSettlementToDatabase,
  logCostCalculation 
} from '../../utils/cost-enhanced'

// 2. 替换原有的期初数据获取逻辑
const openingBalance = getAccurateOpeningBalance(
  product.id,
  warehouse.id,
  startDate
)

const openingQty = openingBalance.quantity
const openingCost = openingBalance.cost

console.log('使用增强版期初数据:', openingBalance)

// 3. 计算完成后，保存到数据库
const settlement = {
  productId: product.id,
  productCode: product.code,
  warehouseId: warehouse.id,
  periodStart: startDate,
  periodEnd: endDate,
  openingQty,
  openingCost,
  openingUnitCost: openingBalance.unitCost,
  inboundQty,
  inboundCost,
  outboundQty,
  outboundCost,
  avgPrice,
  closingQty,
  closingCost
}

// 保存到数据库（增强）
saveCostSettlementToDatabase(settlement)

// 记录计算日志
logCostCalculation({
  productId: product.id,
  productCode: product.code,
  warehouseId: warehouse.id,
  periodStart: startDate,
  periodEnd: endDate,
  openingQty,
  openingCost,
  openingSource: openingBalance.source,
  calculatedAvgCost: avgPrice,
  closingQty,
  closingCost,
  status: 'success'
})
```

### 4. 数据迁移方案

#### 步骤 1：同步 localStorage 到数据库

```typescript
import { syncToDatabase } from '../../utils/cost-enhanced'

// 在系统启动时或首次使用时调用
const syncCount = syncToDatabase()
console.log(`同步完成：共同步 ${syncCount} 条记录到数据库`)
```

#### 步骤 2：重建历史库存快照

```typescript
// 为已有结算数据的月份生成快照
const settlements = JSON.parse(localStorage.getItem('cost_settlements'))

settlements.forEach((s: any) => {
  db.saveInventorySnapshot({
    productId: s.productId,
    productCode: s.productCode,
    warehouseId: s.warehouseId,
    snapshotDate: s.periodRange[1],
    snapshotType: 'monthly',
    quantity: s.closingQty,
    unitCost: s.avgPrice,
    totalCost: s.closingCost,
    source: 'migrated'
  })
})
```

## 使用流程

### 正常月度结算流程

1. **月末进行成本结算**
   - 选择会计期间（如 2026-03-01 至 2026-03-31）
   - 点击"开始计算"
   - 系统自动：
     - 从数据库获取准确的期初数据
     - 计算本期加权平均成本
     - 保存结算结果到数据库
     - 生成库存快照

2. **下月计算时**
   - 系统自动从上月的库存快照获取期初
   - 确保成本价连续性

### 查询不同期间

**场景 1：查询单月（2026-03）**
- 期初 = 2026-02 的库存快照（准确）
- 计算结果准确

**场景 2：查询整年（2025-03 至 2026-03）**
- 期初 = 2025-02 的库存快照（准确）
- 包含整年的出入库记录
- 计算结果准确

**结果**：两个期间的成本价一致！

## 验证方案

### 1. 数据一致性验证

```typescript
import { validateCostCalculation } from '../../utils/cost-enhanced'

const result = validateCostCalculation(
  productId,
  warehouseId,
  periodEnd
)

if (!result.isValid) {
  console.warn('成本计算验证失败:', {
    snapshotCost: result.snapshotCost,
    calculatedCost: result.calculatedCost,
    difference: result.difference
  })
}
```

### 2. 测试用例

**测试 1：连续月份结算**
1. 结算 2026-01
2. 结算 2026-02
3. 结算 2026-03
4. 验证：各月成本价连续性

**测试 2：跳月结算**
1. 结算 2026-01
2. **不结算** 2026-02
3. 结算 2026-03
4. 验证：2026-03 的期初应该从 2026-02 的快照获取（而不是 2026-01）

**测试 3：跨年度查询**
1. 查询 2025 全年
2. 查询 2026 年 1-3 月
3. 验证：成本价一致性

## 优势总结

### 1. 数据准确性
- ✅ 期初数据始终准确（来自快照或结算历史）
- ✅ 即使跳月结算，也能获取正确的期初
- ✅ 支持全量计算（从出入库流水表）

### 2. 可追溯性
- ✅ 每次计算都有日志
- ✅ 可以追溯任意时间点的库存
- ✅ 支持审计

### 3. 性能优化
- ✅ 使用数据库索引，查询快速
- ✅ 快照机制避免全量计算
- ✅ 支持大数据量

### 4. 向后兼容
- ✅ 继续使用 localStorage
- ✅ 数据库作为补充和增强
- ✅ 平滑迁移，不影响现有功能

## 注意事项

1. **数据库初始化**
   - 首次使用需要调用 `db.initialize()`
   - 创建所有表和索引

2. **数据同步**
   - 建议每次启动时同步 localStorage 到数据库
   - 确保数据不丢失

3. **快照生成**
   - 每月结算后自动生成快照
   - 标记为 `is_locked = 1`

4. **错误处理**
   - 数据库操作失败时，降级到 localStorage
   - 记录错误日志

## 后续优化建议

1. **实时库存快照**
   - 每次出入库后更新实时库存
   - 进一步减少计算量

2. **Web Worker**
   - 将成本计算放到后台线程
   - 避免阻塞 UI

3. **增量计算**
   - 只计算变动的单据
   - 复用已有的计算结果

4. **成本预警**
   - 成本价波动超过阈值时预警
   - 负库存预警

## 总结

本方案通过引入数据库快照机制，从根本上解决了成本价不一致的问题：

- **核心思想**：每月保存库存快照，确保期初数据准确
- **实施策略**：四层获取策略，确保数据可靠性
- **兼容性**：完全向后兼容，不影响现有功能
- **可扩展性**：支持后续优化和增强

实施后，无论查询哪个期间，成本价都将保持一致！
