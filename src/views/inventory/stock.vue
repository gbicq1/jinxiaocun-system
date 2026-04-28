<template>
  <div class="inventory-stock-page">
    <el-card>
      <div class="toolbar">
        <el-autocomplete
          v-model="searchQuery"
          :fetch-suggestions="querySearch"
          placeholder="搜索产品编码/名称"
          clearable
          style="width: 260px"
          @select="handleSelect"
          @clear="handleClear"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #default="{ item }">
            <div class="product-option">
              <span class="product-code">{{ item.value }}</span>
              <span class="product-name">{{ item.name }}</span>
            </div>
          </template>
        </el-autocomplete>
        <el-select
          v-model="selectedWarehouse"
          placeholder="仓库（全部）"
          clearable
          filterable
          style="width: 160px; margin-left: 10px;"
          @change="handleWarehouseFilter"
        >
          <el-option
            v-for="warehouse in warehouses"
            :key="warehouse.id"
            :label="warehouse.name"
            :value="warehouse.name"
          />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="起始日期"
          end-placeholder="截止日期"
          value-format="YYYY-MM-DD"
          style="width: 280px; margin-left: 10px;"
          :shortcuts="dateShortcuts"
        />
        <el-button type="primary" @click="handleExport" style="margin-left: 10px;">
          <el-icon><Download /></el-icon>
          导出库存
        </el-button>
      </div>
      <el-table :data="stockList" style="width: 100%" :table-layout="'fixed'">
        <el-table-column prop="productCode" label="产品编码" width="120" />
        <el-table-column prop="productName" label="产品名称" width="220" />
        <el-table-column prop="specification" label="规格" width="160" />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="warehouseName" label="仓库" width="120" />
        <el-table-column prop="stockQuantity" label="库存数量" width="100">
          <template #default="{ row }">
            <el-tag :type="getStockType(row.stockQuantity, row.warningQuantity)">
              {{ row.stockQuantity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="warningQuantity" label="预警数量" width="100" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="costPrice" label="成本价" width="100">
          <template #default="{ row }">
            ¥{{ Number(row.costPrice).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="totalValue" label="库存金额" width="120">
          <template #default="{ row }">
            ¥{{ (row.stockQuantity * row.costPrice).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleView(row)">明细</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <!-- 库存明细弹窗 -->
    <div v-if="dialogVisible" class="stock-detail-overlay" @click="handleOverlayClick">
      <div class="stock-detail-dialog" @click.stop>
        <!-- ① 头部固定区 -->
        <div class="stock-detail-header">
          <span class="stock-detail-title">库存明细</span>
          <el-icon class="stock-detail-close" @click="dialogVisible = false">
            <Close />
          </el-icon>
        </div>

        <div v-if="selectedRow" class="stock-detail-body">
          <!-- ② 明细表格滚动区 -->
          <div class="stock-detail-table-wrapper">
            <el-table 
              :data="ledgerEntries" 
              style="width: 100%; min-width: 1200px" 
              :height="'100%'"
              :show-summary="false"
              element-loading-text="加载中..."
              border
              :row-class-name="tableRowClassName"
            >
              <el-table-column prop="date" label="日期" width="120" min-width="100" fixed>
                <template #default="{ row }">
                  <span v-if="row._isSummary" style="font-weight: bold; color: #303133">{{ row.docNo }}</span>
                  <span v-else>{{ row.date }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="docNo" label="单号" width="210" min-width="180" fixed>
                <template #default="{ row }">
                  <a v-if="!row._isSummary && row.docNo && row.docType" class="doc-link" @click.stop="handleDocClick(row)">{{ row.docNo }}</a>
                  <span v-else-if="!row._isSummary">{{ row.docNo }}</span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="productName" label="产品名称" width="180" min-width="140" />
              <el-table-column prop="specification" label="规格" width="120" min-width="100" />
              <el-table-column prop="unit" label="单位" width="70" min-width="60" />
              
              <!-- 入库数据区域 -->
              <el-table-column label="入库数据" align="center">
                <el-table-column prop="inboundQty" label="数量" width="90" min-width="80" class-name="inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.inboundQty > 0" style="color: #67c23a; font-weight: 600">{{ row.inboundQty }}</span>
                    <span v-else-if="row.inboundQty < 0" style="color: #f56c6c; font-weight: 600">{{ row.inboundQty }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="inboundUnitPrice" label="单价" width="90" min-width="80" class-name="inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.inboundUnitPrice !== 0 && row.inboundUnitPrice !== undefined">{{ Math.abs(row.inboundUnitPrice).toFixed(2) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="inboundAmount" label="金额" width="110" min-width="90" class-name="inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.inboundAmount !== 0" :style="{ color: row.inboundAmount > 0 ? '#67c23a' : '#f56c6c', fontWeight: 600 }">{{ row.inboundAmount.toFixed(2) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>
              
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
              
              <!-- 库存信息区域 -->
              <el-table-column label="库存结余" align="center">
                <el-table-column prop="runningQty" label="数量" width="120" min-width="100" class-name="stock-col">
                  <template #default="{ row }">
                    <span v-if="row.runningQty === null || row.runningQty === undefined">-</span>
                    <span v-else>{{ row.runningQty }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="runningUnitPrice" label="单价" width="120" min-width="100" class-name="stock-col">
                  <template #default="{ row }">
                    <span v-if="row.runningUnitPrice === null || row.runningUnitPrice === undefined">-</span>
                    <span v-else>{{ Number(row.runningUnitPrice).toFixed(2) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="runningAmount" label="金额" width="140" min-width="120" class-name="stock-col">
                  <template #default="{ row }">
                    <span v-if="row.runningAmount === null || row.runningAmount === undefined">-</span>
                    <span v-else>{{ Number(row.runningAmount).toFixed(2) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
              
              <el-table-column prop="counter" label="往来单位" width="150" min-width="120" />
              <el-table-column prop="remark" label="备注" min-width="200" />
            </el-table>
          </div>
        </div>

        <!-- 单据查看弹窗 -->
        <div v-if="docDialogVisible" class="doc-preview-overlay" @click.self="docDialogVisible = false">
          <div class="doc-preview-dialog">
            <div class="doc-preview-header">
              <span class="doc-preview-title">{{ docDialogTitle }}</span>
              <el-icon class="doc-preview-close" @click="docDialogVisible = false"><Close /></el-icon>
            </div>
            <div class="doc-preview-body" v-loading="docLoading">
              <table class="doc-info-table" v-if="!docLoading && docDetailData">
                <tr><td class="label">单号</td><td>{{ docDetailData.docNo }}</td></tr>
                <tr><td class="label">日期</td><td>{{ docDetailData.date }}</td></tr>
                <tr><td class="label">往来单位</td><td>{{ docDetailData.counter }}</td></tr>
                <tr><td class="label">仓库</td><td>{{ docDetailData.warehouseName }}</td></tr>
                <tr><td class="label">备注</td><td>{{ docDetailData.remark || '-' }}</td></tr>
              </table>
              <el-table :data="docDetailItems" border size="small" style="width: 100%; margin-top: 12px;" v-if="!docLoading && docDetailItems.length">
                <el-table-column prop="productCode" label="产品编码" width="120" />
                <el-table-column prop="productName" label="产品名称" min-width="160" />
                <el-table-column prop="specification" label="规格" width="120" />
                <el-table-column prop="unit" label="单位" width="70" />
                <el-table-column prop="quantity" label="数量" width="90" />
                <el-table-column prop="unit_price" label="单价" width="100">
                  <template #default="{ row }">{{ row.unit_price ? Number(row.unit_price).toFixed(2) : '-' }}</template>
                </el-table-column>
                <el-table-column prop="total_amount" label="金额" width="120">
                  <template #default="{ row }">{{ row.total_amount ? Number(row.total_amount).toFixed(2) : '-' }}</template>
                </el-table-column>
              </el-table>
            </div>
            <div class="doc-preview-footer">
              <el-button @click="docDialogVisible = false">关闭</el-button>
            </div>
          </div>
        </div>

        <!-- 底部关闭按钮固定区 -->
        <div class="stock-detail-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Search, Download, Close } from '@element-plus/icons-vue'
import exportToCsv from '../../utils/exportCsv'
import { db } from '@/utils/db-ipc'

const searchQuery = ref('')
const selectedWarehouse = ref('')
const warehouses = ref<any[]>([])
const products = ref<any[]>([])
const stockList = ref<any[]>([])
const allStock = ref<any[]>([])
const dialogVisible = ref(false)
const dateRange = ref<[string, string] | null>(null)
watch(dialogVisible, (v) => {
  try { document.body.style.overflow = v ? 'hidden' : '' } catch {}
})
const selectedRow = ref<any>(null)
const ledgerEntries = ref<any[]>([])

const docDialogVisible = ref(false)
const docDialogTitle = ref('')
const docLoading = ref(false)
const docDetailData = ref<any>(null)
const docDetailItems = ref<any[]>([])

const DOC_TYPE_MAP: Record<string, { title: string; fetch: (id: number) => Promise<any> }> = {
  'purchase_inbound': {
    title: '采购入库单',
    fetch: (id) => db.getInboundById(id)
  },
  'sales_outbound': {
    title: '销售出库单',
    fetch: (id) => db.getOutboundById(id)
  },
  'purchase_return': {
    title: '采购退货单',
    fetch: (id) => db.getPurchaseReturnById(id)
  },
  'sales_return': {
    title: '销售退货单',
    fetch: (id) => db.getSalesReturnById(id)
  },
  'transfer_out': {
    title: '调拨单（出库）',
    fetch: (id) => db.getTransferById(id)
  },
  'transfer_in': {
    title: '调拨单（入库）',
    fetch: (id) => db.getTransferById(id)
  }
}

const handleDocClick = async (row: any) => {
  const config = DOC_TYPE_MAP[row.docType]
  if (!config || !row.docId) return

  docDialogVisible.value = true
  docDialogTitle.value = config.title
  docLoading.value = true
  docDetailData.value = null
  docDetailItems.value = []

  try {
    const data = await config.fetch(row.docId)
    if (!data) {
      ElMessage.warning('未找到该单据信息')
      docDialogVisible.value = false
      return
    }

    const dateField = data.inbound_date || data.outbound_date || data.return_date || data.transfer_date || ''
    const noField = data.inbound_no || data.outbound_no || data.return_no || data.transfer_no || ''

    docDetailData.value = {
      docNo: noField,
      date: dateField,
      counter: data.supplier_name || data.customer_name || ((data.from_warehouse_name || '') + ' → ' + (data.to_warehouse_name || '')) || '',
      warehouseName: data.warehouse_name || data.to_warehouse_name || '',
      remark: data.remark || ''
    }
    docDetailItems.value = Array.isArray(data.items) ? data.items : []
  } catch (error) {
    console.error('[handleDocClick] 获取单据详情失败:', error)
    ElMessage.error('获取单据详情失败')
  } finally {
    docLoading.value = false
  }
}

const dateShortcuts = [
  { text: '本月', value: () => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); return [start, end] } },
  { text: '本季', value: () => { const now = new Date(); const q = Math.floor(now.getMonth() / 3); const start = new Date(now.getFullYear(), q * 3, 1); const end = new Date(now.getFullYear(), q * 3 + 3, 0); return [start, end] } },
  { text: '本年', value: () => { const now = new Date(); return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31)] } },
  { text: '上月', value: () => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() - 1, 1); const end = new Date(now.getFullYear(), now.getMonth(), 0); return [start, end] } }
]

const handleSearch = () => {
  const q = (searchQuery.value || '').toLowerCase()
  const warehouse = selectedWarehouse.value
  
  if (!q && !warehouse) {
    stockList.value = allStock.value.slice()
    return
  }
  
  stockList.value = allStock.value.filter(item => {
    const matchText = !q || 
      (item.productCode || '').toLowerCase().includes(q)
      || (item.productName || '').toLowerCase().includes(q)
      || (String(item.specification || '').toLowerCase().includes(q))
    
    const matchWarehouse = !warehouse || item.warehouseName === warehouse
    
    return matchText && matchWarehouse
  })
}

const handleWarehouseFilter = () => {
  handleSearch()
}

// 加载仓库列表（从数据库获取）
const loadWarehouses = async () => {
  try {
    warehouses.value = await db.getWarehouses()
    console.log('加载仓库列表成功（数据库），共', warehouses.value.length, '个仓库')
    if (warehouses.value.length === 0) {
      warehouses.value = [{ id: 1, name: '默认仓库' }]
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error)
    warehouses.value = [{ id: 1, name: '默认仓库' }]
  }
}

// 加载产品列表（从数据库获取，用于搜索建议）
const loadProducts = async () => {
  try {
    const allProducts = await db.getProducts()
    products.value = allProducts
      .filter((p: any) => (p.status as any) === 1 || (p.status as any) === true)
      .map((p: any) => ({
        value: p.code || p.productCode || '',
        label: `${p.code || p.productCode || ''} - ${p.name || p.productName || ''}`,
        code: p.code || p.productCode || '',
        name: p.name || p.productName || '',
        id: p.id
      }))
    console.log('加载产品列表成功（数据库），共', products.value.length, '个产品')
  } catch (error) {
    console.error('加载产品列表失败:', error)
    products.value = []
  }
}

// 搜索建议
const querySearch = (queryString: string, cb: (suggestions: any[]) => void) => {
  const results = queryString
    ? products.value.filter(createFilter(queryString))
    : products.value
  
  cb(results.map(p => ({
    value: p.code,
    label: p.label,
    code: p.code,
    name: p.name
  })))
}

// 搜索过滤器
const createFilter = (queryString: string) => {
  return (restaurant: any) => {
    return (
      restaurant.value.toLowerCase().indexOf(queryString.toLowerCase()) === 0 ||
      restaurant.name.toLowerCase().includes(queryString.toLowerCase())
    )
  }
}

// 选择产品
const handleSelect = (item: any) => {
  console.log('选择的产品:', item)
  handleSearch()
}

// 清空搜索
const handleClear = () => {
  console.log('清空搜索')
  searchQuery.value = ''
  handleSearch()
}

const handleExport = () => {
  const columns = [
    { label: '产品编码', key: 'productCode' },
    { label: '产品名称', key: 'productName' },
    { label: '规格', key: 'specification' },
    { label: '分类', key: 'category' },
    { label: '仓库', key: 'warehouseName' },
    { label: '库存数量', key: 'stockQuantity' },
    { label: '单位', key: 'unit' },
    { label: '成本价', key: 'costPrice' }
  ]
  exportToCsv('stock.csv', columns, stockList.value)
}

const handleView = (row: any) => {
  selectedRow.value = row
  loadLedger(row)
  dialogVisible.value = true
}

const handleOverlayClick = () => {
  dialogVisible.value = false
}

const loadLedger = async (row: any) => {
  ledgerEntries.value = []
  if (!row) return

  try {
    let rawStartDate = dateRange.value?.[0] || ''
    let rawEndDate = dateRange.value?.[1] || ''

    const startDate = rawStartDate || '1900-01-01'
    const endDate = rawEndDate || '2099-12-31'

    console.log('[loadLedger] 调用参数:', { productId: row.productId, warehouseId: row.warehouseId, startDate, endDate, originalStart: rawStartDate, originalEnd: rawEndDate })

    const ledgerData = await db.getProductLedger(row.productId, row.warehouseId, startDate, endDate, true)

    console.log('[loadLedger] 原始返回数据:', ledgerData)
    console.log('[loadLedger] 数据条数:', Array.isArray(ledgerData) ? ledgerData.length : '非数组')

    const result: any[] = []
    let runningQty = 0
    let runningUnitPrice = 0
    let runningAmount = 0
    let lastValidUnitPrice = 0

    const startYear = rawStartDate ? new Date(rawStartDate).getFullYear() : new Date().getFullYear()
    const startMonth = rawStartDate ? new Date(rawStartDate).getMonth() + 1 : null
    const endYear = rawEndDate ? new Date(rawEndDate).getFullYear() : new Date().getFullYear()
    const endMonth = rawEndDate ? new Date(rawEndDate).getMonth() + 1 : new Date().getMonth() + 1

    if (startMonth !== null && rawStartDate) {
      let prevQty = 0
      let prevCost = 0
      if (startMonth === 1) {
        prevQty = await db.getStockBeforeDate(row.productId, row.warehouseId, `${startYear - 1}-12-31`)
        prevCost = await db.getStockCostBeforeDate(row.productId, row.warehouseId, `${startYear - 1}-12-31`)
        runningQty = prevQty
        runningUnitPrice = prevQty > 0 ? Number((prevCost / prevQty).toFixed(4)) : 0
        runningAmount = prevCost
        lastValidUnitPrice = runningUnitPrice > 0 ? runningUnitPrice : 0

        result.push({
          _isSummary: true,
          _summaryType: 'carryover',
          date: `${startYear - 1}-12-31`,
          docNo: '上年结转',
          productName: row.productName,
          specification: row.specification || '-',
          unit: row.unit || '-',
          inboundQty: 0,
          inboundUnitPrice: 0,
          inboundAmount: 0,
          outboundQty: 0,
          outboundUnitPrice: 0,
          outboundAmount: 0,
          counter: '',
          remark: '',
          runningQty: prevQty,
          runningUnitPrice,
          runningAmount
        })
      } else {
        const prevMonthLastDay = new Date(startYear, startMonth - 1, 0)
        const prevDateStr = `${prevMonthLastDay.getFullYear()}-${String(prevMonthLastDay.getMonth() + 1).padStart(2, '0')}-${String(prevMonthLastDay.getDate()).padStart(2, '0')}`
        prevCost = await db.getStockCostBeforeDate(row.productId, row.warehouseId, prevDateStr)
        prevQty = await db.getStockBeforeDate(row.productId, row.warehouseId, prevDateStr)
        runningQty = prevQty
        runningUnitPrice = prevQty > 0 ? Number((prevCost / prevQty).toFixed(4)) : 0
        runningAmount = prevCost
        lastValidUnitPrice = runningUnitPrice > 0 ? runningUnitPrice : 0
        result.push({
          _isSummary: true,
          _summaryType: 'carryover',
          date: prevDateStr,
          docNo: '上期结转',
          productName: row.productName,
          specification: row.specification || '-',
          unit: row.unit || '-',
          inboundQty: 0,
          inboundUnitPrice: 0,
          inboundAmount: 0,
          outboundQty: 0,
          outboundUnitPrice: 0,
          outboundAmount: 0,
          counter: '',
          remark: '',
          runningQty: prevQty,
          runningUnitPrice,
          runningAmount
        })
      }
    }

    for (const en of ledgerData) {
      const inQty = Number(en.inboundQty || 0)
      const outQty = Number(en.outboundQty || 0)
      const inAmt = Number(en.inboundAmount || 0)

      const displayOutboundUnitPrice = en.outboundUnitPrice || 0
      const displayOutboundAmount = en.outboundAmount || 0

      if (inQty > 0) {
        runningQty = Number((runningQty + inQty).toFixed(4))
        runningAmount = Number((runningAmount + inAmt).toFixed(2))
        runningUnitPrice = runningQty > 0 ? Number((runningAmount / runningQty).toFixed(4)) : 0
        if (runningUnitPrice > 0) lastValidUnitPrice = runningUnitPrice
      } else if (inQty < 0) {
        const effectiveUnitPrice = runningUnitPrice > 0 ? runningUnitPrice : lastValidUnitPrice
        runningQty = Number((runningQty + inQty).toFixed(4))
        runningAmount = Number((runningQty * effectiveUnitPrice).toFixed(2))
      }

      if (outQty > 0) {
        runningQty = Number((runningQty - outQty).toFixed(4))
        runningAmount = Number((runningAmount - displayOutboundAmount).toFixed(2))
      } else if (outQty < 0) {
        const returnQty = Math.abs(outQty)
        const returnCost = Math.abs(displayOutboundAmount)
        runningQty = Number((runningQty + returnQty).toFixed(4))
        runningAmount = Number((runningAmount + returnCost).toFixed(2))
        runningUnitPrice = runningQty > 0 ? Number((runningAmount / runningQty).toFixed(4)) : 0
        if (runningUnitPrice > 0) lastValidUnitPrice = runningUnitPrice
      }

      result.push({
        productCode: row.productCode,
        productName: row.productName,
        warehouseName: row.warehouseName,
        specification: row.specification || '-',
        unit: row.unit || '-',
        date: en.date,
        type: en.type,
        docNo: en.docNo,
        docType: en.docType || '',
        docId: en.docId || 0,
        inboundQty: en.inboundQty || 0,
        inboundUnitPrice: en.inboundUnitPrice || 0,
        inboundAmount: en.inboundAmount || 0,
        outboundQty: en.outboundQty || 0,
        outboundUnitPrice: displayOutboundUnitPrice,
        outboundAmount: displayOutboundAmount,
        counter: en.counter || '',
        remark: en.remark || '',
        runningQty,
        runningUnitPrice,
        runningAmount,
        _sortDate: en._sortDate || en.date,
        _timestamp: en._timestamp
      })
    }

    const detailStartIdx = startMonth !== null && rawStartDate ? 1 : 0
    const detailRows = result.slice(detailStartIdx)
    detailRows.sort((a: any, b: any) => {
      const da = new Date(a._sortDate || a.date || '1970-01-01').getTime()
      const db_ = new Date(b._sortDate || b.date || '1970-01-01').getTime()
      if (da !== db_) return da - db_
      const ta = a._timestamp ? new Date(a._timestamp).getTime() : 0
      const tb = b._timestamp ? new Date(b._timestamp).getTime() : 0
      return ta - tb
    })
    result.splice(detailStartIdx, result.length - detailStartIdx, ...detailRows)

    let finalRunningQty = result.length > 0 && result[0]._isSummary ? result[0].runningQty : 0
    let finalRunningUnitPrice = result.length > 0 && result[0]._isSummary ? (result[0].runningUnitPrice || 0) : 0
    let finalRunningAmount = result.length > 0 && result[0]._isSummary ? (result[0].runningAmount || 0) : 0
    let lastValidFinalUnitPrice = finalRunningUnitPrice > 0 ? finalRunningUnitPrice : 0
    for (let i = (result[0]?._isSummary ? 1 : 0); i < result.length; i++) {
      const inQty = Number(result[i].inboundQty || 0)
      const outQty = Number(result[i].outboundQty || 0)
      const inAmt = Number(result[i].inboundAmount || 0)
      const outAmt = Number(result[i].outboundAmount || 0)
      if (inQty > 0) {
        finalRunningQty = Number((finalRunningQty + inQty).toFixed(4))
        finalRunningAmount = Number((finalRunningAmount + inAmt).toFixed(2))
        finalRunningUnitPrice = finalRunningQty > 0 ? Number((finalRunningAmount / finalRunningQty).toFixed(4)) : 0
        if (finalRunningUnitPrice > 0) lastValidFinalUnitPrice = finalRunningUnitPrice
      } else if (inQty < 0) {
        const effectiveInPrice = finalRunningUnitPrice > 0 ? finalRunningUnitPrice : lastValidFinalUnitPrice
        finalRunningQty = Number((finalRunningQty + inQty).toFixed(4))
        finalRunningAmount = Number((finalRunningQty * effectiveInPrice).toFixed(2))
      }
      if (outQty > 0) {
        finalRunningQty = Number((finalRunningQty - outQty).toFixed(4))
        finalRunningAmount = Number((finalRunningAmount - outAmt).toFixed(2))
      } else if (outQty < 0) {
        const returnQty = Math.abs(outQty)
        const returnCost = Math.abs(outAmt)
        finalRunningQty = Number((finalRunningQty + returnQty).toFixed(4))
        finalRunningAmount = Number((finalRunningAmount + returnCost).toFixed(2))
        finalRunningUnitPrice = finalRunningQty > 0 ? Number((finalRunningAmount / finalRunningQty).toFixed(4)) : 0
        if (finalRunningUnitPrice > 0) lastValidFinalUnitPrice = finalRunningUnitPrice
      }
      result[i].runningQty = finalRunningQty
      result[i].runningUnitPrice = finalRunningUnitPrice
      result[i].runningAmount = finalRunningAmount
    }

    if (rawEndDate) {
      const monthStart = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
      const monthEnd = `${endYear}-${String(endMonth).padStart(2, '0')}-${new Date(endYear, endMonth, 0).getDate()}`

      let monthInQty = 0, monthInAmt = 0, monthOutQty = 0, monthOutAmt = 0
      for (let i = 0; i < result.length; i++) {
        const en = result[i]
        if (en._isSummary) continue
        if (en.date >= monthStart && en.date <= monthEnd) {
          const inQty = Number(en.inboundQty || 0)
          const outQty = Number(en.outboundQty || 0)
          const inAmt = Number(en.inboundAmount || 0)
          const outAmt = Number(en.outboundAmount || 0)

          if (inQty !== 0) { monthInQty += inQty; monthInAmt += inAmt }
          if (outQty !== 0) { monthOutQty += outQty; monthOutAmt += outAmt }
        }
      }
      const totalMonthQty = Math.abs(monthInQty) + Math.abs(monthOutQty)
      const monthAvgPrice = totalMonthQty > 0 ? ((Math.abs(monthInAmt) + Math.abs(monthOutAmt)) / totalMonthQty) : 0
      result.push({
        _isSummary: true,
        _summaryType: 'monthly',
        date: `${endYear}-${String(endMonth).padStart(2, '0')}`,
        docNo: '本月合计',
        productName: row.productName,
        specification: row.specification || '-',
        unit: row.unit || '-',
        inboundQty: Number(monthInQty.toFixed(4)),
        inboundUnitPrice: Number(monthAvgPrice.toFixed(2)),
        inboundAmount: Number(monthInAmt.toFixed(2)),
        outboundQty: Number(monthOutQty.toFixed(4)),
        outboundUnitPrice: Number(monthAvgPrice.toFixed(2)),
        outboundAmount: Number(monthOutAmt.toFixed(2)),
        counter: '',
        remark: '',
        runningQty: null,
        runningUnitPrice: null,
        runningAmount: null
      })

      const yearStartStr = `${endYear}-01-01`
      let yearInQty = 0, yearInAmt = 0, yearOutQty = 0, yearOutAmt = 0
      let yearReturnInAmt = 0
      for (let i = 0; i < result.length; i++) {
        const en = result[i]
        if (en._isSummary) continue
        if (en.date >= yearStartStr && en.date <= monthEnd) {
          const inQty = Number(en.inboundQty || 0)
          const outQty = Number(en.outboundQty || 0)
          const inAmt = Number(en.inboundAmount || 0)
          const outAmt = Number(en.outboundAmount || 0)
          if (inQty !== 0) {
            yearInQty += inQty
            yearInAmt += inAmt
            if (inQty < 0) { yearReturnInAmt += Math.abs(inAmt) }
          }
          if (outQty !== 0) { yearOutQty += outQty; yearOutAmt += outAmt }
        }
      }
      const yearTotalQty = Math.abs(yearInQty) + Math.abs(yearOutQty)
      const netYearOutAmt = yearOutAmt - yearReturnInAmt
      const yearAvgPrice = yearTotalQty > 0 ? ((Math.abs(yearInAmt) + Math.abs(netYearOutAmt)) / yearTotalQty) : 0
      result.push({
        _isSummary: true,
        _summaryType: 'yearly',
        date: `${endYear}-${String(endMonth).padStart(2, '0')}`,
        docNo: '本年累计',
        productName: row.productName,
        specification: row.specification || '-',
        unit: row.unit || '-',
        inboundQty: Number(yearInQty.toFixed(4)),
        inboundUnitPrice: Number(yearAvgPrice.toFixed(2)),
        inboundAmount: Number(yearInAmt.toFixed(2)),
        outboundQty: Number(yearOutQty.toFixed(4)),
        outboundUnitPrice: Number(yearAvgPrice.toFixed(2)),
        outboundAmount: Number(netYearOutAmt.toFixed(2)),
        counter: '',
        remark: '',
        runningQty: null,
        runningUnitPrice: null,
        runningAmount: null
      })
    } else {
      let totalInQty = 0, totalInAmt = 0, totalOutQty = 0, totalOutAmt = 0
      let returnInQty = 0, returnInAmt = 0
      for (let i = 0; i < result.length; i++) {
        const en = result[i]
        if (en._isSummary) continue
        const inQty = Number(en.inboundQty || 0)
        const outQty = Number(en.outboundQty || 0)
        const inAmt = Number(en.inboundAmount || 0)
        const outAmt = Number(en.outboundAmount || 0)

        if (inQty !== 0) {
          if (inQty > 0) {
            totalInQty += inQty
            totalInAmt += inAmt
          } else {
            returnInQty += Math.abs(inQty)
            returnInAmt += Math.abs(inAmt)
            totalInQty += inQty
            totalInAmt += inAmt
          }
        }
        if (outQty !== 0) {
          if (outQty > 0) {
            totalOutQty += outQty
            totalOutAmt += outAmt
          } else {
            totalOutQty += outQty
            totalOutAmt += outAmt
          }
        }
      }

      // 计算净额：实际入库 = 正常入库 - 销售退货；实际出库 = 正常出库 - 采购退货
      const netInQty = totalInQty
      const netInAmt = totalInAmt
      const netOutQty = totalOutQty
      const netOutAmt = totalOutAmt - returnInAmt  // 出库净额需扣减销售退货金额

      const absNetInQty = Math.abs(netInQty)
      const absNetOutQty = Math.abs(netOutQty)
      result.push({
        _isSummary: true,
        _summaryType: 'total',
        date: '',
        docNo: '合计',
        productName: row.productName,
        specification: row.specification || '-',
        unit: row.unit || '-',
        inboundQty: Number(netInQty.toFixed(4)),
        inboundUnitPrice: absNetInQty > 0 ? Number((Math.abs(netInAmt) / absNetInQty).toFixed(2)) : 0,
        inboundAmount: Number(netInAmt.toFixed(2)),
        outboundQty: Number(netOutQty.toFixed(4)),
        outboundUnitPrice: absNetOutQty > 0 ? Number((Math.abs(netOutAmt) / absNetOutQty).toFixed(2)) : 0,
        outboundAmount: Number(netOutAmt.toFixed(2)),
        counter: '',
        remark: '',
        runningQty: null,
        runningUnitPrice: null,
        runningAmount: null
      })
    }

    ledgerEntries.value = result

  } catch (error) {
    console.error('[loadLedger] 加载明细失败:', error)
    ledgerEntries.value = []
  }
}

const getStockType = (stock: number, warning: number) => {
  if (stock <= 0) return 'danger'
  if (stock <= warning) return 'warning'
  return 'success'
}

const tableRowClassName = ({ row }: { row: any }) => {
  if (row._isSummary) {
    if (row._summaryType === 'carryover') return 'summary-row-carryover'
    if (row._summaryType === 'monthly') return 'summary-row-monthly'
    if (row._summaryType === 'yearly') return 'summary-row-yearly'
    if (row._summaryType === 'total') return 'summary-row-total'
  }
  return ''
}

const loadStock = async () => {
  const endDate = dateRange.value?.[1] || ''
  allStock.value = await db.getStocks(endDate)
  stockList.value = allStock.value.slice()
}

watch(dateRange, () => {
  loadStock()
})

onMounted(async () => {
  await loadWarehouses()
  await loadProducts()
  await loadStock()
})
</script>

<style scoped>
.inventory-stock-page { 
  padding: 20px; 
}

.toolbar { 
  margin-bottom: 20px; 
}

/* 产品搜索下拉选项样式 */
.product-option {
  display: flex;
  align-items: center;
  gap: 12px;
}

.product-code {
  font-weight: 600;
  color: #409eff;
  min-width: 60px;
}

.product-name {
  color: #606266;
  flex: 1;
}

/* ==================== 遮罩层 ==================== */
.stock-detail-overlay {
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
  padding: 20px;
}

/* ==================== 弹窗主体 ==================== */
.stock-detail-dialog {
  position: relative;
  width: 90%;
  max-width: 95vw;
  height: 85vh;
  min-height: 600px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ==================== ① 头部固定区 ==================== */
.stock-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.stock-detail-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.stock-detail-close {
  font-size: 18px;
  color: #909399;
  cursor: pointer;
  transition: color 0.3s;
}

.stock-detail-close:hover {
  color: #606266;
}

/* ==================== 弹窗主体内容区 ==================== */
.stock-detail-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

/* ==================== ② 产品基础信息固定区 ==================== */
.stock-detail-info {
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

/* ==================== ③ 明细表格滚动区 ==================== */
.stock-detail-table-wrapper {
  flex: 1;
  overflow: hidden;
  padding: 0;
  background: #fff;
}

/* 滚动条样式（与 Element Plus 统一） */
:deep(.el-table__body-wrapper::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #c0c4cc;
  border-radius: 4px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb:hover) {
  background: #a8abb2;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-track) {
  background: #f5f7fa;
}

/* ==================== 表格实线边框 ==================== */
.stock-detail-table-wrapper :deep(.el-table) {
  border: 1px solid #909399 !important;
}

.stock-detail-table-wrapper :deep(.el-table th.el-table__cell),
.stock-detail-table-wrapper :deep(.el-table td.el-table__cell) {
  border-right: 1px solid #c0c4cc !important;
  border-bottom: 1px solid #c0c4cc !important;
}

.stock-detail-table-wrapper :deep(.el-table .el-table__header-wrapper th),
.stock-detail-table-wrapper :deep(.el-table .el-table__fixed-header-wrapper th) {
  border-bottom: 2px solid #909399 !important;
}

.stock-detail-table-wrapper :deep(.el-table .el-table__inner-wrapper::before),
.stock-detail-table-wrapper :deep(.el-table::before),
.stock-detail-table-wrapper :deep(.el-table::after) {
  display: none !important;
}

/* 单号链接样式 */
.doc-link {
  color: #409eff;
  cursor: pointer;
  text-decoration: none;
  font-weight: 500;
}

.doc-link:hover {
  color: #337ecc;
  text-decoration: underline;
}

/* ==================== 单据查看弹窗 ==================== */
.doc-preview-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.doc-preview-dialog {
  background: #fff;
  border-radius: 8px;
  width: 720px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.doc-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.doc-preview-title {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}

.doc-preview-close {
  font-size: 18px;
  cursor: pointer;
  color: #909399;
  transition: color 0.2s;
}

.doc-preview-close:hover {
  color: #303133;
}

.doc-preview-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}

.doc-info-table {
  width: 100%;
  border-collapse: collapse;
}

.doc-info-table td {
  padding: 6px 12px;
  border: 1px solid #ebeef5;
  font-size: 13px;
}

.doc-info-table td.label {
  background: #f5f7fa;
  color: #606266;
  width: 100px;
  font-weight: 600;
  text-align: right;
}

.doc-preview-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
}

/* ==================== 表格列分组背景色 ==================== */
/* 入库数据区域 - 浅绿色背景 */
:deep(.el-table .inbound-col) {
  background-color: #f0f9eb !important;
}

:deep(.el-table__header .inbound-col) {
  background-color: #e1f3d8 !important;
  color: #2e7d32 !important;
  font-weight: 700;
  border-left: 2px solid #67c23a;
}

/* 出库数据区域 - 浅红色背景 */
:deep(.el-table .outbound-col) {
  background-color: #fef0f0 !important;
}

:deep(.el-table__header .outbound-col) {
  background-color: #fde2e2 !important;
  color: #c62828 !important;
  font-weight: 700;
  border-left: 2px solid #f56c6c;
}

/* 库存结余区域 - 浅蓝色背景 */
:deep(.el-table .stock-col) {
  background-color: #ecf5ff !important;
}

:deep(.el-table__header .stock-col) {
  background-color: #d9ecff !important;
  color: #1565c0 !important;
  font-weight: 700;
  border-left: 2px solid #409eff;
}

/* ==================== 底部关闭按钮固定区 ==================== */
.stock-detail-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
}

/* ==================== 汇总行样式（财务账簿格式）==================== */
:deep(.el-table .summary-row-carryover) {
  background-color: #fff8e1 !important;
}

:deep(.el-table .summary-row-carryover:hover > td) {
  background-color: #ffecb3 !important;
}

:deep(.el-table .summary-row-monthly) {
  background-color: #e8f5e9 !important;
  font-weight: bold;
}

:deep(.el-table .summary-row-monthly:hover > td) {
  background-color: #c8e6c9 !important;
}

:deep(.el-table .summary-row-yearly) {
  background-color: #e3f2fd !important;
  font-weight: bold;
}

:deep(.el-table .summary-row-yearly:hover > td) {
  background-color: #bbdefb !important;
}

:deep(.el-table .summary-row-total) {
  background-color: #f5f5f5 !important;
  font-weight: bold;
}

:deep(.el-table .summary-row-total:hover > td) {
  background-color: #e0e0e0 !important;
}
</style>
