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
        
        <!-- 查询凭证 -->
        <el-input
          v-model="searchQuery"
          placeholder="搜索凭证号/产品编码/名称"
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
        :data="inboundList"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="voucherNo" label="凭证号" width="150" />
        <el-table-column prop="voucherDate" label="日期" width="120" />
        <el-table-column prop="supplierName" label="供应商" min-width="120" />
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
            <el-form-item label="经办人" prop="handlerId">
              <el-select
                v-model="formData.handlerId"
                placeholder="请选择经办人"
                style="width: 100%"
                filterable
                @change="handleHandlerChange"
              >
                <el-option
                  v-for="employee in employees"
                  :key="employee.id"
                  :label="employee.name"
                  :value="employee.id"
                >
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
                      :disabled="dialogType === 'view'"
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
                @change="onUnitPriceInclChange(row)"
              />
            </template>
          </el-table-column>

          <el-table-column label="税率 (%)" width="120">
            <template #default="{ row }">
              <el-select v-model="row.taxRate" filterable allow-create placeholder="选择或输入税率" style="width: 100%" @change="onTaxRateChange(row)">
                <el-option label="免税" :value="'免税'" :disabled="formData.invoiceType === '专票'" />
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
          <el-table-column label="金额（不含税）" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.totalAmountEx"
                :min="0"
                :precision="2"
                :controls="false"
                style="width: 100%"
                @change="onAmountExChange(row)"
              />
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
                @change="onAmountInclChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="加计扣除" width="120">
            <template #default="{ row }">
              <el-switch
                v-model="row.allowDeduction"
                :disabled="!canEnableDeduction(row)"
                active-color="#13ce66"
                inactive-color="#909399"
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

        <!-- 单据汇总 -->
        <el-alert
          title="单据汇总"
          type="success"
          :closable="false"
          show-icon
          style="margin: 20px 0"
        />
        <el-row :gutter="20" style="margin-bottom: 10px">
          <el-col :span="12">
            <div style="font-size: 14px">已付款：
              <el-input-number v-model="formData.paidAmount" :min="0" :precision="2" :controls="false" style="width:160px" /> 元
            </div>
          </el-col>
          <el-col :span="12" style="text-align: right">
            <div style="font-size: 14px">
              <span style="margin-right: 10px">发票：
                <el-switch v-model="formData.invoiceIssued" @change="handleInvoiceIssuedChange" active-text="已开票" inactive-text="未开票" active-color="#13ce66" inactive-color="#ff4949" />
              </span>
              <span v-if="formData.invoiceIssued" style="margin-left: 10px">
                发票类型：
                <el-select v-model="formData.invoiceType" placeholder="选择发票类型" size="small" style="width: 120px" @change="handleInvoiceTypeChange">
                  <el-option label="普票" value="普票" />
                  <el-option label="专票" value="专票" />
                </el-select>
              </span>
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="20" style="background: #f5f7fa; padding: 15px; border-radius: 4px">
          <el-col :span="12">
            <div style="font-size: 16px; font-weight: bold">商品行数：{{ formData.items?.length || 0 }}</div>
          </el-col>
          <el-col :span="12" style="text-align: right">
            <div style="font-size: 18px; font-weight: bold; color: #f56c6c">合计金额：¥{{ totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</div>
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

// 定义接口
interface InboundItem {
  productId?: number
  productName: string
  specification: string
  quantity?: number
  unit: string
  unitPrice?: number
  unitPriceEx?: number
  taxRate?: number | string
  taxAmount?: number
  totalAmount?: number
  totalAmountEx?: number
  deductionAmount?: number
  allowDeduction?: boolean
  _lastEdited?: 'unitEx' | 'unitIncl' | 'amountEx' | 'amountIncl' | 'quantity'
}

interface InboundRecord {
  id?: number
  voucherNo: string
  voucherDate: string
  supplierId?: number
  supplierName: string
  handlerId?: number
  handlerName?: string
  operator: string
  items: InboundItem[]
  totalAmount: number
  remark?: string
  paidAmount?: number
  invoiceIssued?: boolean
  invoiceType?: string
  createdAt?: string
}

interface Product {
  id: number
  code: string
  name: string
  specification?: string
  unit?: string
  costPrice?: number
  status?: number
}

interface Supplier {
  id: number
  name: string
  status?: number
}

interface Employee {
  id: number
  name: string
  status?: number
}

// 响应式数据
const inboundList = ref<InboundRecord[]>([])
const productList = ref<Product[]>([])
const suppliers = ref<Supplier[]>([])
const employees = ref<Employee[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const dialogVisible = ref(false)
const dialogTitle = ref('新增入库单')
const formRef = ref()
const selectedRow = ref<InboundRecord | null>(null)
const selectedRecords = ref<InboundRecord[]>([])
const isViewMode = ref(false)

// 默认经办人 ID
const defaultHandlerId = ref<number | undefined>(undefined)

// 表单数据
const formData = reactive<InboundRecord>({
  voucherNo: '',
  voucherDate: dayjs().format('YYYY-MM-DD'),
  supplierId: undefined,
  supplierName: '',
  handlerId: undefined,
  handlerName: '',
  operator: '',
  items: [],
  totalAmount: 0,
  remark: '',
  paidAmount: 0,
  invoiceIssued: false,
  invoiceType: '普票'
})

// 表单验证规则
const rules = {
  voucherNo: [{ required: true, message: '请输入凭证号', trigger: 'blur' }],
  voucherDate: [{ required: true, message: '请选择入库日期', trigger: 'change' }],
  supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  items: [{ required: true, message: '请至少添加一行商品', trigger: 'blur' }]
}

// 计算合计金额
const totalAmount = computed(() => {
  return formData.items.reduce((sum, item) => sum + (item.totalAmount || 0), 0)
})

// 生成凭证号
const generateVoucherNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `RK${date}${random}`
}

// 加载入库单列表
const loadInboundList = async () => {
  try {
    // 检查是否有 Electron 环境
    if (window.electron && window.electron.dbQuery) {
      // Electron 环境
      const result = await window.electron.dbQuery('inbound', 'SELECT * FROM inbound ORDER BY created_at DESC')
      inboundList.value = result
    } else {
      // 前端环境 - 使用 localStorage
      const savedData = localStorage.getItem('inbound_records')
      const allRecords = savedData ? JSON.parse(savedData) : []
      
      // 搜索过滤
      let filtered = allRecords
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = allRecords.filter((r: InboundRecord) => 
          r.voucherNo?.toLowerCase().includes(query) || 
          r.supplierName?.toLowerCase().includes(query)
        )
      }
      
      inboundList.value = filtered
    }
    
    // 分页
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    const paginated = inboundList.value.slice(start, end)
    inboundList.value = paginated
    total.value = inboundList.value.length
  } catch (error) {
    ElMessage.error('加载入库单列表失败')
    console.error(error)
  }
}

// 加载产品列表
const loadProducts = async () => {
  try {
    // 从 localStorage 加载真实产品数据
    const savedProducts = localStorage.getItem('products')
    if (savedProducts) {
      const allProducts = JSON.parse(savedProducts)
      // 只加载启用的产品
      productList.value = allProducts.filter((p: Product) => p.status === 1).map((p: Product) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        specification: p.specification || p.spec || '',  // 优先使用 spec 字段
        unit: p.unit || '',
        costPrice: p.costPrice || 0
      }))
    } else {
      productList.value = []
    }
  } catch (error) {
    console.error('加载产品列表失败:', error)
    productList.value = []
  }
}

