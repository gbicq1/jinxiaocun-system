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
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleViewDetail(row)">
              查看明细
            </el-button>
            <el-button
              v-if="row.pendingAmount > 0"
              type="success"
              size="small"
              @click="handleInvoice(row)"
            >
              开票
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
                  <span style="color: #f56c6c">-{{ row.quantity }}</span>
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

// 加载供应商列表
const loadSuppliers = () => {
  try {
    const savedSuppliers = localStorage.getItem('suppliers')
    if (savedSuppliers) {
      suppliers.value = JSON.parse(savedSuppliers).filter((s: Supplier) => s.status !== 0)
    }
  } catch (error) {
    console.error('加载供应商列表失败:', error)
  }
}

// 加载仓库列表
const loadWarehouses = () => {
  try {
    const savedWarehouses = localStorage.getItem('warehouses')
    if (savedWarehouses) {
      warehouses.value = JSON.parse(savedWarehouses).filter((w: Warehouse) => w.status !== 0)
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error)
  }
}

// 加载发票管理列表（核心逻辑：综合入库单和退货单）
const loadInvoiceList = async () => {
  try {
    console.log('开始加载发票管理列表...')
    
    // 从数据库读取数据
    let allInbounds: any[] = []
    let allReturns: any[] = []
    
    // 检查是否在 Electron 环境
    if (window.electron && window.electron.inboundList) {
      // 从数据库获取入库单
      console.log('从数据库获取入库单...')
      const inboundResult = await window.electron.inboundList(1, 1000)
      console.log('入库单结果:', inboundResult)
      allInbounds = inboundResult.data || []
      console.log('入库单数据:', allInbounds)
      
      // 从数据库获取退货单
      if (window.electron.purchaseReturnList) {
        console.log('从数据库获取退货单...')
        const returnResult = await window.electron.purchaseReturnList(1, 1000)
        console.log('退货单结果:', returnResult)
        allReturns = returnResult.data || []
        console.log('退货单数据:', allReturns)
      }
    } else {
      // 非 Electron 环境，使用 localStorage（兼容开发测试）
      console.log('从 localStorage 获取数据...')
      const inboundsData = localStorage.getItem('inbound_records')
      const returnsData = localStorage.getItem('purchaseReturns')
      
      allInbounds = inboundsData ? JSON.parse(inboundsData) : []
      allReturns = returnsData ? JSON.parse(returnsData) : []
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
      
      // 确定已开票金额：如果入库单已开票，则已开票金额 = 总金额
      let ibInvoicedAmount = 0
      if (ib.invoiceIssued) {
        ibInvoicedAmount = ibTotalAmount
      } else if (ib.invoicedAmount != null) {
        ibInvoicedAmount = ib.invoicedAmount
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
        invoiceIssued: ib.invoiceIssued || false, // 保存入库单的开票状态
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
          invRecord.returnItems.push({
            voucherNo: ret.voucherNo,
            productId: it.productId,
            productName: it.productName,
            specification: it.specification,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
            unitPriceEx: it.unitPriceEx,
            unitPriceIncl: it.unitPriceIncl,
            taxRate: it.taxRate,
            taxAmount: it.taxAmount,
            amount: it.totalAmount,
            totalInc: it.totalAmount // 使用 totalAmount 作为 totalInc
          })
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
        
        // 再加退货商品（因为退货商品的数量和金额都是正数，所以需要减去）
        for (let i = 0; i < record.returnItems.length; i++) {
          const item = record.returnItems[i]
          if (netMap.has(item.productId)) {
            const existing = netMap.get(item.productId)!
            // 退货数量是正数，所以需要减去
            existing.quantity -= Math.abs(item.quantity)
            existing.amount -= Math.abs(item.totalInc)
            existing.taxAmount -= Math.abs(item.taxAmount || 0)
          } else {
            // 如果退货商品不在入库商品中，也添加进去（但数量和金额为负）
            netMap.set(item.productId, { 
              productId: item.productId,
              productName: item.productName,
              specification: item.specification,
              quantity: -Math.abs(item.quantity),
              unit: item.unit,
              unitPrice: item.unitPrice,
              unitPriceEx: item.unitPriceEx,
              taxRate: item.taxRate,
              taxAmount: -Math.abs(item.taxAmount || 0),
              amount: -Math.abs(item.totalInc)
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
  
  ElMessageBox.prompt('请输入开票金额', '开票', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: row.pendingAmount.toFixed(2),
    inputPattern: /^\d+(\.\d{1,2})?$/,
    inputErrorMessage: '请输入有效的金额'
  }).then(async ({ value }) => {
    const invoiceAmount = parseFloat(value)
    if (invoiceAmount > row.pendingAmount) {
      ElMessage.error('开票金额不能大于待开票金额')
      return
    }
    
    // 更新入库单的已开票金额
    try {
      if (window.electron && window.electron.inboundUpdate) {
        // 从数据库获取入库单
        const inboundResult = await window.electron.inboundList(1, 1000)
        const inbounds = inboundResult.data || []
        
        const inbound = inbounds.find((o: any) => o.voucherNo === row.voucherNo)
        if (inbound) {
          // 更新已开票金额
          const updatedInbound = {
            ...inbound,
            invoicedAmount: (inbound.invoicedAmount || 0) + invoiceAmount,
            invoiceDate: dayjs().format('YYYY-MM-DD')
          }
          
          await window.electron.inboundUpdate(updatedInbound)
          
          // 重新加载列表
          loadInvoiceList()
          
          ElMessage.success(`开票成功，开票金额：¥${invoiceAmount.toFixed(2)}`)
        }
      } else {
        // 非 Electron 环境，使用 localStorage
        const savedInbounds = localStorage.getItem('inbound_records')
        const inbounds = savedInbounds ? JSON.parse(savedInbounds) : []
        
        const inbound = inbounds.find((o: any) => o.voucherNo === row.voucherNo)
        if (inbound) {
          inbound.invoicedAmount = (inbound.invoicedAmount || 0) + invoiceAmount
          inbound.invoiceDate = dayjs().format('YYYY-MM-DD')
          
          localStorage.setItem('inbound_records', JSON.stringify(inbounds))
          
          // 重新加载列表
          loadInvoiceList()
          
          ElMessage.success(`开票成功，开票金额：¥${invoiceAmount.toFixed(2)}`)
        }
      }
    } catch (error) {
      console.error('开票失败:', error)
      ElMessage.error('开票失败')
    }
  }).catch(() => {
    // 用户取消
  })
}

// 生命周期
onMounted(() => {
  loadSuppliers()
  loadWarehouses()
  loadInvoiceList()
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
</style>
