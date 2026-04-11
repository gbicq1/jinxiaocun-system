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
            clearable
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
      title="查看付款单"
      width="600px"
    >
      <el-descriptions :column="1" border>
        <el-descriptions-item label="付款单号">{{ viewData.paymentNo }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ viewData.supplierName }}</el-descriptions-item>
        <el-descriptions-item label="付款日期">{{ viewData.paymentDate }}</el-descriptions-item>
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
const suppliers = ref<any[]>([])
const dialogVisible = ref(false)
const viewDialogVisible = ref(false)
const dialogTitle = ref('新增付款单')
const formRef = ref()
const viewData = ref<Payment>({} as Payment)

const formData = reactive<Payment>({
  paymentNo: '',
  supplierId: undefined,
  supplierName: '',
  paymentDate: dayjs().format('YYYY-MM-DD'),
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

const generatePaymentNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `PAY${date}${random}`
}

const loadSuppliers = async () => {
  try {
    suppliers.value = await db.getSuppliers()
  } catch (error) {
    console.error('加载供应商数据失败:', error)
    suppliers.value = []
  }
}

const loadPayments = async () => {
  try {
    paymentList.value = await db.getPaymentList()
  } catch (error) {
    ElMessage.error('加载付款单列表失败')
    console.error(error)
  }
}

const handleAdd = () => {
  dialogTitle.value = '新增付款单'
  Object.assign(formData, {
    id: undefined,
    paymentNo: generatePaymentNo(),
    supplierId: undefined,
    supplierName: '',
    paymentDate: dayjs().format('YYYY-MM-DD'),
    amount: 0,
    paymentMethod: '',
    status: 'pending',
    remark: ''
  })
  dialogVisible.value = true
}

const handleView = (row: Payment) => {
  viewData.value = { ...row }
  viewDialogVisible.value = true
}

const handleEdit = (row: Payment) => {
  dialogTitle.value = '编辑付款单'
  Object.assign(formData, { ...row })
  dialogVisible.value = true
}

const handleDelete = async (row: Payment) => {
  try {
    await ElMessageBox.confirm('确定要删除这条付款单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await db.deletePayment(row.id)
    paymentList.value = paymentList.value.filter((p: Payment) => p.id !== row.id)
    ElMessage.success('删除成功')
  } catch {
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()

    const supplier = suppliers.value.find(s => s.id === formData.supplierId)
    if (supplier) {
      formData.supplierName = supplier.name
    }

    if (formData.id) {
      await db.updatePayment(formData)
      const index = paymentList.value.findIndex((p: Payment) => p.id === formData.id)
      if (index !== -1) {
        paymentList.value[index] = { ...formData }
      }
      ElMessage.success('更新成功')
    } else {
      const saved = await db.addPayment(formData)
      formData.id = saved.id
      paymentList.value.push({ ...formData })
      ElMessage.success('新增成功')
    }

    dialogVisible.value = false
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  loadSuppliers()
  loadPayments()
})
</script>

<style scoped>
.finance-payment-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
