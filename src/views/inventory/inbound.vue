<template>
  <div class="inbound-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增入库单
        </el-button>
        <el-button type="success" @click="handlePrintCurrent">
          <el-icon><Printer /></el-icon>
          打印当前单据
        </el-button>
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出 Excel
        </el-button>
      </div>

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
          <el-form-item label="金额范围">
            <el-input-number
              v-model="queryForm.minAmount"
              :min="0"
              :precision="2"
              :step="0.01"
              controls-position="right"
              placeholder="最小金额"
              style="width: 120px"
            />
            <span style="margin: 0 10px">-</span>
            <el-input-number
              v-model="queryForm.maxAmount"
              :min="0"
              :precision="2"
              :step="0.01"
              controls-position="right"
              placeholder="最大金额"
              style="width: 120px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleQuery">查询</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-table
        :data="filteredInbounds"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="voucherNo" label="凭证号" width="150" />
        <el-table-column prop="voucherDate" label="日期" width="120" />
        <el-table-column prop="supplierName" label="供应商" min-width="120" />
        <el-table-column prop="warehouseName" label="仓库" width="120">
          <template #default="{ row }">
            {{ row.warehouseName || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="itemCount" label="商品行数" width="80">
          <template #default="{ row }">
            {{ row.items?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="总金额" width="120">
          <template #default="{ row }">
            ¥{{ row.totalAmount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
          </template>
        </el-table-column>
        <el-table-column prop="paidAmount" label="已付款" width="120">
          <template #default="{ row }">
            <span :style="{ color: (row.paidAmount || 0) > 0 ? '#67c23a' : '#999' }">
              ¥{{ (row.paidAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="经办人" width="100" />
        <el-table-column prop="remark" label="备注" min-width="150" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" @click="handleView(row)">查看</el-button>
              <el-button type="warning" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="success" size="small" @click="handlePrint(row)">打印</el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </div>
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

    <!-- 新增/编辑入库单对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="90%"
      :close-on-click-modal="false"
      @close="handleDialogClose"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="100px"
        :disabled="isViewMode"
      >
        <!-- 单据头部信息 -->
        <el-alert
          title="入库单头部信息"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        />
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="凭证号" prop="voucherNo">
              <el-input v-model="formData.voucherNo" placeholder="自动生成" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入库日期" prop="voucherDate">
              <el-date-picker
                v-model="formData.voucherDate"
                type="date"
                placeholder="选择日期"
                style="width: 100%"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="供应商" prop="supplierId">
              <el-select
                v-model="formData.supplierId"
                placeholder="请选择供应商"
                style="width: 100%"
                filterable
                @change="handleSupplierChange"
              >
                <el-option
                  v-for="supplier in suppliers"
                  :key="supplier.id"
                  :label="supplier.name"
                  :value="supplier.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="仓库" prop="warehouseId">
              <el-select
                v-model="formData.warehouseId"
                placeholder="请选择仓库"
                style="width: 100%"
                filterable
                @change="handleWarehouseChange"
              >
                <el-option
                  v-for="warehouse in warehouses"
                  :key="warehouse.id"
                  :label="warehouse.name"
                  :value="warehouse.id"
                >
                  <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span>{{ warehouse.name }}</span>
                    <el-switch
                      v-if="!isViewMode"
                      :model-value="defaultWarehouseId === warehouse.id"
                      :active-value="true"
                      :inactive-value="false"
                      inline-prompt
                      active-text="默认"
                      inactive-text=""
                      style="--el-switch-width: 60px; --el-switch-inactive-color: #dcdfe6;"
                      @click.stop
                      @change="(val: boolean) => saveDefaultWarehouse(warehouse.id)"
                    />
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="经办人" prop="operator">
              <el-input v-model="formData.operator" placeholder="自动获取当前用户" disabled />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 商品明细表格 -->
        <el-alert
          title="商品明细"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        />
        
        <el-table
          :data="formData.items"
          style="width: 100%"
          border
        >
          <el-table-column label="序号" width="60" type="index" />
          <el-table-column label="商品" min-width="130">
            <template #default="{ row, $index }">
              <el-select
                v-model="row.productId"
                placeholder="请选择商品"
                style="width: 100%"
                filterable
                @change="handleProductChange($index, $event)"
              >
                <el-option
                  v-for="product in productList"
                  :key="product.id"
                  :label="`${product.code} - ${product.name}`"
                  :value="product.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="商品名称" min-width="100">
            <template #default="{ row }">
              <el-input v-model="row.productName" disabled />
            </template>
          </el-table-column>
          <el-table-column label="规格" width="120">
            <template #default="{ row }">
              <el-input v-model="row.specification" disabled />
            </template>
          </el-table-column>
          <el-table-column label="数量" width="100">
            <template #default="{ row }">
              <el-input-number
                v-model="row.quantity"
                :min="0"
                :precision="2"
                :controls="false"
                style="width: 100%"
                @focus="handleFocus(row, 'quantity')"
                @change="onQuantityChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="单位" width="80">
            <template #default="{ row }">
              <el-input v-model="row.unit" disabled />
            </template>
          </el-table-column>
          <el-table-column label="单价 (不含税)" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.unitPriceEx"
                :min="0"
                :precision="2"
                :step="0.01"
                :controls="false"
                style="width: 100%"
                @focus="handleFocus(row, 'unitPriceEx')"
                @change="onUnitPriceExChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="单价 (含税)" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.unitPrice"
                :min="0"
                :precision="2"
                :step="0.01"
                :controls="false"
                style="width: 100%"
                @focus="handleFocus(row, 'unitPrice')"
                @change="onUnitPriceChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="税率 (%)" width="120">
            <template #default="{ row }">
              <el-select
                v-model="row.taxRate"
                filterable
                allow-create
                placeholder="选择或输入税率"
                style="width: 100%"
                @change="onTaxRateChange(row)"
              >
                <el-option label="免税" :value="'免税'" />
                <el-option label="1%" :value="1" />
                <el-option label="3%" :value="3" />
                <el-option label="5%" :value="5" />
                <el-option label="6%" :value="6" />
                <el-option label="9%" :value="9" />
                <el-option label="13%" :value="13" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="税额" width="100">
            <template #default="{ row }">
              <el-input v-model="row.taxAmount" disabled />
            </template>
          </el-table-column>
          <el-table-column label="金额 (不含税)" width="120">
            <template #default="{ row }">
              <el-input v-model="row.totalAmountEx" disabled />
            </template>
          </el-table-column>
          <el-table-column label="金额 (含税)" width="140">
            <template #default="{ row }">
              <el-input-number
                v-model="row.totalAmount"
                :min="0"
                :precision="2"
                :controls="false"
                style="width: 100%"
                @focus="handleFocus(row, 'totalAmount')"
                @change="onAmountChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="加计扣除" width="100">
            <template #default="{ row }">
              <el-switch
                v-model="row.allowDeduction"
                active-text="是"
                inactive-text="否"
                :disabled="!(formData.invoiceIssued && formData.invoiceType === '普票' && row.taxRate === '免税')"
                @change="onDeductionSwitchChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ $index }">
              <el-button type="danger" size="small" @click="removeItem($index)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        
        <el-button
          type="primary"
          icon="Plus"
          style="margin-top: 10px"
          @click="addItem"
        >
          添加商品行
        </el-button>

        <el-alert
          v-if="formData.items.some(i => i.allowDeduction)"
          title="加计扣除说明：加计扣除金额 = 金额（含税）× 9%"
          type="info"
          :closable="false"
          show-icon
          style="margin: 20px 0"
        />

        <el-alert title="单据汇总" type="success" :closable="false" show-icon style="margin: 20px 0" />

        <el-row :gutter="20" style="margin-bottom: 10px">
          <el-col :span="12">
            <div style="font-size: 14px">已付款：
              <el-input-number v-model="formData.paidAmount" :min="0" :precision="2" :controls="false" style="width:160px" @focus="handlePaidAmountFocus" /> 元
            </div>
          </el-col>
          <el-col :span="12" style="text-align: right">
            <div style="font-size: 14px">发票：
              <el-switch v-model="formData.invoiceIssued" active-text="已开票" inactive-text="未开票" active-color="#13ce66" inactive-color="#ff4949" @change="handleInvoiceIssuedChange" />
              <span v-if="formData.invoiceIssued" style="margin-left: 20px">
                发票类型：
                <el-select
                  v-model="formData.invoiceType"
                  placeholder="选择发票类型"
                  size="small"
                  style="width: 120px"
                  @change="handleInvoiceTypeChange"
                >
                  <el-option label="普票" value="普票" />
                  <el-option label="专票" value="专票" />
                </el-select>
              </span>
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="20" style="background: #f5f7fa; padding: 15px; border-radius: 4px">
          <el-col :span="8">
            <div style="font-size: 16px; font-weight: bold">
              商品行数：{{ formData.items?.length || 0 }}
            </div>
          </el-col>
          <el-col :span="8" style="text-align: center">
            <div style="font-size: 16px; font-weight: bold; color: #67c23a">
              已付款：¥{{ (formData.paidAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
            </div>
          </el-col>
          <el-col :span="8" style="text-align: right">
            <div style="font-size: 18px; font-weight: bold; color: #f56c6c">
              合计金额：¥{{ totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
            </div>
          </el-col>
        </el-row>

        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import exportToCsv from '../../utils/exportCsv'
import * as XLSX from 'xlsx'
import { handleDocumentSave, DocumentType } from '@/utils/cost-recalculation'
import { db } from '@/utils/db-ipc'

// 定义接口
interface InboundItem {
  productId?: number
  productName: string
  specification: string
  quantity: number
  unit: string
  unitPriceEx?: number
  unitPrice: number
  taxRate: number | string
  taxAmount: number
  totalAmountEx?: number
  totalAmount: number
  allowDeduction?: boolean
  deductionAmount?: number
  _lastEdited?: 'unitEx' | 'unitIncl' | 'amount'
}

interface InboundRecord {
  id?: number
  voucherNo: string
  voucherDate: string
  supplierId?: number
  supplierName: string
  warehouseId?: number
  warehouseName?: string
  operator: string
  items: InboundItem[]
  totalAmount: number
  paidAmount: number
  remark?: string
  invoiceIssued?: boolean
  invoiceType?: string
}

interface Product {
  id: number
  code: string
  name: string
  specification?: string
  unit?: string
  costPrice?: number
}

interface Supplier {
  id: number
  name: string
}

interface Warehouse {
  id: number
  code: string
  name: string
  status: number
}

// 响应式数据
const inboundList = ref<InboundRecord[]>([])
const productList = ref<Product[]>([])
const suppliers = ref<Supplier[]>([])
const warehouses = ref<Warehouse[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const dialogVisible = ref(false)
const dialogTitle = ref('新增入库单')
const isViewMode = ref(false)
const formRef = ref()
const selectedRow = ref<InboundRecord | null>(null)
const defaultWarehouseId = ref<number | undefined>()
const defaultHandlerId = ref<number | undefined>()

const queryForm = reactive({
  dateRange: [] as string[],
  supplierId: undefined as number | undefined,
  minAmount: undefined as number | undefined,
  maxAmount: undefined as number | undefined
})

const filteredInbounds = computed(() => {
  const sourceArray = inboundList.value || []
  let filtered = [...sourceArray]

  if (queryForm.dateRange && Array.isArray(queryForm.dateRange) && queryForm.dateRange.length === 2) {
    const [startDate, endDate] = queryForm.dateRange
    if (startDate && endDate) {
      filtered = filtered.filter(record => {
        if (!record.voucherDate) return false
        return record.voucherDate >= startDate && record.voucherDate <= endDate
      })
    }
  }

  if (queryForm.supplierId !== undefined && queryForm.supplierId !== null) {
    filtered = filtered.filter(record => record.supplierId === queryForm.supplierId)
  }

  if (typeof queryForm.minAmount === 'number' && !isNaN(queryForm.minAmount)) {
    filtered = filtered.filter(record => record.totalAmount >= queryForm.minAmount)
  }
  if (typeof queryForm.maxAmount === 'number' && !isNaN(queryForm.maxAmount)) {
    filtered = filtered.filter(record => record.totalAmount <= queryForm.maxAmount)
  }

  filtered.sort((a: any, b: any) => {
    const dateA = new Date(a.voucherDate || '1970-01-01').getTime()
    const dateB = new Date(b.voucherDate || '1970-01-01').getTime()
    if (dateA !== dateB) return dateB - dateA
    const timeA = a.createdAt || a.voucherDate || '1970-01-01'
    const timeB = b.createdAt || b.voucherDate || '1970-01-01'
    return new Date(timeB).getTime() - new Date(timeA).getTime()
  })

  return filtered
})

// 表单数据
const formData = reactive<InboundRecord>({
  voucherNo: '',
  voucherDate: dayjs().format('YYYY-MM-DD'),
  supplierId: undefined,
  supplierName: '',
  warehouseId: undefined,
  warehouseName: '',
  operator: '',
  items: [],
  totalAmount: 0,
  paidAmount: 0,
  remark: '',
  invoiceIssued: false,
  invoiceType: '普票'
})

// 表单验证规则
const rules = {
  voucherNo: [{ required: true, message: '请输入凭证号', trigger: 'blur' }],
  voucherDate: [{ required: true, message: '请选择入库日期', trigger: 'change' }],
  supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  items: [{ required: true, message: '请至少添加一行商品', trigger: 'blur' }]
}

// 计算合计金额
const totalAmount = computed(() => {
  return formData.items.reduce((sum, item) => sum + item.totalAmount, 0)
})

// 生成凭证号
const generateVoucherNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `RK${date}${random}`
}

// 加载入库单列表（从数据库获取）
const loadInboundList = async () => {
  try {
    console.log('开始加载入库单列表...')

    const result = await db.getInboundList(currentPage.value, pageSize.value)
    console.log('入库单列表结果:', result)

    inboundList.value = result.data || []
    total.value = result.total || 0

    console.log('处理后的入库单列表:', inboundList.value)
  } catch (error) {
    ElMessage.error('加载入库单列表失败')
    console.error('加载入库单列表出错:', error)
    inboundList.value = []
    total.value = 0
  }
}

// 加载产品列表（从数据库获取）
const loadProducts = async () => {
  try {
    const allProducts = await db.getProducts()
    productList.value = allProducts
      .filter((p: any) => (p.status as any) === 1 || (p.status as any) === true)
      .map((p: any) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        specification: p.specification || p.spec || '',
        unit: p.unit || '',
        costPrice: p.costPrice || 0,
        taxRate: p.taxRate || p.tax_rate || ''
      }))
    console.log('加载产品列表成功（数据库），共', productList.value.length, '个产品')
  } catch (error) {
    console.error('加载产品列表失败:', error)
    productList.value = []
  }
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

    // 从 localStorage 读取用户偏好设置：默认仓库
    const savedDefaultWarehouse = localStorage.getItem('defaultWarehouseId')
    if (savedDefaultWarehouse) {
      defaultWarehouseId.value = parseInt(savedDefaultWarehouse)
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error)
    warehouses.value = []
  }
}

// 加载当前用户信息
const loadCurrentUser = async () => {
  try {
    // 从 localStorage 获取当前用户
    const currentUser = localStorage.getItem('currentUser')
    if (currentUser) {
      const user = JSON.parse(currentUser)
      formData.operator = user.name || user.username || '未知用户'
    } else {
      formData.operator = '系统用户'
    }
  } catch (error) {
    console.error(error)
    formData.operator = '系统用户'
  }
}

// 新增入库单
const handleAdd = () => {
  dialogTitle.value = '新增入库单'
  isViewMode.value = false
  Object.assign(formData, {
    voucherNo: generateVoucherNo(),
    voucherDate: dayjs().format('YYYY-MM-DD'),
    supplierId: undefined,
    supplierName: '',
    warehouseId: defaultWarehouseId.value,
    warehouseName: '',
    operator: localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')!).name : '系统用户',
    items: [],
    totalAmount: 0,
    paidAmount: 0,
    remark: '',
    invoiceIssued: false,
    invoiceType: '普票'
  })
  
  // 如果设置了默认仓库，获取仓库名称
  if (defaultWarehouseId.value) {
    const warehouse = warehouses.value.find(w => w.id === defaultWarehouseId.value)
    if (warehouse) {
      formData.warehouseName = warehouse.name
    }
  }
  
  dialogVisible.value = true
}

// 编辑入库单
const handleEdit = (row: InboundRecord) => {
  dialogTitle.value = '编辑入库单'
  isViewMode.value = false
  
  const items = row.items ? JSON.parse(JSON.stringify(row.items)) : []
  items.forEach((item: any) => {
    item._lastEdited = undefined
  })
  
  Object.assign(formData, {
    ...row,
    items: items
  })
  selectedRow.value = row
  dialogVisible.value = true
}

// 删除入库单
const handleDelete = async (row: InboundRecord) => {
  try {
    await ElMessageBox.confirm('确定要删除该入库单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await db.deleteInbound(row.id)

    ElMessage.success('删除成功')
    loadInboundList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 查看入库单（只读模式）
const handleView = (row: InboundRecord) => {
  console.log('查看入库单:', row)
  dialogTitle.value = '查看入库单'
  isViewMode.value = true
  
  // 使用深拷贝避免数据被修改
  const viewData = JSON.parse(JSON.stringify(row))
  if (viewData.items) {
    viewData.items.forEach((item: any) => {
      item._lastEdited = undefined
    })
  }
  Object.assign(formData, viewData)
  
  selectedRow.value = row
  dialogVisible.value = true
}

// 关闭对话框
const handleDialogClose = () => {
  isViewMode.value = false
  formRef.value?.resetFields()
}

// 添加商品行
const addItem = () => {
  formData.items.push({
    productId: undefined,
    productName: '',
    specification: '',
    quantity: undefined,
    unit: '',
    unitPriceEx: undefined,
    unitPrice: undefined,
    taxRate: 13,
    taxAmount: undefined,
    totalAmountEx: undefined,
    totalAmount: undefined,
    allowDeduction: false,
    deductionAmount: 0,
    _lastEdited: undefined
  })
}

// 删除商品行
const removeItem = (index: number) => {
  formData.items.splice(index, 1)
  calculateTotalAmount()
}

// 处理输入框聚焦事件，清空 0 值让用户直接输入
const handleFocus = (row: any, field: string) => {
  const value = row[field]
  if (value === 0 || value === '0') {
    row[field] = ''
  }
}

const handlePaidAmountFocus = () => {
  if (formData.paidAmount === 0 || formData.paidAmount === '0') {
    formData.paidAmount = '' as any
  }
}

// 处理商品选择变化
const handleProductChange = (index: number, productId: number) => {
  const product = productList.value.find(p => p.id === productId)
  if (product) {
    const item = formData.items[index]
    item.productName = product.name
    item.specification = product.spec || product.specification || product.code || ''
    item.unit = product.unit || ''
    item.unitPrice = product.costPrice || 0
    const productTaxRate = product.taxRate || product.tax_rate || ''
    if (productTaxRate && productTaxRate !== '') {
      item.taxRate = productTaxRate
    }
    item._lastEdited = 'unitIncl'
    calculateRowTotal(item)
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100

// 单价（不含税）变化时触发
const onUnitPriceExChange = (item: InboundItem) => {
  item._lastEdited = 'unitEx'
  calculateRowTotal(item)
}

// 单价（含税）变化时触发
const onUnitPriceChange = (item: InboundItem) => {
  item._lastEdited = 'unitIncl'
  calculateRowTotal(item)
}

// 金额（含税）变化时触发
const onAmountChange = (item: InboundItem) => {
  item._lastEdited = 'amount'
  calculateRowTotal(item)
}

// 数量变化时触发
const onQuantityChange = (item: InboundItem) => {
  if (!item._lastEdited) {
    if (item.unitPriceEx || item.unitPriceEx === 0) {
      item._lastEdited = 'unitEx'
    } else if (item.unitPrice || item.unitPrice === 0) {
      item._lastEdited = 'unitIncl'
    } else if (item.totalAmount || item.totalAmount === 0) {
      item._lastEdited = 'amount'
    }
  }
  calculateRowTotal(item)
}

// 加计扣除开关变化时触发
const onDeductionSwitchChange = (item: InboundItem) => {
  if (!(formData.invoiceIssued && formData.invoiceType === '普票' && item.taxRate === '免税')) {
    item.allowDeduction = false
    ElMessage.warning('只有已开票、普票、免税商品才允许加计扣除')
  }
  calculateRowTotal(item)
}

// 税率变化时触发
const onTaxRateChange = (item: InboundItem) => {
  if (!(formData.invoiceIssued && formData.invoiceType === '普票' && item.taxRate === '免税') && item.allowDeduction) {
    item.allowDeduction = false
  }
  calculateRowTotal(item)
}

// 计算单行总额
const calculateRowTotal = (item: InboundItem) => {
  const qty = item.quantity || 0
  const taxRaw = item.taxRate === '免税' ? 0 : Number(item.taxRate || 0)
  const r = taxRaw / 100
  const isDeduction = item.allowDeduction && formData.invoiceIssued && formData.invoiceType === '普票' && item.taxRate === '免税'

  const last = item._lastEdited
  
  if (!last) {
    return
  }

  if (last === 'unitEx') {
    const unitEx = Number(item.unitPriceEx || 0)
    let unitIncl: number
    let taxAmount: number
    let totalAmount: number
    let totalAmountEx: number
    let deductionAmount: number
    
    if (isDeduction) {
      totalAmount = round2(unitEx * qty / 0.91)
      unitIncl = round2(totalAmount / qty)
      taxAmount = round2(qty * (unitIncl - unitEx))
      totalAmountEx = round2(unitEx * qty)
      deductionAmount = round2(totalAmount * 0.09)
    } else {
      unitIncl = r === 0 ? unitEx : round2(unitEx * (1 + r))
      taxAmount = round2(qty * (unitIncl - unitEx))
      totalAmount = round2(unitIncl * qty)
      totalAmountEx = round2(unitEx * qty)
      deductionAmount = 0
    }
    item.unitPrice = unitIncl
    item.taxAmount = taxAmount
    item.totalAmount = totalAmount
    item.totalAmountEx = totalAmountEx
    item.deductionAmount = deductionAmount
  } else if (last === 'unitIncl') {
    const unitIncl = Number(item.unitPrice || 0)
    let unitEx: number
    let taxAmount: number
    let totalAmount: number
    let totalAmountEx: number
    let deductionAmount: number
    
    if (isDeduction) {
      totalAmount = round2(unitIncl * qty)
      unitEx = round2(unitIncl * 0.91)
      taxAmount = round2(qty * (unitIncl - unitEx))
      totalAmountEx = round2(unitEx * qty)
      deductionAmount = round2(totalAmount * 0.09)
    } else {
      unitEx = r === 0 ? unitIncl : round2(unitIncl / (1 + r))
      taxAmount = round2(qty * (unitIncl - unitEx))
      totalAmount = round2(unitIncl * qty)
      totalAmountEx = round2(unitEx * qty)
      deductionAmount = 0
    }
    item.unitPriceEx = unitEx
    item.taxAmount = taxAmount
    item.totalAmount = totalAmount
    item.totalAmountEx = totalAmountEx
    item.deductionAmount = deductionAmount
  } else if (last === 'amount') {
    const total = Number(item.totalAmount || 0)
    if (qty === 0) {
      item.unitPrice = 0
      item.unitPriceEx = 0
      item.taxAmount = 0
      item.totalAmountEx = 0
      item.deductionAmount = 0
    } else {
      let unitIncl: number
      let unitEx: number
      let taxAmount: number
      let totalAmountEx: number
      let deductionAmount: number
      
      if (isDeduction) {
        unitIncl = round2(total / qty)
        unitEx = round2(total * 0.91 / qty)
        taxAmount = round2(qty * (unitIncl - unitEx))
        totalAmountEx = round2(unitEx * qty)
        deductionAmount = round2(total * 0.09)
      } else {
        unitIncl = round2(total / qty)
        unitEx = r === 0 ? unitIncl : round2(unitIncl / (1 + r))
        taxAmount = round2(qty * (unitIncl - unitEx))
        totalAmountEx = round2(unitEx * qty)
        deductionAmount = 0
      }
      item.unitPrice = unitIncl
      item.unitPriceEx = unitEx
      item.taxAmount = taxAmount
      item.totalAmountEx = totalAmountEx
      item.deductionAmount = deductionAmount
    }
  } else {
    if (item.unitPriceEx || item.unitPriceEx === 0) {
      item._lastEdited = 'unitEx'
      calculateRowTotal(item)
      return
    }
    if (item.unitPrice || item.unitPrice === 0) {
      item._lastEdited = 'unitIncl'
      calculateRowTotal(item)
      return
    }
    if (item.totalAmount || item.totalAmount === 0) {
      item._lastEdited = 'amount'
      calculateRowTotal(item)
      return
    }
  }

  calculateTotalAmount()
}

// 计算单据总额
const calculateTotalAmount = () => {
  formData.totalAmount = formData.items.reduce((sum, item) => sum + (item.totalAmount || 0), 0)
}

// 处理供应商变化
const handleSupplierChange = (supplierId: number) => {
  const supplier = suppliers.value.find(s => s.id === supplierId)
  if (supplier) {
    formData.supplierName = supplier.name
  }
}

// 处理仓库变化
const handleWarehouseChange = (warehouseId: number) => {
  const warehouse = warehouses.value.find(w => w.id === warehouseId)
  if (warehouse) {
    formData.warehouseName = warehouse.name
  }
  
  // 保存默认仓库
  saveDefaultWarehouse(warehouseId)
}

// 保存默认仓库
const saveDefaultWarehouse = (warehouseId: number | undefined) => {
  if (warehouseId) {
    localStorage.setItem('defaultWarehouseId', warehouseId.toString())
    defaultWarehouseId.value = warehouseId
    ElMessage.success('已设置为默认仓库')
  }
}

// 处理发票状态变化
const handleInvoiceIssuedChange = (val: boolean) => {
  if (!val) {
    formData.items.forEach(item => {
      if (item.allowDeduction) {
        item.allowDeduction = false
      }
    })
    ElMessage.info('未开票状态下无法使用加计扣除')
  }
}

// 处理发票类型变化
const handleInvoiceTypeChange = (val: string) => {
  if (val !== '普票') {
    formData.items.forEach(item => {
      if (item.allowDeduction) {
        item.allowDeduction = false
      }
    })
    ElMessage.info('只有普票才允许加计扣除')
  }
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    
    // 验证商品明细
    if (!formData.items || formData.items.length === 0) {
      ElMessage.warning('请至少添加一行商品')
      return
    }
    
    // 验证每行商品
    for (let i = 0; i < formData.items.length; i++) {
      if (!formData.items[i].productId) {
        ElMessage.warning(`第 ${i + 1} 行请选择商品`)
        return
      }
      if (!formData.items[i].quantity || Number(formData.items[i].quantity) <= 0) {
        ElMessage.warning(`第 ${i + 1} 行商品数量必须大于0`)
        return
      }
    }
    
    // 计算总金额
    calculateTotalAmount()
    
    // 手动转换字段：驼峰 → 下划线
    if (formData.id) {
      const updateData = {
        id: formData.id,
        inbound_no: formData.voucherNo,
        inbound_date: formData.voucherDate,
        supplier_id: formData.supplierId || null,
        warehouse_id: formData.warehouseId || null,
        total_amount: formData.totalAmount,
        paid_amount: formData.paidAmount || 0,
        invoice_type: formData.invoiceType || null,
        invoice_issued: formData.invoiceIssued ? 1 : 0,
        status: 'completed',
        remark: formData.remark || null,
        items: formData.items.map((item: any) => ({
          product_id: item.productId || null,
          quantity: item.quantity || null,
          unit_price: item.unitPrice || null,
          unit_price_ex: item.unitPriceEx || null,
          tax_rate: item.taxRate === '免税' ? 0 : Number(item.taxRate || 0),
          tax_amount: item.taxAmount || null,
          total_amount_ex: item.totalAmountEx || null,
          total_amount: item.totalAmount || null,
          allow_deduction: item.allowDeduction ? 1 : 0,
          deduction_amount: item.deductionAmount || null,
          remark: item.remark || null
        }))
      }
      await db.updateInbound(updateData)
      ElMessage.success('更新成功')
    } else {
      const inboundData = {
        inbound_no: formData.voucherNo,
        inbound_date: formData.voucherDate,
        supplier_id: formData.supplierId || null,
        warehouse_id: formData.warehouseId || null,
        total_amount: formData.totalAmount,
        paid_amount: formData.paidAmount || 0,
        invoice_type: formData.invoiceType || null,
        invoice_issued: formData.invoiceIssued ? 1 : 0,
        status: 'completed',
        remark: formData.remark || null,
        created_by: formData.operator,
        items: formData.items.map((item: any) => ({
          product_id: item.productId || null,
          quantity: item.quantity || null,
          unit_price: item.unitPrice || null,
          unit_price_ex: item.unitPriceEx || null,
          tax_rate: item.taxRate === '免税' ? 0 : Number(item.taxRate || 0),
          tax_amount: item.taxAmount || null,
          total_amount_ex: item.totalAmountEx || null,
          total_amount: item.totalAmount || null,
          allow_deduction: item.allowDeduction ? 1 : 0,
          deduction_amount: item.deductionAmount || null,
          remark: item.remark || null
        }))
      }

      await db.addInbound(inboundData)
      ElMessage.success('新增成功')
    }
    
    // 检测是否需要重新结算成本
    try {
      await handleDocumentSave(
        DocumentType.INVENTORY_INBOUND,
        formData.items || [],
        formData.voucherDate
      )
    } catch (costError) {
      console.warn('成本结算检测跳过:', costError)
    }
    
    dialogVisible.value = false
    loadInboundList()
  } catch (error: any) {
    console.error('保存入库单失败:', error)
    ElMessage.error(error?.message || '保存入库单失败，请检查数据后重试')
  }
}

// 搜索
const handleSearch = () => {
  currentPage.value = 1
  loadInboundList()
}

const handleQuery = () => {
  currentPage.value = 1
}

const clearFilters = () => {
  queryForm.dateRange = []
  queryForm.supplierId = undefined
  queryForm.minAmount = undefined
  queryForm.maxAmount = undefined
}

// 分页处理
const handleSizeChange = (size: number) => {
  pageSize.value = size
  loadInboundList()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  loadInboundList()
}

// 选中的记录
const selectedRecords = ref<InboundRecord[]>([])

// 选择变化
const handleSelectionChange = (selection: InboundRecord[]) => {
  selectedRecords.value = selection
}

// 打印当前选中的单据
const handlePrintCurrent = () => {
  if (selectedRecords.value.length === 0) {
    ElMessage.warning('请先在列表中选择要打印的单据')
    return
  }
  printBatchInboundForms(selectedRecords.value)
}

// 导出 Excel
const handleExport = () => {
  const exportData = selectedRecords.value.length > 0 ? selectedRecords.value : inboundList.value
  if (exportData.length === 0) {
    ElMessage.warning('没有可导出的单据，请先勾选要导出的单据')
    return
  }

  const headers = [
    '入库单号', '入库日期', '供应商', '仓库', '经办人',
    '商品编码', '商品名称', '规格型号', '单位', '数量',
    '单价(不含税)', '单价(含税)', '税率', '税额', '金额(不含税)', '金额(含税)',
    '是否开票', '发票类型', '加计扣除',
    '已付款', '合计金额', '备注'
  ]

  const rows: any[][] = []
  for (const record of exportData) {
    const items = record.items || []
    const invoiceIssuedStr = record.invoiceIssued ? '已开票' : '未开票'
    const invoiceTypeStr = record.invoiceIssued ? (record.invoiceType || '普票') : ''
    if (items.length === 0) {
      rows.push([
        record.voucherNo, record.voucherDate, record.supplierName,
        record.warehouseName || '', record.operator || '',
        '', '', '', '', '',
        '', '', '', '', '', '',
        invoiceIssuedStr, invoiceTypeStr, '',
        record.paidAmount || 0, record.totalAmount, record.remark || ''
      ])
    } else {
      for (const item of items) {
        rows.push([
          record.voucherNo, record.voucherDate, record.supplierName,
          record.warehouseName || '', record.operator || '',
          item.productCode || '', item.productName, item.specification, item.unit, item.quantity,
          item.unitPriceEx || 0, item.unitPrice || 0, item.taxRate, item.taxAmount || 0, item.totalAmountEx || 0, item.totalAmount || 0,
          invoiceIssuedStr, invoiceTypeStr, item.allowDeduction ? '是' : '否',
          record.paidAmount || 0, record.totalAmount, record.remark || ''
        ])
      }
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 22 : 14 }))
  XLSX.utils.book_append_sheet(wb, ws, '采购入库单')
  XLSX.writeFile(wb, `采购入库单_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
  ElMessage.success(`成功导出 ${exportData.length} 张单据`)
}

// 打印单据
const handlePrint = (row: InboundRecord) => {
  printInboundForm(row)
}

// 打印入库单
const printInboundForm = (row: InboundRecord) => {
  const hasDeduction = row.items.some((item: any) => item.allowDeduction)
  const itemsHtml = row.items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.productName}</td>
        <td>${item.specification}</td>
        <td>${item.quantity}</td>
        <td>${item.unit}</td>
        <td>${(item.unitPriceEx ?? 0).toFixed(2)}</td>
        <td>${(item.unitPrice ?? 0).toFixed(2)}</td>
        <td>${item.taxRate}%</td>
        <td>${item.allowDeduction ? '是' : '否'}</td>
        <td>${(item.taxAmount || 0).toFixed(2)}</td>
        <td>${item.totalAmount.toFixed(2)}</td>
        ${hasDeduction ? `<td>${(item.deductionAmount || 0).toFixed(2)}</td>` : ''}
      </tr>
    `).join('')

  const companyName = localStorage.getItem('companyName') || '荆州供销农业服务有限公司'
  const invoiceStatus = row.invoiceIssued ? '已开票' : '未开票'
  const invoiceTypeStr = row.invoiceIssued ? (row.invoiceType || '普票') : ''

  const printContent = `
    <html>
      <head>
        <title>入库单 - ${row.voucherNo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: center; }
          .table th { background-color: #f5f5f5; }
          .info { margin-bottom: 10px; display: flex; flex-wrap: wrap; }
          .info div { width: 50%; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${companyName}</h2>
          <h3>入库单</h3>
          <p>凭证号：${row.voucherNo}</p>
        </div>
        <div class="info">
          <div>入库日期：${row.voucherDate}</div>
          <div>供应商：${row.supplierName}</div>
          <div>仓库：${row.warehouseName || '-'}</div>
          <div>经办人：${row.operator}</div>
          <div>发票状态：${invoiceStatus}${invoiceTypeStr ? '（' + invoiceTypeStr + '）' : ''}</div>
          <div>已付款：¥${(row.paidAmount || 0).toFixed(2)}</div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>商品</th>
              <th>规格</th>
              <th>数量</th>
              <th>单位</th>
              <th>单价(不含税)</th>
              <th>单价(含税)</th>
              <th>税率</th>
              <th>加计扣除</th>
              <th>税额</th>
              <th>金额</th>
              ${hasDeduction ? '<th>加计扣除金额</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="text-align: right; font-weight: bold;">总金额：¥${row.totalAmount.toFixed(2)}</div>
        ${hasDeduction ? `<div style="text-align: right; font-weight: bold; color: #67c23a;">加计扣除总额：¥${row.items.reduce((sum: number, item: any) => sum + (item.deductionAmount || 0), 0).toFixed(2)}</div>` : ''}
        <div style="margin-top: 10px; border: 1px solid #000; padding: 8px; text-align: left;">备注：${row.remark || '-'}</div>
        <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div>操作员：${row.operator}</div>
          <div>经办人签字：____________________</div>
        </div>
        <div style="text-align: right; margin-top: 10px;">打印时间：${dayjs().format('YYYY-MM-DD HH:mm:ss')}</div>
      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.focus()
      printWindow.print()
    }
  }
}

// 批量打印入库单
const printBatchInboundForms = (rows: InboundRecord[]) => {
  const companyName = localStorage.getItem('companyName') || '荆州供销农业服务有限公司'
  
  const allFormsHtml = rows.map((row, formIndex) => {
    const hasDeduction = row.items.some((item: any) => item.allowDeduction)
    const itemsHtml = row.items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.productName}</td>
          <td>${item.specification}</td>
          <td>${item.quantity}</td>
          <td>${item.unit}</td>
          <td>${(item.unitPriceEx ?? 0).toFixed(2)}</td>
          <td>${(item.unitPrice ?? 0).toFixed(2)}</td>
          <td>${item.taxRate}%</td>
          <td>${item.allowDeduction ? '是' : '否'}</td>
          <td>${(item.taxAmount || 0).toFixed(2)}</td>
          <td>${item.totalAmount.toFixed(2)}</td>
          ${hasDeduction ? `<td>${(item.deductionAmount || 0).toFixed(2)}</td>` : ''}
        </tr>
      `).join('')

    const invoiceStatus = row.invoiceIssued ? '已开票' : '未开票'
    const invoiceTypeStr = row.invoiceIssued ? (row.invoiceType || '普票') : ''

    return `
      <div class="form-container" style="page-break-after: always; margin-bottom: 40px;">
        <div class="header" style="text-align: center; margin-bottom: 20px;">
          <h2>${companyName}</h2>
          <h3>入库单</h3>
          <p>凭证号：${row.voucherNo}</p>
        </div>
        <div class="info" style="margin-bottom: 10px; display: flex; flex-wrap: wrap;">
          <div style="width: 50%; margin-bottom: 5px;">入库日期：${row.voucherDate}</div>
          <div style="width: 50%; margin-bottom: 5px;">供应商：${row.supplierName}</div>
          <div style="width: 50%; margin-bottom: 5px;">仓库：${row.warehouseName || '-'}</div>
          <div style="width: 50%; margin-bottom: 5px;">经办人：${row.operator}</div>
          <div style="width: 50%; margin-bottom: 5px;">发票状态：${invoiceStatus}${invoiceTypeStr ? '（' + invoiceTypeStr + '）' : ''}</div>
          <div style="width: 50%; margin-bottom: 5px;">已付款：¥${(row.paidAmount || 0).toFixed(2)}</div>
        </div>
        <table class="table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">#</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">商品</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">规格</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">数量</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">单位</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">单价(不含税)</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">单价(含税)</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">税率</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">加计扣除</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">税额</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">金额</th>
              ${hasDeduction ? '<th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">加计扣除金额</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="text-align: right; font-weight: bold;">总金额：¥${row.totalAmount.toFixed(2)}</div>
        ${hasDeduction ? `<div style="text-align: right; font-weight: bold; color: #67c23a;">加计扣除总额：¥${row.items.reduce((sum: number, item: any) => sum + (item.deductionAmount || 0), 0).toFixed(2)}</div>` : ''}
        <div style="margin-top: 10px; border: 1px solid #000; padding: 8px; text-align: left;">备注：${row.remark || '-'}</div>
        <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div>操作员：${row.operator}</div>
          <div>经办人签字：____________________</div>
        </div>
        <div style="text-align: right; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">
          第 ${formIndex + 1} 张 / 共 ${rows.length} 张
        </div>
      </div>
    `
  }).join('')

  const printContent = `
    <html>
      <head>
        <title>批量入库单打印 - ${rows.length} 张</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .batch-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .form-container { margin-bottom: 40px; }
          @media print {
            .batch-header { margin-bottom: 20px; }
            .form-container { page-break-after: always; margin-bottom: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="batch-header">
          <h1>批量入库单打印</h1>
          <p>共 ${rows.length} 张单据 | 打印时间：${dayjs().format('YYYY-MM-DD HH:mm:ss')}</p>
        </div>
        ${allFormsHtml}
      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.focus()
      printWindow.print()
    }
  }
}

// 初始化
onMounted(() => {
  loadInboundList()
  loadProducts()
  loadSuppliers()
  loadWarehouses()
  loadCurrentUser()
})
</script>

<style scoped>
.inbound-page {
  padding: 20px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.action-buttons {
  display: flex;
  gap: 5px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
