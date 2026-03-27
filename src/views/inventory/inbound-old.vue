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
                @change="calculateRowTotal(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="税率 (%)" width="80">
            <template #default="{ row }">
              <el-input-number
                v-model="row.taxRate"
                :min="0"
                :max="100"
                :precision="2"
                :step="0.01"
                :controls="false"
                style="width: 100%"
                @change="calculateRowTotal(row)"
              />
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
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息"
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import exportToCsv from '../../utils/exportCsv'

interface InboundRecord {
  id?: number
  voucherNo: string
  productId?: number
  productCode?: string
  productName?: string
  quantity: number
  unit?: string
  costPrice: number
  totalAmount: number
  inboundDate: string
  operator?: string
  remark?: string
}

interface Product {
  id: number
  code: string
  name: string
  unit?: string
  costPrice?: number
}

const inboundList = ref<InboundRecord[]>([])
const productList = ref<Product[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const dialogVisible = ref(false)
const dialogTitle = ref('新增入库单')
const formRef = ref()
const selectedRow = ref<InboundRecord | null>(null)

const formData = reactive<InboundRecord>({
  voucherNo: '',
  productId: undefined,
  productCode: '',
  productName: '',
  quantity: 1,
  unit: '',
  costPrice: 0,
  totalAmount: 0,
  inboundDate: dayjs().format('YYYY-MM-DD'),
  operator: '',
  remark: ''
})

const rules = {
  voucherNo: [{ required: true, message: '请输入凭证号', trigger: 'blur' }],
  productId: [{ required: true, message: '请选择产品', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入入库数量', trigger: 'blur' }],
  inboundDate: [{ required: true, message: '请选择入库日期', trigger: 'change' }]
}

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
        filtered = allRecords.filter(r => 
          r.voucherNo?.toLowerCase().includes(query) || 
          r.productCode?.toLowerCase().includes(query) || 
          r.productName?.toLowerCase().includes(query)
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
    // 模拟数据
    productList.value = [
      { id: 1, code: 'P001', name: '测试产品 A', unit: '个', costPrice: 10.50 },
      { id: 2, code: 'P002', name: '测试产品 B', unit: '个', costPrice: 20.00 }
    ]
  } catch (error) {
    console.error(error)
  }
}

// 新增入库单
const handleAdd = () => {
  dialogTitle.value = '新增入库单'
  Object.assign(formData, {
    voucherNo: generateVoucherNo(),
    productId: undefined,
    productCode: '',
    productName: '',
    quantity: 1,
    unit: '',
    costPrice: 0,
    totalAmount: 0,
    inboundDate: dayjs().format('YYYY-MM-DD'),
    operator: '',
    remark: ''
  })
  dialogVisible.value = true
}

// 编辑入库单
const handleEdit = (row: InboundRecord) => {
  dialogTitle.value = '编辑入库单'
  Object.assign(formData, row)
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
      const savedData = localStorage.getItem('inbound_records')
      const allRecords = savedData ? JSON.parse(savedData) : []
      const filtered = allRecords.filter(r => r.id !== row.id)
      localStorage.setItem('inbound_records', JSON.stringify(filtered))
    }
    
    ElMessage.success('删除成功')
    loadInboundList()
  } catch {
    // 用户取消删除
  }
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    
    // 计算总金额
    formData.totalAmount = formData.quantity * formData.costPrice
    
    if (formData.id) {
      // 更新
      if (window.electron && window.electron.dbUpdate) {
        // Electron 环境
        await window.electron.dbUpdate('inbound', formData, 'id = ?', [formData.id])
      } else {
        // 前端环境 - 使用 localStorage
        const savedData = localStorage.getItem('inbound_records')
        const allRecords = savedData ? JSON.parse(savedData) : []
        const index = allRecords.findIndex(r => r.id === formData.id)
        if (index !== -1) {
          allRecords[index] = { ...formData }
          localStorage.setItem('inbound_records', JSON.stringify(allRecords))
        }
      }
      ElMessage.success('更新成功')
    } else {
      // 新增
      const newRecord = {
        ...formData,
        id: Date.now() // 生成唯一 ID
      }
      
      if (window.electron && window.electron.dbInsert) {
        // Electron 环境
        await window.electron.dbInsert('inbound', newRecord)
      } else {
        // 前端环境 - 使用 localStorage
        const savedData = localStorage.getItem('inbound_records')
        const allRecords = savedData ? JSON.parse(savedData) : []
        allRecords.push(newRecord)
        localStorage.setItem('inbound_records', JSON.stringify(allRecords))
      }
      
      ElMessage.success('新增成功')
    }
    
    dialogVisible.value = false
    loadInboundList()
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

// 搜索
const handleSearch = () => {
  ElMessage.info('搜索功能待实现')
}

// 打印当前单据
const handlePrint = (row: InboundRecord) => {
  selectedRow.value = row
  printInboundForm(row)
}

// 打印当前选中的单据
const handlePrintCurrent = () => {
  if (!selectedRow.value) {
    ElMessage.warning('请先选择要打印的单据')
    return
  }
  printInboundForm(selectedRow.value)
}

// 打印入库单
const printInboundForm = (row: InboundRecord) => {
  const printContent = `
    <html>
      <head>
        <title>入库单 - ${row.voucherNo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h2 { margin: 10px 0; }
          .info { margin: 20px 0; line-height: 2; }
          .info div { margin: 5px 0; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .table th { background-color: #f5f5f5; }
          .footer { margin-top: 30px; text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>入库单</h2>
          <p>凭证号：${row.voucherNo}</p>
        </div>
        <div class="info">
          <div><strong>产品编码:</strong> ${row.productCode}</div>
          <div><strong>产品名称:</strong> ${row.productName}</div>
          <div><strong>入库数量:</strong> ${row.quantity} ${row.unit}</div>
          <div><strong>成本单价:</strong> ¥${row.costPrice.toFixed(2)}</div>
          <div><strong>总金额:</strong> ¥${row.totalAmount.toFixed(2)}</div>
          <div><strong>入库日期:</strong> ${row.inboundDate}</div>
          <div><strong>操作员:</strong> ${row.operator}</div>
          <div><strong>备注:</strong> ${row.remark || '-'}</div>
        </div>
        <div class="footer">
          <p>打印日期：${dayjs().format('YYYY-MM-DD HH:mm:ss')}</p>
        </div>
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

// 导出 Excel
const handleExport = () => {
  const columns = [
    { label: '单号', key: 'voucherNo' },
    { label: '入库日期', key: 'inboundDate' },
    { label: '产品编码', key: 'productCode' },
    { label: '产品名称', key: 'productName' },
    { label: '数量', key: 'quantity' }
  ]
  // 假定 inboundList 存在并包含当前页面数据
  // 尝试读取 inboundList 或 data 源
  const dataSource = (typeof inboundList !== 'undefined' ? (inboundList as any).value : [])
  exportToCsv('inventory_inbound_old.csv', columns, dataSource)
}

// 分页处理
const handleSizeChange = () => {
  loadInboundList()
}
const handlePageChange = () => {
  loadInboundList()
}
const handleSelectionChange = (selection: InboundRecord[]) => {
  if (selection.length > 0) {
    selectedRow.value = selection[0]
  }
}

onMounted(() => {
  loadInboundList()
  loadProducts()
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
