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
          placeholder="搜索凭证号/产品编码/供应商"
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
        <el-table-column prop="supplierName" label="供应商" min-width="120" />
        <el-table-column prop="originalVoucherNo" label="原入库单号" width="150" />
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
          title="采购退货单 - 冲减入库数据"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        >
          <template #default>
            <div>
              退货单将冲减对应商品的库存数量，并生成负向入库记录
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
            <el-form-item label="原入库单号" prop="originalVoucherNo">
              <el-select
                v-model="formData.originalVoucherNo"
                placeholder="选择原入库单"
                style="width: 100%"
                clearable
                @change="handleOriginalVoucherChange"
              >
                <el-option
                  v-for="item in inboundList"
                  :key="item.id"
                  :label="`${item.voucherNo} - ${item.voucherDate}`"
                  :value="item.voucherNo"
                >
                  <span>{{ item.voucherNo }}</span>
                  <span style="color: #8492a6; font-size: 13px">({{ item.voucherDate }})</span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="供应商" prop="supplierId">
              <el-select
                v-model="formData.supplierId"
                placeholder="选择供应商"
                style="width: 100%"
                filterable
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
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="供应商名称">
              <el-input v-model="formData.supplierName" readonly />
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
              选择原入库单后自动加载商品，或直接添加退货商品
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
                @change="calculateRowTotals(row)"
              />
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
                @change="calculateRowTotals(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="退货金额" width="120">
            <template #default="{ row }">
              -¥{{ Math.abs(row.amount || 0).toFixed(2) }}
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
  originalVoucherNo?: string
  supplierId?: number
  supplierName: string
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

interface Supplier {
  id: number
  name: string
  status?: number | boolean
}

interface InboundRecord {
  id?: number
  voucherNo: string
  voucherDate: string
  supplierId?: number
  supplierName: string
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
const inboundList = ref<InboundRecord[]>([])
const products = ref<Product[]>([])
const suppliers = ref<Supplier[]>([])
const selectedRows = ref<ReturnRecord[]>([])

// 表单数据
const formRef = ref()
const formData = reactive<ReturnRecord>({
  voucherNo: '',
  voucherDate: dayjs().format('YYYY-MM-DD'),
  originalVoucherNo: '',
  supplierId: undefined,
  supplierName: '',
  operator: '',
  returnReason: '',
  items: [],
  totalAmount: 0,
  remark: ''
})

const rules = {
  voucherDate: [{ required: true, message: '请选择退货日期', trigger: 'change' }],
  supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  operator: [{ required: true, message: '请输入经办人', trigger: 'blur' }],
  returnReason: [{ required: true, message: '请输入退货原因', trigger: 'blur' }]
}

// 加载退货单列表
const loadReturnsList = async () => {
  try {
    const savedReturns = localStorage.getItem('purchaseReturns')
    if (savedReturns) {
      const allReturns = JSON.parse(savedReturns)
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      returnsList.value = allReturns.slice(start, end)
      total.value = allReturns.length
    } else {
      returnsList.value = []
      total.value = 0
    }
  } catch (error) {
    console.error('加载退货单列表失败:', error)
    ElMessage.error('加载退货单列表失败')
  }
}

// 加载入库单列表（用于选择原入库单）
const loadInboundList = async () => {
  try {
    const savedInbounds = localStorage.getItem('purchaseInbounds')
    if (savedInbounds) {
      inboundList.value = JSON.parse(savedInbounds)
    } else {
      inboundList.value = []
    }
  } catch (error) {
    console.error('加载入库单列表失败:', error)
  }
}

// 加载商品列表
const loadProducts = async () => {
  try {
    const savedProducts = localStorage.getItem('products')
    if (savedProducts) {
      const allProducts = JSON.parse(savedProducts)
      products.value = allProducts.filter((p: Product) => (p.status as any) === 1 || (p.status as any) === true)
    } else {
      products.value = []
    }
  } catch (error) {
    console.error('加载商品列表失败:', error)
    products.value = []
  }
}

// 加载供应商列表
const loadSuppliers = async () => {
  try {
    const savedSuppliers = localStorage.getItem('suppliers')
    if (savedSuppliers) {
      const allSuppliers = JSON.parse(savedSuppliers)
      suppliers.value = allSuppliers.filter((s: Supplier) => s.status === 1 || s.status === true)
    } else {
      suppliers.value = []
    }
  } catch (error) {
    console.error('加载供应商列表失败:', error)
    suppliers.value = []
  }
}

// 加载系统用户（用于经办人下拉），兼容多种存储键与字段
const users = ref<any[]>([])
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
    // 如果没有在常用键里找到，尝试遍历 localStorage 寻找数组结构的用户数据
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

