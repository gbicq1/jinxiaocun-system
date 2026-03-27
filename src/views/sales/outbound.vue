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
        <el-table-column prop="handlerName" label="经办人" min-width="100" />
        <el-table-column prop="itemCount" label="商品行数" width="80">
          <template #default="{ row }">
            {{ row.items?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="总金额" width="120">
          <template #default="{ row }">
            {{ row.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
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
            <el-form-item label="经办人" prop="handlerId">
              <el-select v-model="formData.handlerId" placeholder="请选择经办人" style="width: 100%" filterable @change="handleHandlerChange">
                <el-option v-for="employee in employees" :key="employee.id" :label="employee.name" :value="employee.id" />
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
              <el-input-number v-model="row.quantity" :min="0" :precision="2" :controls="false" style="width: 100%" @change="onQuantityChange(row)" />
            </template>
          </el-table-column>
          <el-table-column label="单位" width="80">
            <template #default="{ row }"><el-input v-model="row.unit" disabled /></template>
          </el-table-column>
          <el-table-column label="单价（不含税）" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.unitPriceEx" :min="0" :precision="2" :step="0.01" :controls="false" style="width: 100%" @change="onUnitPriceExChange(row)" />
            </template>
          </el-table-column>

          <el-table-column label="单价 (含税)" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.unitPrice" :min="0" :precision="2" :step="0.01" :controls="false" style="width: 100%" @change="onUnitPriceInclChange(row)" />
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
          <el-table-column label="加计扣除" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.allowDeduction" :disabled="row.taxRate !== '免税'" @change="onDeductionSwitchChange(row)" />
            </template>
          </el-table-column>
          <el-table-column label="税额" width="100"><template #default="{ row }"><el-input v-model="row.taxAmount" disabled /></template></el-table-column>
          <el-table-column label="金额 (含税)" width="140"><template #default="{ row }"><el-input-number v-model="row.totalAmount" :min="0" :precision="2" :controls="false" style="width: 100%" @change="onAmountChange(row)" /></template></el-table-column>
          <el-table-column label="加计扣除金额" width="120" v-if="formData.items.some(item => item.allowDeduction)">
            <template #default="{ row }"><el-input v-model="row.deductionAmount" disabled /></template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right"><template #default="{ $index }"><el-button type="danger" size="small" @click="removeItem($index)">删除</el-button></template></el-table-column>
        </el-table>

        <el-button type="primary" style="margin-top: 10px" @click="addItem"><el-icon><Plus /></el-icon> 添加商品行</el-button>

        <el-alert title="单据汇总" type="success" :closable="false" show-icon style="margin: 20px 0" />

        <el-row :gutter="20" style="margin-bottom: 10px">
          <el-col :span="12">
            <div style="font-size: 14px">已收款：
              <el-input-number v-model="formData.receivedAmount" :min="0" :precision="2" :controls="false" style="width:160px" /> 元
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
          <el-col :span="12" style="text-align: right"><div style="font-size: 18px; font-weight: bold; color: #f56c6c">合计金额：{{ totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</div></el-col>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import exportToCsv from '../../utils/exportCsv'

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
  deductionAmount?: number
  allowDeduction?: boolean
  _lastEdited?: 'unitEx' | 'unitIncl' | 'amount'
}

interface OutboundRecord {
  id?: number
  voucherNo: string
  voucherDate: string
  customerId?: number
  customerName: string
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

const outbounds = ref<OutboundRecord[]>([])
const productList = ref<Product[]>([])
const customers = ref<Customer[]>([])
const employees = ref<Employee[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增出库单')
const selectedRows = ref<OutboundRecord[]>([])
const isViewMode = ref(false) // 新增：控制是否为查看模式

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
  let filtered = outbounds.value

  // 日期范围过滤
  if (queryForm.dateRange && queryForm.dateRange.length === 2) {
    const [startDate, endDate] = queryForm.dateRange
    filtered = filtered.filter(record => {
      return record.voucherDate >= startDate && record.voucherDate <= endDate
    })
  }

  // 客户过滤
  if (queryForm.customerId) {
    filtered = filtered.filter(record => record.customerId === queryForm.customerId)
  }

  // 金额范围过滤
  if (typeof queryForm.minAmount === 'number') {
    filtered = filtered.filter(record => record.totalAmount >= queryForm.minAmount!)
  }
  if (typeof queryForm.maxAmount === 'number') {
    filtered = filtered.filter(record => record.totalAmount <= queryForm.maxAmount!)
  }

  return filtered
})

const generateVoucherNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `CK${date}${random}`
}

const loadOutbounds = () => {
  const savedData = localStorage.getItem('sales_outbound_records')
  const allRecords = savedData ? JSON.parse(savedData) : []
  outbounds.value = allRecords
}

const saveOutbounds = () => {
  localStorage.setItem('sales_outbound_records', JSON.stringify(outbounds.value))
}

const loadProducts = () => {
  // 从 localStorage 加载产品数据
  const savedProducts = localStorage.getItem('products')
  if (savedProducts) {
    try {
      const products = JSON.parse(savedProducts)
      productList.value = products.map((p: any) => ({
        id: p.id,
        code: p.productCode || p.code,
        name: p.productName || p.name,
        specification: p.specification || p.spec || '',
        unit: p.unit || '个',
        salePrice: p.salePrice || p.price || 0
      }))
    } catch (e) {
      console.error('加载产品数据失败:', e)
      // 如果加载失败，使用默认数据
      productList.value = [
        { id: 1, code: 'P001', name: '测试产品 A', specification: '规格 A', unit: '个', salePrice: 20.0 },
        { id: 2, code: 'P002', name: '测试产品 B', specification: '规格 B', unit: '个', salePrice: 30.0 }
      ]
    }
  } else {
    // 如果没有产品数据，使用默认数据
    productList.value = [
      { id: 1, code: 'P001', name: '测试产品 A', specification: '规格 A', unit: '个', salePrice: 20.0 },
      { id: 2, code: 'P002', name: '测试产品 B', specification: '规格 B', unit: '个', salePrice: 30.0 }
    ]
  }

  // 若存在 price_list，则按生效日期覆盖产品的销售价（选择最近且生效<=今天的记录）
  const saved = localStorage.getItem('price_list')
  if (saved) {
    const priceList = JSON.parse(saved)
    const today = dayjs().format('YYYY-MM-DD')
    productList.value = productList.value.map(p => {
      const entries = priceList.filter((pl: any) => pl.productCode === p.code)
      if (entries && entries.length) {
        // 找到生效日期 <= today 的最新一条
        const valid = entries.filter((e: any) => e.effectiveDate && e.effectiveDate <= today)
        if (valid && valid.length) {
          valid.sort((a: any, b: any) => b.effectiveDate.localeCompare(a.effectiveDate))
          const pick = valid[0]
          return { ...p, salePrice: Number(pick.salePrice || p.salePrice) }
        }
      }
      return p
    })
  }
}

const loadCustomers = () => {
  const saved = localStorage.getItem('customers')
  customers.value = saved ? JSON.parse(saved) : [
    { id: 1, name: '客户 A' },
    { id: 2, name: '客户 B' }
  ]
}

const loadEmployees = () => {
  const saved = localStorage.getItem('employees')
  employees.value = saved ? JSON.parse(saved) : []
}

const loadCurrentUser = () => {
  const currentUser = localStorage.getItem('currentUser')
  if (currentUser) {
    formData.operator = JSON.parse(currentUser).name || '系统用户'
  } else {
    formData.operator = '系统用户'
  }
}

const handleAdd = () => {
  dialogTitle.value = '新增出库单'
  const user = localStorage.getItem('currentUser')
  // 完全重置formData，确保清除所有属性包括id
  Object.assign(formData, {
    id: undefined, // 明确清除id
    voucherNo: generateVoucherNo(),
    voucherDate: dayjs().format('YYYY-MM-DD'),
    customerId: undefined,
    customerName: '',
    operator: user ? JSON.parse(user).name : '系统用户',    handlerId: undefined,
    handlerName: '',    items: [],
    totalAmount: 0,
    receivedAmount: 0,
    invoiceIssued: false,
    status: 'draft',
    remark: ''
  })
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

    // 从当前列表移除
    outbounds.value = outbounds.value.filter(r => r.id !== row.id)
    saveOutbounds()
    ElMessage.success('已移到回收站')
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
    quantity: 1, 
    unit: '', 
    unitPrice: 0, 
    unitPriceEx: 0, 
    taxRate: 13, 
    taxAmount: 0, 
    totalAmount: 0,
    deductionAmount: 0,
    allowDeduction: false,
    _lastEdited: 'unitIncl' 
  })
}

const removeItem = (index: number) => {
  formData.items.splice(index, 1)
  calculateTotalAmount()
}

const handleProductChange = (index: number, productId: number) => {
  const product = productList.value.find(p => p.id === productId)
  if (product) {
    const item = formData.items[index]
    item.productName = product.name
    item.specification = product.specification || ''
    item.unit = product.unit || ''
    item.unitPriceEx = product.salePrice || 0
    item._lastEdited = 'unitEx'
    calculateRowTotal(item)
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100

const calculateRowTotal = (item: OutboundItem) => {
  const qty = item.quantity || 0
  const taxRaw = item.taxRate === '免税' ? 0 : Number(item.taxRate || 0)
  const r = taxRaw / 100
  const isDeduction = item.allowDeduction || false

  const last = item._lastEdited

  if (last === 'unitEx') {
    const unitEx = Number(item.unitPriceEx || 0)
    let unitIncl: number
    let taxAmount: number
    let totalAmount: number
    let deductionAmount: number
    
    if (isDeduction) {
      // 加计扣除模式：单价（不含税）= 金额 * (1-9%) / 数量
      // 反推：金额 = 单价（不含税）* 数量 / (1-9%)
      totalAmount = round2(unitEx * qty / 0.91)
      unitIncl = round2(totalAmount / qty) // 单价（含税）= 金额 / 数量
      taxAmount = round2(qty * (unitIncl - unitEx))
      deductionAmount = round2(totalAmount * 0.09) // 加计扣除 = 金额 × 9%
    } else {
      // 正常模式
      unitIncl = r === 0 ? unitEx : round2(unitEx * (1 + r))
      taxAmount = round2(qty * (unitIncl - unitEx))
      totalAmount = round2(unitIncl * qty)
      deductionAmount = 0
    }
    item.unitPrice = unitIncl
    item.taxAmount = taxAmount
    item.totalAmount = totalAmount
    item.deductionAmount = deductionAmount
  } else if (last === 'unitIncl') {
    const unitIncl = Number(item.unitPrice || 0)
    let unitEx: number
    let taxAmount: number
    let totalAmount: number
    let deductionAmount: number
    
    if (isDeduction) {
      // 加计扣除模式：单价（不含税）= 单价（含税）* (1-9%)
      totalAmount = round2(unitIncl * qty) // 金额 = 单价（含税）* 数量
      unitEx = round2(unitIncl * 0.91) // 单价（不含税）= 单价（含税）* (1-9%)
      taxAmount = round2(qty * (unitIncl - unitEx))
      deductionAmount = round2(totalAmount * 0.09) // 加计扣除 = 金额 × 9%
    } else {
      // 正常模式
      unitEx = r === 0 ? unitIncl : round2(unitIncl / (1 + r))
      taxAmount = round2(qty * (unitIncl - unitEx))
      totalAmount = round2(unitIncl * qty)
      deductionAmount = 0
    }
    item.unitPriceEx = unitEx
    item.taxAmount = taxAmount
    item.totalAmount = totalAmount
    item.deductionAmount = deductionAmount
  } else if (last === 'amount') {
    const total = Number(item.totalAmount || 0)
    if (qty === 0) {
      item.unitPrice = 0
      item.unitPriceEx = 0
      item.taxAmount = 0
      item.deductionAmount = 0
    } else {
      let unitIncl: number
      let unitEx: number
      let taxAmount: number
      let deductionAmount: number
      
      if (isDeduction) {
        // 加计扣除模式：单价（不含税）= 金额 * (1-9%) / 数量
        unitIncl = round2(total / qty) // 单价（含税）= 金额 / 数量
        unitEx = round2(total * 0.91 / qty) // 单价（不含税）= 金额 * (1-9%) / 数量
        taxAmount = round2(qty * (unitIncl - unitEx))
        deductionAmount = round2(total * 0.09) // 加计扣除 = 金额 × 9%
      } else {
        // 正常模式
        unitIncl = round2(total / qty)
        unitEx = r === 0 ? unitIncl : round2(unitIncl / (1 + r))
        taxAmount = round2(qty * (unitIncl - unitEx))
        deductionAmount = 0
      }
      item.unitPrice = unitIncl
      item.unitPriceEx = unitEx
      item.taxAmount = taxAmount
      item.deductionAmount = deductionAmount
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
  // 如果税率不是免税，关闭加计扣除开关
  if (item.taxRate !== '免税' && item.allowDeduction) {
    item.allowDeduction = false
  }
  calculateRowTotal(item)
}

const onDeductionSwitchChange = (item: OutboundItem) => {
  // 如果税率不是免税，自动关闭开关
  if (item.taxRate !== '免税') {
    item.allowDeduction = false
    ElMessage.warning('只有免税商品才允许加计扣除')
  }
  // 重新计算该行
  calculateRowTotal(item)
}

const onQuantityChange = (item: OutboundItem) => {
  calculateRowTotal(item)
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

const handleSubmit = () => {
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
      ElMessage.warning(`第 ${i + 1} 行数量必须大于0`)
      return
    }
    if (!item.unitPrice || item.unitPrice <= 0) {
      ElMessage.warning(`第 ${i + 1} 行单价必须大于0`)
      return
    }
    if (item.taxRate === null || item.taxRate === undefined) {
      ElMessage.warning(`第 ${i + 1} 行税率不能为空`)
      return
    }
  }

  calculateTotalAmount()
  if (formData.id) {
    const idx = outbounds.value.findIndex(o => o.id === formData.id)
    if (idx !== -1) {
      outbounds.value[idx] = { 
        ...formData,
        handlerName: formData.handlerName || '' // 确保保存 handlerName
      }
    }
  } else {
    formData.id = Date.now()
    formData.createdAt = new Date().toISOString() // 添加精确时间戳
    outbounds.value.push({ 
      ...formData, 
      status: 'completed',
      handlerName: formData.handlerName || '' // 确保保存 handlerName
    })
  }
  saveOutbounds()
  dialogVisible.value = false
  ElMessage.success('保存成功')
  loadOutbounds()
}

const handleView = (row: OutboundRecord) => {
  dialogTitle.value = '查看出库单'
  isViewMode.value = true
  Object.assign(formData, { ...row, items: row.items ? JSON.parse(JSON.stringify(row.items)) : [] })
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
  const hasDeduction = row.items.some(item => item.allowDeduction)
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
        ${hasDeduction ? `<td>${(item.deductionAmount || 0).toFixed(2)}</td>` : ''}
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
              ${hasDeduction ? '<th>加计扣除</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="text-align: right; font-weight: bold;">总金额：${row.totalAmount.toFixed(2)}</div>
        ${hasDeduction ? `<div style="text-align: right; font-weight: bold; color: #67c23a;">加计扣除总额：${row.items.reduce((sum, item) => sum + (item.deductionAmount || 0), 0).toFixed(2)}</div>` : ''}
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
    const hasDeduction = row.items.some(item => item.allowDeduction)
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
          ${hasDeduction ? `<td>${(item.deductionAmount || 0).toFixed(2)}</td>` : ''}
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
              ${hasDeduction ? '<th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">加计扣除</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="text-align: right; font-weight: bold;">总金额：${row.totalAmount.toFixed(2)}</div>
        ${hasDeduction ? `<div style="text-align: right; font-weight: bold; color: #67c23a;">加计扣除总额：${row.items.reduce((sum, item) => sum + (item.deductionAmount || 0), 0).toFixed(2)}</div>` : ''}
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
