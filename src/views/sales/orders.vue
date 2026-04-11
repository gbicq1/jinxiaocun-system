<template>
  <div class="sales-orders-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增订单
        </el-button>
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出 Excel
        </el-button>
      </div>
      <el-table :data="orders" style="width: 100%">
        <el-table-column prop="orderNo" label="订单号" width="150" />
        <el-table-column prop="quoteNo" label="报价单号" width="150" />
        <el-table-column prop="customerName" label="客户名称" width="150" />
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
            <el-button type="success" size="small" @click="handleOutbound(row)">出库</el-button>
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
          customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
          orderDate: [{ required: true, message: '请选择订单日期', trigger: 'change' }],
          deliveryDate: [{ required: true, message: '请选择交货日期', trigger: 'change' }],
          totalAmount: [{ required: true, message: '请输入订单金额', trigger: 'blur' }]
        }"
        label-width="100px"
      >
        <el-form-item label="订单号" prop="orderNo">
          <el-input v-model="formData.orderNo" placeholder="自动生成或手动输入" />
        </el-form-item>
        <el-form-item label="报价单号" prop="quoteNo">
          <el-input v-model="formData.quoteNo" placeholder="可选" />
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
            <el-option label="已发货" value="shipped" />
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
import exportToCsv from '../../utils/exportCsv'
import { dbQuery, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { db } from '@/utils/db-ipc'

interface Order {
  id?: number
  orderNo: string
  quoteNo?: string
  customerId?: number
  customerName?: string
  orderDate: string
  deliveryDate: string
  totalAmount: number
  status: 'pending' | 'approved' | 'shipped' | 'completed' | 'cancelled'
}

const orders = ref<Order[]>([])
const total = ref(0)

const dialogVisible = ref(false)
const dialogTitle = ref('新增订单')
const formRef = ref()
const selectedRow = ref<Order | null>(null)

const formData = reactive<Order>({
  orderNo: '',
  quoteNo: '',
  customerId: undefined,
  customerName: '',
  orderDate: dayjs().format('YYYY-MM-DD'),
  deliveryDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
  totalAmount: 0,
  status: 'pending'
})

const customers = ref<any[]>([])

// 加载客户列表
const loadCustomers = async () => {
  try {
    customers.value = await db.getCustomers()
    console.log('加载客户成功:', customers.value.length, '个')
  } catch (error) {
    console.error('加载客户失败:', error)
  }
}

// 生成订单号
const generateOrderNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `SO${date}${random}`
}

// 加载订单列表
const loadOrders = async () => {
  try {
    const result = await dbQuery('SELECT * FROM sales_orders ORDER BY created_at DESC')
    orders.value = result
    total.value = orders.value.length
  } catch (error) {
    ElMessage.error('加载订单列表失败')
    console.error(error)
  }
}

// 新增订单
const handleAdd = () => {
  dialogTitle.value = '新增订单'
  Object.assign(formData, {
    orderNo: generateOrderNo(),
    quoteNo: '',
    customerId: undefined,
    customerName: '',
    orderDate: dayjs().format('YYYY-MM-DD'),
    deliveryDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    totalAmount: 0,
    status: 'pending'
  })
  dialogVisible.value = true
}

// 编辑订单
const handleEdit = (row: Order) => {
  dialogTitle.value = '编辑订单'
  Object.assign(formData, row)
  selectedRow.value = row
  dialogVisible.value = true
}

// 删除订单
const handleDelete = async (row: Order) => {
  try {
    await ElMessageBox.confirm('确定要删除该订单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await dbDelete('sales_orders', 'id = ?', [row.id])
    ElMessage.success('删除成功')
    loadOrders()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
      console.error(error)
    }
  }
}

// 出库
const handleOutbound = (row: Order) => {
  console.log('出库:', row)
  ElMessage.info('出库功能待实现')
}

// 审核
const handleApprove = async (row: Order) => {
  try {
    await ElMessageBox.confirm('确定要审核该订单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await dbUpdate('sales_orders', { ...row, status: 'approved' }, 'id = ?', [row.id])
    ElMessage.success('审核成功')
    loadOrders()
  } catch (error) {
    ElMessage.error('审核失败')
    console.error(error)
  }
}

// 导出 Excel
const handleExport = () => {
  const columns = [
    { label: '订单号', key: 'orderNo' },
    { label: '下单日期', key: 'orderDate' },
    { label: '客户', key: 'customerName' },
    { label: '总金额', key: 'totalAmount' },
    { label: '状态', key: 'status' }
  ]
  exportToCsv('sales_orders.csv', columns, orders.value)
}

const getStatusType = (status: string) => {
  const map: any = {
    'pending': 'warning',
    'approved': 'success',
    'shipped': 'primary',
    'completed': 'success',
    'cancelled': 'danger'
  }
  return map[status] || ''
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
      await dbUpdate('sales_orders', formData, 'id = ?', [formData.id])
      ElMessage.success('更新成功')
    } else {
      // 新增
      await dbInsert('sales_orders', formData)
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
  loadCustomers()
})
</script>

<style scoped>
.sales-orders-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
