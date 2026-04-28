<template>
  <div class="finance-payment-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增付款单
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
          <el-form-item label="供应商">
            <el-select
              v-model="queryForm.supplierId"
              placeholder="请选择供应商"
              clearable
              filterable
              style="width: 150px"
            >
              <el-option
                v-for="supplier in suppliers"
                :key="supplier.id"
                :label="supplier.name"
                :value="supplier.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleQuery">查询</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-table :data="filteredList" style="width: 100%">
        <el-table-column prop="paymentNo" label="付款单号" width="160" />
        <el-table-column prop="supplierName" label="供应商名称" min-width="150" />
        <el-table-column prop="paymentDate" label="付款日期" width="120" />
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
          paymentNo: [{ required: true, message: '请输入付款单号', trigger: 'blur' }],
          supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
          paymentDate: [{ required: true, message: '请选择付款日期', trigger: 'change' }],
          amount: [
            { type: 'number', required: true, message: '请输入金额', trigger: 'blur' },
            { type: 'number', min: 0.01, message: '金额必须大于0', trigger: 'blur' }
          ],
          paymentMethod: [{ required: true, message: '请选择支付方式', trigger: 'change' }]
        }"
        label-width="100px"
        :disabled="isViewMode"
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
        <el-form-item label="付款日期" prop="paymentDate">
          <el-date-picker
            v-model="formData.paymentDate"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="付款金额" prop="amount">
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

        <el-divider v-if="formData.supplierId" content-position="left">供应商往来明细</el-divider>
        <div v-if="formData.supplierId && supplierInbounds.length > 0" class="inbound-list">
          <el-table :data="supplierInbounds" size="small" border max-height="400">
            <el-table-column prop="date" label="日期" width="110" />
            <el-table-column prop="docNo" label="单号" width="180" />
            <el-table-column label="类型" width="80">
              <template #default="{ row }">
                <el-tag :type="getTypeTagColor(row.type)" size="small">
                  {{ getTypeLabel(row.type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="应付款" width="120" align="right">
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
            <el-table-column label="已付款" width="120" align="right">
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
            供应商未结清金额合计：
            <span :style="{ color: supplierUnpaidTotal >= 0 ? '#f56c6c' : '#67c23a', fontWeight: 'bold' }">
              ¥{{ Math.abs(supplierUnpaidTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
              <span style="font-weight: normal; font-size: 12px; margin-left: 4px">
                （{{ supplierUnpaidTotal >= 0 ? '我方欠供应商' : '供应商欠我方' }}）
              </span>
            </span>
          </div>
        </div>
        <div v-else-if="formData.supplierId" style="color: #909399; font-size: 14px">
          该供应商暂无往来记录
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ isViewMode ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!isViewMode" type="primary" @click="handleSubmit">确定</el-button>
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

interface PaymentRecord {
  id?: number
  paymentNo: string
  supplierId?: number
  supplierName?: string
  paymentDate: string
  amount: number
  paymentMethod: string
  status: string
  remark?: string
}

const paymentList = ref<PaymentRecord[]>([])
const suppliers = ref<any[]>([])
const dialogVisible = ref(false)
const viewDialogVisible = ref(false)
const dialogTitle = ref('新增付款单')
const isViewMode = ref(false)
const formRef = ref()
const viewData = ref<PaymentRecord>({} as PaymentRecord)

const queryForm = reactive({
  dateRange: [] as string[],
  supplierId: undefined as number | undefined
})

const filteredList = computed(() => {
  let filtered = [...paymentList.value]
  if (queryForm.dateRange && queryForm.dateRange.length === 2) {
    const [start, end] = queryForm.dateRange
    if (start && end) {
      filtered = filtered.filter(r => r.paymentDate >= start && r.paymentDate <= end)
    }
  }
  if (queryForm.supplierId) {
    filtered = filtered.filter(r => r.supplierId === queryForm.supplierId)
  }
  return filtered
})

const supplierInbounds = ref<any[]>([])

const supplierUnpaidTotal = computed(() => {
  if (supplierInbounds.value.length === 0) return 0
  return supplierInbounds.value[supplierInbounds.value.length - 1].balance || 0
})

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = { inbound: '入库', return: '退货', payment: '付款' }
  return labels[type] || type
}

const getTypeTagColor = (type: string) => {
  const colors: Record<string, string> = { inbound: 'primary', return: 'danger', payment: 'success' }
  return colors[type] || 'info'
}

const formData = reactive<PaymentRecord>({
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
  return `FK${date}${random}`
}

const loadSuppliers = async () => {
  try {
    suppliers.value = await db.getSuppliers()
  } catch (error) {
    console.error('加载供应商数据失败:', error)
    suppliers.value = []
  }
}

const loadPaymentList = async () => {
  try {
    const rawList = await db.getPaymentList()
    paymentList.value = (rawList || []).map((r: any) => ({
      id: r.id,
      paymentNo: r.payment_no || r.paymentNo || '',
      supplierId: r.supplier_id ?? r.supplierId,
      supplierName: r.supplier_name || r.supplierName || '',
      paymentDate: (r.payment_date || r.paymentDate || '').slice(0, 10),
      amount: Number(r.amount || 0),
      paymentMethod: r.payment_method || r.paymentMethod || '',
      status: r.status || 'pending',
      remark: r.remark || ''
    }))
  } catch (error) {
    ElMessage.error('加载付款单列表失败')
    console.error(error)
  }
}

const loadSupplierInbounds = async (supplierId: number) => {
  try {
    const round2 = (n: number) => Math.round(n * 100) / 100

    const inbounds = await db.getInboundList(1, 10000)
    const inboundList = (inbounds?.data || inbounds || []).filter((r: any) => {
      return (r.supplierId || r.supplier_id) === supplierId
    })

    const purchaseReturns = await db.getPurchaseReturns(1, 10000)
    const returnList = (purchaseReturns?.data || []).filter((r: any) => {
      return (r.supplierId || r.supplier_id) === supplierId
    })

    const payments = await db.getPaymentList()
    const existingPayments = (payments || []).filter((r: any) => {
      return (r.supplier_id ?? r.supplierId) === supplierId && r.id !== formData.id
    })

    const documents: any[] = []

    for (const r of inboundList) {
      const totalAmount = round2(Number(r.totalAmount || r.total_amount || 0))
      const paidAmount = round2(Number(r.paidAmount || r.paid_amount || 0))
      documents.push({
        date: (r.voucherDate || r.inbound_date || '').slice(0, 10),
        docNo: r.voucherNo || r.inbound_no || '',
        type: 'inbound',
        debitAmount: totalAmount,
        creditAmount: paidAmount,
        _timestamp: r.createdAt || r.created_at || r.voucherDate || r.inbound_date || ''
      })
    }

    for (const r of returnList) {
      // 采购退货：以负数冲减应付款，使用含税金额
      const totalAmount = round2(Number(r.total_incl || r.totalAmount || r.total_amount || 0))
      documents.push({
        date: (r.returnDate || r.return_date || '').slice(0, 10),
        docNo: r.returnNo || r.return_no || '',
        type: 'return',
        debitAmount: -totalAmount,  // 负数冲减应付款
        creditAmount: 0,
        _timestamp: r.createdAt || r.created_at || r.returnDate || r.return_date || ''
      })
    }

    for (const r of existingPayments) {
      const amount = round2(Number(r.amount || 0))
      documents.push({
        date: (r.payment_date || r.paymentDate || '').slice(0, 10),
        docNo: r.payment_no || r.paymentNo || '',
        type: 'payment',
        debitAmount: 0,
        creditAmount: amount,
        _timestamp: r.created_at || r.createdAt || r.payment_date || r.paymentDate || ''
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

    supplierInbounds.value = documents
  } catch (error) {
    console.error('加载供应商入库单失败:', error)
    supplierInbounds.value = []
  }
}

const handleSupplierChange = (supplierId: number) => {
  const supplier = suppliers.value.find(s => s.id === supplierId)
  if (supplier) {
    formData.supplierName = supplier.name
  }
  if (supplierId) {
    loadSupplierInbounds(supplierId)
  } else {
    supplierInbounds.value = []
  }
}

const handleAdd = () => {
  dialogTitle.value = '新增付款单'
  isViewMode.value = false
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
  supplierInbounds.value = []
  dialogVisible.value = true
}

const clearDefaultAmount = () => {
  if (formData.amount === 0) {
    formData.amount = null as any
  }
}

const handleView = (row: PaymentRecord) => {
  viewData.value = { ...row }
  viewDialogVisible.value = true
}

const handleEdit = (row: PaymentRecord) => {
  dialogTitle.value = '编辑付款单'
  isViewMode.value = false
  Object.assign(formData, { ...row })
  if (formData.supplierId) {
    loadSupplierInbounds(formData.supplierId)
  }
  dialogVisible.value = true
}

const handleDelete = async (row: PaymentRecord) => {
  try {
    await ElMessageBox.confirm('确定要删除这条付款单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await db.deletePayment(row.id)
    paymentList.value = paymentList.value.filter((p: PaymentRecord) => p.id !== row.id)
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

    const supplier = suppliers.value.find(s => s.id === formData.supplierId)
    if (supplier) {
      formData.supplierName = supplier.name
    }

    const dbData: any = {
      payment_no: formData.paymentNo,
      supplier_id: formData.supplierId || null,
      payment_date: formData.paymentDate,
      amount: formData.amount,
      payment_method: formData.paymentMethod,
      type: 'payment',
      status: formData.status,
      remark: formData.remark || null
    }

    if (formData.id) {
      dbData.id = formData.id
      await db.updatePayment(dbData)
      ElMessage.success('更新成功')
    } else {
      const saved = await db.addPayment(dbData)
      formData.id = saved?.id || saved
      ElMessage.success('新增成功')
    }

    dialogVisible.value = false
    loadPaymentList()
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
  queryForm.supplierId = undefined
}

onMounted(() => {
  loadSuppliers()
  loadPaymentList()
})
</script>

<style scoped>
.finance-payment-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.query-form { display: flex; flex-wrap: wrap; gap: 10px; }
.inbound-list { margin-top: 10px; }
</style>
