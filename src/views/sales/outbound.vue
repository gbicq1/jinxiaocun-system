<template>
  <div class="sales-outbound-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增出库单
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
          <el-form-item label="客户">
            <el-select
              v-model="queryForm.customerId"
              placeholder="请选择客户"
              clearable
              filterable
              style="width: 150px"
            >
              <el-option
                v-for="customer in customers"
                :key="customer.id"
                :label="customer.name"
                :value="customer.id"
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

      <el-table :data="filteredOutbounds" style="width: 100%" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="voucherNo" label="凭证号" width="150" />
        <el-table-column prop="voucherDate" label="出库日期" width="120" />
        <el-table-column prop="customerName" label="客户" min-width="120" />
        <el-table-column prop="warehouseName" label="仓库" width="120">
          <template #default="{ row }">
            {{ row.warehouseName || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="handlerName" label="经办人" min-width="100" />
        <el-table-column prop="itemCount" label="商品行数" width="80">
          <template #default="{ row }">
            {{ row.items?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="总金额" width="120">
          <template #default="{ row }">
            {{ (row.totalAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : 'warning'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleView(row)">查看</el-button>
            <el-button type="warning" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="success" size="small" @click="handlePrint(row)">打印</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="90%" :close-on-click-modal="false">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px" :disabled="isViewMode">
        <el-alert title="销售出库单头部信息" type="info" :closable="false" show-icon style="margin-bottom: 20px" />

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="凭证号" prop="voucherNo">
              <el-input v-model="formData.voucherNo" placeholder="自动生成" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="出库日期" prop="voucherDate">
              <el-date-picker v-model="formData.voucherDate" type="date" placeholder="选择日期" style="width: 100%" value-format="YYYY-MM-DD" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="客户" prop="customerId">
              <el-select v-model="formData.customerId" placeholder="请选择客户" style="width: 100%" filterable @change="handleCustomerChange">
                <el-option v-for="customer in customers" :key="customer.id" :label="customer.name" :value="customer.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="仓库" prop="warehouseId">
              <el-select v-model="formData.warehouseId" placeholder="请选择仓库" style="width: 100%" filterable @change="handleWarehouseChange">
                <el-option v-for="warehouse in warehouses" :key="warehouse.id" :label="warehouse.name" :value="warehouse.id">
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
            <el-form-item label="经办人" prop="handlerId">
              <el-select v-model="formData.handlerId" placeholder="请选择经办人" style="width: 100%" filterable @change="handleHandlerChange">
                <el-option v-for="employee in employees" :key="employee.id" :label="employee.name" :value="employee.id">
                  <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span>{{ employee.name }}</span>
                    <el-switch
                      :model-value="defaultHandlerId === employee.id"
                      :active-value="true"
                      :inactive-value="false"
                      inline-prompt
                      active-text="默认"
                      inactive-text=""
                      style="--el-switch-width: 60px; --el-switch-inactive-color: #dcdfe6;"
                      :disabled="isViewMode"
                      @change="(val) => saveDefaultHandler(employee.id)"
                    />
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="操作员" prop="operator">
              <el-input v-model="formData.operator" placeholder="自动获取当前用户" disabled />
            </el-form-item>
          </el-col>
        
        </el-row>

        <el-alert title="商品明细" type="warning" :closable="false" show-icon style="margin-bottom: 20px" />

        <el-table :data="formData.items" style="width: 100%" border>
          <el-table-column label="商品" min-width="200">
            <template #default="{ row, $index }">
              <el-select 
                v-model="row.productId" 
                placeholder="请选择商品" 
                style="width: 100%" 
                filterable 
                @change="(val: number) => handleProductChange($index, val)"
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
          <el-table-column label="商品名称" min-width="150">
            <template #default="{ row }"><el-input v-model="row.productName" disabled /></template>
          </el-table-column>
          <el-table-column label="规格" width="120">
            <template #default="{ row }"><el-input v-model="row.specification" disabled /></template>
          </el-table-column>
          <el-table-column label="数量" width="100">
            <template #default="{ row }">
              <el-input-number v-model="row.quantity" :min="0" :precision="2" :controls="false" style="width: 100%" @focus="handleFocus(row, 'quantity')" @change="onQuantityChange(row)" />
            </template>
          </el-table-column>
          <el-table-column label="单位" width="80">
            <template #default="{ row }"><el-input v-model="row.unit" disabled /></template>
          </el-table-column>
          <el-table-column label="单价（不含税）" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.unitPriceEx" :min="0" :precision="2" :step="0.01" :controls="false" style="width: 100%" @focus="handleFocus(row, 'unitPriceEx')" @change="onUnitPriceExChange(row)" />
            </template>
          </el-table-column>

          <el-table-column label="单价 (含税)" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.unitPrice" :min="0" :precision="2" :step="0.01" :controls="false" style="width: 100%" @focus="handleFocus(row, 'unitPrice')" @change="onUnitPriceInclChange(row)" />
            </template>
          </el-table-column>

          <el-table-column label="税率 (%)" width="120">
            <template #default="{ row }">
              <el-select v-model="row.taxRate" filterable allow-create placeholder="选择或输入税率" style="width: 100%" @change="onTaxRateChange(row)">
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
          <el-table-column label="税额" width="100"><template #default="{ row }"><el-input v-model="row.taxAmount" disabled /></template></el-table-column>
          <el-table-column label="金额 (含税)" width="140"><template #default="{ row }"><el-input-number v-model="row.totalAmount" :min="0" :precision="2" :controls="false" style="width: 100%" @focus="handleFocus(row, 'totalAmount')" @change="onAmountChange(row)" /></template></el-table-column>
          <el-table-column label="操作" width="80" fixed="right"><template #default="{ $index }"><el-button type="danger" size="small" @click="removeItem($index)">删除</el-button></template></el-table-column>
        </el-table>

        <el-button type="primary" style="margin-top: 10px" @click="addItem"><el-icon><Plus /></el-icon> 添加商品行</el-button>

        <el-alert title="单据汇总" type="success" :closable="false" show-icon style="margin: 20px 0" />

        <el-row :gutter="20" style="margin-bottom: 10px">
          <el-col :span="12">
            <div style="font-size: 14px">已收款：
              <el-input-number v-model="formData.receivedAmount" :min="0" :precision="2" :controls="false" style="width:160px" @focus="handleReceivedAmountFocus" /> 元
            </div>
          </el-col>
          <el-col :span="12" style="text-align: right">
            <div style="font-size: 14px">发票：
              <el-switch v-model="formData.invoiceIssued" active-text="已开票" inactive-text="未开票" active-color="#13ce66" inactive-color="#ff4949" />
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="20" style="background: #f5f7fa; padding: 15px; border-radius: 4px">
          <el-col :span="12"><div style="font-size: 16px; font-weight: bold">商品行数：{{ formData.items?.length || 0 }}</div></el-col>
          <el-col :span="12" style="text-align: right"><div style="font-size: 18px; font-weight: bold; color: #f56c6c">合计金额：{{ (totalAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</div></el-col>
        </el-row>

        <el-form-item label="备注" prop="remark"><el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入备注" /></el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ isViewMode ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!isViewMode" type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Printer, Download } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { dbQuery, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { handleDocumentSave, DocumentType } from '@/utils/cost-recalculation'
// 获取单个产品的实时库存（从数据库）
const getProductStock = async (productId: number, warehouseId: number): Promise<number> => {
  try {
    if (window.electron && window.electron.productStock) {
      return await window.electron.productStock(productId, warehouseId)
    }
    return 0
  } catch (error) {
    console.error('获取库存失败:', error)
    return 0
  }
}
import exportToCsv from '../../utils/exportCsv'
import { onBarcodeScan, type BarcodeScanEvent } from '@/utils/barcode-scanner'

interface OutboundItem {
  productId?: number
  productName: string
  specification: string
  quantity: number
  unit: string
  unitPrice: number
  unitPriceEx?: number
  taxRate: number | string
  taxAmount: number
  totalAmount: number
  _lastEdited?: 'unitEx' | 'unitIncl' | 'amount'
}

interface OutboundRecord {
  id?: number
  voucherNo: string
  voucherDate: string
  customerId?: number
  customerName: string
  warehouseId?: number
  warehouseName?: string
  operator: string
  handlerId?: number
  handlerName?: string
  items: OutboundItem[]
  totalAmount: number
  receivedAmount?: number
  invoiceIssued?: boolean
  status: string
  remark?: string
}

interface Product {
  id: number
  code: string
  name: string
  specification?: string
  unit?: string
  salePrice?: number
}

interface Customer {
  id: number
  name: string
}

interface Employee {
  id: number
  code: string
  name: string
  position: string
  department: string
  phone: string
  email: string
  status: 'active' | 'inactive'
}

interface Warehouse {
  id: number
  code: string
  name: string
  status?: number
}

const outbounds = ref<OutboundRecord[]>([])
const productList = ref<Product[]>([])
const customers = ref<Customer[]>([])
const employees = ref<Employee[]>([])
const warehouses = ref<Warehouse[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const dialogTitle = ref('新增出库单')
const selectedRows = ref<OutboundRecord[]>([])
const isViewMode = ref(false) // 新增：控制是否为查看模式

// 默认经办人 ID
const defaultHandlerId = ref<number | undefined>(undefined)
// 默认仓库 ID
const defaultWarehouseId = ref<number | undefined>(undefined)

// 查询表单数据
const queryForm = reactive({
  dateRange: [] as string[],
  customerId: undefined as number | undefined,
  minAmount: undefined as number | undefined,
  maxAmount: undefined as number | undefined
})

const formData = reactive<OutboundRecord & { handlerId?: number; handlerName?: string }>({
  voucherNo: '',
  voucherDate: dayjs().format('YYYY-MM-DD'),
  customerId: undefined,
  customerName: '',
  warehouseId: undefined,
  warehouseName: '',
  operator: '',
  handlerId: undefined,
  handlerName: '',
  items: [],
  totalAmount: 0,
  receivedAmount: 0,
  invoiceIssued: false,
  status: 'draft',
  remark: ''
})

const rules = {
  voucherNo: [{ required: true, message: '请输入凭证号', trigger: 'blur' }],
  voucherDate: [{ required: true, message: '请选择出库日期', trigger: 'change' }],
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  items: [
    {
      validator: (_rule: any, value: OutboundItem[]) => {
        if (!value || value.length === 0) {
          return new Error('请至少添加一行商品')
        }
        return true
      },
      trigger: 'change'
    }
  ]
}

const totalAmount = computed(() => formData.items.reduce((sum, item) => sum + item.totalAmount, 0))

// 过滤后的出库记录
const filteredOutbounds = computed(() => {
  // 创建副本，避免修改原数组
  const sourceArray = outbounds.value || []
  let filtered = [...sourceArray]

  // 日期范围过滤
  if (queryForm.dateRange && Array.isArray(queryForm.dateRange) && queryForm.dateRange.length === 2) {
    const [startDate, endDate] = queryForm.dateRange
    if (startDate && endDate) {
      filtered = filtered.filter(record => {
        if (!record.voucherDate) return false
        return record.voucherDate >= startDate && record.voucherDate <= endDate
      })
    }
  }

  // 客户过滤
  if (queryForm.customerId !== undefined && queryForm.customerId !== null) {
    filtered = filtered.filter(record => record.customerId === queryForm.customerId)
  }

  // 金额范围过滤
  if (typeof queryForm.minAmount === 'number' && !isNaN(queryForm.minAmount)) {
    filtered = filtered.filter(record => record.totalAmount >= queryForm.minAmount)
  }
  if (typeof queryForm.maxAmount === 'number' && !isNaN(queryForm.maxAmount)) {
    filtered = filtered.filter(record => record.totalAmount <= queryForm.maxAmount)
  }

  // 按日期和时间戳正序排序（对副本排序）
  filtered.sort((a: any, b: any) => {
    const dateA = new Date(a.voucherDate || a.date || '1970-01-01').getTime()
    const dateB = new Date(b.voucherDate || b.date || '1970-01-01').getTime()
    if (dateA !== dateB) {
      return dateA - dateB
    }
    const timeA = a.createdAt || a._timestamp || a.voucherDate || '1970-01-01'
    const timeB = b.createdAt || b._timestamp || b.voucherDate || '1970-01-01'
    return new Date(timeA).getTime() - new Date(timeB).getTime()
  })

  return filtered
})

// 生成凭证号 - 使用时间戳确保唯一性
const generateVoucherNo = async () => {
  let voucherNo: string
  let attempts = 0
  const maxAttempts = 10
  
  do {
    const dateStr = dayjs().format('YYYYMMDD')
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
    const timestamp = Date.now().toString().slice(-4)
    voucherNo = `CK${dateStr}${random}${timestamp}`
    attempts++
    
    try {
      const result = await dbQuery('SELECT id FROM sales_outbound WHERE outbound_no = ?', [voucherNo])
      if (result.length === 0) {
        break
      }
    } catch (error) {
      console.error('检查凭证号失败:', error)
      break
    }
  } while (attempts < maxAttempts)
  
  return voucherNo
}

// 加载出库单列表
const loadOutbounds = async () => {
  try {
    console.log('开始加载出库单列表...')
    
    const electron = (window as any).electron
    if (electron && electron.outboundList) {
      // 调用 Electron 后端的 outboundList 方法
      const result = await electron.outboundList(1, 1000) // 获取所有数据
      console.log('出库单列表结果:', result)
      
      // 后端已经返回 camelCase 字段，直接使用
      outbounds.value = result.data || result
      total.value = result.total || result.length
      
      console.log('处理后的出库单列表:', outbounds.value)
      if (outbounds.value && outbounds.value.length > 0) {
        console.log('第一条出库单数据:', outbounds.value[0])
      }
    } else {
      console.error('outboundList 方法不可用')
      ElMessage.error('加载失败：后端方法不可用')
      outbounds.value = []
      total.value = 0
    }
  } catch (error) {
    console.error('加载出库单列表失败:', error)
    ElMessage.error('加载出库单列表失败')
    outbounds.value = []
    total.value = 0
  }
}

// 加载产品数据
const loadProducts = async () => {
  try {
    const result = await dbQuery('SELECT * FROM products ORDER BY code')
    productList.value = result
  } catch (error) {
    console.error('加载产品数据失败:', error)
    ElMessage.error('加载产品数据失败')
  }
}

// 加载客户数据
const loadCustomers = async () => {
  try {
    const result = await dbQuery('SELECT * FROM customers ORDER BY name')
    customers.value = result
  } catch (error) {
    console.error('加载客户数据失败:', error)
    ElMessage.error('加载客户数据失败')
  }
}

// 加载仓库数据
const loadWarehouses = async () => {
  try {
    const result = await dbQuery('SELECT * FROM warehouses ORDER BY name')
    warehouses.value = result
  } catch (error) {
    console.error('加载仓库数据失败:', error)
    ElMessage.error('加载仓库数据失败')
  }
}

// 加载员工数据
const loadEmployees = async () => {
  try {
    const result = await dbQuery('SELECT * FROM employees ORDER BY name')
    employees.value = result
  } catch (error) {
    console.error('加载员工数据失败:', error)
    ElMessage.error('加载员工数据失败')
  }
}

const handleWarehouseChange = async (warehouseId: number) => {
  const warehouse = warehouses.value.find(w => w.id === warehouseId)
  if (warehouse) {
    formData.warehouseName = warehouse.name
    
    // 仓库变化时，检查所有已添加商品的库存
    if (formData.items && formData.items.length > 0) {
      for (const item of formData.items) {
        if (item.productId && item.quantity) {
          const stock = await getProductStock(item.productId, warehouseId)
          if (item.quantity > stock) {
            ElMessage.warning({
              message: `库存不足：${item.productName || '该商品'}，当前库存 ${stock}，出库数量 ${item.quantity}`,
              duration: 5000
            })
          }
        }
      }
    }
  }
}

// 保存默认仓库
const saveDefaultWarehouse = (warehouseId: number | undefined) => {
  if (warehouseId) {
    localStorage.setItem('defaultWarehouseId', warehouseId.toString())
    defaultWarehouseId.value = warehouseId
    ElMessage.success('已设置为默认仓库')
  }
}

// 检查库存
const checkStock = async (): Promise<boolean> => {
  const warehouseId = formData.warehouseId
  
  if (!warehouseId) {
    ElMessage.warning('请先选择仓库')
    return false
  }
  if (!formData.voucherDate) {
    ElMessage.warning('请先选择出库日期')
    return false
  }
  
  for (let i = 0; i < formData.items.length; i++) {
    const item = formData.items[i]
    if (!item.productId || !item.quantity) continue
    
    // 获取实时库存
    const stock = await getProductStock(item.productId, warehouseId)
    
    if (stock < item.quantity) {
      const productName = item.productName || `第 ${i + 1} 行商品`
      ElMessage.error(
        `库存不足：${productName}\n` +
        `当前库存：${stock}\n` +
        `需要出库：${item.quantity}\n\n` +
        `请修改出库数量！`
      )
      return false
    }
  }
  
  return true
}

const loadCurrentUser = () => {
  const currentUser = localStorage.getItem('currentUser')
  if (currentUser) {
    formData.operator = JSON.parse(currentUser).name || '系统用户'
  } else {
    formData.operator = '系统用户'
  }
}

const handleAdd = async () => {
  dialogTitle.value = '新增出库单'
  isViewMode.value = false
  const user = localStorage.getItem('currentUser')
  const voucherNo = await generateVoucherNo()
  Object.assign(formData, {
    id: undefined,
    voucherNo: voucherNo,
    voucherDate: dayjs().format('YYYY-MM-DD'),
    customerId: undefined,
    customerName: '',
    warehouseId: defaultWarehouseId.value,
    warehouseName: '',
    operator: user ? JSON.parse(user).name : '系统用户',
    handlerId: defaultHandlerId.value,
    handlerName: '',
    items: [],
    totalAmount: 0,
    receivedAmount: 0,
    invoiceIssued: false,
    status: 'draft',
    remark: ''
  })
  
  if (defaultHandlerId.value) {
    const employee = employees.value.find(e => e.id === defaultHandlerId.value)
    if (employee) {
      formData.handlerName = employee.name
    }
  }
  
  if (defaultWarehouseId.value) {
    const warehouse = warehouses.value.find(w => w.id === defaultWarehouseId.value)
    if (warehouse) {
      formData.warehouseName = warehouse.name
    }
  }
  
  selectedRows.value = []
  dialogVisible.value = true
}

const handleDelete = async (row: OutboundRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除出库单 "${row.voucherNo}" 吗？将移到回收站，可在回收站恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    // 将数据移到回收站
    const recycleBinItem = {
      id: Date.now(),
      type: 'outbound' as const,
      voucherNo: row.voucherNo,
      voucherDate: row.voucherDate,
      customerName: row.customerName,
      totalAmount: row.totalAmount,
      deletedAt: new Date().toISOString(),
      originalData: { ...row }
    }

    // 保存到回收站
    const savedRecycleBin = localStorage.getItem('recycle_bin')
    const recycleBin = savedRecycleBin ? JSON.parse(savedRecycleBin) : []
    recycleBin.push(recycleBinItem)
    localStorage.setItem('recycle_bin', JSON.stringify(recycleBin))

    // 从数据库删除
    if (window.electron && window.electron.dbDelete) {
      await window.electron.dbDelete('sales_outbound', 'id = ?', [row.id])
    } else {
      await dbDelete('sales_outbound', 'id = ?', [row.id])
    }
    
    ElMessage.success('已移到回收站')
    loadOutbounds()
  } catch {
    // 用户点击取消或关闭弹窗
    ElMessage.info('已取消删除')
  }
}

const addItem = () => {
  formData.items.push({ 
    productId: undefined, 
    productName: '', 
    specification: '', 
    quantity: undefined, 
    unit: '', 
    unitPrice: undefined, 
    unitPriceEx: undefined, 
    taxRate: 13, 
    taxAmount: undefined, 
    totalAmount: undefined,
    _lastEdited: 'unitIncl' 
  })
}

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

// 处理已收款聚焦事件
const handleReceivedAmountFocus = () => {
  if (formData.receivedAmount === 0 || formData.receivedAmount === '0') {
    formData.receivedAmount = '' as any
  }
}

const handleProductChange = async (index: number, productId: number) => {
  const product = productList.value.find(p => p.id === productId)
  if (product) {
    const item = formData.items[index]
    item.productName = product.name
    // 优先使用 spec（产品表字段），其次使用 specification，最后使用 code 作为备用
    item.specification = product.spec || product.specification || product.code || ''
    item.unit = product.unit || ''
    // 如果产品有售价则使用，否则保持为空
    item.unitPriceEx = product.salePrice && product.salePrice > 0 ? product.salePrice : ('' as any)
    item._lastEdited = 'unitEx'
    // 只有当有价格时才计算总额
    if (item.unitPriceEx && item.unitPriceEx !== '') {
      calculateRowTotal(item)
    }
    
    // 如果已经有数量，检查库存
    if (item.quantity && formData.warehouseId) {
      const stock = await getProductStock(productId, formData.warehouseId)
      if (item.quantity > stock) {
        ElMessage.warning({
          message: `库存不足：${item.productName}，当前库存 ${stock}，出库数量 ${item.quantity}`,
          duration: 5000
        })
      }
    }
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100

const calculateRowTotal = (item: OutboundItem) => {
  const qty = item.quantity || 0
  const taxRaw = item.taxRate === '免税' ? 0 : Number(item.taxRate || 0)
  const r = taxRaw / 100

  const last = item._lastEdited

  if (last === 'unitEx') {
    const unitEx = Number(item.unitPriceEx || 0)
    let unitIncl: number
    let taxAmount: number
    let totalAmount: number
    
    // 正常模式
    unitIncl = r === 0 ? unitEx : round2(unitEx * (1 + r))
    taxAmount = round2(qty * (unitIncl - unitEx))
    totalAmount = round2(unitIncl * qty)
    
    item.unitPrice = unitIncl
    item.taxAmount = taxAmount
    item.totalAmount = totalAmount
  } else if (last === 'unitIncl') {
    const unitIncl = Number(item.unitPrice || 0)
    let unitEx: number
    let taxAmount: number
    let totalAmount: number
    
    // 正常模式
    unitEx = r === 0 ? unitIncl : round2(unitIncl / (1 + r))
    taxAmount = round2(qty * (unitIncl - unitEx))
    totalAmount = round2(unitIncl * qty)
    
    item.unitPriceEx = unitEx
    item.taxAmount = taxAmount
    item.totalAmount = totalAmount
  } else if (last === 'amount') {
    const total = Number(item.totalAmount || 0)
    if (qty === 0) {
      item.unitPrice = 0
      item.unitPriceEx = 0
      item.taxAmount = 0
    } else {
      let unitIncl: number
      let unitEx: number
      let taxAmount: number
      
      // 正常模式
      unitIncl = round2(total / qty)
      unitEx = r === 0 ? unitIncl : round2(unitIncl / (1 + r))
      taxAmount = round2(qty * (unitIncl - unitEx))
      
      item.unitPrice = unitIncl
      item.unitPriceEx = unitEx
      item.taxAmount = taxAmount
    }
  } else {
    // fallback: prefer unitEx -> unitIncl -> amount
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

const onUnitPriceExChange = (item: OutboundItem) => {
  item._lastEdited = 'unitEx'
  calculateRowTotal(item)
}

const onUnitPriceInclChange = (item: OutboundItem) => {
  item._lastEdited = 'unitIncl'
  calculateRowTotal(item)
}

const onAmountChange = (item: OutboundItem) => {
  item._lastEdited = 'amount'
  calculateRowTotal(item)
}

const onTaxRateChange = (item: OutboundItem) => {
  calculateRowTotal(item)
}

const onQuantityChange = async (item: OutboundItem) => {
  calculateRowTotal(item)
  
  // 实时检查库存
  if (item.productId && item.quantity && formData.warehouseId) {
    const stock = await getProductStock(item.productId, formData.warehouseId)
    
    if (item.quantity > stock) {
      const shortage = item.quantity - stock
      ElMessage.warning({
        message: `库存不足：${item.productName || '该商品'}，当前库存 ${stock}，您输入的数量 ${item.quantity}，还差 ${shortage}`,
        duration: 5000
      })
    }
  }
}

const calculateTotalAmount = () => {
  formData.totalAmount = formData.items.reduce((sum, item) => sum + item.totalAmount, 0)
}

const handleCustomerChange = (customerId: number) => {
  const customer = customers.value.find(c => c.id === customerId)
  if (customer) {
    formData.customerName = customer.name
  }
}

const handleHandlerChange = (handlerId: number) => {
  const employee = employees.value.find(e => e.id === handlerId)
  if (employee) {
    formData.handlerName = employee.name
  }
}

// 保存默认经办人
const saveDefaultHandler = (handlerId: number | undefined) => {
  if (handlerId) {
    localStorage.setItem('defaultHandlerId', handlerId.toString())
    defaultHandlerId.value = handlerId
    ElMessage.success('已设置为默认经办人')
  }
}

const handleSubmit = async () => {
  // 必填头部校验
  if (!formData.voucherNo) {
    ElMessage.warning('凭证号不能为空')
    return
  }
  if (!formData.customerId) {
    ElMessage.warning('客户不能为空')
    return
  }

  if (!formData.items || formData.items.length === 0) {
    ElMessage.warning('请至少添加一行商品')
    return
  }

  // 商品明细逐行校验
  for (let i = 0; i < formData.items.length; i++) {
    const item = formData.items[i]
    if (!item.productId) {
      ElMessage.warning(`第 ${i + 1} 行请选择商品`)
      return
    }
    if (!item.productName) {
      ElMessage.warning(`第 ${i + 1} 行商品名称不能为空`)
      return
    }
    if (!item.quantity || item.quantity <= 0) {
      ElMessage.warning(`第 ${i + 1} 行数量必须大于 0`)
      return
    }
    if (!item.unitPrice || item.unitPrice <= 0) {
      ElMessage.warning(`第 ${i + 1} 行单价必须大于 0`)
      return
    }
    if (item.taxRate === null || item.taxRate === undefined) {
      ElMessage.warning(`第 ${i + 1} 行税率不能为空`)
      return
    }
  }

  // 检查库存
  if (!(await checkStock())) {
    return
  }

  calculateTotalAmount()
  
  try {
    if (formData.id) {
      // 更新
      if (window.electron && window.electron.dbUpdate) {
        await window.electron.dbUpdate('sales_outbound', { 
          outbound_no: formData.voucherNo,
          customer_id: formData.customerId,
          warehouse_id: formData.warehouseId,
          outbound_date: formData.voucherDate,
          total_amount: formData.totalAmount,
          remark: formData.remark,
          handler_name: formData.handlerName
        }, 'id = ?', [formData.id])
      } else {
        await dbUpdate('sales_outbound', { 
          outbound_no: formData.voucherNo,
          customer_id: formData.customerId,
          warehouse_id: formData.warehouseId,
          outbound_date: formData.voucherDate,
          total_amount: formData.totalAmount,
          remark: formData.remark,
          handler_name: formData.handlerName
        }, 'id = ?', [formData.id])
      }
    } else {
      // 新增
      const outboundData = {
        outbound_no: formData.voucherNo,
        customer_id: formData.customerId,
        warehouse_id: formData.warehouseId,
        outbound_date: formData.voucherDate,
        total_amount: formData.totalAmount,
        status: 'completed',
        remark: formData.remark,
        handler_name: formData.handlerName,
        created_by: formData.operator,
        items: formData.items.map((item: any) => ({
          product_id: item.productId,
          quantity: item.quantity,
          cost_price: item.costPrice || item.unitPrice || 0,
          remark: item.remark || ''
        }))
      }
      
      if (window.electron && window.electron.outboundAdd) {
        await window.electron.outboundAdd(outboundData)
      } else {
        console.error('outboundAdd 方法不可用')
        ElMessage.error('保存失败：后端方法不可用')
        return
      }
    }
    
    // 检测是否需要重新结算成本
    await handleDocumentSave(
      DocumentType.SALES_OUTBOUND,
      formData.items || [],
      formData.voucherDate
    )
    
    dialogVisible.value = false
    ElMessage.success('保存成功')
    loadOutbounds()
  } catch (error) {
    console.error('保存出库单失败:', error)
    ElMessage.error('保存失败')
  }
}

const handleView = (row: OutboundRecord) => {
  dialogTitle.value = '查看出库单'
  isViewMode.value = true
  
  // 使用深拷贝避免数据被修改（和入库单一样）
  const viewData = JSON.parse(JSON.stringify(row))
  if (viewData.items) {
    viewData.items.forEach((item: any) => {
      item._lastEdited = undefined
    })
  }
  Object.assign(formData, viewData)
  
  console.log('查看出库单:', row)
  console.log('深拷贝后的 viewData:', viewData)
  console.log('赋值后的 formData:', formData)
  
  selectedRows.value = [row]
  dialogVisible.value = true
}

const handleEdit = (row: OutboundRecord) => {
  dialogTitle.value = '编辑出库单'
  isViewMode.value = false
  Object.assign(formData, { ...row, items: row.items ? JSON.parse(JSON.stringify(row.items)) : [] })
  selectedRows.value = [row]
  dialogVisible.value = true
}

const handlePrint = (row: OutboundRecord) => {
  printOutboundForm(row)
}

const handlePrintCurrent = () => {
  if (!selectedRows.value || selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要打印的单据')
    return
  }

  printBatchOutboundForms(selectedRows.value)
}

const handleExport = () => {
  const columns = [
    { label: '凭证号', key: 'voucherNo' },
    { label: '出库日期', key: 'voucherDate' },
    { label: '客户', key: 'customerName' },
    { label: '总金额', key: 'totalAmount' },
    { label: '状态', key: 'status' }
  ]
  exportToCsv('outbounds.csv', columns, outbounds.value)
}

const printOutboundForm = (row: OutboundRecord & { handlerName?: string }) => {
  const itemsHtml = row.items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.productName}</td>
        <td>${item.specification}</td>
        <td>${item.quantity}</td>
        <td>${item.unit}</td>
        <td>${(item.unitPriceEx ?? item.unitPrice ?? 0).toFixed(2)}</td>
        <td>${(item.unitPrice ?? 0).toFixed(2)}</td>
        <td>${item.taxRate}%</td>
        <td>${item.taxAmount.toFixed(2)}</td>
        <td>${item.totalAmount.toFixed(2)}</td>
      </tr>
    `).join('')

  const companyName = localStorage.getItem('companyName') || '荆州供销农业服务有限公司'

  const printContent = `
    <html>
      <head>
        <title>销售出库单 - ${row.voucherNo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { margin: 10px 0; font-size: 24px; }
          .header h3 { margin: 10px 0; font-size: 20px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; }
          .table th { background-color: #f5f5f5; }
          .info { margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${companyName}</h2>
          <h3>销售出库单</h3>
          <p>凭证号：${row.voucherNo}</p>
        </div>
        <div class="info">
          <div>出库日期：${row.voucherDate}</div>
          <div>客户：${row.customerName}</div>
          <div>经办人：${row.handlerName || '-'}</div>
          <div>发票状态：${row.invoiceIssued ? '已开票' : '未开票'}</div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>序号</th>
              <th>商品</th>
              <th>规格</th>
              <th>数量</th>
              <th>单位</th>
              <th>单价<br/>(不含税)</th>
              <th>单价<br/>(含税)</th>
              <th>税率</th>
              <th>税额</th>
              <th>金额</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="text-align: right; font-weight: bold;">总金额：${row.totalAmount.toFixed(2)}</div>
        <div style="margin-top: 10px; border: 1px solid #000; padding: 8px; text-align: left;">备注：${row.remark || '-'}</div>
        <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div>操作员：${row.operator}  &nbsp;&nbsp;&nbsp;&nbsp; 经办人：${row.handlerName || '-'}</div>
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
    // 等待内容加载完成后再打印，避免内容未渲染就打印
    printWindow.onload = () => {
      printWindow.focus()
      printWindow.print()
    }
  }
}

const printBatchOutboundForms = (rows: (OutboundRecord & { handlerName?: string })[]) => {
  const companyName = localStorage.getItem('companyName') || '荆州供销农业服务有限公司'
  const allFormsHtml = rows.map((row) => {
    const itemsHtml = row.items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.productName}</td>
          <td>${item.specification}</td>
          <td>${item.quantity}</td>
          <td>${item.unit}</td>
          <td>${(item.unitPriceEx ?? item.unitPrice ?? 0).toFixed(2)}</td>
          <td>${(item.unitPrice ?? 0).toFixed(2)}</td>
          <td>${item.taxRate}%</td>
          <td>${item.taxAmount.toFixed(2)}</td>
          <td>${item.totalAmount.toFixed(2)}</td>
        </tr>
      `).join('')

    return `
      <div class="form-container" style="page-break-after: always; margin-bottom: 40px;">
        <div class="header" style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 10px 0; font-size: 24px;">${companyName}</h2>
          <h3 style="margin: 10px 0; font-size: 20px;">销售出库单</h3>
          <p>凭证号：${row.voucherNo}</p>
        </div>
        <div class="info" style="margin-bottom: 10px;">
          <div>出库日期：${row.voucherDate}</div>
          <div>客户：${row.customerName}</div>
          <div>经办人：${row.handlerName || '-'}</div>
          <div>发票状态：${row.invoiceIssued ? '已开票' : '未开票'}</div>
        </div>
        <table class="table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">序号</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">商品</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">规格</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">数量</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">单位</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">单价<br/>(不含税)</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">单价<br/>(含税)</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">税率</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">税额</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">金额</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="text-align: right; font-weight: bold;">总金额：${row.totalAmount.toFixed(2)}</div>
        <div style="margin-top: 10px; border: 1px solid #000; padding: 8px; text-align: left;">备注：${row.remark || '-'}</div>
        <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div>操作员：${row.operator}  &nbsp;&nbsp;&nbsp;&nbsp; 经办人：${row.handlerName || '-'}</div>
          <div>经办人签字：____________________</div>
        </div>
      </div>
    `
  }).join('')
  const printContent = `
    <html>
      <head>
        <title>销售出库单打印</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .form-container { margin-bottom: 40px; }
          @media print {
            .form-container { page-break-after: always; margin-bottom: 20px; }
          }
        </style>
      </head>
      <body>
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

const handleSelectionChange = (selection: OutboundRecord[]) => {
  selectedRows.value = selection
}

// 查询处理
const handleQuery = () => {
  // 查询逻辑已在计算属性中实现，这里可以添加额外的处理
  ElMessage.success('查询完成')
}

// 清空过滤器
const clearFilters = () => {
  Object.assign(queryForm, {
    dateRange: [],
    customerId: undefined,
    minAmount: undefined,
    maxAmount: undefined
  })
}

onMounted(() => {
  loadOutbounds()
  loadProducts()
  loadCustomers()
  loadWarehouses()
  loadEmployees()
  loadCurrentUser()
})
</script>

<style scoped>
.sales-outbound-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
.query-form { display: flex; flex-wrap: wrap; gap: 10px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
