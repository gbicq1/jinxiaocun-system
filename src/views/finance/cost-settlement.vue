<template>
  <div class="cost-settlement-page">
    <el-card>
      <div class="toolbar">
        <el-form :inline="true" :model="queryForm" class="query-form">
          <el-form-item label="会计期间">
            <el-date-picker
              v-model="queryForm.periodRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 240px"
            />
          </el-form-item>
          <el-form-item label="商品编码/名称">
            <el-input
              v-model="queryForm.productSearch"
              placeholder="输入商品编码或名称"
              clearable
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item label="仓库">
            <el-select v-model="queryForm.warehouse" placeholder="选择仓库" clearable style="width: 150px">
              <el-option label="全部仓库" value="" />
              <el-option
                v-for="warehouse in warehouses"
                :key="warehouse.id"
                :label="warehouse.name"
                :value="warehouse.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSearch">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
            <el-button @click="handleReset">
              <el-icon><RefreshLeft /></el-icon>
              重置
            </el-button>
          </el-form-item>
        </el-form>
        
        <!-- 右侧功能按钮 -->
        <div class="action-buttons">
          <el-button type="success" @click="handleCalculate">
            <el-icon><Check /></el-icon>
            开始计算
          </el-button>
          <el-button type="warning" @click="handleReverse">
            <el-icon><Back /></el-icon>
            反结算
          </el-button>
          <el-button type="primary" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出 Excel
          </el-button>
          <el-button @click="handlePrint">
            <el-icon><Printer /></el-icon>
            打印
          </el-button>
        </div>
      </div>

      <!-- 中间表格展示区域 -->
      <el-table
        :data="settlementList"
        style="width: 100%"
        :table-layout="'fixed'"
        border
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="productCode" label="商品编码" width="120" />
        <el-table-column prop="productName" label="商品名称" width="200" />
        <el-table-column prop="specification" label="规格型号" width="150" />
        <el-table-column prop="unit" label="单位" width="80" />
        
        <el-table-column prop="openingQty" label="期初数量" width="100" align="right">
          <template #default="{ row }">{{ row.openingQty }}</template>
        </el-table-column>
        <el-table-column prop="openingCost" label="期初成本（不含税）" width="130" align="right">
          <template #default="{ row }">¥{{ row.openingCost.toLocaleString() }}</template>
        </el-table-column>
        
        <el-table-column prop="inboundQty" label="本期入库数量" width="110" align="right">
          <template #default="{ row }">{{ row.inboundQty }}</template>
        </el-table-column>
        <el-table-column prop="inboundCost" label="本期入库成本" width="150" align="right">
          <template #default="{ row }">¥{{ row.inboundCost.toLocaleString() }}</template>
        </el-table-column>
        
        <el-table-column prop="outboundQty" label="本期出库数量" width="110" align="right">
          <template #default="{ row }">{{ row.outboundQty }}</template>
        </el-table-column>
        <el-table-column prop="outboundCost" label="本期出库成本" width="150" align="right">
          <template #default="{ row }">¥{{ row.outboundCost.toLocaleString() }}</template>
        </el-table-column>
        
        <el-table-column prop="avgPrice" label="加权平均单价" width="130" align="right">
          <template #default="{ row }">¥{{ row.avgPrice.toFixed(2) }}</template>
        </el-table-column>
        
        <el-table-column prop="closingQty" label="期末结存数量" width="110" align="right">
          <template #default="{ row }">{{ row.closingQty }}</template>
        </el-table-column>
        <el-table-column prop="closingCost" label="期末结存成本" width="150" align="right">
          <template #default="{ row }">¥{{ row.closingCost.toLocaleString() }}</template>
        </el-table-column>
        
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleViewDetail(row)">明细</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 底部统计区域 -->
      <div class="summary-bar">
        <div class="summary-item">
          <span class="summary-label">期末结存数量合计：</span>
          <span class="summary-value">{{ totalQty.toLocaleString() }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">期末结存成本合计：</span>
          <span class="summary-value">¥{{ totalCost.toLocaleString() }}</span>
        </div>
      </div>
    </el-card>

    <!-- 成本结算明细弹窗 -->
    <div v-if="dialogVisible" class="settlement-detail-overlay" @click="handleOverlayClick">
      <div class="settlement-detail-dialog" @click.stop>
        <!-- 头部固定区 -->
        <div class="settlement-detail-header">
          <span class="settlement-detail-title">成本结算明细</span>
          <el-icon class="settlement-detail-close" @click="dialogVisible = false">
            <Close />
          </el-icon>
        </div>

        <div v-if="selectedRow" class="settlement-detail-body">
          <!-- 商品基础信息固定区 -->
          <div class="settlement-detail-info">
            <el-descriptions :column="2" border size="default">
              <el-descriptions-item label="商品编码">{{ selectedRow.productCode }}</el-descriptions-item>
              <el-descriptions-item label="商品名称">{{ selectedRow.productName }}</el-descriptions-item>
              <el-descriptions-item label="规格型号">{{ selectedRow.specification || '-' }}</el-descriptions-item>
              <el-descriptions-item label="单位">{{ selectedRow.unit }}</el-descriptions-item>
              <el-descriptions-item label="会计期间">{{ queryForm.periodRange ? queryForm.periodRange[0] + ' 至 ' + queryForm.periodRange[1] : '-' }}</el-descriptions-item>
              <el-descriptions-item label="加权平均单价">¥{{ selectedRow.avgPrice.toFixed(2) }}</el-descriptions-item>
              <el-descriptions-item label="期初数量">{{ selectedRow.openingQty }}</el-descriptions-item>
              <el-descriptions-item label="期初成本">¥{{ selectedRow.openingCost.toLocaleString() }}</el-descriptions-item>
              <el-descriptions-item label="本期入库数量">{{ selectedRow.inboundQty }}</el-descriptions-item>
              <el-descriptions-item label="本期入库成本">¥{{ selectedRow.inboundCost.toLocaleString() }}</el-descriptions-item>
              <el-descriptions-item label="本期出库数量">{{ selectedRow.outboundQty }}</el-descriptions-item>
              <el-descriptions-item label="本期出库成本">¥{{ selectedRow.outboundCost.toLocaleString() }}</el-descriptions-item>
              <el-descriptions-item label="期末结存数量">{{ selectedRow.closingQty }}</el-descriptions-item>
              <el-descriptions-item label="期末结存成本">¥{{ selectedRow.closingCost.toLocaleString() }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 明细表格滚动区 -->
          <div class="settlement-detail-table-wrapper">
            <el-table :data="ledgerEntries" style="width: 100%" :show-summary="false" :row-class="getRowClass">
              <el-table-column prop="date" label="日期" width="120">
                <template #default="{ row }">
                  <span v-if="row.rowType === 'carryover'" style="font-weight: bold; color: #409eff">上月结转</span>
                  <span v-else-if="row.rowType === 'monthly'" style="font-weight: bold">[本月合计]</span>
                  <span v-else-if="row.rowType === 'yearly'" style="font-weight: bold; color: #e6a23c">[本年累计]</span>
                  <span v-else>{{ row.date }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="docNo" label="单号" width="140">
                <template #default="{ row }">
                  <span v-if="row.rowType === 'carryover'">-</span>
                  <span v-else-if="row.rowType === 'monthly' || row.rowType === 'yearly'">-</span>
                  <span v-else>{{ row.docNo }}</span>
                </template>
              </el-table-column>
              
              <!-- 入库数据区域 -->
              <el-table-column label="入库数据" align="center">
                <el-table-column prop="inboundQty" label="数量" width="100" class-name="inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'" style="color: #67c23a; font-weight: bold">{{ row.inboundQty }}</span>
                    <span v-else-if="row.inboundQty > 0" style="color: #67c23a">{{ row.inboundQty }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="inboundUnitPrice" label="成本价" width="120" class-name="inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'" style="font-weight: bold">¥{{ (row.inboundUnitPrice || 0).toFixed(2) }}</span>
                    <span v-else-if="row.inboundQty > 0">¥{{ (row.inboundUnitPrice || 0).toFixed(2) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="inboundAmount" label="金额" width="120" class-name="inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'" style="font-weight: bold">¥{{ (row.inboundAmount || 0).toFixed(2) }}</span>
                    <span v-else-if="row.inboundQty > 0">¥{{ (row.inboundAmount || 0).toFixed(2) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>
              
              <!-- 出库数据区域 -->
              <el-table-column label="出库数据" align="center">
                <el-table-column prop="outboundQty" label="数量" width="100" class-name="outbound-col">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty > 0" style="color: #f56c6c">{{ row.outboundQty }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="outboundUnitPrice" label="成本价" width="120" class-name="outbound-col">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty > 0">¥{{ (row.outboundUnitPrice || 0).toFixed(2) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="outboundAmount" label="金额" width="120" class-name="outbound-col">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty > 0">¥{{ (row.outboundAmount || 0).toFixed(2) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>
              
              <!-- 库存结余区域 -->
              <el-table-column label="库存结余" align="center">
                <el-table-column prop="runningQty" label="库存数量" width="120" class-name="stock-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'" style="font-weight: bold">{{ row.runningQty }}</span>
                    <span v-else>{{ row.runningQty }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="costPrice" label="成本价" width="120" class-name="stock-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'" style="font-weight: bold">¥{{ (row.costPrice || 0).toFixed(2) }}</span>
                    <span v-else>¥{{ (row.costPrice || 0).toFixed(2) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="runningAmount" label="库存金额" width="140" class-name="stock-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'" style="font-weight: bold">¥{{ (row.runningAmount || 0).toFixed(2) }}</span>
                    <span v-else>¥{{ (row.runningAmount || 0).toFixed(2) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
              
              <el-table-column prop="counter" label="往来单位/供应商/客户" min-width="160">
                <template #default="{ row }">
                  <span v-if="row.rowType === 'carryover'">-</span>
                  <span v-else-if="row.rowType === 'yearly'" style="font-weight: bold; color: #e6a23c">本年累计</span>
                  <span v-else-if="row.rowType === 'monthly'">-</span>
                  <span v-else>{{ row.counter }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" min-width="160">
                <template #default="{ row }">
                  <span v-if="row.rowType === 'carryover'">-</span>
                  <span v-else-if="row.rowType === 'monthly' || row.rowType === 'yearly'">-</span>
                  <span v-else>{{ row.remark }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <!-- 底部关闭按钮固定区 -->
        <div class="settlement-detail-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { Search, RefreshLeft, Check, Back, Download, Printer, Close } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import exportToCsv from '../../utils/exportCsv'

// 查询表单
const queryForm = reactive({
  periodRange: [],
  productSearch: '',
  warehouse: ''
})

// 仓库列表
const warehouses = ref([
  { id: 1, name: '主仓库' },
  { id: 2, name: '备用仓库' },
  { id: 3, name: '临时仓库' }
])

// 结算数据列表
const settlementList = ref<any[]>([])
const allSettlementData = ref<any[]>([])

// 弹窗
const dialogVisible = ref(false)
const selectedRow = ref<any>(null)
const ledgerEntries = ref<any[]>([])

// 打开明细弹窗时禁止页面滚动
watch(dialogVisible, (v) => {
  try { document.body.style.overflow = v ? 'hidden' : '' } catch {}
})

// 统计
const totalQty = computed(() => {
  return settlementList.value.reduce((sum, row) => sum + Number(row.closingQty || 0), 0)
})

const totalCost = computed(() => {
  return settlementList.value.reduce((sum, row) => sum + Number(row.closingCost || 0), 0)
})



// 查询
const handleSearch = () => {
  const q = (queryForm.productSearch || '').toLowerCase()
  if (!q && !queryForm.warehouse) {
    settlementList.value = allSettlementData.value.slice()
    return
  }
  
  settlementList.value = allSettlementData.value.filter(item => {
    const matchProduct = !q || 
      (item.productCode || '').toLowerCase().includes(q) ||
      (item.productName || '').toLowerCase().includes(q)
    const matchWarehouse = !queryForm.warehouse || item.warehouseId === queryForm.warehouse
    return matchProduct && matchWarehouse
  })
}

// 重置
const handleReset = () => {
  queryForm.periodRange = []
  queryForm.productSearch = ''
  queryForm.warehouse = ''
  settlementList.value = []
  allSettlementData.value = []
}

// 开始计算
const handleCalculate = () => {
  if (!queryForm.periodRange || queryForm.periodRange.length !== 2) {
    ElMessage.warning('请选择会计期间（开始日期至结束日期）')
    return
  }
  loadSettlementData()
  ElMessage.success('成本计算完成')
}

// 反结算
const handleReverse = () => {
  if (!queryForm.periodRange || queryForm.periodRange.length !== 2) {
    ElMessage.warning('请选择会计期间（开始日期至结束日期）')
    return
  }
  
  const startDate = queryForm.periodRange[0]
  const endDate = queryForm.periodRange[1]
  
  ElMessageBox.confirm(`确定要反结算吗？这将删除${startDate}至${endDate}期间的结算数据`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    let settlements = JSON.parse(localStorage.getItem('cost_settlements') || '[]')
    settlements = settlements.filter((s: any) => {
      const periodStart = s.periodRange ? s.periodRange[0] : ''
      return periodStart !== startDate
    })
    localStorage.setItem('cost_settlements', JSON.stringify(settlements))
    
    allSettlementData.value = []
    settlementList.value = []
    ElMessage.success('反结算成功')
  }).catch(() => {})
}

// 导出 Excel
const handleExport = () => {
  if (settlementList.value.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }
  
  const columns = [
    { label: '商品编码', key: 'productCode' },
    { label: '商品名称', key: 'productName' },
    { label: '规格型号', key: 'specification' },
    { label: '单位', key: 'unit' },
    { label: '期初数量', key: 'openingQty' },
    { label: '期初成本', key: 'openingCost' },
    { label: '本期入库数量', key: 'inboundQty' },
    { label: '本期入库成本', key: 'inboundCost' },
    { label: '本期出库数量', key: 'outboundQty' },
    { label: '本期出库成本', key: 'outboundCost' },
    { label: '加权平均单价', key: 'avgPrice' },
    { label: '期末结存数量', key: 'closingQty' },
    { label: '期末结存成本', key: 'closingCost' }
  ]
  
  const filename = `成本结算_${queryForm.periodRange ? queryForm.periodRange[0] + '至' + queryForm.periodRange[1] : '全部'}.csv`
  exportToCsv(filename, columns, settlementList.value)
}

// 打印
const handlePrint = () => {
  if (settlementList.value.length === 0) {
    ElMessage.warning('没有可打印的数据')
    return
  }
  window.print()
}

// 获取行样式类名（财务账簿特殊行）
const getRowClass = (row: any) => {
  if (row.rowType === 'carryover') return 'carryover-row'
  if (row.rowType === 'opening') return 'opening-row'
  if (row.rowType === 'monthly') return 'monthly-row'
  if (row.rowType === 'yearly') return 'yearly-row'
  return ''
}

// 查看明细
const handleViewDetail = (row: any) => {
  selectedRow.value = row
  loadDetailData(row)
  dialogVisible.value = true
}

const handleOverlayClick = () => {
  dialogVisible.value = false
}

// 加载结算数据
const loadSettlementData = () => {
  if (!queryForm.periodRange || queryForm.periodRange.length !== 2) {
    ElMessage.warning('请选择会计期间（开始日期至结束日期）')
    return
  }
  
  const startDate = queryForm.periodRange[0]
  const endDate = queryForm.periodRange[1]
  
  // 获取期间范围
  const periodStart = new Date(startDate)
  const periodEnd = new Date(endDate)
  periodEnd.setDate(periodEnd.getDate() + 1) // 包含结束日期当天
  
  console.log('=== 成本结算调试信息 ===')
  console.log('会计期间:', startDate + ' 至 ' + endDate)
  console.log('期间开始:', periodStart.toISOString())
  console.log('期间结束:', periodEnd.toISOString())
  
  // 获取上期期末日期（用于获取期初数据）
  const previousPeriodEnd = new Date(periodStart)
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1)
  
  // 获取上期期间（用于查询上期期末数据）
  const previousPeriod = previousPeriodEnd.toISOString().slice(0, 7) // YYYY-MM
  
  console.log('上期期间:', previousPeriod)
  
  // 获取产品列表
  const products = JSON.parse(localStorage.getItem('products') || '[]')
  console.log('产品数量:', products.length)
  
  // 获取上期结算数据（作为本期期初）
  const allSettlements = JSON.parse(localStorage.getItem('cost_settlements') || '[]')
  const previousSettlements = allSettlements.filter((s: any) => {
    const periodEndStr = s.periodRange ? s.periodRange[1] : s.period
    return periodEndStr === previousPeriodEnd.toISOString().slice(0, 10)
  })
  console.log('上期结算数据数量:', previousSettlements.length)
  
// 参照实时库存查询的明细功能，遍历所有 localStorage 键来查找出入库记录
const periodInboundRecords: any[] = []  // 本期入库记录
const periodOutboundRecords: any[] = [] // 本期出库记录

console.log('=== 开始扫描 localStorage 中的出入库记录 ===')
console.log('会计期间:', startDate + ' 至 ' + endDate)

// 遍历 localStorage 中所有可能的数组
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i)
  if (!key) continue
  
  const raw = localStorage.getItem(key)
  if (!raw) continue
  
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) continue
    
    // 判断是入库还是出库 - 明确指定键名
    const inboundKeys = ['inbound_records', 'purchaseInbounds', 'inbounds', 'purchase_inbounds']
    const outboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'sales_outbounds', 'salesOutbounds', 'delivery_records']
    const returnsKeys = ['purchaseReturns', 'salesReturns', 'purchase_returns', 'sales_returns']
    
    let isInbound = false
    let isOutbound = false
    
    // 精确匹配键名
    if (inboundKeys.includes(key)) {
      isInbound = true
      console.log(`✓ 找到入库单数据：${key} (${arr.length} 条记录)`)
    } else if (outboundKeys.includes(key)) {
      isOutbound = true
      console.log(`✓ 找到出库单数据：${key} (${arr.length} 条记录)`)
    } else if (returnsKeys.includes(key) || key.toLowerCase().includes('return')) {
      isOutbound = true // 退货也作为出库处理
      console.log(`✓ 找到退货数据：${key} (${arr.length} 条记录)`)
    } else {
      continue // 跳过不相关的键
    }
    
    // 遍历每条记录
    let count = 0
    for (const rec of arr) {
      // 获取记录日期
      const recDateStr = rec.voucherDate || rec.orderDate || rec.date || rec.createdAt || ''
      if (!recDateStr) continue
      
      const recDate = new Date(recDateStr)
      const inRange = recDate >= periodStart && recDate < periodEnd
      
      if (!inRange) continue
      
      // 获取 items 数组
      const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
      if (!Array.isArray(items)) continue
      
      // 遍历每个产品项
      for (const it of items) {
        const productCode = String(it.productCode || it.code || it.sku || '').trim()
        const productName = String(it.productName || it.name || '').trim()
        const productId = it.productId || it.id || null
        const qty = Number(it.quantity || it.qty || it.count || it.num || 0)
        const unitPriceInc = Number(it.unitPriceInc || it.unitPriceTaxIncluded || it.priceWithTax || it.unitPrice || it.price || 0)
        const entryAmount = Number((qty * unitPriceInc).toFixed(2))
        
        const record = {
          productCode,
          productName,
          productId,
          voucherNo: rec.voucherNo || rec.orderNo || rec.number || rec.no || '',
          voucherDate: recDateStr,
          quantity: qty,
          unitPriceInc,
          amount: entryAmount,
          supplierName: rec.supplierName || rec.supplier || '',
          customerName: rec.customerName || rec.customer || '',
          remark: rec.remark || rec.note || ''
        }
        
        if (isInbound) {
          periodInboundRecords.push(record)
          count++
        } else if (isOutbound) {
          periodOutboundRecords.push(record)
          count++
        }
      }
    }
    
    if (count > 0) {
      console.log(`  → 在期间内找到 ${count} 个产品项`)
    }
  } catch (e) {
    // 忽略解析错误
    console.warn(`解析 ${key} 失败:`, e)
  }
}

console.log(`=== 成本结算数据获取结果 ===`)
console.log(`会计期间：${startDate} 至 ${endDate}`)
console.log(`期间开始：${periodStart.toISOString()}`)
console.log(`期间结束：${periodEnd.toISOString()}`)
console.log(`本期入库记录总数：${periodInboundRecords.length}`)
console.log(`本期出库记录总数：${periodOutboundRecords.length}`)

// 打印示例数据
if (periodInboundRecords.length > 0) {
  console.log('=== 入库记录示例 ===')
  console.log(JSON.stringify(periodInboundRecords[0], null, 2))
}
if (periodOutboundRecords.length > 0) {
  console.log('=== 出库记录示例 ===')
  console.log(JSON.stringify(periodOutboundRecords[0], null, 2))
}
  
  // 为每个产品计算成本结算
  const settlements: any[] = []
  
  products.forEach((product: any) => {
    // ========== 1. 期初数据（来自上期期末）==========
    const previousRecord = previousSettlements.find((s: any) => s.productCode === product.code)
    const openingQty = previousRecord ? Number(previousRecord.closingQty || 0) : 0
    const openingCost = previousRecord ? Number(previousRecord.closingCost || 0) : 0
    
    // ========== 2. 本期入库数据（当前会计期间）==========
    const inboundRecords = periodInboundRecords.filter((rec: any) => {
      return rec.productCode === product.code || rec.productId === product.id
    })
    
    // ========== 3. 本期出库数据（当前会计期间）==========
    const outboundRecords = periodOutboundRecords.filter((rec: any) => {
      return rec.productCode === product.code || rec.productId === product.id
    })
    
    // ========== 4. 计算本期入库数量和成本==========
    let inboundQty = 0
    let inboundCost = 0
    
    inboundRecords.forEach((rec: any) => {
      const quantity = Number(rec.quantity || 0)
      const unitPrice = Number(rec.unitPriceInc || 0)
      const totalAmount = quantity * unitPrice
      
      inboundQty += quantity
      inboundCost += totalAmount
    })
    
    // ========== 5. 计算加权平均单价==========
    // 加权平均单价 = (期初成本 + 本期入库成本) / (期初数量 + 本期入库数量)
    const totalAvailableQty = openingQty + inboundQty
    const totalAvailableCost = openingCost + inboundCost
    const avgPrice = totalAvailableQty > 0 ? totalAvailableCost / totalAvailableQty : 0
    
    // ========== 6. 计算本期出库成本==========
    let outboundQty = 0
    let outboundCost = 0
    
    outboundRecords.forEach((rec: any) => {
      const quantity = Number(rec.quantity || 0)
      outboundQty += quantity
      outboundCost += quantity * avgPrice
    })
    
    // ========== 7. 期末结存==========
    // 期末数量 = 期初数量 + 本期入库数量 - 本期出库数量
    const closingQty = totalAvailableQty - outboundQty
    // 期末成本 = 期末数量 × 加权平均单价
    const closingCost = closingQty * avgPrice
    
    settlements.push({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      specification: product.specification || '',
      unit: product.unit || '',
      warehouseId: product.warehouseId || 1,
      periodRange: [startDate, endDate],
      // 期初数据
      openingQty,
      openingCost,
      // 本期入库
      inboundQty,
      inboundCost,
      // 本期出库
      outboundQty,
      outboundCost,
      // 加权平均
      avgPrice,
      // 期末结存
      closingQty,
      closingCost
    })
  })
  
  // 保存到 localStorage
  const existingSettlements = JSON.parse(localStorage.getItem('cost_settlements') || '[]')
  const filteredSettlements = existingSettlements.filter((s: any) => {
    const periodStartStr = s.periodRange ? s.periodRange[0] : s.period
    return periodStartStr !== startDate
  })
  filteredSettlements.push(...settlements)
  localStorage.setItem('cost_settlements', JSON.stringify(filteredSettlements))
  
  allSettlementData.value = settlements
  settlementList.value = settlements
}

// 加载明细数据（财务账簿规则）
const loadDetailData = (row: any) => {
  ledgerEntries.value = []
  
  // 获取期间范围
  const periodStart = row.periodRange && row.periodRange.length === 2 
    ? new Date(row.periodRange[0]) 
    : new Date('1970-01-01')
  const periodEnd = row.periodRange && row.periodRange.length === 2
    ? new Date(row.periodRange[1])
    : new Date('2099-12-31')
  periodEnd.setDate(periodEnd.getDate() + 1) // 包含结束日期当天
  
  const productCode = String(row.productCode || '').trim()
  const productId = row.productId || null
  
  // 获取期初数据（上个月月末结存）
  const openingQty = Number(row.openingQty || 0)
  const openingCost = Number(row.openingCost || 0)
  const openingPrice = openingQty > 0 ? openingCost / openingQty : 0
  
  // 获取期初日期（期间开始日期的前一天）
  const openingDate = new Date(periodStart)
  openingDate.setDate(openingDate.getDate() - 1)
  const openingDateStr = openingDate.toISOString().slice(0, 10)
  
  // 按月份分组存储数据
  const monthlyData = new Map<string, any[]>()
  
  // 遍历 localStorage 获取所有出入库记录
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    
    const raw = localStorage.getItem(key)
    if (!raw) continue
    
    try {
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) continue
      
      // 判断是入库还是出库
      const inboundKeys = ['inbound_records', 'purchaseInbounds', 'inbounds', 'purchase_inbounds']
      const outboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'sales_outbounds', 'salesOutbounds', 'delivery_records']
      const returnsKeys = ['purchaseReturns', 'salesReturns', 'purchase_returns', 'sales_returns']
      
      let isInbound = false
      let isOutbound = false
      
      if (inboundKeys.includes(key) || key.toLowerCase().includes('inbound')) {
        isInbound = true
      } else if (outboundKeys.includes(key) || (key.toLowerCase().includes('outbound') && !key.toLowerCase().includes('return')) || key.toLowerCase().includes('delivery')) {
        isOutbound = true
      } else if (returnsKeys.includes(key) || key.toLowerCase().includes('return')) {
        isOutbound = true
      } else {
        continue
      }
      
      // 遍历每条记录
      for (const rec of arr) {
        const recDateStr = rec.voucherDate || rec.orderDate || rec.date || rec.createdAt || ''
        if (!recDateStr) continue
        
        const recDate = new Date(recDateStr)
        const inRange = recDate >= periodStart && recDate < periodEnd
        
        if (!inRange) continue
        
        const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
        if (!Array.isArray(items)) continue
        
        // 遍历每个产品项
        for (const it of items) {
          const itCode = String(it.productCode || it.code || it.sku || '').trim()
          const itId = it.productId || it.id || null
          
          const match = (itId && productId && itId === productId) || (itCode && productCode && itCode === productCode)
          if (!match) continue
          
          const quantity = Number(it.quantity || it.qty || it.count || it.num || 0)
          const unitPriceInc = Number(it.unitPriceInc || it.unitPriceTaxIncluded || it.priceWithTax || it.unitPrice || it.price || 0)
          const unitPriceExc = Number(it.unitPriceExc || it.unitPriceTaxExcluded || it.priceWithoutTax || 0)
          
          // 获取发票类型和加计扣除状态
          const invoiceType = rec.invoiceType || rec.invoice_type || 'none' // 'special', 'general', 'none'
          const isAgricultural = rec.isAgricultural || rec.is_agricultural || false
          const isDeduction = rec.isDeduction || rec.is_deduction || it.isDeduction || it.is_deduction || false
          
          // 入库成本价提取规则
          let inboundCostPrice = 0
          if (isInbound) {
            // 规则：专票或加计扣除打开 → 单价（不含税），否则 → 单价（含税）
            if (invoiceType === 'special' || (isAgricultural && isDeduction)) {
              inboundCostPrice = unitPriceExc > 0 ? unitPriceExc : unitPriceInc / 1.09
            } else {
              inboundCostPrice = unitPriceInc
            }
          }
          
          const counter = rec.counterName || rec.supplierName || rec.customerName || rec.companyName || ''
          const docNo = rec.voucherNo || rec.orderNo || rec.number || rec.no || ''
          const dateStr = recDateStr.slice(0, 10)
          
          // 获取月份键（YYYY-MM）
          const monthKey = dateStr.slice(0, 7)
          
          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, [])
          }
          
          // 推断单据类型
          let typeLabel = key
          if (inboundKeys.includes(key) || key.toLowerCase().includes('inbound')) { 
            typeLabel = '入库'
          }
          else if (outboundKeys.includes(key) || (key.toLowerCase().includes('outbound') && !key.toLowerCase().includes('return')) || key.toLowerCase().includes('delivery')) { 
            typeLabel = '出库'
          }
          else if (returnsKeys.includes(key) || key.toLowerCase().includes('return')) { 
            typeLabel = '退货'
          }

          const entry = {
            date: dateStr,
            type: typeLabel,  // 单据类型
            docNo,
            inboundQty: 0,
            inboundUnitPrice: 0,
            inboundAmount: 0,
            outboundQty: 0,
            outboundUnitPrice: 0,
            outboundAmount: 0,
            counter,
            remark: rec.remark || '',
            monthKey,
            invoiceType,
            isAgricultural,
            isDeduction,
            unitPriceInc,
            unitPriceExc
          }
          
          if (isInbound) {
            entry.inboundQty = quantity
            entry.inboundUnitPrice = inboundCostPrice
            entry.inboundAmount = quantity * inboundCostPrice
          } else if (isOutbound) {
            entry.outboundQty = quantity
            // 出库成本价将在后续处理时从上一行库存结余获取
            entry.outboundUnitPrice = 0
            entry.outboundAmount = 0
          }
          
          monthlyData.get(monthKey)!.push(entry)
        }
      }
    } catch (e) {
      // 忽略解析错误
    }
  }
  
  // 按月份排序
  const sortedMonths = Array.from(monthlyData.keys()).sort()
  
  // 构建最终的明细账（财务账簿格式）
  let runningQty = openingQty
  let runningCost = openingCost
  let yearlyInboundQty = 0
  let yearlyInboundAmount = 0
  let yearlyOutboundQty = 0
  let yearlyOutboundAmount = 0
  
  // 添加第一个月的期初数据
  if (sortedMonths.length > 0) {
    const firstMonth = sortedMonths[0]
    const openingEntry = {
      rowType: 'carryover' as const,
      date: openingDateStr,
      type: '期初',  // 单据类型
      docNo: '',
      inboundQty: openingQty,
      inboundUnitPrice: openingPrice,
      inboundAmount: openingCost,
      outboundQty: 0,
      outboundUnitPrice: 0,
      outboundAmount: 0,
      counter: '',
      remark: '',
      runningQty: openingQty,
      runningAmount: openingCost,
      costPrice: openingPrice,
      monthKey: firstMonth
    }
    ledgerEntries.value.push(openingEntry)
  }
  
  // 逐月处理
  sortedMonths.forEach((monthKey, monthIndex) => {
    const entries = monthlyData.get(monthKey)!
    
    // 按日期排序，入库在前，出库在后
    entries.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      // 同一天：入库在前（inboundQty > 0），出库在后
      if (a.inboundQty > 0 && b.outboundQty > 0) return -1
      if (a.outboundQty > 0 && b.inboundQty > 0) return 1
      return 0
    })
    
    // 本月合计
    let monthlyInboundQty = 0
    let monthlyInboundAmount = 0
    let monthlyOutboundQty = 0
    let monthlyOutboundAmount = 0
    
    // 处理当月每条记录
    entries.forEach(entry => {
      if (entry.inboundQty > 0) {
        // 入库：更新库存数量和成本
        runningQty += entry.inboundQty
        runningCost += entry.inboundAmount
        monthlyInboundQty += entry.inboundQty
        monthlyInboundAmount += entry.inboundAmount
        yearlyInboundQty += entry.inboundQty
        yearlyInboundAmount += entry.inboundAmount
      }
      
      if (entry.outboundQty > 0) {
        // 出库：成本价从上一行库存结余获取
        const previousCostPrice = runningQty > 0 ? runningCost / runningQty : 0
        entry.outboundUnitPrice = previousCostPrice
        entry.outboundAmount = entry.outboundQty * previousCostPrice
        
        // 更新库存数量和成本
        runningQty -= entry.outboundQty
        runningCost -= entry.outboundAmount
        monthlyOutboundQty += entry.outboundQty
        monthlyOutboundAmount += entry.outboundAmount
        yearlyOutboundQty += entry.outboundQty
        yearlyOutboundAmount += entry.outboundAmount
      }
      
      // 计算当前行的库存结余成本价
      const costPrice = runningQty > 0 ? runningCost / runningQty : 0
      entry.runningQty = runningQty
      entry.runningAmount = runningCost
      entry.costPrice = costPrice
      
      ledgerEntries.value.push(entry)
    })
    
    // 添加本月合计行
    const monthlyEntry = {
      rowType: 'monthly' as const,
      date: '[本月合计]',
      type: '',  // 单据类型留空
      docNo: '',
      inboundQty: monthlyInboundQty,
      inboundUnitPrice: monthlyInboundQty > 0 ? monthlyInboundAmount / monthlyInboundQty : 0,
      inboundAmount: monthlyInboundAmount,
      outboundQty: monthlyOutboundQty,
      outboundUnitPrice: monthlyOutboundQty > 0 ? monthlyOutboundAmount / monthlyOutboundQty : 0,
      outboundAmount: monthlyOutboundAmount,
      counter: '',
      remark: '',
      runningQty,
      runningAmount: runningCost,
      costPrice: runningQty > 0 ? runningCost / runningQty : 0,
      monthKey
    }
    ledgerEntries.value.push(monthlyEntry)
    
    // 添加本年累计行（每个月都添加）
    const yearlyEntry = {
      rowType: 'yearly' as const,
      date: '[本年累计]',
      type: '',  // 单据类型留空
      docNo: '',
      inboundQty: yearlyInboundQty,
      inboundUnitPrice: yearlyInboundQty > 0 ? yearlyInboundAmount / yearlyInboundQty : 0,
      inboundAmount: yearlyInboundAmount,
      outboundQty: yearlyOutboundQty,
      outboundUnitPrice: yearlyOutboundQty > 0 ? yearlyOutboundAmount / yearlyOutboundQty : 0,
      outboundAmount: yearlyOutboundAmount,
      counter: '',
      remark: '',
      runningQty: 0,  // 本年累计不显示库存结余
      runningAmount: 0,
      costPrice: 0,
      monthKey
    }
    ledgerEntries.value.push(yearlyEntry)
  })
  
  console.log('明细数据加载完成，共', ledgerEntries.value.length, '条记录')
}
</script>

<style scoped>
.cost-settlement-page { 
  padding: 20px; 
}

.toolbar { 
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.summary-bar {
  display: flex;
  justify-content: flex-end;
  gap: 40px;
  margin-top: 20px;
  padding: 15px 20px;
  background: #f5f7fa;
  border-radius: 4px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-label {
  font-size: 14px;
  color: #606266;
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

/* ==================== 遮罩层 ==================== */
.settlement-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ==================== 弹窗主体 ==================== */
.settlement-detail-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 85vw;
  min-width: 1400px;
  height: 90vh;
  min-height: 800px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ==================== ① 头部固定区 ==================== */
.settlement-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.settlement-detail-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.settlement-detail-close {
  font-size: 18px;
  color: #909399;
  cursor: pointer;
  transition: color 0.3s;
}

.settlement-detail-close:hover {
  color: #606266;
}

/* ==================== 弹窗主体内容区 ==================== */
.settlement-detail-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

/* ==================== ② 商品基础信息固定区 ==================== */
.settlement-detail-info {
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

/* ==================== ③ 明细表格滚动区 ==================== */
.settlement-detail-table-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  background: #fff;
}

/* 滚动条样式（与 Element Plus 统一） */
.settlement-detail-table-wrapper::-webkit-scrollbar {
  width: 8px;
}

.settlement-detail-table-wrapper::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.settlement-detail-table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #a8abb2;
}

.settlement-detail-table-wrapper::-webkit-scrollbar-track {
  background: #f5f7fa;
}

/* 财务账簿特殊行样式 */
:deep(.el-table) .el-table__row {
  transition: background-color 0.2s;
}

:deep(.el-table) .el-table__row.carryover-row {
  background-color: #f0f0f0 !important;
  font-weight: bold;
}

:deep(.el-table) .el-table__row.opening-row {
  background-color: #e6f7ff !important;
}

:deep(.el-table) .el-table__row.monthly-row {
  background-color: #f0f0f0 !important;
  font-weight: bold;
}

:deep(.el-table) .el-table__row.yearly-row {
  background-color: #fff1f0 !important;
  font-weight: bold;
}

:deep(.el-table) .el-table__row.carryover-row .cell {
  color: #606266;
  font-weight: bold;
}

:deep(.el-table) .el-table__row.opening-row .cell {
  color: #409eff;
}

:deep(.el-table) .el-table__row.monthly-row .cell {
  color: #606266;
  font-weight: bold;
}

:deep(.el-table) .el-table__row.yearly-row .cell {
  color: #f56c6c;
}

/* ==================== 底部关闭按钮固定区 ==================== */
.settlement-detail-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
}

/* 入库列样式 */
:deep(.inbound-col) {
  background-color: #f0f9eb;
}

:deep(.inbound-col .cell) {
  color: #67c23a;
}

/* 入库列在特殊行中不显示背景色 */
:deep(.carryover-row .inbound-col),
:deep(.monthly-row .inbound-col),
:deep(.yearly-row .inbound-col) {
  background-color: transparent !important;
}

/* 出库列样式 */
:deep(.outbound-col) {
  background-color: #fef0f0;
}

:deep(.outbound-col .cell) {
  color: #f56c6c;
}

/* 出库列在特殊行中不显示背景色 */
:deep(.carryover-row .outbound-col),
:deep(.monthly-row .outbound-col),
:deep(.yearly-row .outbound-col) {
  background-color: transparent !important;
}

/* 库存结余列样式 */
:deep(.stock-col) {
  background-color: #ecf5ff;
}

:deep(.stock-col .cell) {
  color: #409eff;
  font-weight: 500;
}

/* 库存结余列在特殊行中不显示背景色 */
:deep(.carryover-row .stock-col),
:deep(.monthly-row .stock-col),
:deep(.yearly-row .stock-col) {
  background-color: transparent !important;
}
</style>