// 加载供应商列表
const loadSuppliers = async () => {
  try {
    console.log('开始加载供应商数据...')
    // 从 localStorage 加载真实供应商数据
    const savedSuppliers = localStorage.getItem('suppliers')
    console.log('localStorage suppliers:', savedSuppliers)
    
    if (savedSuppliers) {
      const allSuppliers = JSON.parse(savedSuppliers)
      console.log('解析后的供应商数据:', allSuppliers)
      // 只加载启用的供应商（兼容布尔值和数字）
      suppliers.value = allSuppliers.filter((s: Supplier) => (s.status as any) === 1 || (s.status as any) === true)
      console.log('过滤后的启用供应商:', suppliers.value)
    } else {
      console.log('没有找到供应商数据')
      suppliers.value = []
    }
  } catch (error) {
    console.error('加载供应商列表失败:', error)
    suppliers.value = []
  }
}

// 加载员工列表
const loadEmployees = () => {
  try {
    const saved = localStorage.getItem('employees')
    if (saved) {
      const allEmployees = JSON.parse(saved)
      // 只加载在职员工（兼容多种状态字段）
      employees.value = allEmployees.filter((e: any) => 
        (e.status as any) === 'active' || 
        (e.status as any) === 1 || 
        (e.status as any) === true
      )
    } else {
      employees.value = []
    }
    
    // 加载默认经办人
    const savedDefaultHandler = localStorage.getItem('defaultHandlerId')
    if (savedDefaultHandler) {
      defaultHandlerId.value = parseInt(savedDefaultHandler)
    }
  } catch (error) {
    console.error('加载员工列表失败:', error)
    employees.value = []
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
  Object.assign(formData, {
    voucherNo: generateVoucherNo(),
    voucherDate: dayjs().format('YYYY-MM-DD'),
    supplierId: undefined,
    supplierName: '',
    handlerId: defaultHandlerId.value, // 使用默认经办人
    handlerName: '',
    operator: localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')!).name : '系统用户',
    items: [],
    totalAmount: 0,
    remark: '',
    paidAmount: 0,
    invoiceIssued: false
  })
  
  // 如果有默认经办人，自动加载经办人名称
  if (defaultHandlerId.value) {
    const employee = employees.value.find(e => e.id === defaultHandlerId.value)
    if (employee) {
      formData.handlerName = employee.name
    }
  }
  
  dialogVisible.value = true
}

// 编辑入库单
const handleEdit = (row: InboundRecord) => {
  dialogTitle.value = '编辑入库单'
  isViewMode.value = false
  Object.assign(formData, {
    ...row,
    items: row.items ? JSON.parse(JSON.stringify(row.items)) : []
  })
  selectedRow.value = row
  dialogVisible.value = true
}

// 查看入库单（只读）
const handleView = (row: InboundRecord) => {
  dialogTitle.value = '查看入库单'
  isViewMode.value = true
  Object.assign(formData, { ...row, items: row.items ? JSON.parse(JSON.stringify(row.items)) : [] })
  selectedRow.value = row
  dialogVisible.value = true
}

// 删除入库单
const handleDelete = async (row: InboundRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除入库单 "${row.voucherNo}" 吗？将移到回收站，可在回收站恢复。`,
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
      type: 'inbound' as const,
      voucherNo: row.voucherNo,
      voucherDate: row.voucherDate,
      supplierName: row.supplierName,
      totalAmount: row.totalAmount,
      deletedAt: new Date().toISOString(),
      originalData: { ...row }
    }

    // 保存到回收站
    const savedRecycleBin = localStorage.getItem('recycle_bin')
    const recycleBin = savedRecycleBin ? JSON.parse(savedRecycleBin) : []
    recycleBin.push(recycleBinItem)
    localStorage.setItem('recycle_bin', JSON.stringify(recycleBin))

    if (window.electron && window.electron.dbDelete) {
      // Electron 环境
      await window.electron.dbDelete('inbound', 'id = ?', [row.id])
    } else {
      // 前端环境 - 使用 localStorage
      const savedData = localStorage.getItem('inbound_records')
      const allRecords: InboundRecord[] = savedData ? JSON.parse(savedData) : []
      const filtered = allRecords.filter((r: InboundRecord) => r.id !== row.id)
      localStorage.setItem('inbound_records', JSON.stringify(filtered))
    }

    ElMessage.success('已移到回收站')
    loadInboundList()
  } catch {
    // 用户取消删除
    ElMessage.info('已取消删除')
  }
}

// 添加商品行
const addItem = () => {
  formData.items.push({
    productId: undefined,
    productName: '',
    specification: '',
    quantity: undefined,
    unit: '',
    unitPrice: undefined,
    unitPriceEx: undefined,
    taxRate: 13, // 默认税率 13%
    taxAmount: undefined,
    totalAmount: undefined,
    totalAmountEx: undefined,
    deductionAmount: undefined,
    allowDeduction: false,
    _lastEdited: 'unitEx'
  })
}

// 删除商品行
const removeItem = (index: number) => {
  formData.items.splice(index, 1)
  calculateTotalAmount()
}

// 处理商品选择变化
const handleProductChange = (index: number, productId: number) => {
  const product = productList.value.find(p => p.id === productId)
  if (product) {
    const item = formData.items[index]
    item.productName = product.name
    // 优先使用 spec（产品表字段），其次使用 specification，最后使用 code 作为备用
    item.specification = product.spec || product.specification || product.code || ''
    item.unit = product.unit || ''
    item.unitPriceEx = product.costPrice || 0
    item._lastEdited = 'unitEx'
    calculateRowTotal(item)
  }
}

// 计算单行总额（支持不含税/含税/金额任填其一）
const round2 = (v: number) => Math.round(v * 100) / 100

const calculateRowTotal = (item: InboundItem) => {
  const qty = item.quantity || 0
  const taxRaw = item.taxRate === '免税' ? 0 : Number(item.taxRate || 0)
  const r = taxRaw / 100
  const isDeduction = item.allowDeduction || false

  const last = item._lastEdited

  if (last === 'unitEx') {
    // 从单价（不含税）计算
    const unitEx = Number(item.unitPriceEx || 0)
    let unitIncl: number
    let taxAmount: number
    let totalAmount: number
    let totalAmountEx: number
    let deductionAmount: number
    
    if (isDeduction) {
      // 加计扣除模式：单价（不含税）= 金额 * (1-9%) / 数量
      // 反推：金额 = 单价（不含税）* 数量 / (1-9%)
      totalAmount = round2(unitEx * qty / 0.91)
      unitIncl = round2(totalAmount / qty) // 单价（含税）= 金额 / 数量
      totalAmountEx = round2(unitEx * qty)
      taxAmount = round2(qty * (unitIncl - unitEx))
      deductionAmount = round2(totalAmount * 0.09) // 加计扣除 = 金额 × 9%
    } else {
      // 正常模式
      unitIncl = r === 0 ? unitEx : round2(unitEx * (1 + r))
      totalAmountEx = round2(unitEx * qty)
      taxAmount = round2(qty * (unitIncl - unitEx))
      totalAmount = round2(unitIncl * qty)
      deductionAmount = 0
    }
    item.unitPrice = unitIncl
    item.totalAmountEx = totalAmountEx
    item.taxAmount = taxAmount
    item.totalAmount = totalAmount
    item.deductionAmount = deductionAmount
  } else if (last === 'unitIncl') {
    // 从单价（含税）计算
    const unitIncl = Number(item.unitPrice || 0)
    let unitEx: number
    let taxAmount: number
    let totalAmount: number
    let totalAmountEx: number
    let deductionAmount: number
    
    if (isDeduction) {
      // 加计扣除模式：单价（不含税）= 单价（含税）* (1-9%)
      totalAmount = round2(unitIncl * qty) // 金额 = 单价（含税）* 数量
      unitEx = round2(unitIncl * 0.91) // 单价（不含税）= 单价（含税）* (1-9%)
      totalAmountEx = round2(unitEx * qty)
      taxAmount = round2(qty * (unitIncl - unitEx))
      deductionAmount = round2(totalAmount * 0.09) // 加计扣除 = 金额 × 9%
    } else {
      // 正常模式
      unitEx = r === 0 ? unitIncl : round2(unitIncl / (1 + r))
      totalAmountEx = round2(unitEx * qty)
      taxAmount = round2(qty * (unitIncl - unitEx))
      totalAmount = round2(unitIncl * qty)
      deductionAmount = 0
    }
    item.unitPriceEx = unitEx
    item.totalAmountEx = totalAmountEx
    item.taxAmount = taxAmount
    item.totalAmount = totalAmount
    item.deductionAmount = deductionAmount
  } else if (last === 'amountEx') {
    // 从金额（不含税）计算
    const totalEx = Number(item.totalAmountEx || 0)
    if (qty === 0) {
      item.unitPrice = 0
      item.unitPriceEx = 0
      item.taxAmount = 0
      item.totalAmount = 0
      item.deductionAmount = 0
    } else {
      let unitIncl: number
      let unitEx: number
      let taxAmount: number
      let totalAmount: number
      let deductionAmount: number
      
      if (isDeduction) {
        // 加计扣除模式：金额（不含税）= 金额 * (1-9%)
        // 反推：金额 = 金额（不含税）/ (1-9%)
        totalAmount = round2(totalEx / 0.91)
        unitIncl = round2(totalAmount / qty) // 单价（含税）= 金额 / 数量
        unitEx = round2(totalEx / qty) // 单价（不含税）= 金额（不含税）/ 数量
        taxAmount = round2(qty * (unitIncl - unitEx))
        deductionAmount = round2(totalAmount * 0.09) // 加计扣除 = 金额 × 9%
      } else {
        // 正常模式
        unitEx = round2(totalEx / qty)
        unitIncl = r === 0 ? unitEx : round2(unitEx * (1 + r))
        taxAmount = round2(qty * (unitIncl - unitEx))
        totalAmount = round2(unitIncl * qty)
        deductionAmount = 0
      }
      item.unitPrice = unitIncl
      item.unitPriceEx = unitEx
      item.taxAmount = taxAmount
      item.totalAmount = totalAmount
      item.deductionAmount = deductionAmount
    }
  } else if (last === 'amountIncl') {
    // 从金额（含税）计算
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
        // 加计扣除模式：单价（不含税）= 金额 * (1-9%) / 数量
        unitIncl = round2(total / qty) // 单价（含税）= 金额 / 数量
        unitEx = round2(total * 0.91 / qty) // 单价（不含税）= 金额 * (1-9%) / 数量
        totalAmountEx = round2(unitEx * qty)
        taxAmount = round2(qty * (unitIncl - unitEx))
        deductionAmount = round2(total * 0.09) // 加计扣除 = 金额 × 9%
      } else {
        // 正常模式
        unitIncl = round2(total / qty)
        unitEx = r === 0 ? unitIncl : round2(unitIncl / (1 + r))
        totalAmountEx = round2(unitEx * qty)
        taxAmount = round2(qty * (unitIncl - unitEx))
        deductionAmount = 0
      }
      item.unitPrice = unitIncl
      item.unitPriceEx = unitEx
      item.totalAmountEx = totalAmountEx
      item.taxAmount = taxAmount
      item.deductionAmount = deductionAmount
    }
  } else if (last === 'quantity') {
    // 从数量重新计算（需要已有单价）
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
    if (item.totalAmountEx || item.totalAmountEx === 0) {
      item._lastEdited = 'amountEx'
      calculateRowTotal(item)
      return
    }
    if (item.totalAmount || item.totalAmount === 0) {
      item._lastEdited = 'amountIncl'
      calculateRowTotal(item)
      return
    }
  } else {
    // 尝试从已有字段推断
    if (item.unitPriceEx !== undefined) {
      item._lastEdited = 'unitEx'
      calculateRowTotal(item)
      return
    }
    if (item.unitPrice !== undefined) {
      item._lastEdited = 'unitIncl'
      calculateRowTotal(item)
      return
    }
    if (item.totalAmountEx !== undefined) {
      item._lastEdited = 'amountEx'
      calculateRowTotal(item)
      return
    }
    if (item.totalAmount !== undefined) {
      item._lastEdited = 'amountIncl'
      calculateRowTotal(item)
      return
    }
  }

  calculateTotalAmount()
}

const onUnitPriceExChange = (item: InboundItem) => {
  item._lastEdited = 'unitEx'
  calculateRowTotal(item)
}

const onUnitPriceInclChange = (item: InboundItem) => {
  item._lastEdited = 'unitIncl'
  calculateRowTotal(item)
}

const onAmountExChange = (item: InboundItem) => {
  item._lastEdited = 'amountEx'
  calculateRowTotal(item)
}

const onAmountInclChange = (item: InboundItem) => {
  item._lastEdited = 'amountIncl'
  calculateRowTotal(item)
}

const onQuantityChange = (item: InboundItem) => {
  item._lastEdited = 'quantity'
  calculateRowTotal(item)
}

// 判断是否可以启用加计扣除
const canEnableDeduction = (item: InboundItem) => {
  return formData.invoiceIssued === true && 
         formData.invoiceType === '普票' && 
         item.taxRate === '免税'
}

// 处理加计扣除开关变化
const onDeductionSwitchChange = (item: InboundItem) => {
  // 如果不满足条件，自动关闭开关
  if (!canEnableDeduction(item)) {
    item.allowDeduction = false
    if (!formData.invoiceIssued) {
      ElMessage.warning('请先标记为已开票')
    } else if (formData.invoiceType !== '普票') {
      ElMessage.warning('只有普票才允许加计扣除')
    } else if (item.taxRate !== '免税') {
      ElMessage.warning('只有免税商品才允许加计扣除')
    }
  }
  // 重新计算该行
  calculateRowTotal(item)
}

const onTaxRateChange = (item: InboundItem) => {
  // 如果不满足加计扣除条件，关闭开关
  if (!canEnableDeduction(item) && item.allowDeduction) {
    item.allowDeduction = false
  }
  calculateRowTotal(item)
}

// 处理发票类型变化
const handleInvoiceTypeChange = () => {
  // 如果发票类型不是普票，关闭所有行的加计扣除开关
  if (formData.invoiceType !== '普票') {
    formData.items.forEach(item => {
      if (item.allowDeduction) {
        item.allowDeduction = false
      }
    })
    ElMessage.info('只有普票才允许加计扣除')
  }
  
  // 如果发票类型是专票，不允许选择免税税率
  if (formData.invoiceType === '专票') {
    let hasChanged = false
    formData.items.forEach(item => {
      if (item.taxRate === '免税') {
        item.taxRate = 13 // 默认改为 13%
        hasChanged = true
      }
    })
    if (hasChanged) {
      ElMessage.warning('专票不允许免税，已自动改为 13% 税率')
    }
  }
  
  // 重新计算所有行
  formData.items.forEach(item => calculateRowTotal(item))
}

// 处理发票状态变化
const handleInvoiceIssuedChange = (value: boolean) => {
  // 如果未开票，关闭所有行的加计扣除开关
  if (!value) {
    formData.items.forEach(item => {
      if (item.allowDeduction) {
        item.allowDeduction = false
      }
    })
    ElMessage.info('请先标记为已开票')
  }
  // 重新计算所有行
  formData.items.forEach(item => calculateRowTotal(item))
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

// 处理经办人变化
const handleHandlerChange = (handlerId: number) => {
  const employee = employees.value.find(e => e.id === handlerId)
  if (employee) {
    formData.handlerName = employee.name
  }
  
  // 保存默认经办人
  saveDefaultHandler(handlerId)
}

// 保存默认经办人
const saveDefaultHandler = (handlerId: number | undefined) => {
  if (handlerId) {
    localStorage.setItem('defaultHandlerId', handlerId.toString())
    defaultHandlerId.value = handlerId
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
      const item = formData.items[i]
      if (!item.productId) {
        ElMessage.warning(`第 ${i + 1} 行请选择商品`)
        return
      }
      if (!item.quantity || item.quantity <= 0) {
        ElMessage.warning(`第 ${i + 1} 行请输入数量`)
        return
      }
      if (!item.taxRate || (typeof item.taxRate === 'number' && item.taxRate < 0)) {
        ElMessage.warning(`第 ${i + 1} 行请选择税率`)
        return
      }
      // 验证至少填写一个金额相关字段
      if (!item.unitPriceEx && !item.unitPrice && !item.totalAmountEx && !item.totalAmount) {
        ElMessage.warning(`第 ${i + 1} 行请至少填写单价或金额`)
        return
      }
    }
    
    // 计算总金额
    calculateTotalAmount()
    
    if (formData.id) {
      // 更新
      if (window.electron && window.electron.dbUpdate) {
        await window.electron.dbUpdate('inbound', formData, 'id = ?', [formData.id])
      } else {
        // 前端环境 - 使用 localStorage
        const savedData = localStorage.getItem('inbound_records')
        const allRecords: InboundRecord[] = savedData ? JSON.parse(savedData) : []
        const index = allRecords.findIndex((r: InboundRecord) => r.id === formData.id)
        if (index !== -1) {
          allRecords[index] = { ...formData }
          localStorage.setItem('inbound_records', JSON.stringify(allRecords))
        }
      }
      ElMessage.success('更新成功')
    } else {
      // 新增
      formData.id = Date.now()
      formData.createdAt = new Date().toISOString() // 添加精确时间戳
      if (window.electron && window.electron.dbInsert) {
        await window.electron.dbInsert('inbound', formData)
      } else {
        // 前端环境 - 使用 localStorage
        const savedData = localStorage.getItem('inbound_records')
        const allRecords = savedData ? JSON.parse(savedData) : []
        allRecords.push({ ...formData })
        localStorage.setItem('inbound_records', JSON.stringify(allRecords))
      }
      ElMessage.success('新增成功')
    }
    
    dialogVisible.value = false
    loadInboundList()
  } catch (error) {
    console.error(error)
  }
}

// 搜索
const handleSearch = () => {
  currentPage.value = 1
  loadInboundList()
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

// 选择变化
const handleSelectionChange = (selection: any[]) => {
  selectedRecords.value = selection
  selectedRow.value = selection.length ? selection[0] : null
}

// 打印当前单据
const handlePrintCurrent = () => {
  if (!selectedRecords.value || selectedRecords.value.length === 0) {
    ElMessage.warning('请先在列表中选择要打印的单据')
    return
  }
  // 打印第一条（或可扩展为批量）
  printInboundForm(selectedRecords.value[0])
}

// 导出 Excel
const handleExport = () => {
  // 导出为按明细行的表格：每条商品一行，附带单据头信息
  const columns = [
    { label: '凭证号', key: 'voucherNo' },
    { label: '入库日期', key: 'voucherDate' },
    { label: '供应商', key: 'supplierName' },
    { label: '商品编码', key: 'item.productCode' },
    { label: '商品名称', key: 'item.productName' },
    { label: '规格', key: 'item.specification' },
    { label: '数量', key: 'item.quantity' },
    { label: '单位', key: 'item.unit' },
    { label: '单价', key: 'item.unitPrice' },
    { label: '单价（不含税）', key: 'item.unitPriceEx' },
    { label: '税率', key: 'item.taxRate' },
    { label: '税额', key: 'item.taxAmount' },
    { label: '金额', key: 'item.totalAmount' },
    { label: '已付款', key: 'paidAmount' },
    { label: '发票', key: 'invoiceIssued' },
    { label: '备注', key: 'remark' }
  ]

  const rows: any[] = []
  ;(inboundList.value || []).forEach((r: any) => {
    const base = {
      voucherNo: r.voucherNo,
      voucherDate: r.voucherDate,
      supplierName: r.supplierName,
      paidAmount: r.paidAmount != null ? r.paidAmount : '',
      invoiceIssued: r.invoiceIssued ? '已开票' : '未开票',
      remark: r.remark || ''
    }
    const items = r.items && r.items.length ? r.items : [{ productCode: '', productName: '', specification: '', quantity: '', unit: '', unitPrice: '', unitPriceEx: '', taxRate: '', taxAmount: '', totalAmount: '' }]
    items.forEach((it: any) => {
      rows.push({
        ...base,
        item: {
          productCode: it.productCode || it.productId || '',
          productName: it.productName || '',
          specification: it.specification || '',
          quantity: it.quantity != null ? it.quantity : '',
          unit: it.unit || '',
          unitPrice: it.unitPrice != null ? it.unitPrice : '',
          unitPriceEx: it.unitPriceEx != null ? it.unitPriceEx : '',
          taxRate: it.taxRate != null ? it.taxRate : '',
          taxAmount: it.taxAmount != null ? it.taxAmount : '',
          totalAmount: it.totalAmount != null ? it.totalAmount : ''
        }
      })
    })
  })

  exportToCsv('inbounds_items.csv', columns, rows)
}

// 打印单据
const handlePrint = (row: InboundRecord) => {
  selectedRow.value = row
  printInboundForm(row)
}

// 打印入库单
const printInboundForm = (row: InboundRecord) => {
  const itemsHtml = row.items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.productName}</td>
        <td>${item.specification}</td>
        <td>${item.quantity ?? 0}</td>
        <td>${item.unit}</td>
        <td>${(item.unitPriceEx ?? item.unitPrice ?? 0).toFixed(2)}</td>
        <td>${(item.unitPrice ?? 0).toFixed(2)}</td>
        <td>${item.taxRate}%</td>
        <td>${(item.taxAmount ?? 0).toFixed(2)}</td>
        <td>${(item.totalAmount ?? 0).toFixed(2)}</td>
      </tr>
    `).join('')

  const companyName = localStorage.getItem('companyName') || '荆州供销农业服务有限公司'

  const printContent = `
    <html>
      <head>
        <title>采购入库单 - ${row.voucherNo}</title>
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
          <h3>采购入库单</h3>
          <p>凭证号：${row.voucherNo}</p>
        </div>
        <div class="info">
          <div>入库日期：${row.voucherDate}</div>
          <div>供应商：${row.supplierName}</div>
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
  loadEmployees()
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

.action-buttons { display: flex; gap: 6px; }
</style>
