# 数据库增强功能使用指南

## 快速开始

### 1. 启用数据库

在 `electron/main.ts` 中初始化增强版数据库：

```typescript
import { EnhancedInventoryDatabase } from './database-enhanced'

let enhancedDb: EnhancedInventoryDatabase | null = null

function initEnhancedDatabase() {
  const dbPath = resolve(app.getPath('userData'), 'inventory.db')
  enhancedDb = new EnhancedInventoryDatabase(dbPath)
  enhancedDb.initialize()
  console.log('增强版数据库初始化完成')
}

app.whenReady().then(() => {
  initDatabase()  // 原有数据库初始化
  initEnhancedDatabase()  // 新增：增强版数据库初始化
  createWindow()
  setupIpcHandlers()
})
```

### 2. 同步现有数据到数据库

在成本结算页面首次加载时，同步 localStorage 数据：

```typescript
import { syncToDatabase } from '../../utils/cost-enhanced'

// 在 onMounted 中调用
onMounted(() => {
  loadWarehouses()
  
  // 同步数据到数据库
  const syncCount = syncToDatabase()
  if (syncCount > 0) {
    ElMessage.success(`已同步 ${syncCount} 条记录到数据库`)
  }
})
```

### 3. 修改成本计算逻辑

在 `cost-settlement.vue` 的 `loadSettlementData()` 方法中：

```typescript
import { 
  getAccurateOpeningBalance,
  saveCostSettlementToDatabase,
  logCostCalculation 
} from '../../utils/cost-enhanced'

// ========== 替换原有的期初数据获取逻辑 ==========
// 原代码（约 1154-1200 行）：
// const previousRecord = previousSettlements.length > 0 ? 
//   previousSettlements.find(...) : null
// const openingQty = previousRecord ? Number(previousRecord.closingQty || 0) : 0
// const openingCost = previousRecord ? Number(previousRecord.closingCost || 0) : 0

// ========== 新代码：使用增强版期初数据获取 ==========
const openingBalance = getAccurateOpeningBalance(
  product.id,
  warehouse.id,
  startDate
)

const openingQty = openingBalance.quantity
const openingCost = openingBalance.cost
const openingUnitCost = openingBalance.unitCost

console.log('📊 使用增强版期初数据:', {
  product: product.name,
  warehouse: warehouse.name,
  period: startDate + ' 至 ' + endDate,
  ...openingBalance
})

// 然后继续原有的计算逻辑...
// 计算加权平均单价
const totalAvailableQty = openingQty + inboundQty
const totalAvailableCost = openingCost + inboundCost
const avgPrice = totalAvailableQty > 0 ? totalAvailableCost / totalAvailableQty : 0

// 计算期末结存
const closingQty = totalAvailableQty - outboundQty
const closingCost = closingQty * avgPrice

// ========== 新增：保存到数据库 ==========
const settlementData = {
  productId: product.id,
  productCode: product.code,
  warehouseId: warehouse.id,
  periodStart: startDate,
  periodEnd: endDate,
  openingQty,
  openingCost,
  openingUnitCost,
  inboundQty,
  inboundCost,
  outboundQty,
  outboundCost,
  avgPrice,
  closingQty,
  closingCost
}

// 保存到数据库（增强功能）
const savedToDb = saveCostSettlementToDatabase(settlementData)

if (savedToDb) {
  console.log('✅ 已保存到数据库')
} else {
  console.warn('⚠️ 未保存到数据库，仅保存到 localStorage')
}

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
  details: {
    inboundQty,
    inboundCost,
    outboundQty,
    outboundCost
  },
  status: 'success'
})
```

## 测试验证

### 测试场景 1：连续月份结算

**目的**：验证成本价的连续性

**步骤**：
1. 结算 2026-01 期间
2. 结算 2026-02 期间
3. 结算 2026-03 期间
4. 分别查看各月的成本结算明细

**预期结果**：
- 2026-02 的期初成本价 = 2026-01 的期末成本价
- 2026-03 的期初成本价 = 2026-02 的期末成本价
- 查看明细账时，"上月结转"行的数据准确

### 测试场景 2：跳月结算（关键测试）

**目的**：验证即使某月未结算，也能获取正确的期初数据

**步骤**：
1. 结算 2026-01 期间
2. **不结算** 2026-02 期间
3. 直接结算 2026-03 期间
4. 查看 2026-03 的期初数据

