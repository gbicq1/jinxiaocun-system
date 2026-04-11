<template>
  <div class="cost-settlement-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="query-form">
        <el-form :inline="true" :model="queryForm" size="default">
          <el-form-item label="会计期间" prop="periodRange">
            <el-date-picker
              v-model="queryForm.periodRange"
              type="month"
              placeholder="选择月份"
              value-format="YYYY-MM"
              :shortcuts="dateRangeShortcuts"
            />
          </el-form-item>
          <el-form-item label="产品" prop="productSearch">
            <el-input
              v-model="queryForm.productSearch"
              placeholder="搜索产品编码/名称"
              clearable
              style="width: 200px"
              :prefix-icon="Search"
            />
          </el-form-item>
          <el-form-item label="仓库" prop="warehouse">
            <el-select
              v-model="queryForm.warehouse"
              placeholder="请选择仓库"
              clearable
              style="width: 150px"
              :prefix-icon="OfficeBuilding"
            >
              <el-option
                v-for="warehouse in warehouses"
                :key="warehouse.id"
                :label="warehouse.name"
                :value="warehouse.id"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <div class="action-buttons">
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        <el-button type="success" :icon="Check" @click="handleCalculate">开始计算</el-button>
        <el-button type="warning" :icon="RefreshLeft" @click="handleReverse">反结算</el-button>
        <el-button type="danger" :icon="InfoFilled" @click="handleInitialize">初始化</el-button>
        <el-button type="info" :icon="Download" @click="handleExport">导出</el-button>
        <el-button :icon="Printer" @click="handlePrint">打印</el-button>
      </div>
    </div>

    <!-- 成本结算汇总 -->
    <div class="print-area" id="printSettlement">
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span>成本结算汇总表</span>
            <span class="period-label">{{ queryForm.periodRange ? queryForm.periodRange + ' 月份' : '' }}</span>
          </div>
        </template>
        <el-table
          :data="settlementList"
          stripe
          border
          style="width: 100%"
          :header-cell-style="{ backgroundColor: '#f5f7fa', color: '#606266' }"
          @row-click="handleViewDetail"
          show-summary
          :summary-method="getSettlementSummary"
          id="settlementTable"
        >
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="productCode" label="商品编码" width="120" min-width="100" />
          <el-table-column prop="productName" label="商品名称" min-width="180" show-overflow-tooltip />
          <el-table-column prop="specification" label="规格型号" width="120" min-width="100" />
          <el-table-column prop="unit" label="单位" width="80" min-width="60" />
          <el-table-column prop="warehouseName" label="仓库" width="120" min-width="100" />
          <el-table-column label="期初数据" align="center">
            <el-table-column prop="openingQty" label="数量" width="100" min-width="80" align="right">
              <template #default="{ row }">{{ formatNum(row.openingQty) }}</template>
            </el-table-column>
            <el-table-column prop="openingCost" label="成本(元)" width="120" min-width="100" align="right">
              <template #default="{ row }">{{ formatMoney(row.openingCost) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="本期入库" align="center">
            <el-table-column prop="inboundQty" label="数量" width="100" min-width="80" align="right">
              <template #default="{ row }">{{ formatNum(row.inboundQty) }}</template>
            </el-table-column>
            <el-table-column prop="inboundUnitPrice" label="单价(元)" width="110" min-width="90" align="right">
              <template #default="{ row }">{{ formatMoney(row.inboundUnitPrice) }}</template>
            </el-table-column>
            <el-table-column prop="inboundCost" label="金额(元)" width="120" min-width="100" align="right">
              <template #default="{ row }">{{ formatMoney(row.inboundCost) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="本期出库" align="center">
            <el-table-column prop="outboundQty" label="数量" width="100" min-width="80" align="right">
              <template #default="{ row }">{{ formatNum(row.outboundQty) }}</template>
            </el-table-column>
            <el-table-column prop="outboundCost" label="金额(元)" width="120" min-width="100" align="right">
              <template #default="{ row }">{{ formatMoney(row.outboundCost) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="加权平均" align="center">
            <el-table-column prop="avgCost" label="单价(元)" width="120" min-width="100" align="right">
              <template #default="{ row }">{{ formatMoney(row.avgCost) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="期末结存" align="center">
            <el-table-column prop="closingQty" label="数量" width="100" min-width="80" align="right">
              <template #default="{ row }">
                <span :class="{ 'negative-qty': row.closingQty < 0 }">{{ formatNum(row.closingQty) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="closingUnitPrice" label="单价(元)" width="110" min-width="90" align="right">
              <template #default="{ row }">{{ formatMoney(row.closingUnitPrice || row.avgCost) }}</template>
            </el-table-column>
            <el-table-column prop="closingCost" label="结余金额(元)" width="130" min-width="110" align="right">
              <template #default="{ row }">{{ formatMoney(row.closingCost) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right" align="center">
            <template #default="{ row }">
              <el-button type="primary" size="small" link @click.stop="handleViewDetail(row)">明细</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-label">合计结存数量:</span>
            <span class="summary-value">{{ totalQty }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">合计结存成本:</span>
            <span class="summary-value">¥{{ totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 成本结算明细弹窗 -->
    <div v-if="dialogVisible" class="settlement-detail-overlay" @click.self="handleOverlayClick">
      <div class="settlement-detail-dialog">
        <div class="settlement-detail-header">
          <div class="settlement-detail-title">成本结算明细 - {{ selectedRow?.productName }}</div>
          <div class="settlement-detail-close" @click="handleOverlayClick">
            <Close />
          </div>
        </div>

        <div v-if="selectedRow" class="settlement-detail-body">
          <div class="settlement-detail-info">
            <el-descriptions :column="4" border size="default">
              <el-descriptions-item label="商品编码">{{ selectedRow.productCode }}</el-descriptions-item>
              <el-descriptions-item label="商品名称">{{ selectedRow.productName }}</el-descriptions-item>
              <el-descriptions-item label="规格型号">{{ selectedRow.specification || '-' }}</el-descriptions-item>
              <el-descriptions-item label="单位">{{ selectedRow.unit || '-' }}</el-descriptions-item>
              <el-descriptions-item label="仓库">{{ selectedRow.warehouseName }}</el-descriptions-item>
              <el-descriptions-item label="会计期间">{{ queryForm.periodRange || '-' }}</el-descriptions-item>
              <el-descriptions-item label="期初数量">{{ formatNum(selectedRow.openingQty) }}</el-descriptions-item>
              <el-descriptions-item label="期初成本">{{ formatMoney(selectedRow.openingCost) }} 元</el-descriptions-item>
              <el-descriptions-item label="本期入库数量">{{ formatNum(selectedRow.inboundQty) }}</el-descriptions-item>
              <el-descriptions-item label="本期入库成本">{{ formatMoney(selectedRow.inboundCost) }} 元</el-descriptions-item>
              <el-descriptions-item label="本期出库数量">{{ formatNum(selectedRow.outboundQty) }}</el-descriptions-item>
              <el-descriptions-item label="本期出库成本">{{ formatMoney(selectedRow.outboundCost) }} 元</el-descriptions-item>
              <el-descriptions-item label="期末结存数量">
                <span :class="{ 'negative-qty': selectedRow.closingQty < 0 }">{{ formatNum(selectedRow.closingQty) }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="期末结存成本">{{ formatMoney(selectedRow.closingCost) }} 元</el-descriptions-item>
              <el-descriptions-item label="加权平均单价">{{ formatMoney(selectedRow.avgCost) }} 元</el-descriptions-item>
            </el-descriptions>
          </div>

          <div class="settlement-detail-table-wrapper">
            <el-table
              :data="ledgerEntries"
              style="width: 100%; min-width: 1200px"
              :height="'100%'"
              border
              :header-cell-style="{ backgroundColor: '#f5f7fa', color: '#606266' }"
            >
              <el-table-column type="index" label="序号" width="50" align="center" />
              <el-table-column prop="date" label="日期" width="110" min-width="90" />
              <el-table-column prop="docNo" label="单号" width="160" min-width="130" show-overflow-tooltip />
              <el-table-column prop="type" label="类型" width="110" min-width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.type === 'opening' ? 'info' : row.type === 'monthly' || row.type === 'yearly' ? 'primary' : getDocTypeTagType(row.type)">
                    {{ row.type === 'opening' ? '期初' : row.type === 'monthly' ? '本月合计' : row.type === 'yearly' ? '本年累计' : getDocTypeName(row.type) }}
                  </el-tag>
                </template>
              </el-table-column>

              <el-table-column label="入库" align="center">
                <el-table-column prop="inboundQty" label="数量" width="90" min-width="70" align="right">
                  <template #default="{ row }">
                    <span v-if="row.inboundQty !== 0" :class="{ 'text-inbound': row.inboundQty > 0, 'text-outbound': row.inboundQty < 0 }">{{ formatNum(row.inboundQty) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="inboundPrice" label="单价" width="90" min-width="70" align="right">
                  <template #default="{ row }">
                    <span v-if="row.inboundQty !== 0">{{ formatMoney(row.inboundPrice) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="inboundAmount" label="金额" width="110" min-width="90" align="right">
                  <template #default="{ row }">
                    <span v-if="row.inboundQty !== 0" :class="{ 'text-inbound': row.inboundAmount > 0, 'text-outbound': row.inboundAmount < 0 }">{{ formatMoney(row.inboundAmount) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <el-table-column label="出库" align="center">
                <el-table-column prop="outboundQty" label="数量" width="90" min-width="70" align="right">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty !== 0" :class="{ 'text-outbound': row.outboundQty > 0, 'text-inbound': row.outboundQty < 0 }">{{ formatNum(row.outboundQty) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="outboundPrice" label="单价" width="90" min-width="70" align="right">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty !== 0">{{ formatMoney(row.outboundPrice) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="outboundAmount" label="金额" width="110" min-width="90" align="right">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty !== 0" :class="{ 'text-outbound': row.outboundAmount > 0, 'text-inbound': row.outboundAmount < 0 }">{{ formatMoney(row.outboundAmount) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <el-table-column label="库存结余" align="center">
                <el-table-column prop="balanceQty" label="数量" width="100" min-width="80" align="right">
                  <template #default="{ row }">
                    <span :class="{ 'negative-qty': row.balanceQty < 0 }">{{ formatNum(row.balanceQty) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="balanceUnitPrice" label="单价" width="90" min-width="70" align="right">
                  <template #default="{ row }">{{ formatMoney(row.balanceUnitPrice) }}</template>
                </el-table-column>
                <el-table-column label="结余金额" width="120" min-width="100" align="right">
                  <template #default="{ row }">{{ formatMoney(row.balanceAmount) }}</template>
                </el-table-column>
              </el-table-column>

              <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">
                  <span>{{ row.remark || '-' }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <div class="settlement-detail-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="handlePrintDetail">打印明细</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { Search, RefreshLeft, Check, Download, Printer, Close, Refresh, InfoFilled } from '@element-plus/icons-vue'
import { OfficeBuilding } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import exportToCsv from '../../utils/exportCsv'
import { getCostSettlementList } from '@/api/cost'
import { db } from '@/utils/db-ipc'

const queryForm = reactive({
  periodRange: '' as string,
  productSearch: '',
  warehouse: ''
})

const warehouses = ref<any[]>([])
const settlementList = ref<any[]>([])
const dialogVisible = ref(false)
const selectedRow = ref<any>(null)
const ledgerEntries = ref<any[]>([])

const dateRangeShortcuts = [
  {
    text: '本月',
    value: () => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }
  },
  {
    text: '上月',
    value: () => {
      const now = new Date()
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      return `${prevYear}-${String(prevMonth).padStart(2, '0')}`
    }
  }
]

const totalQty = computed(() => settlementList.value.reduce((sum, row) => sum + (Number(row.closingQty) || 0), 0))
const totalCost = computed(() => settlementList.value.reduce((sum, row) => sum + (Number(row.closingCost) || 0), 0))

function formatNum(val: any): string {
  const n = Number(val || 0)
  if (n === 0) return '0'
  return n.toFixed(n % 1 === 0 ? 0 : 2)
}

function formatMoney(val: any): string {
  const n = Number(val || 0)
  return n.toFixed(2)
}

function getDocTypeName(type: string): string {
  const map: Record<string, string> = {
    purchase_inbound: '采购入库',
    sales_outbound: '销售出库',
    purchase_return: '采购退货',
    sales_return: '销售退货'
  }
  return map[type] || type || '-'
}

function getDocTypeTagType(type: string): string {
  const map: Record<string, string> = {
    purchase_inbound: 'success',
    sales_outbound: 'danger',
    purchase_return: 'warning',
    sales_return: 'info'
  }
  return map[type] || 'info'
}

function getSettlementSummary(param: any) {
  const columns = param.columns
  const sums: string[] = []
  columns.forEach((col: any, index: number) => {
    if (index === 0) {
      sums[index] = '合计'
      return
    }
    if (col.property === 'avgCost' || col.property === 'inboundUnitPrice' || col.property === 'closingUnitPrice') {
      const totalCostVal = settlementList.value.reduce((s, r) => s + (Number(r.closingCost) || 0), 0)
      const totalQtyVal = settlementList.value.reduce((s, r) => s + (Number(r.closingQty) || 0), 0)
      sums[index] = totalQtyVal > 0 ? (totalCostVal / totalQtyVal).toFixed(2) : '0.00'
      return
    }
    const prop = col.property
    const values = settlementList.value.map(item => Number(item[prop] || 0))
    if (['openingQty', 'inboundQty', 'outboundQty', 'closingQty'].includes(prop)) {
      sums[index] = values.reduce((a, b) => a + b, 0).toFixed(0)
    } else {
      sums[index] = values.reduce((a, b) => a + b, 0).toFixed(2)
    }
  })
  return sums
}

const loadWarehouses = async () => {
  try {
    warehouses.value = await db.getWarehouses()
  } catch (error) {
    console.error('加载仓库列表失败:', error)
  }
}

const handleSearch = async () => {
  if (!queryForm.periodRange) {
    ElMessage.warning('请选择会计期间')
    return
  }

  try {
    ElMessage.info('正在查询成本结算数据...')

    const settlementResult = await getCostSettlementList({
      periodRange: queryForm.periodRange,
      productSearch: queryForm.productSearch,
      warehouseId: queryForm.warehouse
    })

    settlementList.value = settlementResult?.success ? (settlementResult.data || []) : []

    ElMessage.success(`查询成功，共 ${settlementList.value.length} 条记录`)
  } catch (error) {
    console.error('查询数据失败:', error)
    ElMessage.error('查询失败')
  }
}

const handleReset = () => {
  queryForm.periodRange = ''
  queryForm.productSearch = ''
  queryForm.warehouse = ''
  settlementList.value = []
}

const handleCalculate = async () => {
  if (!queryForm.periodRange) {
    ElMessage.warning('请选择会计期间')
    return
  }

  const [year, month] = queryForm.periodRange.split('-').map(Number)

  try {
    await ElMessageBox.confirm(
      `确定要对 ${year}年${month}月 进行成本结算吗？\n\n注意：\n1. 如果该期间已结算，将被覆盖\n2. 请确保期间内的所有单据已录入完成`,
      '开始计算',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )

    ElMessage.info('正在计算成本数据，请稍候...')
    const result = await db.initializeCostData({ year, month })

    if (result.success) {
      ElMessage.success(`结算完成，共处理 ${result.count || 0} 条记录`)
      handleSearch()
    } else {
      ElMessage.error(result.message || '结算失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('结算失败:', error)
      ElMessage.error('结算失败')
    }
  }
}

const handleReverse = async () => {
  if (!queryForm.periodRange) {
    ElMessage.warning('请选择会计期间')
    return
  }

  const [year, month] = queryForm.periodRange.split('-').map(Number)

  try {
    await ElMessageBox.confirm(
      `确定要反结算 ${year}年${month}月 吗？\n\n反结算后将删除该月的锁定状态和统计数据，可以重新修改单据后再次结算。`,
      '反结算',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )

    const result = await db.reverseCostSettlement({ year, month })
    if (result.success) {
      ElMessage.success(result.message || '反结算成功')
      handleSearch()
    } else {
      ElMessage.error(result.message || '反结算失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('反结算失败:', error)
      ElMessage.error('反结算失败')
    }
  }
}

const handleInitialize = async () => {
  try {
    await ElMessageBox.confirm(
      '初始化成本数据将从系统启用时的第一笔单据开始，全面计算所有产品和仓库的库存结余。\n\n注意：\n1. 此操作会覆盖现有的初始化数据\n2. 如果数据量较大，可能需要几分钟时间\n3. 建议在首次使用或数据不完整时使用\n\n确定要继续吗？',
      '初始化成本数据',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )

    ElMessage.info('正在初始化成本数据，请稍候...')
    const result = await db.initializeAllHistory()

    if (result.success) {
      ElMessage.success(result.message || `初始化完成，共处理 ${result.settledMonths || 0} 个月份`)
    } else {
      ElMessage.error(result.message || '初始化失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('初始化失败:', error)
      ElMessage.error('初始化失败')
    }
  }
}

const handleExport = () => {
  if (settlementList.value.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }

  const data = settlementList.value
  const filename = `成本结算汇总_${queryForm.periodRange || '全部'}`

  exportToCsv(filename + '.csv', data)
  ElMessage.success('导出成功')
}

const handlePrint = () => {
  const printContent = document.getElementById('printSettlement')?.innerHTML || ''
  const title = `成本结算汇总表 - ${queryForm.periodRange || '全部'}`

  if (!printContent) {
    ElMessage.warning('没有可打印的数据')
    return
  }

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: "Microsoft YaHei", SimSun, sans-serif; padding: 20px; font-size: 12px; }
        h1 { text-align: center; font-size: 18px; margin-bottom: 10px; }
        .period-info { text-align: center; color: #666; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
        th { background-color: #f0f0f0; font-weight: bold; }
        td:nth-child(n+7):nth-child(-n+14), td:nth-child(n+16) { text-align: right; }
        .summary-bar { margin-top: 15px; display: flex; gap: 30px; justify-content: center; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="period-info">打印时间：${new Date().toLocaleString()}</div>
      ${printContent}
      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `)
  printWindow.document.close()
}

const handlePrintDetail = () => {
  const infoEl = document.querySelector('.settlement-detail-info')
  const tableEl = document.querySelector('.settlement-detail-table-wrapper')
  if (!infoEl || !tableEl) return

  const content = `
    <div style="margin-bottom: 15px;">${infoEl.innerHTML}</div>
    <div>${tableEl.innerHTML}</div>
  `

  const title = `成本结算明细账 - ${selectedRow.value?.productName || ''} (${queryForm.periodRange || ''})`

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: "Microsoft YaHei", SimSun, sans-serif; padding: 15px; font-size: 12px; }
        h1 { text-align: center; font-size: 16px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        th, td { border: 1px solid #333; padding: 3px 5px; text-align: center; }
        th { background-color: #f0f0f0; font-weight: bold; }
        td:nth-child(n+5):nth-child(-n+10) { text-align: right; }
        td:last-child { text-align: left; }
        .el-descriptions { border: 1px solid #ddd; }
        .el-descriptions__body { display: table; width: 100%; table-layout: fixed; }
        .el-descriptions__table { display: table-row; }
        .el-descriptions__item { display: table-cell; border: 1px solid #eee; padding: 5px 8px; font-size: 11px; }
        .el-descriptions__label { background: #fafafa; font-weight: bold; width: 25%; }
        .el-descriptions__content { width: 25%; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div style="text-align:center;color:#666;margin-bottom:10px;font-size:11px;">打印时间：${new Date().toLocaleString()}</div>
      ${content}
      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `)
  printWindow.document.close()
}

const handleViewDetail = async (row: any) => {
  selectedRow.value = row
  dialogVisible.value = true
  ledgerEntries.value = []

  try {
    if (!queryForm.periodRange) {
      ElMessage.warning('请先选择会计期间')
      return
    }

    const [year, month] = queryForm.periodRange.split('-').map(Number)

    console.log('请求明细账参数:', { productCode: row.productCode, warehouseId: row.warehouseId, year, month })
    
    const result = await db.getProductDetailLedger({
      productCode: row.productCode,
      warehouseId: row.warehouseId,
      year,
      month
    })

    console.log('获取明细账结果:', result)
    console.log('结果类型:', typeof result)
    console.log('结果是否为数组:', Array.isArray(result))
    console.log('结果是否有 data 属性:', result && result.data)
    
    // 处理返回数据
    if (result && result.data && Array.isArray(result.data)) {
      ledgerEntries.value = result.data
      console.log('明细账数据 (新格式):', result.data.length, '条')
    } else if (Array.isArray(result)) {
      ledgerEntries.value = result
      console.log('明细账数据 (旧格式):', result.length, '条')
    } else {
      ledgerEntries.value = []
      console.warn('明细账数据格式异常:', result)
      ElMessage.info('该期间暂无明细数据')
    }
  } catch (error) {
    console.error('加载明细账失败:', error)
    ElMessage.error('加载明细账失败')
    ledgerEntries.value = []
  }
}

const handleOverlayClick = () => {
  dialogVisible.value = false
}

onMounted(() => {
  loadWarehouses()
})
</script>

<style scoped>
.cost-settlement-page {
  padding: 20px;
  background-color: #f0f2f5;
  min-height: calc(100vh - 84px);
}

.toolbar {
  background-color: #fff;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.query-form {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header span:first-child {
  font-weight: bold;
  font-size: 15px;
}

.period-label {
  color: #909399;
  font-size: 13px;
}

.summary-bar {
  margin-top: 16px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 8px;
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
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
  font-size: 18px;
  font-weight: bold;
  color: #409eff;
}

.text-inbound { color: #67c23a; font-weight: 500; }
.text-outbound { color: #f56c6c; font-weight: 500; }
.text-return { color: #e6a23c; font-weight: 500; }
.negative-qty { color: #f56c6c; font-weight: bold; }

.print-area {
  background: #fff;
}

/* 详情弹窗 */
.settlement-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.settlement-detail-dialog {
  width: 92%;
  max-width: 1500px;
  height: 85vh;
  background-color: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settlement-detail-header {
  height: 50px;
  background-color: #409eff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}

.settlement-detail-title {
  font-size: 16px;
  font-weight: bold;
}

.settlement-detail-close {
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.3s;
}

.settlement-detail-close:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.settlement-detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.settlement-detail-info {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.settlement-detail-table-wrapper {
  flex: 1;
  overflow-y: auto;
  min-height: 300px;
}

.settlement-detail-footer {
  height: 54px;
  background-color: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
}
</style>
