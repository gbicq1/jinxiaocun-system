<template>
  <div class="finance-receipt-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增收款单
        </el-button>
      </div>
      <el-table :data="receiptList" style="width: 100%">
        <el-table-column prop="receiptNo" label="收款单号" width="150" />
        <el-table-column prop="customerName" label="客户名称" width="150" />
        <el-table-column prop="receiptDate" label="收款日期" width="120" />
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="{ row }">
            ¥{{ (row.amount || 0).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="paymentMethod" label="支付方式" width="120">
          <template #default="{ row }">
            {{ getPaymentMethodLabel(row.paymentMethod) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : 'warning'">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleView(row)">查看</el-button>
            <el-button type="success" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="{
          receiptNo: [{ required: true, message: '请输入收款单号', trigger: 'blur' }],
          customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
          receiptDate: [{ required: true, message: '请选择收款日期', trigger: 'change' }],
          amount: [{ required: true, message: '请输入收款金额', trigger: 'blur' }],
          paymentMethod: [{ required: true, message: '请选择支付方式', trigger: 'change' }]
        }"
        label-width="100px"
      >
        <el-form-item label="收款单号" prop="receiptNo">
          <el-input v-model="formData.receiptNo" placeholder="自动生成或手动输入" />
        </el-form-item>
        <el-form-item label="客户" prop="customerId">
          <el-select
            v-model="formData.customerId"
            placeholder="请选择客户"
            style="width: 100%"
            clearable
          >
            <el-option
              v-for="customer in customers"
              :key="customer.id"
              :label="customer.name"
              :value="customer.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="收款日期" prop="receiptDate">
          <el-date-picker
            v-model="formData.receiptDate"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="收款金额" prop="amount">
          <el-input-number
            v-model="formData.amount"
            :min="0"
            :precision="2"
            :step="0.01"
            :controls="false"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="支付方式" prop="paymentMethod">
          <el-select v-model="formData.paymentMethod" style="width: 100%" clearable>
            <el-option label="现金" value="cash" />
            <el-option label="银行转账" value="bank_transfer" />
            <el-option label="支票" value="check" />
            <el-option label="支付宝" value="alipay" />
            <el-option label="微信" value="wechat" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="formData.status" style="width: 100%">
            <el-option label="待处理" value="pending" />
            <el-option label="已完成" value="completed" />
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

    <el-dialog
      v-model="viewDialogVisible"
      title="查看收款单"
      width="600px"
    >
      <el-descriptions :column="1" border>
        <el-descriptions-item label="收款单号">{{ viewData.receiptNo }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ viewData.customerName }}</el-descriptions-item>
        <el-descriptions-item label="收款日期">{{ viewData.receiptDate }}</el-descriptions-item>
        <el-descriptions-item label="金额">¥{{ (viewData.amount || 0).toLocaleString() }}</el-descriptions-item>
        <el-descriptions-item label="支付方式">{{ getPaymentMethodLabel(viewData.paymentMethod) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="viewData.status === 'completed' ? 'success' : 'warning'">
            {{ getStatusLabel(viewData.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ viewData.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

interface ReceiptRecord {
  id?: number
  receiptNo: string
  customerId?: number
  customerName?: string
  receiptDate: string
  amount: number
  paymentMethod: string
  status: 'pending' | 'completed'
  remark?: string
}

const receiptList = ref<ReceiptRecord[]>([])
const customers = ref<any[]>([])
const dialogVisible = ref(false)
const viewDialogVisible = ref(false)
const dialogTitle = ref('新增收款单')
const formRef = ref()
const viewData = ref<ReceiptRecord>({} as ReceiptRecord)

const formData = reactive<ReceiptRecord>({
  receiptNo: '',
  customerId: undefined,
  customerName: '',
  receiptDate: dayjs().format('YYYY-MM-DD'),
  amount: 0,
  paymentMethod: '',
  status: 'pending',
  remark: ''
})

const paymentMethodMap: Record<string, string> = {
  cash: '现金',
  bank_transfer: '银行转账',
  check: '支票',
  alipay: '支付宝',
  wechat: '微信'
}

const statusMap: Record<string, string> = {
  pending: '待处理',
  completed: '已完成'
}

const getPaymentMethodLabel = (method: string) => {
  return paymentMethodMap[method] || method
}

const getStatusLabel = (status: string) => {
  return statusMap[status] || status
}

const generateReceiptNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `SK${date}${random}`
}

const loadCustomers = () => {
  try {
    const saved = localStorage.getItem('customers')
    customers.value = saved ? JSON.parse(saved) : []
  } catch (error) {
    console.error('加载客户数据失败:', error)
    customers.value = []
  }
}

const loadReceiptList = async () => {
  try {
    const savedData = localStorage.getItem('finance_receipt')
    receiptList.value = savedData ? JSON.parse(savedData) : []
  } catch (error) {
    ElMessage.error('加载收款单列表失败')
    console.error(error)
  }
}

const handleAdd = () => {
  dialogTitle.value = '新增收款单'
  Object.assign(formData, {
    id: undefined,
    receiptNo: generateReceiptNo(),
    customerId: undefined,
    customerName: '',
    receiptDate: dayjs().format('YYYY-MM-DD'),
    amount: 0,
    paymentMethod: '',
    status: 'pending',
    remark: ''
  })
  dialogVisible.value = true
}

const handleView = (row: ReceiptRecord) => {
  viewData.value = { ...row }
  viewDialogVisible.value = true
}

const handleEdit = (row: ReceiptRecord) => {
  dialogTitle.value = '编辑收款单'
  Object.assign(formData, { ...row })
  dialogVisible.value = true
}

const handleDelete = (row: ReceiptRecord) => {
  ElMessageBox.confirm('确定要删除这条收款单吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    try {
      const savedData = localStorage.getItem('finance_receipt')
      const allRecords = savedData ? JSON.parse(savedData) : []
      const filtered = allRecords.filter((r: ReceiptRecord) => r.id !== row.id)
      localStorage.setItem('finance_receipt', JSON.stringify(filtered))
      receiptList.value = filtered
      ElMessage.success('删除成功')
    } catch (error) {
      ElMessage.error('删除失败')
      console.error(error)
    }
  }).catch(() => {})
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    
    const customer = customers.value.find(c => c.id === formData.customerId)
    if (customer) {
      formData.customerName = customer.name
    }
    
    const savedData = localStorage.getItem('finance_receipt')
    const allRecords = savedData ? JSON.parse(savedData) : []
    
    if (formData.id) {
      const index = allRecords.findIndex((r: ReceiptRecord) => r.id === formData.id)
      if (index !== -1) {
        allRecords[index] = { ...formData }
        ElMessage.success('更新成功')
      }
    } else {
      const newRecord = {
        ...formData,
        id: Date.now()
      }
      allRecords.push(newRecord)
      ElMessage.success('新增成功')
    }
    
    localStorage.setItem('finance_receipt', JSON.stringify(allRecords))
    receiptList.value = allRecords
    dialogVisible.value = false
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

onMounted(() => {
  loadCustomers()
  loadReceiptList()
})
</script>

<style scoped>
.finance-receipt-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
