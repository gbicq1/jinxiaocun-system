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
        <el-table-column prop="operator" label="经办人" width="100" />
        <el-table-column prop="remark" label="备注" min-width="150" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="success" size="small" @click="handlePrint(row)">
              打印
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">
              删除
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
                />
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
                @change="calculateRowTotal(row)"
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
                v-model="row.unitPrice"
                :min="0"
                :precision="2"
                :step="0.01"
                :controls="false"
                style="width: 100%"
                @focus="handleFocus(row, 'unitPrice')"
                @change="calculateRowTotal(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="税率 (%)" width="80">
            <template #default="{ row }">
              <el-select
                v-model="row.taxRate"
                filterable
                allow-create
                placeholder="选择或输入税率"
                style="width: 100%"
                @change="calculateRowTotal(row)"
              >
                <el-option label="免税" :value="0" />
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
          <el-table-column label="金额 (含税)" width="120">
            <template #default="{ row }">
              <el-input v-model="row.totalAmount" disabled />
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
        
        <el-row :gutter="20" style="background: #f5f7fa; padding: 15px; border-radius: 4px">
          <el-col :span="12">
            <div style="font-size: 16px; font-weight: bold">
              商品行数：{{ formData.items?.length || 0 }}
            </div>
          </el-col>
          <el-col :span="12" style="text-align: right">
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

// 定义接口
interface InboundItem {
  productId?: number
  productName: string
  specification: string
  quantity: number
  unit: string
  unitPrice: number
  taxRate: number
  taxAmount: number
  totalAmount: number
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
  remark?: string
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
const formRef = ref()
const selectedRow = ref<InboundRecord | null>(null)

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
  remark: ''
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
  return formData.items.reduce((sum, item) => sum + item.totalAmount, 0)
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
      // 尝试多个可能的键名
      const possibleKeys = ['purchase_inbound_records', 'inbound_records', 'purchaseInbounds']
      let savedData = null
      
      for (const key of possibleKeys) {
        savedData = localStorage.getItem(key)
        if (savedData) {
          console.log(`从 ${key} 加载入库单数据`)
          break
        }
      }
      
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
      productList.value = allProducts.filter((p: any) => p.status === 1).map((p: any) => ({
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
    // 模拟数据
    suppliers.value = [
      { id: 1, name: '供应商 A' },
      { id: 2, name: '供应商 B' }
    ]
  } catch (error) {
    console.error(error)
  }
}

// 加载仓库列表
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
    warehouseId: undefined,
    warehouseName: '',
    operator: localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')!).name : '系统用户',
    items: [],
    totalAmount: 0,
    remark: ''
  })
  dialogVisible.value = true
}