**预期结果**：
- 2026-03 的期初数据应该来自 2026-02 的库存快照
- 而不是来自 2026-01 的结算数据
- 成本价应该是 2026-02 月末的实际成本价

**验证方法**：
```typescript
// 在浏览器控制台执行
const db = require('electron').remote.require('./database-enhanced')
const balance = db.getAccurateOpeningBalance(productId, warehouseId, '2026-03-01')
console.log('2026-03 的期初数据:', balance)
// 应该显示 source: 'snapshot:2026-02-29' 或类似
```

### 测试场景 3：跨年度查询

**目的**：验证跨年度查询时成本价的一致性

**步骤**：
1. 查询 2025-03-01 至 2026-03-31（整年）
2. 查询 2026-03-01 至 2026-03-31（单月）
3. 对比两个查询结果的期末成本价

**预期结果**：
- 两个查询的期末成本价应该一致（或非常接近）
- 差异不超过 0.01（浮点数精度）

### 测试场景 4：数据验证

**目的**：验证数据库快照和计算结果的一致性

**步骤**：
```typescript
import { validateCostCalculation } from '../../utils/cost-enhanced'

// 在浏览器控制台执行
const result = validateCostCalculation(productId, warehouseId, '2026-03-31')
console.log('验证结果:', result)

// 预期输出
{
  isValid: true,  // 或 false（如果差异超过阈值）
  snapshotCost: 213.57,
  calculatedCost: 213.57,
  difference: 0.00
}
```

## 调试工具

### 1. 查看数据库表内容

使用 SQLite 工具查看 `inventory.db` 文件：

```sql
-- 查看库存快照
SELECT * FROM inventory_snapshots 
WHERE product_id = 1 AND warehouse_id = 1 
ORDER BY snapshot_date DESC;

-- 查看成本结算历史
SELECT * FROM cost_settlement_history 
WHERE product_id = 1 AND warehouse_id = 1 
ORDER BY period_end DESC;

-- 查看出入库流水
SELECT * FROM inventory_transactions 
WHERE product_id = 1 AND warehouse_id = 1 
ORDER BY transaction_date DESC 
LIMIT 100;

-- 查看成本计算日志
SELECT * FROM cost_calculation_log 
WHERE product_id = 1 AND warehouse_id = 1 
ORDER BY calculation_time DESC 
LIMIT 100;
```

### 2. 浏览器控制台调试

```typescript
// 1. 查看 localStorage 中的结算数据
const settlements = JSON.parse(localStorage.getItem('cost_settlements'))
console.log('localStorage 结算数据:', settlements)

// 2. 测试期初数据获取
import { getAccurateOpeningBalance } from '../../utils/cost-enhanced'
const balance = getAccurateOpeningBalance(1, 1, '2026-03-01')
console.log('期初数据:', balance)

// 3. 手动同步数据
import { syncToDatabase } from '../../utils/cost-enhanced'
const count = syncToDatabase()
console.log('同步记录数:', count)

// 4. 验证成本计算
import { validateCostCalculation } from '../../utils/cost-enhanced'
const result = validateCostCalculation(1, 1, '2026-03-31')
console.log('验证结果:', result)
```

### 3. 查看计算日志

```typescript
// 在浏览器控制台
const db = getDatabase()
const logs = db.query(`
  SELECT * FROM cost_calculation_log 
  WHERE product_id = 1 AND warehouse_id = 1 
  ORDER BY calculation_time DESC 
  LIMIT 10
`)
console.log('计算日志:', logs)
```

## 常见问题排查

### 问题 1：期初数据为 0

**可能原因**：
1. 数据库中没有历史数据
2. localStorage 中也没有结算数据
3. 产品 ID 或仓库 ID 不匹配

**排查步骤**：
```typescript
// 1. 检查数据库是否有快照
const db = getDatabase()
const snapshots = db.query(`
  SELECT * FROM inventory_snapshots 
  WHERE product_id = ? AND warehouse_id = ?
  ORDER BY snapshot_date DESC LIMIT 5
`, [productId, warehouseId])
console.log('库存快照:', snapshots)

// 2. 检查 localStorage
const settlements = JSON.parse(localStorage.getItem('cost_settlements'))
console.log('localStorage 结算数据:', settlements)

// 3. 检查出入库流水
const transactions = db.query(`
  SELECT * FROM inventory_transactions 
  WHERE product_id = ? AND warehouse_id = ?
  ORDER BY transaction_date DESC LIMIT 10
`, [productId, warehouseId])
console.log('出入库流水:', transactions)
```

