<template>
  <div class="outbound-page">
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

        <el-input
          v-model="searchQuery"
          placeholder="搜索凭证号/客户/产品编码/名称"
          style="width: 320px; margin-left: auto"
          clearable
          @clear="handleSearch"
        >
          <template #append>
            <el-button @click="handleSearch">
              <el-icon><Search /></el-icon>
            </el-button>
          </template>
        </el-input>
      </div>

      <el-table
        :data="outboundList"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="voucherNo" label="凭证号" width="150" />
        <el-table-column prop="voucherDate" label="出库日期" width="120" />
        <el-table-column prop="customerName" label="客户" min-width="120" />
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
            {{ row.totalAmount?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作员" width="100" />
        <el-table-column prop="remark" label="备注" min-width="150" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="success" size="small" @click="handlePrint(row)">打印</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="90%" :close-on-click-modal="false">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <el-alert
          title="出库单头部信息"
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
            <el-form-item label="出库日期" prop="voucherDate">
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
            <el-form-item label="客户" prop="customerId">
              <el-select
                v-model="formData.customerId"
                placeholder="请选择客户"
                style="width: 100%"
                filterable
                @change="handleCustomerChange"
              >
                <el-option
                  v-for="customer in customers"
                  :key="customer.id"
                  :label="customer.name"
                  :value="customer.id"
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
                />
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

        <el-alert
          title="商品明细"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        />

        <el-table :data="formData.items" style="width: 100%" border>
          <el-table-column label="商品" min-width="200">
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
          <el-table-column label="商品名称" min-width="150">
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
          <el-table-column label="单价（不含税）" width="120">
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
          <el-table-column label="单价（含税）" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.unitPrice"
                :min="0"
                :precision="2"
                :step="0.01"
                :controls="false"
                style="width: 100%"
                @focus="handleFocus(row, 'unitPrice')"
                @change="onUnitPriceInclChange(row)"
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
          <el-table-column label="加计扣除" width="100">
            <template #default="{ row }">
              <el-switch
                v-model="row.allowDeduction"
                active-text="是"
                inactive-text="否"
                :disabled="row.taxRate !== '免税'"
                @change="onDeductionSwitchChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="税额" width="100">
            <template #default="{ row }">
              <el-input v-model="row.taxAmount" disabled />
            </template>
          </el-table-column>
          <el-table-column label="金额（含税）" width="120">
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
          <el-table-column label="加计扣除金额" width="120" v-if="formData.items.some(i => i.allowDeduction)">
            <template #default="{ row }">
              <el-input v-model="row.deductionAmount" disabled />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ $index }">
              <el-button type="danger" size="small" @click="removeItem($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-button type="primary" style="margin-top: 10px" @click="addItem">
          <el-icon><Plus /></el-icon> 添加商品行
        </el-button>

        <el-alert
          v-if="formData.items.some(i => i.allowDeduction)"
          title="加计扣除说明：加计扣除金额 = 金额（含税）× 9%"
          type="info"
          :closable="false"
          show-icon
          style="margin: 20px 0"
        />

        <el-alert
          title="单据汇总"
          type="success"
          :closable="false"
          show-icon
          style="margin: 20px 0"
        />

        <el-row :gutter="20" style="background: #f5f7fa; padding: 15px; border-radius: 4px">
          <el-col :span="12">
            <div style="font-size: 16px; font-weight: bold">商品行数：{{ formData.items?.length || 0 }}</div>
          </el-col>
          <el-col :span="12" style="text-align: right">
            <div style="font-size: 18px; font-weight: bold; color: #f56c6c">
              合计金额：{{ totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
            </div>
          </el-col>
        </el-row>

        <el-form-item label="备注" prop="remark">
          <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入备注" />
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
import { getRealTimeStock, getStockBeforeDateTime } from '@/utils/stock'
import { handleDocumentSave, DocumentType } from '@/utils/cost-recalculation'

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
  warehouseId?: number
  warehouseName?: string
  operator: string
  items: OutboundItem[]
  totalAmount: number
  remark?: string
  createdAt?: string
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

interface Warehouse {
  id: number
  code: string
  name: string
  status: number
}

const outboundList = ref<OutboundRecord[]>([])
const productList = ref<Product[]>([])
const customers = ref<Customer[]>([])
const warehouses = ref<Warehouse[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const dialogVisible = ref(false)
const dialogTitle = ref('新增出库单')
const formRef = ref()
const selectedRow = ref<OutboundRecord | null>(null)
const selectedRecords = ref<OutboundRecord[]>([])

const formData = reactive<OutboundRecord>({
  voucherNo: '',
  voucherDate: dayjs().format('YYYY-MM-DD'),
  customerId: undefined,
  customerName: '',
  warehouseId: undefined,
  warehouseName: '',
  operator: '',
  items: [],
  totalAmount: 0,
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

const totalAmount = computed(() => {
  return formData.items.reduce((sum, item) => sum + item.totalAmount, 0)
})

const generateVoucherNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `CK${date}${random}`
}

const loadOutboundList = async () => {
  try {
    if (window.electron && window.electron.dbQuery) {
      const result = await window.electron.dbQuery('outbound', 'SELECT * FROM outbound ORDER BY created_at DESC')
      outboundList.value = result
    } else {
      // 尝试多个可能的键名
      const possibleKeys = ['sales_outbound_records', 'outbound_records', 'salesOutbounds']
      let savedData = null
      
      for (const key of possibleKeys) {
        savedData = localStorage.getItem(key)
        if (savedData) {
          console.log(`从 ${key} 加载出库单数据`)
          break
        }
      }
      
      const allRecords = savedData ? JSON.parse(savedData) : []
      let filtered = allRecords
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = allRecords.filter((r: OutboundRecord) =>
          r.voucherNo?.toLowerCase().includes(query) ||
          r.customerName?.toLowerCase().includes(query)
        )
      }
      outboundList.value = filtered
    }

    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    const paginated = outboundList.value.slice(start, end)
    outboundList.value = paginated
    total.value = outboundList.value.length
  } catch (error) {
    ElMessage.error('加载出库单列表失败')
    console.error(error)
  }
}

const loadProducts = async () => {
  try {
    const saved = localStorage.getItem('products')
    if (saved) {
      const all = JSON.parse(saved)
      // map storage shape to runtime shape used here
      productList.value = all.map((p: any) => ({
        id: p.id,
        code: p.code || p.productCode || '',
        name: p.name || p.productName || '',
        specification: p.specification || p.spec || p.specification || '',
        unit: p.unit || '',
        salePrice: p.salePrice || p.sellPrice || p.costPrice || 0
      }))
    } else {
      productList.value = [
        { id: 1, code: 'P001', name: '测试产品 A', specification: '规格 A', unit: '个', salePrice: 20.0 },
        { id: 2, code: 'P002', name: '测试产品 B', specification: '规格 B', unit: '个', salePrice: 30.0 }
      ]
    }
  } catch (error) {
    console.error(error)
    productList.value = []
  }
}

const loadCustomers = async () => {
  try {
    customers.value = [
      { id: 1, name: '客户 A' },
      { id: 2, name: '客户 B' }
    ]
  } catch (error) {
    console.error(error)
  }
}

const loadWarehouses = async () => {
  try {
    const savedWarehouses = localStorage.getItem('warehouses')
    if (savedWarehouses) {
      const allWarehouses = JSON.parse(savedWarehouses)
      warehouses.value = allWarehouses.filter((w: Warehouse) => w.status === 1)
    } else {
      warehouses.value = []
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error)
    warehouses.value = []
  }
}

const loadCurrentUser = async () => {
  try {
    const currentUser = localStorage.getItem('currentUser')
    if (currentUser) {
      const user = JSON.parse(currentUser)
      formData.operator = user.name || user.username || '系统用户'
    } else {
      formData.operator = '系统用户'
    }
  } catch (error) {
    console.error(error)
    formData.operator = '系统用户'
  }
}

const handleAdd = () => {
  dialogTitle.value = '新增出库单'
  const user = localStorage.getItem('currentUser')
  Object.assign(formData, {
    voucherNo: generateVoucherNo(),
    voucherDate: dayjs().format('YYYY-MM-DD'),
    customerId: undefined,
    customerName: '',
    warehouseId: undefined,
    warehouseName: '',
    operator: user ? JSON.parse(user).name : '系统用户',
    items: [],
    totalAmount: 0,
    remark: ''
  })
  dialogVisible.value = true
}

const handleEdit = (row: OutboundRecord) => {
  dialogTitle.value = '编辑出库单'
  Object.assign(formData, {
    ...row,
    items: row.items ? JSON.parse(JSON.stringify(row.items)) : []
  })
  selectedRow.value = row
  dialogVisible.value = true
}

const handleDelete = async (row: OutboundRecord) => {
  try {
    await ElMessageBox.confirm('确定要删除该出库单吗？', '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    if (window.electron && window.electron.dbDelete) {
      await window.electron.dbDelete('outbound', 'id = ?', [row.id])
    } else {
      const possibleKeys = ['sales_outbound_records', 'outbound_records', 'salesOutbounds']
      let savedData = null
      let usedKey = ''
      
      for (const key of possibleKeys) {
        savedData = localStorage.getItem(key)
        if (savedData) {
          usedKey = key
          break
        }
      }
      
      if (savedData) {
        const allRecords = JSON.parse(savedData)
        const filtered = allRecords.filter((r: OutboundRecord) => r.id !== row.id)
        localStorage.setItem(usedKey, JSON.stringify(filtered))
      }
    }
    ElMessage.success('删除成功')
    loadOutboundList()
  } catch {
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
    deductionAmount: undefined,
    allowDeduction: false,
    _lastEdited: 'unitEx'
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

const handleProductChange = (index: number, productId: number) => {
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

const onDeductionSwitchChange = (item: OutboundItem) => {
  // 如果税率不是免税，自动关闭开关
  if (item.taxRate !== '免税') {
    item.allowDeduction = false
    ElMessage.warning('只有免税商品才允许加计扣除')
  }
  // 重新计算该行
  calculateRowTotal(item)
}

const onTaxRateChange = (item: OutboundItem) => {
  // 如果税率不是免税，关闭加计扣除开关
  if (item.taxRate !== '免税' && item.allowDeduction) {
    item.allowDeduction = false
  }
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

const handleWarehouseChange = (warehouseId: number) => {
  const warehouse = warehouses.value.find(w => w.id === warehouseId)
  if (warehouse) {
    formData.warehouseName = warehouse.name
  }
}

// 检查库存是否足够
const checkStockAvailability = (): boolean => {
  const warehouseId = formData.warehouseId
  const voucherDate = formData.voucherDate
  const createdAt = formData.createdAt
  
  if (!warehouseId) {
    ElMessage.warning('请先选择仓库')
    return false
  }
  if (!voucherDate) {
    ElMessage.warning('请先选择出库日期')
    return false
  }
  
  for (let i = 0; i < formData.items.length; i++) {
    const item = formData.items[i]
    if (!item.productId || !item.quantity) continue
    
    // 获取该日期和时间之前的库存（不包括该日期和时间的单据）
    const stockBeforeDateTime = getStockBeforeDateTime(
      item.productId, 
      warehouseId, 
      voucherDate, 
      createdAt,
      formData.id
    )
    
    if (stockBeforeDateTime < item.quantity) {
      const productName = item.productName || `第 ${i + 1} 行商品`
      ElMessage.error(
        `库存不足：${productName}\n` +
        `出库日期：${voucherDate}\n` +
        `该时间前库存：${stockBeforeDateTime}\n` +
        `需要出库：${item.quantity}\n\n` +
        `请修改出库日期或出库数量！`
      )
      return false
    }
  }
  
  return true
}

const handleSubmit = async () => {
  try {
    // 先执行表单规则校验
    await formRef.value.validate()

    // 表单头部必要字段校验，避免表单 validate 由于某些版本问题未覆盖
    if (!formData.voucherNo) {
      ElMessage.warning('凭证号不能为空')
      return
    }
    if (!formData.voucherDate) {
      ElMessage.warning('出库日期不能为空')
      return
    }
    if (!formData.customerId) {
      ElMessage.warning('客户不能为空')
      return
    }
    if (!formData.warehouseId) {
      ElMessage.warning('仓库不能为空')
      return
    }

    // 商品明细必须至少一行
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

    // 检查库存是否足够
    if (!checkStockAvailability()) {
      return
    }

    calculateTotalAmount()

    if (formData.id) {
      if (window.electron && window.electron.dbUpdate) {
        await window.electron.dbUpdate('outbound', formData, 'id = ?', [formData.id])
      } else {
        const possibleKeys = ['sales_outbound_records', 'outbound_records', 'salesOutbounds']
        let savedData = null
        let usedKey = ''
        
        for (const key of possibleKeys) {
          savedData = localStorage.getItem(key)
          if (savedData) {
            usedKey = key
            break
          }
        }
        
        if (savedData) {
          const allRecords = JSON.parse(savedData)
          const index = allRecords.findIndex((r: OutboundRecord) => r.id === formData.id)
          if (index !== -1) {
            allRecords[index] = { ...formData }
            localStorage.setItem(usedKey, JSON.stringify(allRecords))
          }
        }
      }
      ElMessage.success('更新成功')
    } else {
      formData.id = Date.now()
      formData.createdAt = new Date().toISOString() // 添加精确时间戳
      if (window.electron && window.electron.dbInsert) {
        await window.electron.dbInsert('outbound', formData)
      } else {
        const key = 'sales_outbound_records'
        const savedData = localStorage.getItem(key)
        const allRecords = savedData ? JSON.parse(savedData) : []
        allRecords.push({ ...formData })
        localStorage.setItem(key, JSON.stringify(allRecords))
      }
      ElMessage.success('新增成功')
    }
    
    // 检测是否需要重新结算成本
    await handleDocumentSave(
      DocumentType.INVENTORY_OUTBOUND,
      formData.items || [],
      formData.voucherDate
    )
    
    dialogVisible.value = false
    loadOutboundList()
  } catch (error) {
    console.error(error)
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadOutboundList()
}

const handlePrintCurrent = () => {
  if (!selectedRecords.value.length) {
    ElMessage.warning('请先在列表中选择要打印的单据')
    return
  }

  printBatchOutboundForms(selectedRecords.value)
}

const handlePrint = (row: OutboundRecord) => {
  selectedRow.value = row
  printOutboundForm(row)
}

const printOutboundForm = (row: OutboundRecord) => {
  const hasDeduction = row.items.some((item: any) => item.allowDeduction)
  
  const itemsHtml = row.items.map((item: any, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.productName}</td>
        <td>${item.specification}</td>
        <td>${item.quantity}</td>
        <td>${item.unit}</td>
        <td>${item.unitPriceEx?.toFixed(2) || item.unitPrice.toFixed(2)}</td>
        <td>${item.unitPrice.toFixed(2)}</td>
        <td>${item.taxRate}%</td>
        <td>${item.allowDeduction ? '是' : '否'}</td>
        <td>${item.taxAmount.toFixed(2)}</td>
        <td>${item.totalAmount.toFixed(2)}</td>
        ${hasDeduction ? `<td>${(item.deductionAmount || 0).toFixed(2)}</td>` : ''}
      </tr>
    `).join('')

  const printContent = `
    <html>
      <head>
        <title>出库单 - ${row.voucherNo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; }
          .table th { background-color: #f5f5f5; }
          .info { margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>出库单</h2>
          <p>凭证号：${row.voucherNo}</p>
        </div>
        <div class="info">
          <div>出库日期：${row.voucherDate}</div>
          <div>客户：${row.customerName}</div>
          <div>操作员：${row.operator}</div>
          <div>备注：${row.remark || '-'}</div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>商品</th>
              <th>规格</th>
              <th>数量</th>
              <th>单位</th>
              <th>单价（不含税）</th>
              <th>单价（含税）</th>
              <th>税率</th>
              <th>加计扣除</th>
              <th>税额</th>
              <th>金额（含税）</th>
              ${hasDeduction ? '<th>加计扣除金额</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="text-align: right; font-weight: bold;">总金额：${row.totalAmount.toFixed(2)}</div>
        ${hasDeduction ? `<div style="text-align: right; font-weight: bold; color: #67c23a;">加计扣除总额：${row.items.reduce((sum: number, item: any) => sum + (item.deductionAmount || 0), 0).toFixed(2)}</div>` : ''}
        <div style="text-align: right; margin-top: 10px;">打印时间：${dayjs().format('YYYY-MM-DD HH:mm:ss')}</div>
      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }
}

const printBatchOutboundForms = (rows: OutboundRecord[]) => {
  const allFormsHtml = rows.map((row: any, formIndex) => {
    const hasDeduction = row.items.some((item: any) => item.allowDeduction)
    
    const itemsHtml = row.items.map((item: any, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.productName}</td>
          <td>${item.specification}</td>
          <td>${item.quantity}</td>
          <td>${item.unit}</td>
          <td>${item.unitPriceEx?.toFixed(2) || item.unitPrice.toFixed(2)}</td>
          <td>${item.unitPrice.toFixed(2)}</td>
          <td>${item.taxRate}%</td>
          <td>${item.allowDeduction ? '是' : '否'}</td>
          <td>${item.taxAmount.toFixed(2)}</td>
          <td>${item.totalAmount.toFixed(2)}</td>
          ${hasDeduction ? `<td>${(item.deductionAmount || 0).toFixed(2)}</td>` : ''}
        </tr>
      `).join('')

    return `
      <div class="form-container" style="page-break-after: always; margin-bottom: 40px;">
        <div class="header" style="text-align: center; margin-bottom: 20px;">
          <h2>出库单</h2>
          <p>凭证号：${row.voucherNo}</p>
        </div>
        <div class="info" style="margin-bottom: 10px;">
          <div>出库日期：${row.voucherDate}</div>
          <div>客户：${row.customerName}</div>
          <div>操作员：${row.operator}</div>
          <div>备注：${row.remark || '-'}</div>
        </div>
        <table class="table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">#</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">商品</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">规格</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">数量</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">单位</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">单价（不含税）</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">单价（含税）</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">税率</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">加计扣除</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">税额</th>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">金额（含税）</th>
              ${hasDeduction ? '<th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">加计扣除金额</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="text-align: right; font-weight: bold;">总金额：${row.totalAmount.toFixed(2)}</div>
        ${hasDeduction ? `<div style="text-align: right; font-weight: bold; color: #67c23a;">加计扣除总额：${row.items.reduce((sum: number, item: any) => sum + (item.deductionAmount || 0), 0).toFixed(2)}</div>` : ''}
        <div style="text-align: right; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">
          第 ${formIndex + 1} 张 / 共 ${rows.length} 张
        </div>
      </div>
    `
  }).join('')

  const printContent = `
    <html>
      <head>
        <title>批量出库单打印 - ${rows.length} 张</title>
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
          <h1>批量出库单打印</h1>
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
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }
}

const handleExport = () => {
  const columns = [
    { label: '凭证号', key: 'voucherNo' },
    { label: '出库日期', key: 'voucherDate' },
    { label: '仓库', key: 'warehouseName' },
    { label: '总金额', key: 'totalAmount' }
  ]
  exportToCsv('inventory_outbounds.csv', columns, outboundList.value)
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  loadOutboundList()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  loadOutboundList()
}

const handleSelectionChange = (selection: OutboundRecord[]) => {
  selectedRecords.value = selection
  selectedRow.value = selection.length ? selection[0] : null
}

onMounted(() => {
  loadOutboundList()
  loadProducts()
  loadCustomers()
  loadWarehouses()
  loadCurrentUser()
})
</script>

<style scoped>
.outbound-page { padding: 20px; }
.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
.pagination { margin-top: 20px; display: flex; justify-content: flex-end; }
</style>
