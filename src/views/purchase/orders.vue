<template>
  <div class="purchase-orders-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增采购订单
        </el-button>
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出 Excel
        </el-button>
      </div>
      <el-table :data="orders" style="width: 100%">
        <el-table-column prop="orderNo" label="订单号" width="150" />
        <el-table-column prop="requestNo" label="申请单号" width="150" />
        <el-table-column prop="supplierName" label="供应商" width="150" />
        <el-table-column prop="orderDate" label="订单日期" width="120" />
        <el-table-column prop="deliveryDate" label="交货日期" width="120" />
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
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="success" size="small" @click="handleInbound(row)">入库</el-button>
            <el-button type="warning" size="small" @click="handleApprove(row)">审核</el-button>
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
          orderNo: [{ required: true, message: '请输入订单号', trigger: 'blur' }],
          supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
          orderDate: [{ required: true, message: '请选择订单日期', trigger: 'change' }],
          deliveryDate: [{ required: true, message: '请选择交货日期', trigger: 'change' }],
          totalAmount: [{ required: true, message: '请输入订单金额', trigger: 'blur' }]
        }"
        label-width="100px"
      >
        <el-form-item label="订单号" prop="orderNo">
          <el-input v-model="formData.orderNo" placeholder="自动生成或手动输入" />
        </el-form-item>
        <el-form-item label="申请单号" prop="requestNo">
          <el-input v-model="formData.requestNo" placeholder="可选" />
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
        <el-form-item label="订单日期" prop="orderDate">
          <el-date-picker
            v-model="formData.orderDate"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="交货日期" prop="deliveryDate">
          <el-date-picker
            v-model="formData.deliveryDate"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="订单金额" prop="totalAmount">
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
            <el-option label="待审核" value="pending" />
            <el-option label="已审核" value="approved" />
            <el-option label="已收货" value="received" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
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
import { db } from '@/utils/db-ipc'
import exportToCsv from '../../utils/exportCsv'

interface PurchaseOrder {
  id?: number
  orderNo: string
  requestNo?: string
  supplierId?: number
  supplierName?: string
  orderDate: string
  deliveryDate: string
  totalAmount: number
  status: 'pending' | 'approved' | 'received' | 'completed' | 'cancelled'
}

const orders = ref<PurchaseOrder[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const dialogTitle = ref('新增采购订单')
const formRef = ref()
const selectedRow = ref<PurchaseOrder | null>(null)

const formData = reactive<PurchaseOrder>({
  orderNo: '',
  requestNo: '',
  supplierId: undefined,
  supplierName: '',
  orderDate: dayjs().format('YYYY-MM-DD'),
  deliveryDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
  totalAmount: 0,
  status: 'pending'
})

const suppliers = ref<any[]>([])

// 加载供应商列表
const loadSuppliers = async () => {
  try {
    suppliers.value = await db.getSuppliers()
    console.log('加载供应商成功:', suppliers.value.length, '个')
  } catch (error) {
    console.error('加载供应商失败:', error)
  }
}

// 生成订单号
const generateOrderNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `PO${date}${random}`
}

// 加载订单列表
const loadOrders = async () => {
  try {
    orders.value = await db.getPurchaseOrders()
    total.value = orders.value.length
  } catch (error) {
    ElMessage.error('加载订单列表失败')
    console.error(error)
  }
}

// 新增订单
const handleAdd = () => {
  dialogTitle.value = '新增采购订单'
  Object.assign(formData, {
    orderNo: generateOrderNo(),
    requestNo: '',
    supplierId: undefined,
    supplierName: '',
    orderDate: dayjs().format('YYYY-MM-DD'),
    deliveryDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    totalAmount: 0,
    status: 'pending'
  })
  dialogVisible.value = true
}

// 编辑订单
const handleEdit = (row: PurchaseOrder) => {
  dialogTitle.value = '编辑采购订单'
  Object.assign(formData, row)
  selectedRow.value = row
  dialogVisible.value = true
}

// 删除订单
const handleDelete = async (row: PurchaseOrder) => {
  try {
    await ElMessageBox.confirm('确定要删除该订单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await db.deletePurchaseOrder(row.id)

    ElMessage.success('删除成功')
    loadOrders()
  } catch {
    // 用户取消删除
  }
}

// 入库
const handleInbound = (row: PurchaseOrder) => {
  console.log('入库:', row)
  ElMessage.info('入库功能待实现')
}

// 审核
const handleApprove = async (row: PurchaseOrder) => {
  try {
    await ElMessageBox.confirm('确定要审核该订单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await db.updatePurchaseOrder({ ...row, status: 'approved' })

    ElMessage.success('审核成功')
    loadOrders()
  } catch {
  }
}

// 导出 Excel
const handleExport = () => {
  const columns = [
    { label: '订单号', key: 'orderNo' },
    { label: '下单日期', key: 'orderDate' },
    { label: '供应商', key: 'supplierName' },
    { label: '总金额', key: 'totalAmount' },
    { label: '状态', key: 'status' }
  ]
  exportToCsv('purchase_orders.csv', columns, orders.value)
}

const getStatusType = (status: string) => {
  const map: any = {
    'pending': 'warning',
    'approved': 'success',
    'received': 'primary',
    'completed': 'success',
    'cancelled': 'danger'
  }
  return map[status] || ''
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()

    const supplier = suppliers.value.find(s => s.id === formData.supplierId)
    if (supplier) {
      formData.supplierName = supplier.name
    }

    if (formData.id) {
      await db.updatePurchaseOrder(formData)
      ElMessage.success('更新成功')
    } else {
      const saved = await db.addPurchaseOrder(formData)
      formData.id = saved.id
      ElMessage.success('新增成功')
    }

    dialogVisible.value = false
    loadOrders()
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

onMounted(() => {
  loadOrders()
  loadSuppliers()
})
</script>

<style scoped>
.purchase-orders-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
