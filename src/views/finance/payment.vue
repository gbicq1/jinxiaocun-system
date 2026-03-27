<template>
  <div class="finance-payment-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增付款单
        </el-button>
      </div>
      <el-table :data="paymentList" style="width: 100%">
        <el-table-column prop="paymentNo" label="付款单号" width="150" />
        <el-table-column prop="supplierName" label="供应商名称" width="150" />
        <el-table-column prop="paymentDate" label="付款日期" width="120" />
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

    <!-- 新增对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="新增付款单"
      width="600px"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="{
          paymentNo: [{ required: true, message: '请输入付款单号', trigger: 'blur' }],
          supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
          paymentDate: [{ required: true, message: '请选择付款日期', trigger: 'change' }],
          amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
          paymentMethod: [{ required: true, message: '请选择支付方式', trigger: 'change' }]
        }"
        label-width="100px"
      >
        <el-form-item label="付款单号" prop="paymentNo">
          <el-input v-model="formData.paymentNo" placeholder="自动生成或手动输入" />
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
        <el-form-item label="付款日期" prop="paymentDate">
          <el-date-picker
            v-model="formData.paymentDate"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="金额" prop="amount">
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
            <el-option label="银行转账" value="bank_transfer" />
            <el-option label="现金" value="cash" />
            <el-option label="支票" value="check" />
            <el-option label="支付宝" value="alipay" />
            <el-option label="微信" value="wechat" />
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

    <!-- 查看对话框 -->
    <el-dialog
      v-model="viewDialogVisible"
      title="查看付款单"
      width="600px"
    >
      <el-descriptions :column="1" border>
        <el-descriptions-item label="付款单号">{{ viewData.paymentNo }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ viewData.supplierName }}</el-descriptions-item>
        <el-descriptions-item label="付款日期">{{ viewData.paymentDate }}</el-descriptions-item>
        <el-descriptions-item label="金额">¥{{ viewData.amount.toLocaleString() }}</el-descriptions-item>
        <el-descriptions-item label="支付方式">{{ viewData.paymentMethod }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="viewData.status === 'completed' ? 'success' : 'warning'">
            {{ viewData.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ viewData.remark }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

interface Payment {
  id?: number
  paymentNo: string
  supplierId?: number
  supplierName?: string
  paymentDate: string
  amount: number
  paymentMethod: string
  status: 'pending' | 'completed'
  remark?: string
}

const paymentList = ref<Payment[]>([])
const dialogVisible = ref(false)
const viewDialogVisible = ref(false)
const formRef = ref()
const viewData = ref<Payment>({} as Payment)

const formData = reactive<Payment>({
  paymentNo: '',
  supplierId: undefined,
  supplierName: '',
  paymentDate: dayjs().format('YYYY-MM-DD'),
  amount: 0,
  paymentMethod: 'bank_transfer',
  status: 'pending',
  remark: ''
})

const suppliers = ref([
  { id: 1, name: '供应商 A' },
  { id: 2, name: '供应商 B' }
])

// 生成付款单号
const generatePaymentNo = () => {
  const date = dayjs().format('YMMDD')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `PAY${date}${random}`
}

// 加载付款单列表
const loadPayments = async () => {
  try {
    if (window.electron && window.electron.dbQuery) {
      const result = await window.electron.dbQuery('payments', 'SELECT * FROM payments ORDER BY created_at DESC')
      paymentList.value = result
    } else {
      const savedData = localStorage.getItem('payments')
      paymentList.value = savedData ? JSON.parse(savedData) : []
    }
  } catch (error) {
    ElMessage.error('加载付款单列表失败')
    console.error(error)
  }
}

// 新增付款单
const handleAdd = () => {
  Object.assign(formData, {
    paymentNo: generatePaymentNo(),
    supplierId: undefined,
    supplierName: '',
    paymentDate: dayjs().format('YYYY-MM-DD'),
    amount: 0,
    paymentMethod: 'bank_transfer',
    status: 'pending',
    remark: ''
  })
  dialogVisible.value = true
}

// 查看付款单
const handleView = (row: Payment) => {
  viewData.value = row
  viewDialogVisible.value = true
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
    
    const newPayment = {
      ...formData,
      id: Date.now()
    }
    
    if (window.electron && window.electron.dbInsert) {
      await window.electron.dbInsert('payments', newPayment)
    } else {
      const savedData = localStorage.getItem('payments')
      const allPayments = savedData ? JSON.parse(savedData) : []
      allPayments.push(newPayment)
      localStorage.setItem('payments', JSON.stringify(allPayments))
    }
    
    ElMessage.success('新增成功')
    dialogVisible.value = false
    loadPayments()
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

onMounted(() => {
  loadPayments()
})
</script>

<style scoped>
.finance-payment-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