// 编辑入库单
const handleEdit = (row: InboundRecord) => {
  dialogTitle.value = '编辑入库单'
  Object.assign(formData, {
    ...row,
    items: row.items ? JSON.parse(JSON.stringify(row.items)) : []
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
    
    if (window.electron && window.electron.dbDelete) {
      // Electron 环境
      await window.electron.dbDelete('inbound', 'id = ?', [row.id])
    } else {
      // 前端环境 - 使用 localStorage
      const possibleKeys = ['purchase_inbound_records', 'inbound_records', 'purchaseInbounds']
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
        const allRecords: InboundRecord[] = JSON.parse(savedData)
        const filtered = allRecords.filter((r: InboundRecord) => r.id !== row.id)
        localStorage.setItem(usedKey, JSON.stringify(filtered))
      }
    }
    
    ElMessage.success('删除成功')
    loadInboundList()
  } catch {
    // 用户取消删除
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
    taxRate: 13, // 默认税率 13%
    taxAmount: undefined,
    totalAmount: undefined
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

// 处理商品选择变化
const handleProductChange = (index: number, productId: number) => {
  const product = productList.value.find(p => p.id === productId)
  if (product) {
    const item = formData.items[index]
    item.productName = product.name
    // 优先使用 spec（产品表字段），其次使用 specification，最后使用 code 作为备用
    item.specification = product.spec || product.specification || product.code || ''
    item.unit = product.unit || ''
    item.unitPrice = product.costPrice || 0
    calculateRowTotal(item)
  }
}

// 计算单行总额
const calculateRowTotal = (item: InboundItem) => {
  // 税额 = 数量 * 单价 * 税率 / 100
  item.taxAmount = Math.round(item.quantity * item.unitPrice * item.taxRate / 100 * 100) / 100
  // 含税金额 = 数量 * 单价 + 税额
  item.totalAmount = Math.round((item.quantity * item.unitPrice + item.taxAmount) * 100) / 100
  calculateTotalAmount()
}

// 计算单据总额
const calculateTotalAmount = () => {
  formData.totalAmount = formData.items.reduce((sum, item) => sum + item.totalAmount, 0)
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
    }
    
    // 计算总金额
    calculateTotalAmount()
    
    if (formData.id) {
      // 更新
      if (window.electron && window.electron.dbUpdate) {
        await window.electron.dbUpdate('inbound', formData, 'id = ?', [formData.id])
      } else {
        // 前端环境 - 使用 localStorage
        const possibleKeys = ['purchase_inbound_records', 'inbound_records', 'purchaseInbounds']
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
          const allRecords: InboundRecord[] = JSON.parse(savedData)
          const index = allRecords.findIndex((r: InboundRecord) => r.id === formData.id)
          if (index !== -1) {
            allRecords[index] = { ...formData }
            localStorage.setItem(usedKey, JSON.stringify(allRecords))
          }
        }
      }
      ElMessage.success('更新成功')
    } else {
      // 新增
      formData.id = Date.now()
      if (window.electron && window.electron.dbInsert) {
        await window.electron.dbInsert('inbound', formData)
      } else {
        // 前端环境 - 使用 localStorage
        const key = 'purchase_inbound_records'
        const savedData = localStorage.getItem(key)
        const allRecords = savedData ? JSON.parse(savedData) : []
        allRecords.push({ ...formData })
        localStorage.setItem(key, JSON.stringify(allRecords))
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
  const columns = [
    { label: '单号', key: 'voucherNo' },
    { label: '入库日期', key: 'voucherDate' },
    { label: '供应商', key: 'supplierName' },
    { label: '总金额', key: 'totalAmount' }
  ]
  exportToCsv('inventory-inbounds.csv', columns, inboundList.value)
}

// 打印单据
const handlePrint = (row: InboundRecord) => {
  printInboundForm(row)
}

// 打印入库单
const printInboundForm = (row: InboundRecord) => {
  const itemsHtml = row.items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.productName}</td>
        <td>${item.specification}</td>
        <td>${item.quantity}</td>
        <td>${item.unit}</td>
        <td>${item.unitPrice.toFixed(2)}</td>
        <td>${item.taxRate}%</td>
        <td>${item.taxAmount.toFixed(2)}</td>
        <td>${item.totalAmount.toFixed(2)}</td>
      </tr>
    `).join('')

  const companyName = localStorage.getItem('companyName') || '荆州供销农业服务有限公司'

  const printContent = `
    <html>
      <head>
        <title>入库单 - ${row.voucherNo}</title>
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
          <h2>${companyName}</h2>
          <h3>入库单</h3>
          <p>凭证号：${row.voucherNo}</p>
        </div>
        <div class="info">
          <div>入库日期：${row.voucherDate}</div>
          <div>供应商：${row.supplierName}</div>
          <div>经办人：${row.operator}</div>
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
              <th>单价<br/>(不含税)</th>
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
    const itemsHtml = row.items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.productName}</td>
          <td>${item.specification}</td>
          <td>${item.quantity}</td>
          <td>${item.unit}</td>
          <td>${item.unitPrice.toFixed(2)}</td>
          <td>${item.taxRate}%</td>
          <td>${item.taxAmount.toFixed(2)}</td>
          <td>${item.totalAmount.toFixed(2)}</td>
        </tr>
      `).join('')

    return `
      <div class="form-container" style="page-break-after: always; margin-bottom: 40px;">
        <div class="header" style="text-align: center; margin-bottom: 20px;">
          <h2>${companyName}</h2>
          <h3>入库单</h3>
          <p>凭证号：${row.voucherNo}</p>
        </div>
        <div class="info" style="margin-bottom: 10px;">
          <div>入库日期：${row.voucherDate}</div>
          <div>供应商：${row.supplierName}</div>
          <div>经办人：${row.operator}</div>
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
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5;">单价<br/>(不含税)</th>
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
</style>
