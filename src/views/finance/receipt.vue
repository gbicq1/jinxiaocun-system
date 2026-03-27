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
            ¥{{ row.amount.toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="paymentMethod" label="支付方式" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : 'warning'">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增收款单对话框 -->
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
          <el-select v-model="formData.paymentMethod" style="width: 100%">
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

interface ReceiptRecord {
  id?: number
  receiptNo: string
  customerId?: number
  customerName?: string
  receiptDate: string
  amount: number
  paymentMethod: string
  status: 'pending' | 'completed'
}

const receiptList = ref<ReceiptRecord[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const dialogVisible = ref(false)
const dialogTitle = ref('新增收款单')
const formRef = ref()
const selectedRow = ref<ReceiptRecord | null>(null)

const formData = reactive<ReceiptRecord>({
  receiptNo: '',
  customerId: undefined,
  customerName: '',
  receiptDate: dayjs().format('YYYY-MM-DD'),
  amount: 0,
  paymentMethod: '',
  status: 'pending'
})

const customers = ref([
  { id: 1, name: '客户 A' },
  { id: 2, name: '客户 B' }
])

// 生成收款单号
const generateReceiptNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `SK${date}${random}`
}

// 加载收款单列表
const loadReceiptList = async () => {
  try {
    if (window.electron && window.electron.dbQuery) {
      const result = await window.electron.dbQuery('finance_receipt', 'SELECT * FROM finance_receipt ORDER BY created_at DESC')
      receiptList.value = result
    } else {
      const savedData = localStorage.getItem('finance_receipt')
      receiptList.value = savedData ? JSON.parse(savedData) : []
    }
    total.value = receiptList.value.length
  } catch (error) {
    ElMessage.error('加载收款单列表失败')
    console.error(error)
  }
}

// 新增收款单
const handleAdd = () => {
  dialogTitle.value = '新增收款单'
  Object.assign(formData, {
    receiptNo: generateReceiptNo(),
    customerId: undefined,
    customerName: '',
    receiptDate: dayjs().format('YYYY-MM-DD'),
    amount: 0,
    paymentMethod: '',
    status: 'pending'
  })
  dialogVisible.value = true
}

// 查看收款单
const handleView = (row: ReceiptRecord) => {
  ElMessage.info(`查看收款单：${row.receiptNo}`)
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    
    // 获取客户名称
    const customer = customers.value.find(c => c.id === formData.customerId)
    if (customer) {
      formData.customerName = customer.name
    }
    
    if (formData.id) {
      // 更新
      if (window.electron && window.electron.dbUpdate) {
        await window.electron.dbUpdate('finance_receipt', formData, 'id = ?', [formData.id])
      } else {
        const savedData = localStorage.getItem('finance_receipt')
        const allRecords = savedData ? JSON.parse(savedData) : []
        const index = allRecords.findIndex(r => r.id === formData.id)
        if (index !== -1) {
          allRecords[index] = { ...formData }
          localStorage.setItem('finance_receipt', JSON.stringify(allRecords))
        }
      }
      ElMessage.success('更新成功')
    } else {
      // 新增
      const newRecord = {
        ...formData,
        id: Date.now()
      }
      
      if (window.electron && window.electron.dbInsert) {
        await window.electron.dbInsert('finance_receipt', newRecord)
      } else {
        const savedData = localStorage.getItem('finance_receipt')
        const allRecords = savedData ? JSON.parse(savedData) : []
        allRecords.push(newRecord)
        localStorage.setItem('finance_receipt', JSON.stringify(allRecords))
      }
      
      ElMessage.success('新增成功')
    }
    
    dialogVisible.value = false
    loadReceiptList()
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

onMounted(() => {
  loadReceiptList()
})
</script>

<style scoped>
.finance-receipt-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