### 问题 2：成本价不一致

**可能原因**：
1. 某月未生成快照
2. 跳月结算时使用了错误的期初
3. 出入库记录成本价不一致

**排查步骤**：
```typescript
// 1. 验证成本计算
const result = validateCostCalculation(productId, warehouseId, periodEnd)
console.log('验证结果:', result)

// 2. 查看计算日志
const logs = db.query(`
  SELECT * FROM cost_calculation_log 
  WHERE product_id = ? AND warehouse_id = ? 
  AND period_end = ?
  ORDER BY calculation_time DESC
`, [productId, warehouseId, periodEnd])
console.log('计算日志:', logs)

// 3. 检查出入库记录的成本价
const transactions = db.query(`
  SELECT transaction_date, transaction_type, quantity, unit_cost, total_cost
  FROM inventory_transactions 
  WHERE product_id = ? AND warehouse_id = ?
  ORDER BY transaction_date
`, [productId, warehouseId])
console.log('出入库成本价:', transactions)
```

### 问题 3：数据库同步失败

**可能原因**：
1. 数据库未初始化
2. localStorage 数据格式不正确
3. 表结构不匹配

**排查步骤**：
```typescript
// 1. 检查数据库是否初始化
const db = getDatabase()
console.log('数据库已初始化:', db['initialized'])

// 2. 检查 localStorage 数据
const keys = ['purchase_inbound_records', 'sales_outbound_records', 'inventory_transfers']
keys.forEach(key => {
  try {
    const data = JSON.parse(localStorage.getItem(key))
    console.log(`${key}:`, data ? `${data.length} 条记录` : '无数据')
  } catch (e) {
    console.error(`解析 ${key} 失败:`, e)
  }
})

// 3. 手动同步
try {
  const count = syncToDatabase()
  console.log('同步成功:', count)
} catch (e) {
  console.error('同步失败:', e)
}
```

## 性能优化建议

### 1. 批量同步

```typescript
// 在系统空闲时批量同步
const syncInBatch = async () => {
  const batchSize = 100
  let offset = 0
  
  while (true) {
    const records = getLocalStorageRecords(offset, batchSize)
    if (records.length === 0) break
    
    syncToDatabase(records)
    offset += batchSize
    
    // 避免阻塞 UI
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}
```

### 2. 增量计算

```typescript
// 只计算变动的单据
const incrementalCalculation = (periodStart, periodEnd) => {
  // 从数据库获取上期快照
  const openingBalance = getAccurateOpeningBalance(productId, warehouseId, periodStart)
  
  // 只查询本期新增的出入库记录
  const newTransactions = db.query(`
    SELECT * FROM inventory_transactions 
    WHERE product_id = ? AND warehouse_id = ?
    AND transaction_date >= ? AND transaction_date <= ?
    AND source_key IN (
      SELECT key FROM localStorage_changes 
      WHERE changed_at >= ?
    )
  `, [productId, warehouseId, periodStart, periodEnd, lastSyncTime])
  
  // 从快照开始，只计算新增记录
  return calculateFromSnapshot(openingBalance, newTransactions)
}
```

### 3. 缓存热点数据

```typescript
// 缓存常用产品的期初数据
const openingBalanceCache = new Map()

const getCachedOpeningBalance = (productId, warehouseId, periodStart) => {
  const cacheKey = `${productId}-${warehouseId}-${periodStart}`
  
  if (openingBalanceCache.has(cacheKey)) {
    return openingBalanceCache.get(cacheKey)
  }
  
  const balance = getAccurateOpeningBalance(productId, warehouseId, periodStart)
  openingBalanceCache.set(cacheKey, balance)
  
  return balance
}
```

## 最佳实践

1. **每月及时结算**
   - 每月月末及时进行成本结算
   - 生成库存快照
   - 锁定已结算月份

2. **定期数据同步**
   - 每次启动时同步 localStorage
   - 定期备份数据库文件
   - 监控数据库文件大小

3. **异常监控**
   - 记录所有成本计算日志
   - 设置成本价波动预警
   - 定期检查数据一致性

4. **权限控制**
   - 已结算月份禁止修改
   - 反结算需要权限
   - 重要操作记录日志

## 总结

通过本增强方案，您可以：

✅ 解决成本价不一致问题
✅ 确保期初数据准确
✅ 支持跳月结算
✅ 提供完整的数据追溯
✅ 保持向后兼容

如有问题，请查看计算日志或联系技术支持。
