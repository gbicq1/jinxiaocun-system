# 成本自动结转功能 - 测试步骤

## 🎯 测试目标

验证月度成本自动结转功能是否正常工作

## 📋 测试前准备

### 1. 确保有以下数据

- ✅ 至少 1 个产品（如：01 - 再生稻）
- ✅ 至少 2 个仓库（如：农服、驿站）
- ✅ 至少 2 个月的出入库单据（2 月和 3 月）

### 2. 检查数据库文件

```
路径：C:\Users\你的用户名\AppData\Roaming\你的应用名\inventory.db
检查：文件是否存在
```

## 🧪 测试步骤

### 步骤 1：启动系统

1. 刷新浏览器页面（F5）
2. 打开浏览器控制台（F12）
3. 查看控制台日志

**预期日志**：
```
成本结算处理器初始化完成
定时任务服务已启动
```

### 步骤 2：检查数据库表是否创建

在浏览器控制台执行：

```javascript
// 检查 2 月份是否已结算
const result = await window.electron?.invoke?.('cost:is-settled', { year: 2026, month: 2 })
console.log('2 月已结算:', result)
```

**预期结果**：
- `false`（如果还未结算）
- `true`（如果已结算）

### 步骤 3：手动结算 2 月份成本

在浏览器控制台执行：

```javascript
// 结算 2 月份
const settleResult = await window.electron?.invoke?.('cost:settle-month', {
  year: 2026,
  month: 2,
  lock: true
})
console.log('结算结果:', settleResult)
```

**预期结果**：
```javascript
{
  success: true,
  count: 10  // 假设有 10 个产品仓库组合
}
```

### 步骤 4：查询结算数据

在浏览器控制台执行：

```javascript
// 查询 2 月份的结算数据
const settlement = await window.electron?.invoke?.('cost:get-settlement', {
  productCode: '01',
  warehouseId: 1,
  year: 2026,
  month: 2
})
console.log('结算数据:', settlement)
```

**预期结果**：
```javascript
{
  product_code: '01',
  product_name: '再生稻',
  warehouse_id: 1,
  warehouse_name: '农服',
  period_year: 2026,
  period_month: 2,
  opening_qty: 0,
  opening_cost: 0,
  inbound_qty: 100,
  inbound_cost: 1100,
  outbound_qty: 50,
  outbound_cost: 0,
  closing_qty: 50,
  closing_cost: 550,
  avg_cost: 11.00,
  is_locked: 1
}
```

### 步骤 5：测试调拨单成本价获取

1. 打开"库存调拨"页面
2. 点击"新增调拨单"
3. 选择：
   - 调拨日期：2026-02-28
   - 调出仓库：农服
   - 产品：01 - 再生稻

**预期结果**：
- 成本价自动填充为 **11.00**（从数据库读取）

### 步骤 6：测试历史单据触发重算

在浏览器控制台执行：

```javascript
// 模拟新增 2 月份单据
const checkResult = await window.electron?.invoke?.('cost:check-bill-date-and-recalculate', {
  billDate: '2026-02-15'
})
console.log('检测结果:', checkResult)
```

**预期结果**：
```javascript
{
  needRecalculate: true,
  year: 2026,
  month: 2,
  message: '单据日期 2026-02-15 早于当前月份，将重新结算从 2026 年 2 月 开始的成本数据'
}
```

### 步骤 7：查看已结算期间列表

在浏览器控制台执行：

```javascript
// 获取所有已结算期间
const periods = await window.electron?.invoke?.('cost:get-settled-periods')
console.log('已结算期间:', periods)
```

**预期结果**：
```javascript
[
  { period_year: 2026, period_month: 2 }
]
```

## ✅ 测试通过标准

- [x] 数据库表成功创建
- [x] 手动结算成功
- [x] 结算数据正确保存
- [x] 调拨单正确读取成本价
- [x] 历史单据检测正常
- [x] 已结算期间列表正确

## 🐛 常见问题

### 问题 1：数据库表未创建

**症状**：查询返回 `undefined` 或错误

**解决**：
```bash
# 重启 Electron 主进程
# 检查 electron/main.ts 是否成功导入并初始化
```

### 问题 2：成本价为 0

**症状**：调拨单成本价显示 0

**解决**：
1. 检查是否有出入库单据
2. 检查产品编码和仓库 ID 是否正确
3. 查看浏览器控制台日志

### 问题 3：结算失败

**症状**：`settle-month` 返回 `success: false`

**解决**：
```javascript
// 查看详细错误
const result = await window.electron?.invoke?.('cost:settle-month', {...})
console.error('错误:', result.error)
```

## 📊 性能测试

### 大数据量测试

```javascript
// 测试 1000 个产品仓库组合的结算性能
console.time('结算耗时')
const result = await window.electron?.invoke?.('cost:settle-month', {
  year: 2026,
  month: 2,
  lock: true
})
console.timeEnd('结算耗时')
console.log('结算记录数:', result.count)
```

**预期**：
- 1000 条记录：< 5 秒
- 10000 条记录：< 30 秒

## 🎉 测试完成

如果所有测试都通过，说明成本自动结转功能已经成功实现！

接下来可以：
1. 集成到采购入库单
2. 集成到销售出库单
3. 开发成本分析报表
4. 添加成本预警功能
