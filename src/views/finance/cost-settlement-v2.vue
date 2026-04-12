<template>
  <div class="cost-settlement-page">
    <!-- 成本结算启用日期设置 -->
    <el-card shadow="never" style="margin-bottom: 20px;">
      <template #header>
        <div class="card-header">
          <span>成本结算设置</span>
        </div>
      </template>
      <el-form :inline="true" size="default">
        <el-form-item label="成本结算启用日期">
          <el-date-picker
            v-model="costStartDate"
            type="month"
            placeholder="选择启用月份"
            value-format="YYYY-MM"
            @change="handleCostStartDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSaveCostStartDate">保存设置</el-button>
        </el-form-item>
        <el-form-item>
          <el-tag type="info" v-if="costStartDate">
            当前启用月份：{{ costStartDate }}
          </el-tag>
          <el-tag type="warning" v-else>
            尚未设置启用月份
          </el-tag>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 年度成本结算状态总览 -->
    <el-card shadow="never" style="margin-bottom: 20px;">
      <template #header>
        <div class="card-header">
          <span>年度成本结算状态</span>
          <el-select
            v-model="currentYear"
            placeholder="选择年份"
            style="width: 120px; margin-left: 20px;"
            @change="handleYearChange"
          >
            <el-option
              v-for="year in yearOptions"
              :key="year"
              :label="`${year}年`"
              :value="year"
            />
          </el-select>
        </div>
      </template>
      <div class="month-status-grid">
        <div
          v-for="month in 12"
          :key="month"
          class="month-status-card"
          :class="getMonthStatusClass(month)"
          @click="handleMonthClick(month)"
        >
          <div class="month-number">{{ String(month).padStart(2, '0') }}</div>
          <div class="month-label">{{ month }}月</div>
          <div class="month-status">
            <el-tag
              :type="getMonthStatusType(month)"
              size="small"
              effect="plain"
            >
              {{ getMonthStatusText(month) }}
            </el-tag>
          </div>
          <div class="month-date" v-if="getMonthSettleDate(month)">
            {{ getMonthSettleDate(month) }}
          </div>
        </div>
      </div>
    </el-card>

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
              :disabled-date="disabledDate"
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
        <el-button
          type="success"
          :icon="Check"
          @click="handleCalculate"
          :disabled="!canSettleCurrentMonth"
        >
          开始计算
        </el-button>
        <el-button type="warning" :icon="RefreshLeft" @click="handleReverse" :disabled="!currentMonthSettled">
          反结算
        </el-button>
        <el-button type="info" :icon="Download" @click="handleExport">导出</el-button>
        <el-button :icon="Printer" @click="handlePrint">打印</el-button>
      </div>
    </div>

    <!-- 提示信息 -->
    <el-alert
      v-if="!canSettleCurrentMonth && queryForm.periodRange"
      title="无法结算"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 10px;"
    >
      <template #default>
        <div v-if="!costStartDate">
          请先设置成本结算启用日期
        </div>
        <div v-else-if="!previousMonthSettled && !isFirstMonth">
          前一个月未完成成本结算，无法结算当前月份。请先完成 {{ previousMonth }} 的结算。
        </div>
        <div v-else-if="isBeforeStartDate">
          该月份早于成本结算启用日期 {{ costStartDate }}，无需结算。
        </div>
      </template>
    </el-alert>

    <el-alert
      v-if="currentMonthSettled"
      title="当前月份已结算"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 10px;"
    >
      <template #default>
        当前月份已完成成本结算，如需修改请先进行反结算操作。
      </template>
    </el-alert>

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
              <el-descriptions-item label="期初数量">{{ formatNum(detailOpeningQty) }}</el-descriptions-item>
              <el-descriptions-item label="期初成本">{{ formatMoney(detailOpeningCost) }} 元</el-descriptions-item>
              <el-descriptions-item label="本期入库数量">{{ formatNum(detailInboundQty) }}</el-descriptions-item>
              <el-descriptions-item label="本期入库成本">{{ formatMoney(detailInboundAmount) }} 元</el-descriptions-item>
              <el-descriptions-item label="本期出库数量">{{ formatNum(detailOutboundQty) }}</el-descriptions-item>
              <el-descriptions-item label="本期出库成本">{{ formatMoney(detailOutboundAmount) }} 元</el-descriptions-item>
              <el-descriptions-item label="期末结存数量">
                <span :class="{ 'negative-qty': detailClosingQty < 0 }">{{ formatNum(detailClosingQty) }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="期末结存成本">{{ formatMoney(detailClosingCost) }} 元</el-descriptions-item>
              <el-descriptions-item label="加权平均单价">{{ formatMoney(detailAvgCost) }} 元</el-descriptions-item>
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
                    <span v-if="row.balanceQty !== null && row.balanceQty !== undefined" :class="{ 'negative-qty': row.balanceQty < 0 }">{{ formatNum(row.balanceQty) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="balanceUnitPrice" label="单价" width="90" min-width="70" align="right">
                  <template #default="{ row }">
                    <span v-if="row.balanceUnitPrice !== null && row.balanceUnitPrice !== undefined">{{ formatMoney(row.balanceUnitPrice) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column label="结余金额" width="120" min-width="100" align="right">
                  <template #default="{ row }">
                    <span v-if="row.balanceAmount !== null && row.balanceAmount !== undefined">{{ formatMoney(row.balanceAmount) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip>
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
import { ref, reactive, computed, onMounted, onActivated } from 'vue'
import { Search, RefreshLeft, Check, Download, Printer, Close, Refresh } from '@element-plus/icons-vue'
import { OfficeBuilding } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import exportToCsv from '../../utils/exportCsv'
import { getCostSettlementList } from '@/api/cost'
import { db } from '@/utils/db-ipc'

// 成本结算启用日期
const costStartDate = ref<string>('')
const currentYear = ref<number>(new Date().getFullYear())
const yearOptions = ref<number[]>([])
const monthStatus = ref<Map<number, any>>(new Map())

// 生成最近 50 年的选项（当前年份前后各 25 年）
const now = new Date()
for (let i = now.getFullYear() - 25; i <= now.getFullYear() + 40; i++) {
  yearOptions.value.push(i)
}

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

// 计算属性：当前月份是否已结算
const currentMonthSettled = computed(() => {
  if (!queryForm.periodRange) return false
  
  // 优先从月份状态中获取
  const [year, month] = queryForm.periodRange.split('-').map(Number)
  if (monthStatus.value.has(month)) {
    return monthStatus.value.get(month)?.settled || false
  }
  
  // 如果月份状态中没有，则从结算列表中判断
  return settlementList.value.length > 0 && settlementList.value.every((row: any) => {
    // 如果有任何一行数据，说明已结算
    return row.openingQty !== undefined
  })
})

// 计算属性：前一个月是否已结算
const previousMonthSettled = computed(() => {
  if (!queryForm.periodRange || !costStartDate.value) return false
  
  const [year, month] = queryForm.periodRange.split('-').map(Number)
  let prevMonth = month - 1
  let prevYear = year
  
  if (prevMonth === 0) {
    prevMonth = 12
    prevYear = year - 1
  }
  
  // 如果前一个月早于启用日期，认为已结算
  const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`
  if (prevMonthStr < costStartDate.value) return true
  
  // 检查前一个月是否已结算
  return monthStatus.value.has(prevMonth) && monthStatus.value.get(prevMonth)?.settled
})

// 计算属性：是否是启用后的第一个月
const isFirstMonth = computed(() => {
  if (!queryForm.periodRange || !costStartDate.value) return false
  return queryForm.periodRange === costStartDate.value
})

// 计算属性：是否早于启用日期
const isBeforeStartDate = computed(() => {
  if (!queryForm.periodRange || !costStartDate.value) return false
  return queryForm.periodRange < costStartDate.value
})

// 计算属性：当前月份是否可以结算
const canSettleCurrentMonth = computed(() => {
  if (!queryForm.periodRange) return false
  if (!costStartDate.value) return false
  if (isBeforeStartDate.value) return false
  if (currentMonthSettled.value) return false
  if (!isFirstMonth.value && !previousMonthSettled.value) return false
  
  return true
})

// 前一个月的月份显示
const previousMonth = computed(() => {
  if (!queryForm.periodRange) return ''
  const [year, month] = queryForm.periodRange.split('-').map(Number)
  let prevMonth = month - 1
  let prevYear = year
  
  if (prevMonth === 0) {
    prevMonth = 12
    prevYear = year - 1
  }
  
  return `${prevYear}年${prevMonth}月`
})

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

// 从明细数据计算汇总信息
const detailOpeningQty = computed(() => {
  const opening = ledgerEntries.value.find(r => r.type === 'opening')
  return opening ? Number(opening.balanceQty || 0) : 0
})

const detailOpeningCost = computed(() => {
  const opening = ledgerEntries.value.find(r => r.type === 'opening')
  return opening ? Number(opening.balanceAmount || 0) : 0
})

const detailInboundQty = computed(() => {
  const monthly = ledgerEntries.value.find(r => r.type === 'monthly')
  return monthly ? Number(monthly.inboundQty || 0) : 0
})

const detailInboundAmount = computed(() => {
  const monthly = ledgerEntries.value.find(r => r.type === 'monthly')
  return monthly ? Number(monthly.inboundAmount || 0) : 0
})

const detailOutboundQty = computed(() => {
  const monthly = ledgerEntries.value.find(r => r.type === 'monthly')
  return monthly ? Number(monthly.outboundQty || 0) : 0
})

const detailOutboundAmount = computed(() => {
  const monthly = ledgerEntries.value.find(r => r.type === 'monthly')
  return monthly ? Number(monthly.outboundAmount || 0) : 0
})

const detailClosingQty = computed(() => {
  // 获取本月合计上一行的库存结余数量（最后一个业务单据的库存结余）
  const businessRecords = ledgerEntries.value.filter(r =>
    r.type !== 'opening' && r.type !== 'monthly' && r.type !== 'yearly'
  )
  const lastRecord = businessRecords[businessRecords.length - 1]
  return lastRecord ? Number(lastRecord.balanceQty || 0) : 0
})

const detailClosingCost = computed(() => {
  // 获取本月合计上一行的库存结余金额（最后一个业务单据的结余金额）
  const businessRecords = ledgerEntries.value.filter(r =>
    r.type !== 'opening' && r.type !== 'monthly' && r.type !== 'yearly'
  )
  const lastRecord = businessRecords[businessRecords.length - 1]
  return lastRecord ? Number(lastRecord.balanceAmount || 0) : 0
})

const detailAvgCost = computed(() => {
  const qty = detailClosingQty.value
  const cost = detailClosingCost.value
  return qty > 0 ? cost / qty : 0
})

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
    
    // 更新月份状态
    const [year, month] = queryForm.periodRange.split('-').map(Number)
    const settled = settlementList.value.length > 0
    if (monthStatus.value.has(month)) {
      monthStatus.value.get(month)!.settled = settled
      monthStatus.value.get(month)!.canSettle = !settled
    } else {
      monthStatus.value.set(month, {
        settled,
        period: queryForm.periodRange,
        year,
        month,
        canSettle: !settled
      })
    }
    
    // 调试：直接查询数据库中的锁定记录数
    try {
      const lockCheck = await (window as any).electron.costSettlementQuery(year, month, '', undefined)
      console.log(`${queryForm.periodRange} 数据库原始记录:`, lockCheck)
    } catch (err) {
      console.error('查询数据库失败:', err)
    }
    
    console.log(`更新 ${queryForm.periodRange} 状态：settled=${settled}, data length=${settlementList.value.length}`)

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
      
      // 强制等待一小段时间，确保数据库事务完成
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 重新加载月份状态
      console.log('重新加载月份状态...')
      await loadMonthStatus()
      
      // 重新查询
      console.log('重新查询数据...')
      await handleSearch()
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
      console.log('反结算结果:', result)
      const msg = `反结算成功！${result.deletedCount !== undefined ? `删除了 ${result.deletedCount} 条记录，` : ''}${result.remainingCount !== undefined ? `剩余 ${result.remainingCount} 条记录` : ''}`
      ElMessage.success(result.message || msg)
      
      // 清空结算列表
      settlementList.value = []
      
      // 强制等待一小段时间，确保数据库事务完成
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 重新加载月份状态
      console.log('重新加载月份状态...')
      await loadMonthStatus()
      
      // 重新查询
      console.log('重新查询数据...')
      await handleSearch()
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

// ==================== 成本结算设置相关函数 ====================

// 加载成本结算启用日期
const loadCostStartDate = async () => {
  try {
    const settings = await db.getSystemSettings()
    costStartDate.value = settings?.costStartDate || ''
    console.log('加载成本结算启用日期:', costStartDate.value)
    // 加载月份状态
    if (costStartDate.value) {
      await loadMonthStatus()
    }
  } catch (error) {
    console.error('加载成本结算启用日期失败:', error)
  }
}

// 保存成本结算启用日期
const handleSaveCostStartDate = async () => {
  if (!costStartDate.value) {
    ElMessage.warning('请选择启用月份')
    return
  }

  try {
    await db.saveSystemSettings({ costStartDate: costStartDate.value })
    ElMessage.success('保存成功')
    await loadMonthStatus()
  } catch (error) {
    console.error('保存成本结算启用日期失败:', error)
    ElMessage.error('保存失败')
  }
}

// 处理启用日期变化
const handleCostStartDateChange = (val: string) => {
  console.log('启用日期变化:', val)
}

// 加载月份状态
const loadMonthStatus = async () => {
  if (!costStartDate.value) {
    monthStatus.value.clear()
    return
  }

  try {
    const [startYear, startMonth] = costStartDate.value.split('-').map(Number)
    
    // 清空状态
    monthStatus.value.clear()

    // 从启用年份的启用月份到当前年份的当前月份，逐月检查结算状态
    const now = new Date()
    const endYear = now.getFullYear()
    const endMonth = now.getMonth() + 1

    let y = startYear
    let m = startMonth
    let prevSettled = true

    while (y < endYear || (y === endYear && m <= endMonth)) {
      const periodStr = `${y}-${String(m).padStart(2, '0')}`
      
      // 直接使用 API 查询成本结算数据
      try {
        const result = await getCostSettlementList({
          periodRange: periodStr,
          productSearch: '',
          warehouseId: undefined
        })
        
        // 如果有返回数据且数据长度大于 0，说明已结算
        const settled = result && result.data && result.data.length > 0
        
        // 只加载当前选定年份的月份
        if (y === currentYear.value) {
          console.log(`${periodStr} settled:`, settled, 'data length:', result?.data?.length)
          
          monthStatus.value.set(m, {
            settled,
            period: periodStr,
            year: y,
            month: m,
            canSettle: prevSettled && !settled
          })

          prevSettled = settled
        } else {
          // 非当前年份的月份，也需要追踪结算状态以确保连续性
          prevSettled = settled
        }
      } catch (err) {
        console.error(`查询 ${periodStr} 失败:`, err)
        // 查询失败，认为未结算
        if (y === currentYear.value) {
          monthStatus.value.set(m, {
            settled: false,
            period: periodStr,
            year: y,
            month: m,
            canSettle: prevSettled
          })
        }
        prevSettled = false
      }
      
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }
    
    console.log('月份状态加载完成:', Object.fromEntries(monthStatus.value))
  } catch (error) {
    console.error('加载月份状态失败:', error)
  }
}

// 检查月份是否已结算
const checkMonthSettled = async (year: number, month: number): Promise<boolean> => {
  try {
    const result = await db.getCostSettlement({
      year,
      month,
      productCode: '',
      warehouseId: undefined
    })
    return result && result.data && result.data.length > 0
  } catch (error) {
    return false
  }
}

// 处理年份变化
const handleYearChange = () => {
  // 年份切换时，清空并重新加载月份状态
  console.log('年份切换:', currentYear.value)
  loadMonthStatus()
}

// 处理月份点击
const handleMonthClick = (month: number) => {
  const status = monthStatus.value.get(month)
  if (status) {
    queryForm.periodRange = status.period
    handleSearch()
  }
}

// 获取月份状态样式
const getMonthStatusClass = (month: number) => {
  const status = monthStatus.value.get(month)
  if (!status) return ''
  
  if (status.settled) return 'month-settled'
  if (status.canSettle) return 'month-can-settle'
  return 'month-cannot-settle'
}

// 获取月份状态标签类型
const getMonthStatusType = (month: number): 'success' | 'warning' | 'info' | 'danger' => {
  const status = monthStatus.value.get(month)
  if (!status) return 'info'
  
  if (status.settled) return 'success'
  if (status.canSettle) return 'warning'
  return 'info'
}

// 获取月份状态文本
const getMonthStatusText = (month: number): string => {
  const status = monthStatus.value.get(month)
  if (!status) return '未启用'
  
  if (status.settled) return '已结算'
  if (status.canSettle) return '待结算'
  return '未就绪'
}

// 获取月份结算日期
const getMonthSettleDate = (month: number): string => {
  const status = monthStatus.value.get(month)
  if (!status || !status.settled) return ''
  
  // 这里可以从数据库获取实际结算时间
  return status.period
}

// 禁用日期
const disabledDate = (date: Date) => {
  if (!costStartDate.value) return false
  
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  return dateStr < costStartDate.value
}

onMounted(() => {
  loadWarehouses()
  loadCostStartDate()
})

// 页面激活时也重新加载（解决切换模块后数据不更新的问题）
onActivated(() => {
  loadCostStartDate()
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
  width: 98%;
  max-width: 1800px;
  height: 90vh;
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

/* 月份状态网格 */
.month-status-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 12px;
  margin-top: 10px;
}

.month-status-card {
  background-color: #f5f7fa;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.month-status-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.month-status-card.month-settled {
  background-color: #f0f9ff;
  border-color: #67c23a;
}

.month-status-card.month-can-settle {
  background-color: #fff7e6;
  border-color: #e6a23c;
  animation: pulse 2s infinite;
}

.month-status-card.month-cannot-settle {
  background-color: #f5f7fa;
  border-color: #dcdfe6;
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(230, 162, 60, 0.3);
  }
  50% {
    box-shadow: 0 2px 12px rgba(230, 162, 60, 0.6);
  }
}

.month-number {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.month-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.month-status {
  margin-bottom: 4px;
}

.month-date {
  font-size: 10px;
  color: #67c23a;
  margin-top: 4px;
}
</style>
