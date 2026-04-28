<template>
  <div class="finance-receipt-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增收款单
        </el-button>
      </div>

      <el-card style="margin-bottom: 20px;">
        <template #header>
          <div class="card-header">
            <span>查询条件</span>
            <el-button style="float: right; padding: 3px 0" type="text" @click="clearFilters">清空</el-button>
          </div>
        </template>
        <el-form :inline="true" :model="queryForm" class="query-form">
          <el-form-item label="日期范围">
            <el-date-picker
              v-model="queryForm.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 240px"
            />
          </el-form-item>
          <el-form-item label="客户">
            <el-select
              v-model="queryForm.customerId"
              placeholder="请选择客户"
              clearable
              filterable
              style="width: 150px"
            >
              <el-option
                v-for="customer in customers"
                :key="customer.id"
                :label="customer.name"
                :value="customer.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleQuery">查询</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-table :data="filteredList" style="width: 100%">
        <el-table-column prop="receiptNo" label="收款单号" width="160" />
        <el-table-column prop="customerName" label="客户名称" min-width="150" />
        <el-table-column prop="receiptDate" label="收款日期" width="120" />
        <el-table-column prop="amount" label="金额" width="120" align="right">
          <template #default="{ row }">
            ¥{{ (row.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
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
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
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
      width="960px"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="{
          receiptNo: [{ required: true, message: '请输入收款单号', trigger: 'blur' }],
          customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
          receiptDate: [{ required: true, message: '请选择收款日期', trigger: 'change' }],
          amount: [{ type: 'number', required: true, message: '请输入收款金额', trigger: 'blur' }],
          paymentMethod: [{ required: true, message: '请选择支付方式', trigger: 'change' }]
        }"
        label-width="100px"
        :disabled="isViewMode"
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
            filterable
            @change="handleCustomerChange"
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
            @focus="clearDefaultAmount"
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

        <el-divider v-if="formData.customerId" content-position="left">客户往来明细</el-divider>
        <div v-if="formData.customerId && customerOutbounds.length > 0" class="outbound-list">
          <el-table :data="customerOutbounds" size="small" border max-height="400">
            <el-table-column prop="date" label="日期" width="110" />
            <el-table-column prop="docNo" label="单号" width="180" />
            <el-table-column label="类型" width="80">
              <template #default="{ row }">
                <el-tag :type="getTypeTagColor(row.type)" size="small">
                  {{ getTypeLabel(row.type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="应收款" width="120" align="right">
              <template #default="{ row }">
                <span v-if="row.debitAmount > 0" style="color: #f56c6c">
                  ¥{{ row.debitAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </span>
                <span v-else-if="row.debitAmount < 0" style="color: #67c23a">
                  -¥{{ Math.abs(row.debitAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="已收款" width="120" align="right">
              <template #default="{ row }">
                <span v-if="row.creditAmount > 0" style="color: #67c23a">
                  ¥{{ row.creditAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="余额" width="130" align="right">
              <template #default="{ row }">
                <span :style="{ color: row.balance >= 0 ? '#f56c6c' : '#67c23a', fontWeight: 'bold' }">
                  ¥{{ Math.abs(row.balance).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
          <div style="margin-top: 10px; font-size: 14px; color: #606266">
            客户未结清金额合计：
            <span :style="{ color: customerUnpaidTotal >= 0 ? '#f56c6c' : '#67c23a', fontWeight: 'bold' }">
              ¥{{ Math.abs(customerUnpaidTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
              <span style="font-weight: normal; font-size: 12px; margin-left: 4px">
                （{{ customerUnpaidTotal >= 0 ? '客户欠我方' : '我方欠客户' }}）
              </span>
            </span>
          </div>
        </div>
        <div v-else-if="formData.customerId" style="color: #909399; font-size: 14px">
          该客户暂无往来记录
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ isViewMode ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!isViewMode" type="primary" @click="handleSubmit">确定</el-button>
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
        <el-descriptions-item label="金额">¥{{ (viewData.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</el-descriptions-item>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { db } from '@/utils/db-ipc'

interface ReceiptRecord {
  id?: number
  receiptNo: string
  customerId?: number
  customerName?: string
  receiptDate: string
  amount: number
  paymentMethod: string
  status: string
  remark?: string
}

const receiptList = ref<ReceiptRecord[]>([])
const customers = ref<any[]>([])
const dialogVisible = ref(false)
const viewDialogVisible = ref(false)
const dialogTitle = ref('新增收款单')
const isViewMode = ref(false)
const formRef = ref()
const viewData = ref<ReceiptRecord>({} as ReceiptRecord)

const queryForm = reactive({
  dateRange: [] as string[],
  customerId: undefined as number | undefined
})

const filteredList = computed(() => {
  let filtered = [...receiptList.value]
  if (queryForm.dateRange && queryForm.dateRange.length === 2) {
    const [start, end] = queryForm.dateRange
    if (start && end) {
      filtered = filtered.filter(r => r.receiptDate >= start && r.receiptDate <= end)
    }
  }
  if (queryForm.customerId) {
    filtered = filtered.filter(r => r.customerId === queryForm.customerId)
  }
  return filtered
})

const customerOutbounds = ref<any[]>([])

const customerUnpaidTotal = computed(() => {
  if (customerOutbounds.value.length === 0) return 0
  return customerOutbounds.value[customerOutbounds.value.length - 1].balance || 0
})

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = { outbound: '出库', return: '退货', receipt: '收款' }
  return labels[type] || type
}

const getTypeTagColor = (type: string) => {
  const colors: Record<string, string> = { outbound: 'primary', return: 'danger', receipt: 'success' }
  return colors[type] || 'info'
}

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

const loadCustomers = async () => {
  try {
    customers.value = await db.getCustomers()
  } catch (error) {
    console.error('加载客户数据失败:', error)
    customers.value = []
  }
}

const loadReceiptList = async () => {
  try {
    const rawList = await db.getReceiptList()
    receiptList.value = (rawList || []).map((r: any) => ({
      id: r.id,
      receiptNo: r.receipt_no || r.receiptNo || '',
      customerId: r.customer_id ?? r.customerId,
      customerName: r.customer_name || r.customerName || '',
      receiptDate: (r.receipt_date || r.receiptDate || '').slice(0, 10),
      amount: Number(r.amount || 0),
      paymentMethod: r.payment_method || r.paymentMethod || '',
      status: r.status || 'pending',
      remark: r.remark || ''
    }))
  } catch (error) {
    ElMessage.error('加载收款单列表失败')
    console.error(error)
  }
}

const loadCustomerOutbounds = async (customerId: number) => {
  try {
    const round2 = (n: number) => Math.round(n * 100) / 100

    const outbounds = await db.getOutboundList(1, 10000)
    const outboundList = (outbounds?.data || outbounds || []).filter((r: any) => {
      return (r.customerId || r.customer_id) === customerId
    })

    const salesReturns = await db.getSalesReturns(1, 10000)
    const returnList = (salesReturns?.data || []).filter((r: any) => {
      return (r.customerId || r.customer_id) === customerId
    })

    const receipts = await db.getReceiptList()
    const existingReceipts = (receipts || []).filter((r: any) => {
      return (r.customer_id ?? r.customerId) === customerId && r.id !== formData.id
    })

    const documents: any[] = []

    for (const r of outboundList) {
      const totalAmount = round2(Number(r.totalAmount || r.total_amount || 0))
      const receivedAmount = round2(Number(r.receivedAmount || r.received_amount || 0))
      documents.push({
        date: (r.voucherDate || r.outbound_date || '').slice(0, 10),
        docNo: r.voucherNo || r.outbound_no || '',
        type: 'outbound',
        debitAmount: totalAmount,
        creditAmount: receivedAmount,
        _timestamp: r.createdAt || r.created_at || r.voucherDate || r.outbound_date || ''
      })
    }

    for (const r of returnList) {
      // 销售退货：以负数冲减应收款（debitAmount 为负数），使用含税金额
      const totalAmount = round2(Number(r.total_incl || r.totalInc || r.total_inc || r.totalAmount || r.total_amount || 0))
      documents.push({
        date: (r.returnDate || r.return_date || '').slice(0, 10),
        docNo: r.returnNo || r.return_no || '',
        type: 'return',
        debitAmount: -totalAmount,
        creditAmount: 0,
        _timestamp: r.createdAt || r.created_at || r.returnDate || r.return_date || ''
      })
    }

    for (const r of existingReceipts) {
      const amount = round2(Number(r.amount || 0))
      documents.push({
        date: (r.receipt_date || r.receiptDate || '').slice(0, 10),
        docNo: r.receipt_no || r.receiptNo || '',
        type: 'receipt',
        debitAmount: 0,
        creditAmount: amount,
        _timestamp: r.created_at || r.createdAt || r.receipt_date || r.receiptDate || ''
      })
    }

    documents.sort((a, b) => {
      const dateA = new Date(a.date || '1970-01-01').getTime()
      const dateB = new Date(b.date || '1970-01-01').getTime()
      if (dateA !== dateB) return dateA - dateB
      return new Date(a._timestamp || '1970-01-01').getTime() - new Date(b._timestamp || '1970-01-01').getTime()
    })

    let balance = 0
    for (const doc of documents) {
      balance = round2(balance + doc.debitAmount - doc.creditAmount)
      doc.balance = balance
    }

    customerOutbounds.value = documents
  } catch (error) {
    console.error('加载客户出库单失败:', error)
    customerOutbounds.value = []
  }
}

const handleCustomerChange = (customerId: number) => {
  const customer = customers.value.find(c => c.id === customerId)
  if (customer) {
    formData.customerName = customer.name
  }
  if (customerId) {
    loadCustomerOutbounds(customerId)
  } else {
    customerOutbounds.value = []
  }
}

const handleAdd = () => {
  dialogTitle.value = '新增收款单'
  isViewMode.value = false
  Object.assign(formData, {
    id: undefined,
    receiptNo: generateReceiptNo(),
    customerId: undefined,
    customerName: '',
    receiptDate: dayjs().format('YYYY-MM-DD'),
    amount: 0,
    paymentMethod: 'cash',
    status: 'pending',
    remark: ''
  })
  customerOutbounds.value = []
  dialogVisible.value = true
}

const clearDefaultAmount = () => {
  if (formData.amount === 0) {
    formData.amount = null as any
  }
}

const handleView = (row: ReceiptRecord) => {
  viewData.value = { ...row }
  viewDialogVisible.value = true
}

const handleEdit = (row: ReceiptRecord) => {
  dialogTitle.value = '编辑收款单'
  isViewMode.value = false
  Object.assign(formData, { ...row })
  if (formData.customerId) {
    loadCustomerOutbounds(formData.customerId)
  }
  dialogVisible.value = true
}

const handleDelete = async (row: ReceiptRecord) => {
  try {
    await ElMessageBox.confirm('确定要删除这条收款单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await db.deleteReceipt(row.id)
    receiptList.value = receiptList.value.filter((r: ReceiptRecord) => r.id !== row.id)
    ElMessage.success('删除成功')
  } catch {
  }
}

const handleSubmit = async () => {
  try {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) {
      ElMessage.warning('请填写必填项')
      return
    }

    const customer = customers.value.find(c => c.id === formData.customerId)
    if (customer) {
      formData.customerName = customer.name
    }

    const dbData: any = {
      receipt_no: formData.receiptNo,
      customer_id: formData.customerId || null,
      receipt_date: formData.receiptDate,
      amount: formData.amount,
      payment_method: formData.paymentMethod,
      type: 'receipt',
      status: formData.status,
      remark: formData.remark || null
    }

    if (formData.id) {
      dbData.id = formData.id
      await db.updateReceipt(dbData)
      ElMessage.success('更新成功')
    } else {
      const saved = await db.addReceipt(dbData)
      formData.id = saved?.id || saved
      ElMessage.success('新增成功')
    }

    dialogVisible.value = false
    loadReceiptList()
  } catch (error: any) {
    console.error(error)
    if (error?.message) {
      ElMessage.error('保存失败：' + error.message)
    }
  }
}

const handleQuery = () => {}

const clearFilters = () => {
  queryForm.dateRange = []
  queryForm.customerId = undefined
}

onMounted(() => {
  loadCustomers()
  loadReceiptList()
})
</script>

<style scoped>
.finance-receipt-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.query-form { display: flex; flex-wrap: wrap; gap: 10px; }
.outbound-list { margin-top: 10px; }
</style>
