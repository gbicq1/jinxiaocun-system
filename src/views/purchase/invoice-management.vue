<template>
  <div class="invoice-management-page">
    <el-card>
      <!-- 查询表单 -->
      <el-card style="margin-bottom: 20px;">
        <template #header>
          <div class="card-header">
            <span>查询条件</span>
            <el-button style="float: right; padding: 3px 0" type="text" @click="clearFilters">清空</el-button>
          </div>
        </template>
        <el-form :inline="true" :model="queryForm" class="query-form">
          <el-form-item label="日期范围">
            <el-date-picker
              v-model="queryForm.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 240px"
            />
          </el-form-item>
          <el-form-item label="供应商">
            <el-select
              v-model="queryForm.supplierId"
              placeholder="请选择供应商"
              clearable
              filterable
              style="width: 150px"
            >
              <el-option
                v-for="supplier in suppliers"
                :key="supplier.id"
                :label="supplier.name"
                :value="supplier.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="单据状态">
            <el-select
              v-model="queryForm.invoiceStatus"
              placeholder="请选择状态"
              clearable
              style="width: 150px"
            >
              <el-option label="未开票" value="uninvoiced" />
              <el-option label="已开票" value="invoiced" />
              <el-option label="部分开票" value="partial" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleQuery">查询</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 入库单列表 -->
      <el-table
        :data="filteredInvoiceList"
        style="width: 100%"
        border
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="voucherNo" label="凭证号" width="150" />
        <el-table-column prop="voucherDate" label="入库日期" width="120" />
        <el-table-column prop="supplierName" label="供应商" min-width="120" />
        <el-table-column prop="warehouseName" label="仓库" width="120" />
        <el-table-column prop="handlerName" label="经办人" width="100" />
        <el-table-column prop="originalAmount" label="入库金额" width="120">
          <template #default="{ row }">
            ¥{{ row.originalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
          </template>
        </el-table-column>
        <el-table-column prop="returnedAmount" label="退货金额" width="120">
          <template #default="{ row }">
            <span style="color: #f56c6c">-¥{{ row.returnedAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="netAmount" label="净额" width="120">
          <template #default="{ row }">
            <span style="font-weight: bold; color: #409eff">¥{{ row.netAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="invoicedAmount" label="已开票金额" width="120">
          <template #default="{ row }">
            ¥{{ row.invoicedAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
          </template>
        </el-table-column>
        <el-table-column prop="pendingAmount" label="待开票金额" width="120">
          <template #default="{ row }">
            <span :style="{ fontWeight: 'bold', color: row.pendingAmount > 0 ? '#e6a23c' : '#909399' }">
              ¥{{ row.pendingAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="invoiceStatus" label="开票状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getInvoiceStatusType(row.invoiceStatus)">
              {{ getInvoiceStatusText(row.invoiceStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleViewDetail(row)">
              查看明细
            </el-button>
            <el-button
              v-if="row.pendingAmount > 0 && !row.invoiceIssued"
              type="success"
              size="small"
              @click="handleInvoice(row)"
            >
              开票
            </el-button>
            <el-button
              v-if="row.invoiceIssued"
              type="danger"
              size="small"
              @click="handleReverseInvoice(row)"
            >
              红冲
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 查看明细对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="`入库单明细 - ${currentDetail.voucherNo}`"
      width="90%"
      :close-on-click-modal="false"
    >
      <!-- 开票日期水印（已开票时显示） -->
      <div v-if="currentDetail.invoiceIssued && currentDetail.invoiceDate" class="invoice-watermark">
        已开票 {{ currentDetail.invoiceDate }}
      </div>
      
      <!-- 入库单基本信息 -->
      <el-descriptions :column="3" border style="margin-bottom: 20px">
        <el-descriptions-item label="凭证号">{{ currentDetail.voucherNo }}</el-descriptions-item>
        <el-descriptions-item label="入库日期">{{ currentDetail.voucherDate }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ currentDetail.supplierName }}</el-descriptions-item>
        <el-descriptions-item label="仓库">{{ currentDetail.warehouseName }}</el-descriptions-item>
        <el-descriptions-item label="经办人">{{ currentDetail.handlerName }}</el-descriptions-item>
        <el-descriptions-item label="开票状态">
          <el-tag :type="currentDetail.invoiceIssued ? 'success' : getInvoiceStatusType(currentDetail.invoiceStatus)">
            {{ currentDetail.invoiceIssued ? '已开票' : getInvoiceStatusText(currentDetail.invoiceStatus) }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 金额汇总 -->
      <el-descriptions :column="4" border style="margin-bottom: 20px">
        <el-descriptions-item label="入库金额">
          ¥{{ currentDetail.originalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
        </el-descriptions-item>
        <el-descriptions-item label="退货金额">
          <span style="color: #f56c6c">-¥{{ currentDetail.returnedAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="净额">
          <span style="font-weight: bold; color: #409eff">¥{{ currentDetail.netAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="已开票金额">
          ¥{{ currentDetail.invoicedAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
        </el-descriptions-item>
        <el-descriptions-item label="待开票金额" :span="2">
          <span style="font-weight: bold; color: #e6a23c">¥{{ currentDetail.pendingAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 入库单商品明细 -->
      <el-alert
        title="入库商品明细"
        type="success"
        :closable="false"
        show-icon
        style="margin-bottom: 10px"
      />
      <div style="overflow-x: auto; margin-bottom: 20px;">
        <el-table
          :data="currentDetail.inboundItems"
          style="width: 1200px"
          border
        >
          <el-table-column prop="productName" label="商品名称" width="150" />
          <el-table-column prop="specification" label="规格" width="120" />
          <el-table-column prop="quantity" label="数量" width="100" />
          <el-table-column prop="unit" label="单位" width="80" />
          <el-table-column label="单价（不含税）" width="120">
            <template #default="{ row }">
              {{ row.unitPriceEx != null ? row.unitPriceEx.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="单价（含税）" width="120">
            <template #default="{ row }">
              {{ row.unitPrice != null ? row.unitPrice.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="税率 (%)" width="100">
            <template #default="{ row }">
              {{ row.taxRate != null ? (row.taxRate === '免税' ? '免税' : row.taxRate + '%') : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="税额" width="100">
            <template #default="{ row }">
              {{ row.taxAmount != null ? row.taxAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="金额（含税）" width="140">
            <template #default="{ row }">
              ¥{{ row.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 退货单商品明细（如果有） -->
      <template v-if="currentDetail.returnItems && currentDetail.returnItems.length > 0">
        <template v-for="(items, voucherNo) in groupedReturnItems" :key="voucherNo">
          <el-alert
            :title="'退货商品明细（退货单号：' + voucherNo + '）'"
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 10px"
          />
          <div style="overflow-x: auto; margin-bottom: 20px;">
            <el-table
              :data="items"
              style="width: 1200px"
              border
            >
              <el-table-column prop="productName" label="商品名称" width="150" />
              <el-table-column prop="specification" label="规格" width="120" />
              <el-table-column label="退货数量" width="100">
                <template #default="{ row }">
                  <span style="color: #f56c6c">{{ row.quantity < 0 ? row.quantity : -row.quantity }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="unit" label="单位" width="80" />
              <el-table-column label="单价（不含税）" width="120">
                <template #default="{ row }">
                  {{ row.unitPriceEx != null ? row.unitPriceEx.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' }}
                </template>
              </el-table-column>
              <el-table-column label="单价（含税）" width="120">
                <template #default="{ row }">
                  {{ row.unitPrice != null ? row.unitPrice.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' }}
                </template>
              </el-table-column>
              <el-table-column label="税率 (%)" width="100">
                <template #default="{ row }">
                  {{ row.taxRate != null ? row.taxRate + '%' : '-' }}
                </template>
              </el-table-column>
              <el-table-column label="税额" width="100">
                <template #default="{ row }">
                  {{ row.taxAmount != null ? row.taxAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' }}
                </template>
              </el-table-column>
              <el-table-column label="金额（含税）" width="140">
                <template #default="{ row }">
                  <span style="color: #f56c6c">-¥{{ (row.totalInc || row.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </template>

      <!-- 净额商品明细（最终开票数据） -->
      <el-alert
        title="净额商品明细（最终开票数据）"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 10px"
      />
      <div style="overflow-x: auto;">
        <el-table
          :data="currentDetail.netItems"
          style="width: 1200px"
          border
        >
          <el-table-column prop="productName" label="商品名称" width="150" />
          <el-table-column prop="specification" label="规格" width="120" />
          <el-table-column prop="quantity" label="净数量" width="100">
            <template #default="{ row }">
              <span style="font-weight: bold; color: #409eff">{{ row.quantity }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="80" />
          <el-table-column label="单价（不含税）" width="120">
            <template #default="{ row }">
              {{ row.unitPriceEx != null ? row.unitPriceEx.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="单价（含税）" width="120">
            <template #default="{ row }">
              {{ row.unitPrice != null ? row.unitPrice.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="税率 (%)" width="100">
            <template #default="{ row }">
              {{ row.taxRate != null ? (row.taxRate === '免税' ? '免税' : row.taxRate + '%') : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="税额" width="100">
            <template #default="{ row }">
              {{ row.taxAmount != null ? row.taxAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="净额（含税）" width="140">
            <template #default="{ row }">
              <span style="font-weight: bold; color: #409eff">¥{{ row.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { db } from '../../utils/db-ipc'

// 类型定义
interface InvoiceItem {
  productId: number
  productName: string
  specification: string
  quantity: number
  unit: string
  unitPrice: number
  unitPriceEx?: number
  taxRate: number | string
  taxAmount: number
  amount: number
}

interface ReturnItem {
  voucherNo: string
  productId: number
  productName: string
  specification: string
  quantity: number
  unit: string
  unitPrice: number
  unitPriceEx?: number
  unitPriceIncl?: number
  taxRate: number
  taxAmount: number
  amount: number
  totalInc?: number
}

interface NetItem {
  productId: number
  productName: string
  specification: string
  quantity: number
  unit: string
  unitPrice: number
  unitPriceEx?: number
  taxRate: number | string
  taxAmount: number
  amount: number
}

interface InvoiceRecord {
  id: number
  voucherNo: string
  voucherDate: string
  supplierId: number
  supplierName: string
  warehouseId: number
  warehouseName: string
  handlerName: string
  originalAmount: number
  returnedAmount: number
  netAmount: number
  invoicedAmount: number
  pendingAmount: number
  invoiceStatus: 'uninvoiced' | 'invoiced' | 'partial'
  invoiceIssued: boolean
  inboundItems: InvoiceItem[]
  returnItems: ReturnItem[]
  netItems: NetItem[]
}

interface Supplier {
  id: number
  name: string
  status?: number | boolean
}

interface Warehouse {
  id: number
  name: string
  status: number
}

// 状态
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const invoiceList = ref<InvoiceRecord[]>([])
const suppliers = ref<Supplier[]>([])
const warehouses = ref<Warehouse[]>([])
const selectedRows = ref<InvoiceRecord[]>([])

const queryForm = reactive({
  dateRange: [] as string[],
  supplierId: undefined as number | undefined,
  invoiceStatus: '' as string
})

const detailDialogVisible = ref(false)
const currentDetail = ref<InvoiceRecord>({
  id: 0,
  voucherNo: '',
  voucherDate: '',
  supplierId: 0,
  supplierName: '',
  warehouseId: 0,
  warehouseName: '',
  handlerName: '',
  originalAmount: 0,
  returnedAmount: 0,
  netAmount: 0,
  invoicedAmount: 0,
  pendingAmount: 0,
  invoiceStatus: 'uninvoiced',
  invoiceIssued: false,
  inboundItems: [],
  returnItems: [],
  netItems: []
})

// 计算属性：过滤后的列表
const filteredInvoiceList = computed(() => {
  let filtered = invoiceList.value

  // 日期范围过滤
  if (queryForm.dateRange && queryForm.dateRange.length === 2) {
    const startDate = dayjs(queryForm.dateRange[0])
    const endDate = dayjs(queryForm.dateRange[1]).endOf('day')
    filtered = filtered.filter(item => {
      const itemDate = dayjs(item.voucherDate)
      return itemDate.isAfter(startDate) && itemDate.isBefore(endDate)
    })
  }

  // 供应商过滤
  if (queryForm.supplierId) {
    filtered = filtered.filter(item => item.supplierId === queryForm.supplierId)
  }

  // 开票状态过滤
  if (queryForm.invoiceStatus) {
    filtered = filtered.filter(item => item.invoiceStatus === queryForm.invoiceStatus)
  }

  return filtered
})

// 计算属性：按退货单号分组的退货明细
const groupedReturnItems = computed(() => {
  const groups: Record<string, any[]> = {}
  if (currentDetail.value.returnItems) {
    for (let i = 0; i < currentDetail.value.returnItems.length; i++) {
      const item = currentDetail.value.returnItems[i]
      const voucherNo = item.voucherNo
      if (!groups[voucherNo]) {
        groups[voucherNo] = []
      }
      groups[voucherNo].push(item)
    }
  }
  return groups
})

// 获取开票状态类型
const getInvoiceStatusType = (status: string) => {
  const types: Record<string, string> = {
    uninvoiced: 'info',
    invoiced: 'success',
    partial: 'warning'
  }
  return types[status] || 'info'
}

// 获取开票状态文本
const getInvoiceStatusText = (status: string) => {
  const texts: Record<string, string> = {
    uninvoiced: '未开票',
    invoiced: '已开票',
    partial: '部分开票'
  }
  return texts[status] || '未知'
}

// 加载供应商列表（从数据库获取）
const loadSuppliers = async () => {
  try {
    suppliers.value = await db.getSuppliers()
    console.log('加载供应商列表成功（数据库），共', suppliers.value.length, '个供应商')
  } catch (error) {
    console.error('加载供应商列表失败:', error)
    suppliers.value = []
  }
}

// 加载仓库列表（从数据库获取）
const loadWarehouses = async () => {
  try {
    warehouses.value = await db.getWarehouses()
    console.log('加载仓库列表成功（数据库），共', warehouses.value.length, '个仓库')
  } catch (error) {
    console.error('加载仓库列表失败:', error)
    warehouses.value = []
  }
}

// 加载发票管理列表（核心逻辑：综合入库单和退货单）
const loadInvoiceList = async () => {
  try {
    console.log('开始加载发票管理列表...')

    // 从数据库读取数据
    let allInbounds: any[] = []
    let allReturns: any[] = []

    // 从数据库获取入库单
    console.log('从数据库获取入库单...')
    const inboundResult = await db.getInboundList(1, 1000)
    console.log('入库单结果:', inboundResult)
    allInbounds = inboundResult.data || []
    console.log('入库单数据:', allInbounds)

    // 从数据库获取退货单
    console.log('从数据库获取退货单...')
    const returnResult = await db.getPurchaseReturns(1, 1000)
    console.log('退货单结果:', returnResult)
    allReturns = returnResult.data || []
    console.log('退货单数据:', allReturns)
    
    // 获取所有开票记录
    console.log('获取开票记录...')
    const invoiceRecords: any[] = []
    for (const inbound of allInbounds) {
      try {
        console.log(`检查入库单 ${inbound.voucherNo}: invoice_issued=${inbound.invoice_issued}, invoiceIssued=${inbound.invoiceIssued}`)
        const record = await db.getInvoiceRecord(inbound.voucherNo)
        if (record) {
          invoiceRecords.push(record)
          console.log(`入库单 ${inbound.voucherNo} 的开票记录:`, record)
        } else if (inbound.invoiceIssued === true || inbound.invoiceIssued === 1) {
          // 入库单已开票但没有开票记录，自动创建
          console.log(`入库单 ${inbound.voucherNo} 已开票但无记录 (invoiceIssued=${inbound.invoiceIssued})，自动创建...`)
          const newRecord = {
            inbound_no: inbound.voucherNo,
            inbound_id: inbound.id,
            invoice_amount: inbound.total_amount || 0,
            invoice_date: inbound.invoice_date || dayjs().format('YYYY-MM-DD'),
            invoice_issued: 1
          }
          await db.saveInvoiceRecord(newRecord)
          invoiceRecords.push(newRecord)
          console.log(`已自动创建开票记录:`, newRecord)
        } else {
          console.log(`入库单 ${inbound.voucherNo} 未开票，跳过`)
        }
      } catch (error) {
        console.log(`入库单 ${inbound.voucherNo} 无开票记录，错误:`, error)
      }
    }
    
    console.log('处理入库单数据...')
    
    // 2. 创建入库单记录
    const map = new Map()
    
    console.log('开始遍历入库单，数量:', allInbounds.length)
    for (let i = 0; i < allInbounds.length; i++) {
      const ib = allInbounds[i]
      console.log(`入库单 ${i}:`, ib)
      console.log(`入库单 ${i} 的字段:`, Object.keys(ib))
      const key = ib.voucherNo
      console.log(`入库单 ${i} 的 voucherNo:`, key)
      
      // 计算入库单总金额（优先使用 totalAmount，否则计算）
      let ibTotalAmount = 0
      if (ib.totalAmount != null) {
        ibTotalAmount = Math.abs(ib.totalAmount)
      } else if (ib.items && ib.items.length > 0) {
        ibTotalAmount = Math.abs(ib.items.reduce((sum: number, item: any) => sum + (item.totalAmount || 0), 0))
      }
      
      // 确定已开票金额：从开票记录表读取，如果没有则检查入库单的 invoice_issued 字段
      const invoiceRecord = invoiceRecords.find(r => r.inbound_no === key)
      let ibInvoicedAmount = 0
      let ibInvoiceIssued = false
      let ibInvoiceDate = null
      
      if (invoiceRecord) {
        // 优先使用开票记录表的数据
        ibInvoicedAmount = invoiceRecord.invoice_amount || 0
        ibInvoiceIssued = !!invoiceRecord.invoice_issued
        ibInvoiceDate = invoiceRecord.invoice_date
      } else if (ib.invoice_issued) {
        // 如果入库单已开票但没有开票记录，使用入库单的数据
        ibInvoiceIssued = true
        ibInvoicedAmount = ibTotalAmount
        ibInvoiceDate = ib.invoice_date || dayjs().format('YYYY-MM-DD')
      }
      
      const record: InvoiceRecord = {
        id: ib.id || ib.voucherNo,
        voucherNo: ib.voucherNo,
        voucherDate: ib.voucherDate,
        supplierId: ib.supplierId,
        supplierName: ib.supplierName,
        warehouseId: ib.warehouseId,
        warehouseName: ib.warehouseName,
        handlerName: ib.handlerName || ib.operator,
        originalAmount: ibTotalAmount,
        returnedAmount: 0,
        netAmount: ibTotalAmount,
        invoicedAmount: ibInvoicedAmount,
        pendingAmount: ibTotalAmount - ibInvoicedAmount,
        invoiceStatus: 'uninvoiced',
        invoiceIssued: ibInvoiceIssued, // 从开票记录表读取的开票状态
        invoiceDate: ibInvoiceDate, // 从开票记录表读取的开票日期
        inboundItems: (ib.items || []).map((item: any, index: number) => {
          console.log(`入库单 ${i} 的明细项 ${index}:`, item)
          return {
            productId: item.productId,
            productName: item.productName,
            specification: item.specification,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            unitPriceEx: item.unitPriceEx,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            amount: item.totalAmount
          }
        }),
        returnItems: [],
        netItems: []
      }
      
      map.set(key, record)
    }
    
    // 3. 处理退货单关联
    for (let i = 0; i < allReturns.length; i++) {
      const ret = allReturns[i]
      const origNo = ret.originalVoucherNo
      
      if (!origNo) continue
      
      // 找到对应的入库单
      const invRecord = map.get(origNo)
      if (!invRecord) continue
      
      // 计算退货含税金额（使用 totalAmount，因为采购退货单没有 totalInc）
      let retInclAmount = 0
      if (ret.totalAmount != null) {
        retInclAmount = ret.totalAmount
      } else if (ret.items && ret.items.length > 0) {
        retInclAmount = ret.items.reduce((sum: number, item: any) => sum + (item.totalAmount || 0), 0)
      }
      
      // 累加退货金额（取绝对值，因为总金额可能是负数）
      invRecord.returnedAmount += Math.abs(retInclAmount)
      
      // 添加退货明细
      if (ret.items && ret.items.length > 0) {
        for (let j = 0; j < ret.items.length; j++) {
          const it = ret.items[j]
          console.log('退货明细项原始数据:', it)
          console.log('退货明细项字段:', Object.keys(it))
          const returnItem = {
            voucherNo: ret.voucherNo,
            productId: it.productId,
            productName: it.productName || '',
            specification: it.specification || '',
            quantity: -Math.abs(it.quantity || 0), // 退货数量转为负数
            unit: it.unit || '',
            unitPrice: it.unitPrice || 0,
            unitPriceEx: it.unitPriceEx || 0,
            unitPriceIncl: it.unitPriceIncl,
            taxRate: it.taxRate,
            taxAmount: -(it.taxAmount || 0), // 退货税额转为负数
            amount: -(it.totalAmount || 0), // 退货金额转为负数
            totalInc: it.totalAmount || 0 // 使用 totalAmount 作为 totalInc
          }
          console.log('退货明细项转换后:', returnItem)
          invRecord.returnItems.push(returnItem)
        }
      }
    }
    
    // 4. 计算净额和开票状态
    const list: InvoiceRecord[] = []
    
    map.forEach((record: InvoiceRecord) => {
      // 判断是否已开票
      if (record.invoiceIssued) {
        // 已开票状态：净额为0，待开票为0，净额明细为空
        record.netAmount = 0
        record.pendingAmount = 0
        record.invoiceStatus = 'invoiced'
        record.netItems = []
      } else {
        // 未开票状态：正常计算净额（入库单 - 退货单）
        record.netAmount = record.originalAmount - record.returnedAmount
        record.pendingAmount = record.netAmount - record.invoicedAmount
        
        // 更新开票状态
        if (record.invoicedAmount <= 0) {
          record.invoiceStatus = 'uninvoiced'
        } else if (record.invoicedAmount >= record.netAmount) {
          record.invoiceStatus = 'invoiced'
        } else {
          record.invoiceStatus = 'partial'
        }
        
        // 计算净额商品明细（入库商品明细 + 退货商品明细）
        const netMap = new Map<number, any>()
        
        // 先加入库商品
        for (let i = 0; i < record.inboundItems.length; i++) {
          const item = record.inboundItems[i]
          if (netMap.has(item.productId)) {
            const existing = netMap.get(item.productId)!
            existing.quantity += item.quantity
            existing.amount += item.amount
            existing.taxAmount += item.taxAmount || 0
          } else {
            netMap.set(item.productId, { 
              productId: item.productId,
              productName: item.productName,
              specification: item.specification,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              unitPriceEx: item.unitPriceEx,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount || 0,
              amount: item.amount
            })
          }
        }
        
        // 再加退货商品（退货数量已经是负数，所以直接相加）
        for (let i = 0; i < record.returnItems.length; i++) {
          const item = record.returnItems[i]
          if (netMap.has(item.productId)) {
            const existing = netMap.get(item.productId)!
            // 退货数量是负数，所以直接相加
            existing.quantity += item.quantity
            existing.amount += item.amount
            existing.taxAmount += item.taxAmount || 0
          } else {
            // 如果退货商品不在入库商品中，也添加进去（数量和金额为负）
            netMap.set(item.productId, { 
              productId: item.productId,
              productName: item.productName,
              specification: item.specification,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              unitPriceEx: item.unitPriceEx,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount || 0,
              amount: item.amount
            })
          }
        }
        
        // 转换为数组，只保留数量>0 的商品
        record.netItems = Array.from(netMap.values()).filter((item: any) => item.quantity > 0)
      }
      
      list.push(record)
    })
    
    // 5. 赋值
    invoiceList.value = list
    total.value = list.length
    
  } catch (err) {
    console.error('加载失败:', err)
    ElMessage.error('加载数据失败')
  }
}

// 查询
const handleQuery = () => {
  currentPage.value = 1
}

// 清空筛选
const clearFilters = () => {
  queryForm.dateRange = []
  queryForm.supplierId = undefined
  queryForm.invoiceStatus = ''
  handleQuery()
}

// 分页
const handleSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

// 选择变化
const handleSelectionChange = (selection: any[]) => {
  selectedRows.value = selection
}

// 查看明细
const handleViewDetail = (row: InvoiceRecord) => {
  console.log('查看明细 - 原始数据:', row)
  console.log('voucherNo:', row.voucherNo)
  console.log('inboundItems:', row.inboundItems)
  // 使用 JSON 序列化来避免响应式问题
  currentDetail.value = JSON.parse(JSON.stringify(row))
  console.log('当前明细数据:', currentDetail.value)
  detailDialogVisible.value = true
}

// 开票
const handleInvoice = async (row: InvoiceRecord) => {
  if (row.pendingAmount <= 0) {
    ElMessage.warning('该单据没有待开票金额')
    return
  }
  
  // 开票金额应该是净额（入库金额 - 退货金额）
  const netAmount = row.originalAmount - Math.abs(row.returnedAmount)
  
  ElMessageBox.confirm('确定要对该单据进行开票吗？\n\n开票金额：¥' + netAmount.toFixed(2), '开票确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    // 只更新开票记录表，不影响原始入库单
    try {
      const recordData = {
        inbound_no: row.voucherNo,
        inbound_id: row.id,
        invoice_amount: netAmount,
        invoice_date: dayjs().format('YYYY-MM-DD'),
        invoice_issued: 1
      }

      await db.saveInvoiceRecord(recordData)

      // 重新加载列表
      await loadInvoiceList()

      ElMessage.success(`开票成功，开票金额：¥${netAmount.toFixed(2)}`)
    } catch (error: any) {
      console.error('开票失败:', error)
      ElMessage.error('开票失败：' + (error.message || '未知错误'))
    }
  }).catch(() => {
    // 用户取消
  })
}

// 红冲（撤回开票）
const handleReverseInvoice = async (row: InvoiceRecord) => {
  if (!row.invoiceIssued) {
    ElMessage.warning('该单据未开票，无需红冲')
    return
  }
  
  ElMessageBox.confirm(
    `确定要对该单据进行红冲吗？\n\n凭证号：${row.voucherNo}\n红冲金额：¥${row.invoicedAmount.toFixed(2)}\n\n红冲后将：\n1. 清除开票状态\n2. 重置已开票金额为 0\n3. 恢复待开票金额\n\n此操作不可逆，请谨慎操作！`,
    '红冲确认',
    {
      confirmButtonText: '确定红冲',
      cancelButtonText: '取消',
      type: 'warning',
      distinguishCancelAndClose: true
    }
  ).then(async () => {
    try {
      console.log('开始红冲操作，凭证号:', row.voucherNo)
      
      // 更新开票记录表
      const recordData = {
        inbound_no: row.voucherNo,
        inbound_id: row.id,
        invoice_amount: 0,
        invoice_date: null,
        invoice_issued: 0
      }

      await db.saveInvoiceRecord(recordData)
      console.log('数据库更新成功')

      // 重新加载列表
      await loadInvoiceList()
      console.log('列表重新加载完成')

      ElMessage.success(`红冲成功，单据已恢复为未开票状态，红冲金额：¥${row.invoicedAmount.toFixed(2)}`)
    } catch (error: any) {
      console.error('红冲失败:', error)
      ElMessage.error('红冲失败：' + (error.message || '未知错误'))
    }
  }).catch(() => {
    console.log('用户取消红冲操作')
  })
}

// 生命周期
onMounted(async () => {
  await loadSuppliers()
  await loadWarehouses()
  await loadInvoiceList()
})
</script>

<style scoped>
.invoice-management-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.invoice-watermark {
  position: absolute;
  top: 20px;
  right: 30px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #67c23a 0%, #529b2e 100%);
  color: white;
  font-weight: bold;
  font-size: 14px;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(103, 194, 58, 0.3);
  z-index: 10;
  animation: watermark-pulse 2s ease-in-out infinite;
}

@keyframes watermark-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
  }
}
</style>