    // 回退：使用当前登录用户作为单条选项
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

// 加载当前用户
const loadCurrentUser = () => {
  const user = localStorage.getItem('currentUser')
  if (user) {
    const userData = JSON.parse(user)
    formData.operator = userData.name || '管理员'
  }
}

// 新增
const handleAdd = () => {
  resetForm()
  dialogTitle.value = '新增退货单'
  isViewMode.value = false
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row: ReturnRecord) => {
  Object.assign(formData, row)
  formData.items = JSON.parse(JSON.stringify(row.items))
  dialogTitle.value = '编辑退货单'
  isViewMode.value = false
  dialogVisible.value = true
}

// 查看
const handleView = (row: ReturnRecord) => {
  Object.assign(formData, row)
  formData.items = JSON.parse(JSON.stringify(row.items))
  dialogTitle.value = '查看退货单'
  isViewMode.value = true
  dialogVisible.value = true
}

// 删除
const handleDelete = async (row: ReturnRecord) => {
  try {
    await ElMessageBox.confirm(`确定要删除退货单 ${row.voucherNo} 吗？`, '警告', {
      type: 'warning'
    })

    const savedReturns = localStorage.getItem('purchaseReturns')
    if (savedReturns) {
      const allReturns = JSON.parse(savedReturns)
      const filtered = allReturns.filter((r: ReturnRecord) => r.id !== row.id)
      localStorage.setItem('purchaseReturns', JSON.stringify(filtered))
      
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

// 保存
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
    const savedReturns = localStorage.getItem('purchaseReturns')
    const allReturns = savedReturns ? JSON.parse(savedReturns) : []
    
    // 检查是否编辑
    const existingIndex = allReturns.findIndex((r: ReturnRecord) => r.id === formData.id)
    if (existingIndex >= 0) {
      // 编辑：先恢复原库存，再更新
      const oldRecord = allReturns[existingIndex]
      updateInventoryOnReturn(oldRecord, true) // 恢复原库存
      allReturns[existingIndex] = { ...formData, id: formData.id }
    } else {
      // 新增
      formData.id = Date.now()
      formData.createdAt = new Date().toISOString() // 添加精确时间戳
      allReturns.push(formData)
    }

    // 更新库存（减少库存）
    updateInventoryOnReturn(formData, false)

    localStorage.setItem('purchaseReturns', JSON.stringify(allReturns))

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

// 生成凭证号
const generateVoucherNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `CH${date}${random}`
}

// 选择原入库单
const handleOriginalVoucherChange = (voucherNo: string) => {
  const inbound = inboundList.value.find(item => item.voucherNo === voucherNo)
  if (inbound) {
    formData.supplierId = inbound.supplierId
    formData.supplierName = inbound.supplierName
    
    // 加载原入库单的商品
    formData.items = inbound.items.map((item: any) => ({
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

// 商品选择变化
const handleProductChange = (row: ReturnItem) => {
  const product = products.value.find(p => p.id === row.productId)
  if (product) {
    row.productName = product.name
    row.specification = product.specification || ''
    row.unit = product.unit || '个'
    row.unitPrice = product.costPrice || 0
    calculateRowTotals(row)
  }
}

// 计算行合计
const calculateRowTotals = (row: ReturnItem) => {
  row.amount = row.quantity * row.unitPrice
  row.taxAmount = row.amount * (row.taxRate / 100)
}

// 添加商品
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

// 删除商品
const removeItem = (index: number) => {
  formData.items.splice(index, 1)
}

// 重置表单
const resetForm = () => {
  Object.assign(formData, {
    voucherNo: '',
    voucherDate: dayjs().format('YYYY-MM-DD'),
    originalVoucherNo: '',
    supplierId: undefined,
    supplierName: '',
    operator: localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')!).name : '',
    returnReason: '',
    items: [],
    totalAmount: 0,
    remark: ''
  })
  formRef.value?.clearValidate()
}

// 搜索
const handleSearch = () => {
  currentPage.value = 1
  loadReturnsList()
}

// 分页
const handleSizeChange = (size: number) => {
  pageSize.value = size
  loadReturnsList()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  loadReturnsList()
}

// 选择变化
const handleSelectionChange = (selection: ReturnRecord[]) => {
  selectedRows.value = selection
}

// 打印
const handlePrint = (row: ReturnRecord) => {
  handleView(row)
}

const handlePrintCurrent = () => {
  if (selectedRows.value.length === 1) {
    handlePrint(selectedRows.value[0])
  } else if (dialogVisible.value) {
    // 当前对话框中的单据
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

// 导出
const handleExport = () => {
  ElMessage.info('导出功能开发中...')
}

// 生成打印内容
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
        <title>采购退货单 - ${data.voucherNo}</title>
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
          <h2>采购退货单</h2>
          <p>凭证号：${data.voucherNo}</p>
        </div>
        <div class="info">
          <div>退货日期：${data.voucherDate}</div>
          <div>原入库单号：${data.originalVoucherNo || '-'}</div>
          <div>供应商：${data.supplierName}</div>
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

// 初始化
onMounted(() => {
  loadReturnsList()
  loadInboundList()
  loadProducts()
  loadSuppliers()
  loadCurrentUser()
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
