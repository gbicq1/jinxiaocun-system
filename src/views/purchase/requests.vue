<template>
  <div class="purchase-requests-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增采购申请
        </el-button>
      </div>
      <el-table :data="requests" style="width: 100%">
        <el-table-column prop="requestNo" label="申请单号" width="150" />
        <el-table-column prop="supplierName" label="供应商" width="150" />
        <el-table-column prop="requestDate" label="申请日期" width="120" />
        <el-table-column prop="expectedDate" label="期望日期" width="120" />
        <el-table-column prop="totalAmount" label="总金额" width="120">
          <template #default="{ row }">
            ¥{{ row.totalAmount.toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="success" size="small" @click="handleConvert(row)">转订单</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="{
          requestNo: [{ required: true, message: '请输入申请单号', trigger: 'blur' }],
          supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
          requestDate: [{ required: true, message: '请选择申请日期', trigger: 'change' }],
          totalAmount: [{ required: true, message: '请输入总金额', trigger: 'blur' }]
        }"
        label-width="100px"
      >
        <el-form-item label="申请单号" prop="requestNo">
          <el-input v-model="formData.requestNo" placeholder="自动生成或手动输入" />
        </el-form-item>
        <el-form-item label="供应商" prop="supplierId">
          <el-select
            v-model="formData.supplierId"
            placeholder="请选择供应商"
            style="width: 100%"
          >
            <el-option
              v-for="supplier in suppliers"
              :key="supplier.id"
              :label="supplier.name"
              :value="supplier.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="申请日期" prop="requestDate">
          <el-date-picker
            v-model="formData.requestDate"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="期望日期" prop="expectedDate">
          <el-date-picker
            v-model="formData.expectedDate"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="总金额" prop="totalAmount">
          <el-input-number
            v-model="formData.totalAmount"
            :min="0"
            :precision="2"
            :step="0.01"
            :controls="false"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="formData.status" style="width: 100%">
            <el-option label="草稿" value="draft" />
            <el-option label="已审批" value="approved" />
            <el-option label="已转订单" value="converted" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

interface PurchaseRequest {
  id?: number
  requestNo: string
  supplierId?: number
  supplierName?: string
  requestDate: string
  expectedDate: string
  totalAmount: number
  status: 'draft' | 'approved' | 'converted' | 'cancelled'
  remark?: string
}

const requests = ref<PurchaseRequest[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增采购申请')
const formRef = ref()
const selectedRow = ref<PurchaseRequest | null>(null)

const formData = reactive<PurchaseRequest>({
  requestNo: '',
  supplierId: undefined,
  supplierName: '',
  requestDate: dayjs().format('YYYY-MM-DD'),
  expectedDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
  totalAmount: 0,
  status: 'draft',
  remark: ''
})

const suppliers = ref([
  { id: 1, name: '供应商 A' },
  { id: 2, name: '供应商 B' }
])

// 生成申请单号
const generateRequestNo = () => {
  const date = dayjs().format('YMMDD')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `PR${date}${random}`
}

// 加载申请列表
const loadRequests = async () => {
  try {
    if (window.electron && window.electron.dbQuery) {
      const result = await window.electron.dbQuery('purchase_requests', 'SELECT * FROM purchase_requests ORDER BY created_at DESC')
      requests.value = result
    } else {
      const savedData = localStorage.getItem('purchase_requests')
      requests.value = savedData ? JSON.parse(savedData) : []
    }
  } catch (error) {
    ElMessage.error('加载申请列表失败')
    console.error(error)
  }
}

// 新增申请
const handleAdd = () => {
  dialogTitle.value = '新增采购申请'
  Object.assign(formData, {
    requestNo: generateRequestNo(),
    supplierId: undefined,
    supplierName: '',
    requestDate: dayjs().format('YYYY-MM-DD'),
    expectedDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    totalAmount: 0,
    status: 'draft',
    remark: ''
  })
  dialogVisible.value = true
}

// 编辑申请
const handleEdit = (row: PurchaseRequest) => {
  dialogTitle.value = '编辑采购申请'
  Object.assign(formData, row)
  selectedRow.value = row
  dialogVisible.value = true
}

// 删除申请
const handleDelete = async (row: PurchaseRequest) => {
  try {
    await ElMessageBox.confirm('确定要删除该申请吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    if (window.electron && window.electron.dbDelete) {
      await window.electron.dbDelete('purchase_requests', 'id = ?', [row.id])
    } else {
      const filtered = requests.value.filter((r: PurchaseRequest) => r.id !== row.id)
      localStorage.setItem('purchase_requests', JSON.stringify(filtered))
    }
    
    ElMessage.success('删除成功')
    loadRequests()
  } catch {
    // 用户取消删除
  }
}

// 转订单
const handleConvert = (row: PurchaseRequest) => {
  ElMessage.info('转订单功能待实现')
}

const getStatusType = (status: string) => {
  const map: any = {
    'draft': 'info',
    'approved': 'success',
    'converted': 'warning',
    'cancelled': 'danger'
  }
  return map[status] || ''
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    
    // 获取供应商名称
    const supplier = suppliers.value.find(s => s.id === formData.supplierId)
    if (supplier) {
      formData.supplierName = supplier.name
    }
    
    if (formData.id) {
      // 更新
      if (window.electron && window.electron.dbUpdate) {
        await window.electron.dbUpdate('purchase_requests', formData, 'id = ?', [formData.id])
      } else {
        const savedData = localStorage.getItem('purchase_requests')
        const allRequests = savedData ? JSON.parse(savedData) : []
        const index = allRequests.findIndex((r: PurchaseRequest) => r.id === formData.id)
        if (index !== -1) {
          allRequests[index] = { ...formData }
          localStorage.setItem('purchase_requests', JSON.stringify(allRequests))
        }
      }
      ElMessage.success('更新成功')
    } else {
      // 新增
      const newRequest = {
        ...formData,
        id: Date.now()
      }
      
      if (window.electron && window.electron.dbInsert) {
        await window.electron.dbInsert('purchase_requests', newRequest)
      } else {
        const savedData = localStorage.getItem('purchase_requests')
        const allRequests = savedData ? JSON.parse(savedData) : []
        allRequests.push(newRequest)
        localStorage.setItem('purchase_requests', JSON.stringify(allRequests))
      }
      
      ElMessage.success('新增成功')
    }
    
    dialogVisible.value = false
    loadRequests()
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

onMounted(() => {
  loadRequests()
})
</script>

<style scoped>
.purchase-requests-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
