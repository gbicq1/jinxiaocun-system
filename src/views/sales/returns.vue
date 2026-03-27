<template>
  <div class="returns-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增退货单
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
          placeholder="搜索凭证号/产品编码/客户"
          style="width: 300px; margin-left: auto"
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
        :data="returnsList"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="voucherNo" label="凭证号" width="150" />
        <el-table-column prop="voucherDate" label="日期" width="120" />
        <el-table-column prop="customerName" label="客户" min-width="120" />
        <el-table-column prop="originalOrderNo" label="原订单号" width="150" />
        <el-table-column prop="itemCount" label="商品行数" width="80">
          <template #default="{ row }">
            {{ row.items?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="退货金额" width="120">
          <template #default="{ row }">
            -¥{{ Math.abs(row.totalAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
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

    <!-- 新增/编辑退货单对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="90%"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="120px"
        :disabled="isViewMode"
      >
        <el-alert
          title="销售退货单 - 冲减库存数据"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        >
          <template #default>
            <div>
              退货单将冲减对应商品的库存数量，并生成负向出库记录
            </div>
          </template>
        </el-alert>

        <!-- 单据头部信息 -->
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="凭证号" prop="voucherNo">
              <el-input v-model="formData.voucherNo" placeholder="自动生成" readonly />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="退货日期" prop="voucherDate">
              <el-date-picker
                v-model="formData.voucherDate"
                type="date"
                placeholder="选择日期"
                style="width: 100%"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="原订单号" prop="originalOrderNo">
              <el-select
                v-model="formData.originalOrderNo"
                placeholder="选择原订单"
                style="width: 100%"
                clearable
                @change="handleOriginalOrderChange"
              >
                <el-option
                  v-for="item in orderList"
                  :key="item.id"
                  :label="`${item.orderNo} - ${item.orderDate}`"
                  :value="item.orderNo"
                >
                  <span>{{ item.orderNo }}</span>
                  <span style="color: #8492a6; font-size: 13px">({{ item.orderDate }})</span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户" prop="customerId">
              <el-select
                v-model="formData.customerId"
                placeholder="选择客户"
                style="width: 100%"
                filterable
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
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="客户名称">
              <el-input v-model="formData.customerName" readonly />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经办人" prop="operator">
              <el-select v-model="formData.operator" placeholder="选择经办人" filterable>
                <el-option
                  v-for="u in users"
                  :key="u.id"
                  :label="u.name"
                  :value="u.name"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="退货原因" prop="returnReason">
          <el-input
            v-model="formData.returnReason"
            type="textarea"
            :rows="2"
            placeholder="请输入退货原因（如：质量问题、规格不符等）"
          />
        </el-form-item>

        <!-- 退货商品明细 -->
        <el-alert
          title="退货商品明细"
          type="info"
          :closable="false"
          show-icon
          style="margin: 20px 0"
        >
          <template #default>
            <div>
              选择原订单后自动加载商品，或直接添加退货商品
            </div>
          </template>
        </el-alert>

        <el-table
          :data="formData.items"
          style="width: 100%; margin-bottom: 10px"
          border
        >
          <el-table-column label="商品" min-width="200">
            <template #default="{ row }">
              <el-select
                v-model="row.productId"
                placeholder="选择商品"
                filterable
                style="width: 100%"
                @change="handleProductChange(row)"
              >
                <el-option
                  v-for="product in products"
                  :key="product.id"
                  :label="`${product.code} - ${product.name}`"
                  :value="product.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column prop="productName" label="商品名称" min-width="150" />
          <el-table-column prop="specification" label="规格" width="120" />
          <el-table-column prop="unit" label="单位" width="80" />
          <el-table-column label="退货数量" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.quantity"
                :min="1"
                :precision="2"
                controls-position="right"
                style="width: 100%"
                @change="calculateRowTotals(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="单价 (不含税)" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.unitPrice"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 100%"
                @change="updateRowBy(row, 'unitPrice')"
              />
            </template>
          </el-table-column>
          <el-table-column label="单价 (含税)" width="120">
            <template #default="{ row }">
              ¥{{ ((row.unitPrice || 0) * (1 + (row.taxRate || 0) / 100)).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="税率 (%)" width="100">
            <template #default="{ row }">
              <el-input-number
                v-model="row.taxRate"
                :min="0"
                :max="100"
                :precision="2"
                :step="1"
                controls-position="right"
                style="width: 100%"
                @change="updateRowBy(row, 'taxRate')"
              />
            </template>
          </el-table-column>
          <el-table-column label="税额" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.taxAmount"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 100%"
                @change="updateRowBy(row, 'taxAmount')"
              />
            </template>
          </el-table-column>
          <el-table-column label="金额 (含税)" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.totalInc"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 100%"
                @change="updateRowBy(row, 'totalInc')"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ $index }">
              <el-button
                type="danger"
                size="small"
                @click="removeItem($index)"
                :disabled="isViewMode"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-button
          type="primary"
          size="small"
          @click="addItem"
          :disabled="isViewMode"
          style="margin-bottom: 20px"
        >
          <el-icon><Plus /></el-icon>
          添加商品
        </el-button>

        <!-- 合计信息 -->
        <el-descriptions
          :column="2"
          border
          style="margin-top: 20px"
        >
          <el-descriptions-item label="退货总金额">
            -¥{{ Math.abs(formData.totalAmount).toFixed(2) }}
          </el-descriptions-item>
          <el-descriptions-item label="商品行数">
            {{ formData.items.length }}
          </el-descriptions-item>
        </el-descriptions>

        <el-form-item label="备注">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button
            v-if="isViewMode"
            type="primary"
            @click="handlePrintCurrent"
          >
            打印
          </el-button>
          <el-button
            v-else
            type="primary"
            @click="handleSubmit"
            :loading="submitLoading"
          >
            保存
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Printer, Download, Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

// 类型定义
interface ReturnItem {
  productId?: number
  productName?: string
  specification?: string
  unit?: string
  quantity: number
  unitPrice: number
  taxRate: number
  amount: number
  taxAmount: number
}

interface ReturnRecord {
  id?: number
  voucherNo: string
  voucherDate: string
  originalOrderNo?: string
  customerId?: number
  customerName: string
  operator: string
  returnReason?: string
  items: ReturnItem[]
  totalAmount: number
  remark?: string
}

interface Product {
  id: number
  code: string
  name: string
  specification?: string
  unit?: string
  costPrice?: number
  status?: number | boolean
}

interface Customer {
  id: number
  name: string
  status?: number | boolean
}

interface OrderRecord {
  id?: number
  orderNo: string
  orderDate: string
  customerId?: number
  customerName: string
  items: any[]
}

// 状态
const dialogVisible = ref(false)
const dialogTitle = ref('新增退货单')
const isViewMode = ref(false)
const submitLoading = ref(false)
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const returnsList = ref<ReturnRecord[]>([])
const orderList = ref<OrderRecord[]>([])
const products = ref<Product[]>([])
const customers = ref<Customer[]>([])
const users = ref<any[]>([])
const selectedRows = ref<ReturnRecord[]>([])

// 表单数据
const formRef = ref()
const formData = reactive<ReturnRecord>({
  voucherNo: '',
  voucherDate: dayjs().format('YYYY-MM-DD'),
  originalOrderNo: '',
  customerId: undefined,
  customerName: '',
  operator: '',
  returnReason: '',
  items: [],
  totalAmount: 0,
  remark: ''
})

const rules = {
  voucherDate: [{ required: true, message: '请选择退货日期', trigger: 'change' }],
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
  operator: [{ required: true, message: '请输入经办人', trigger: 'blur' }],
  returnReason: [{ required: true, message: '请输入退货原因', trigger: 'blur' }]
}

// 加载退货单列表
const loadReturnsList = async () => {
  try {
    const saved = localStorage.getItem('salesReturns')
    if (saved) {
      const all = JSON.parse(saved)
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      returnsList.value = all.slice(start, end)
      total.value = all.length
    } else {
      returnsList.value = []
      total.value = 0
    }
  } catch (error) {
    console.error('加载销售退货单列表失败:', error)
    ElMessage.error('加载销售退货单列表失败')
  }
}

// 加载订单列表（用于选择原订单）
const loadOrderList = async () => {
  try {
    const saved = localStorage.getItem('sales_orders')
    orderList.value = saved ? JSON.parse(saved) : []
  } catch (error) {
    console.error('加载订单列表失败:', error)
    orderList.value = []
  }
}

// 加载商品列表
const loadProducts = async () => {
  try {
    const savedProducts = localStorage.getItem('products')
    if (savedProducts) {
      const allProducts = JSON.parse(savedProducts)
      products.value = allProducts
        .filter((p: any) => (p.status as any) === 1 || (p.status as any) === true)
        .map((p: any) => ({
          id: p.id,
          code: p.code || p.productCode || '',
          name: p.name || p.productName || '',
          specification: p.specification || p.spec || '',
          unit: p.unit || '',
          costPrice: p.costPrice || p.cost || 0
        }))
    } else {
      products.value = []
    }
  } catch (error) {
    console.error('加载商品列表失败:', error)
    products.value = []
  }
}

// 加载客户列表
const loadCustomers = async () => {
  try {
    const saved = localStorage.getItem('customers')
    customers.value = saved ? JSON.parse(saved) : []
  } catch (error) {
    console.error('加载客户列表失败:', error)
    customers.value = []
  }
}

// 加载系统用户（用于经办人下拉），兼容多种存储键与字段
const normalizeUser = (u: any) => ({ id: u.id ?? u.userId ?? u.uid ?? Date.now(), name: u.name || u.realname || u.realName || u.employeeName || u.fullName || u.username || u.userName || '' })
const loadUsers = async () => {
  try {
    const candidateKeys = ['system_users', 'employees', 'staff', 'users', 'employee_list']
    let found: any[] = []
    for (const k of candidateKeys) {
      const raw = localStorage.getItem(k)
      if (raw) {
        try { found = JSON.parse(raw); break } catch { continue }
      }
    }
    if (!found || found.length === 0) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        if (['system_users','employees','staff','users','employee_list'].includes(key)) continue
        const raw = localStorage.getItem(key)
        try {
          const parsed = JSON.parse(raw as string)
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] && (parsed[0].name || parsed[0].realname || parsed[0].employeeName)) {
            found = parsed
            break
          }
        } catch {
          // ignore
        }
      }
    }

    users.value = (found || []).map(normalizeUser)

    if ((!users.value || users.value.length === 0) && localStorage.getItem('currentUser')) {
      try {
        const cur = JSON.parse(localStorage.getItem('currentUser')!)
        users.value = [normalizeUser(cur)]
      } catch {
        users.value = []
      }
    }
  } catch (error) {
    console.error('加载系统用户失败:', error)
    users.value = []
  }
}

const handleAdd = () => {
  resetForm()
  dialogTitle.value = '新增退货单'
  isViewMode.value = false
  dialogVisible.value = true
}

const handleEdit = (row: ReturnRecord) => {
  Object.assign(formData, row)
  formData.items = JSON.parse(JSON.stringify(row.items))
  dialogTitle.value = '编辑退货单'
  isViewMode.value = false
  dialogVisible.value = true
}

const handleView = (row: ReturnRecord) => {
  Object.assign(formData, row)
  formData.items = JSON.parse(JSON.stringify(row.items))
  dialogTitle.value = '查看退货单'
  isViewMode.value = true
  dialogVisible.value = true
}

const handleDelete = async (row: ReturnRecord) => {
  try {
    await ElMessageBox.confirm(`确定要删除退货单 ${row.voucherNo} 吗？`, '警告', {
      type: 'warning'
    })

    const saved = localStorage.getItem('salesReturns')
    if (saved) {
      const all = JSON.parse(saved)
      const filtered = all.filter((r: ReturnRecord) => r.id !== row.id)
      localStorage.setItem('salesReturns', JSON.stringify(filtered))

      // 更新库存（增加回库存）
      updateInventoryOnReturn(row, true)

      ElMessage.success('删除成功')
      loadReturnsList()
    }
  } catch {
    // 取消删除
  }
}

// 更新库存（退货时增加库存）
const updateInventoryOnReturn = (returnRecord: ReturnRecord, isAdding: boolean) => {
  try {
    const savedInventory = localStorage.getItem('inventory')
    const inventory = savedInventory ? JSON.parse(savedInventory) : {}

    returnRecord.items.forEach((item: ReturnItem) => {
      if (item.productId) {
        if (!inventory[item.productId]) {
          inventory[item.productId] = { productId: item.productId, quantity: 0 }
        }

        const changeAmount = item.quantity
        if (isAdding) {
          inventory[item.productId].quantity += changeAmount
        } else {
          inventory[item.productId].quantity -= changeAmount
        }
      }
    })

    localStorage.setItem('inventory', JSON.stringify(inventory))
  } catch (error) {
    console.error('更新库存失败:', error)
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()

    // 必须添加至少一行商品
    if (!formData.items || formData.items.length === 0) {
      ElMessage.error('请至少添加一条退货商品')
      return
    }

    // 计算总金额
    formData.totalAmount = formData.items.reduce((sum, item) => sum + item.amount, 0)

    // 生成凭证号（如果是新增）
    if (!formData.id) {
      formData.voucherNo = generateVoucherNo()
    }

    // 保存到 localStorage
    const saved = localStorage.getItem('salesReturns')
    const all = saved ? JSON.parse(saved) : []

    const existingIndex = all.findIndex((r: ReturnRecord) => r.id === formData.id)
    if (existingIndex >= 0) {
      const oldRecord = all[existingIndex]
      updateInventoryOnReturn(oldRecord, true)
      all[existingIndex] = { ...formData, id: formData.id }
    } else {
      formData.id = Date.now()
      formData.createdAt = new Date().toISOString() // 添加精确时间戳
      all.push(formData)
    }

    updateInventoryOnReturn(formData, false)

    localStorage.setItem('salesReturns', JSON.stringify(all))

    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadReturnsList()
  } catch (error: any) {
    if (error.validate) {
      ElMessage.error('请完善表单信息')
    } else {
      ElMessage.error('保存失败')
    }
  }
}

const generateVoucherNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `XS${date}${random}`
}

const handleOriginalOrderChange = (orderNo: string) => {
  const order = orderList.value.find(item => item.orderNo === orderNo)
  if (order) {
    formData.customerId = order.customerId
    formData.customerName = order.customerName

    formData.items = order.items.map((item: any) => ({
      productId: item.productId,
      productName: item.productName,
      specification: item.specification,
      unit: item.unit,
      quantity: 0,
      unitPrice: item.unitPrice || 0,
      taxRate: item.taxRate || 0,
      amount: 0,
      taxAmount: 0
    }))
  }
}

const handleProductChange = (row: ReturnItem) => {
  const product = products.value.find(p => p.id === row.productId)
  if (product) {
    row.productName = product.name
    row.specification = product.specification || ''
    row.unit = product.unit || '个'
    row.unitPrice = product.costPrice || 0
    // initialize derived fields
    row.taxRate = row.taxRate || 0
    row.taxAmount = Number((row.quantity * row.unitPrice * (row.taxRate / 100)).toFixed(2))
    row.totalInc = Number((row.quantity * row.unitPrice + row.taxAmount).toFixed(2))
    calculateRowTotals(row)
  }
}

const calculateRowTotals = (row: ReturnItem) => {
  row.amount = Number((row.quantity * row.unitPrice).toFixed(2))
  row.taxAmount = Number((row.amount * (row.taxRate / 100)).toFixed(2))
  // totalInc is含税金额
  row.totalInc = Number((row.amount + row.taxAmount).toFixed(2))
}

// Unified updater: when taxRate + any one of unitPrice / taxAmount / totalInc is changed,
// compute the remaining derived fields.
const updateRowBy = (row: any, field: string) => {
  const q = row.quantity || 0
  const t = Number(row.taxRate || 0)
  if (q <= 0) return

  if (field === 'unitPrice' || field === 'taxRate') {
    // unitPrice and taxRate known -> compute amount, taxAmount, totalInc
    row.amount = Number((q * row.unitPrice).toFixed(2))
    row.taxAmount = Number((row.amount * (t / 100)).toFixed(2))
    row.totalInc = Number((row.amount + row.taxAmount).toFixed(2))
  } else if (field === 'taxAmount') {
    // taxAmount and taxRate known -> compute amount and totals
    if (t === 0) return
    row.amount = Number((row.taxAmount / (t / 100) / q).toFixed(2))
    row.unitPrice = Number((row.amount / q).toFixed(2))
    row.totalInc = Number((row.amount + row.taxAmount).toFixed(2))
  } else if (field === 'totalInc') {
    // totalInc and taxRate known -> compute amount and unitPrice, taxAmount
    const totalInc = Number(row.totalInc || 0)
    row.amount = Number((totalInc / (1 + t / 100)).toFixed(2))
    row.unitPrice = Number((row.amount / q).toFixed(2))
    row.taxAmount = Number((totalInc - row.amount).toFixed(2))
  }
  // ensure rounding
  row.amount = Number((row.amount || 0).toFixed(2))
  row.taxAmount = Number((row.taxAmount || 0).toFixed(2))
  row.totalInc = Number((row.totalInc || 0).toFixed(2))
  // update totals
  formData.totalAmount = formData.items.reduce((s: number, it: any) => s + (it.amount || 0), 0)
}

const addItem = () => {
  formData.items.push({
    productId: undefined,
    productName: '',
    specification: '',
    unit: '个',
    quantity: 0,
    unitPrice: 0,
    taxRate: 0,
    amount: 0,
    taxAmount: 0
  })
}

const removeItem = (index: number) => {
  formData.items.splice(index, 1)
}

const resetForm = () => {
  Object.assign(formData, {
    voucherNo: '',
    voucherDate: dayjs().format('YYYY-MM-DD'),
    originalOrderNo: '',
    customerId: undefined,
    customerName: '',
    operator: localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')!).name : '',
    returnReason: '',
    items: [],
    totalAmount: 0,
    remark: ''
  })
  formRef.value?.clearValidate()
}

const handleSearch = () => {
  currentPage.value = 1
  loadReturnsList()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  loadReturnsList()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  loadReturnsList()
}

const handleSelectionChange = (selection: ReturnRecord[]) => {
  selectedRows.value = selection
}

const handlePrint = (row: ReturnRecord) => {
  handleView(row)
}

const handlePrintCurrent = () => {
  if (selectedRows.value.length === 1) {
    handlePrint(selectedRows.value[0])
  } else if (dialogVisible.value) {
    const printContent = generatePrintContent(formData)
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
}

const handleExport = () => {
  ElMessage.info('导出功能开发中...')
}

const generatePrintContent = (data: ReturnRecord) => {
  const itemsHtml = data.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.productName || '-'}</td>
      <td>${item.specification || '-'}</td>
      <td>${item.quantity}</td>
      <td>${item.unit}</td>
      <td>${item.unitPrice.toFixed(2)}</td>
      <td>${(item.unitPrice * (1 + item.taxRate / 100)).toFixed(2)}</td>
      <td>${item.taxRate}%</td>
      <td>${item.taxAmount.toFixed(2)}</td>
      <td>${item.amount.toFixed(2)}</td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>销售退货单 - ${data.voucherNo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .info { margin-bottom: 10px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; }
          .table th { background-color: #f5f5f5; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>销售退货单</h2>
          <p>凭证号：${data.voucherNo}</p>
        </div>
        <div class="info">
          <div>退货日期：${data.voucherDate}</div>
          <div>原订单号：${data.originalOrderNo || '-'}</div>
          <div>客户：${data.customerName}</div>
          <div>经办人：${data.operator}</div>
          <div>退货原因：${data.returnReason || '-'}</div>
          <div>备注：${data.remark || '-'}</div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>商品</th>
              <th>规格</th>
              <th>退货数量</th>
              <th>单位</th>
              <th>单价</th>
              <th>含税单价</th>
              <th>税率</th>
              <th>税额</th>
              <th>退货金额</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="text-align: right; font-weight: bold;">退货总金额：-¥${Math.abs(data.totalAmount).toFixed(2)}</div>
        <div style="text-align: right; margin-top: 10px;">打印时间：${dayjs().format('YYYY-MM-DD HH:mm:ss')}</div>
      </body>
    </html>
  `
}

onMounted(() => {
  loadReturnsList()
  loadOrderList()
  loadProducts()
  loadCustomers()
  loadUsers()
})
</script>

<style scoped>
.returns-page {
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
  gap: 6px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
