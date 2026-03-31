<template>
  <div class="returns-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增退货单
        </el-button>
        <el-button type="success" @click="handlePrintCurrent">
          <el-icon><Printer /></el-icon>
          打印当前单据
        </el-button>
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出 Excel
        </el-button>
        
        <el-input
          v-model="searchQuery"
          placeholder="搜索凭证号/产品编码/客户"
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
        :data="returnsList"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="voucherNo" label="凭证号" width="150" />
        <el-table-column prop="voucherDate" label="日期" width="120" />
        <el-table-column prop="customerName" label="客户" min-width="120" />
        <el-table-column prop="warehouseName" label="仓库" width="120">
          <template #default="{ row }">
            {{ row.warehouseName || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="originalOrderNo" label="原订单号" width="150" />
        <el-table-column prop="itemCount" label="商品行数" width="80">
          <template #default="{ row }">
            {{ row.items?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="退货金额（不含税）" width="150">
          <template #default="{ row }">
            -¥{{ Math.abs(row.totalAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
          </template>
        </el-table-column>
        <el-table-column label="退货金额（含税）" width="150">
          <template #default="{ row }">
            -¥{{ Math.abs(row.totalInc || row.totalAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="经办人" width="100">
          <template #default="{ row }">
            {{ row.handlerName || row.operator }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" @click="handleView(row)">查看</el-button>
              <el-button type="warning" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="success" size="small" @click="handlePrint(row)">打印</el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </div>
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

    <!-- 新增/编辑退货单对话框 -->
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
        label-width="120px"
        :disabled="isViewMode"
      >
        <el-alert
          title="销售退货单 - 冲减库存数据"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        >
          <template #default>
            <div>
              退货单将冲减对应商品的库存数量，并生成负向出库记录
            </div>
          </template>
        </el-alert>

        <!-- 单据头部信息 -->
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="凭证号" prop="voucherNo">
              <el-input v-model="formData.voucherNo" placeholder="自动生成" readonly />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="退货日期" prop="voucherDate">
              <el-date-picker
                v-model="formData.voucherDate"
                type="date"
                placeholder="选择日期"
                style="width: 100%"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="原订单号" prop="originalOrderNo">
              <el-select
                v-model="formData.originalOrderNo"
                placeholder="选择原订单"
                style="width: 100%"
                clearable
                @change="handleOriginalOrderChange"
              >
                <el-option
                  v-for="item in orderList"
                  :key="item.id"
                  :label="`${item.voucherNo} - ${item.voucherDate}`"
                  :value="item.voucherNo"
                >
                  <span>{{ item.voucherNo }}</span>
                  <span style="color: #8492a6; font-size: 13px">({{ item.voucherDate }})</span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户" prop="customerId">
              <el-select
                v-model="formData.customerId"
                placeholder="选择客户"
                style="width: 100%"
                filterable
              >
                <el-option
                  v-for="customer in customers"
                  :key="customer.id"
                  :label="customer.name"
                  :value="customer.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="仓库" prop="warehouseId">
              <el-select
                v-model="formData.warehouseId"
                placeholder="请选择仓库"
                style="width: 100%"
                filterable
                @change="handleWarehouseChange"
              >
                <el-option
                  v-for="warehouse in warehouses"
                  :key="warehouse.id"
                  :label="warehouse.name"
                  :value="warehouse.id"
                >
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>{{ warehouse.name }}</span>
                    <el-switch
                      v-if="!isViewMode"
                      :model-value="defaultWarehouseId === warehouse.id"
                      :active-value="true"
                      :inactive-value="false"
                      inline-prompt
                      active-text="默认"
                      inactive-text=""
                      style="--el-switch-width: 60px; --el-switch-inactive-color: #dcdfe6;"
                      @click.stop
                      @change="(val: boolean) => saveDefaultWarehouse(warehouse.id)"
                    />
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户名称">
              <el-input v-model="formData.customerName" readonly />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="经办人" prop="handlerId">
              <el-select v-model="formData.handlerId" placeholder="选择经办人" filterable @change="handleHandlerChange">
                <el-option
                  v-for="u in users"
                  :key="u.id"
                  :label="u.name"
                  :value="u.id"
                >
                  <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span>{{ u.name }}</span>
                    <el-switch
                      :model-value="defaultHandlerId === u.id"
                      :active-value="true"
                      :inactive-value="false"
                      inline-prompt
                      active-text="默认"
                      inactive-text=""
                      style="--el-switch-width: 60px; --el-switch-inactive-color: #dcdfe6;"
                      :disabled="isViewMode"
                      @change="(val: boolean) => setDefaultHandler(u.id, val)"
                    />
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="退货原因" prop="returnReason">
          <el-input
            v-model="formData.returnReason"
            type="textarea"
            :rows="2"
            placeholder="请输入退货原因（如：质量问题、规格不符等）"
          />
        </el-form-item>

        <!-- 退货商品明细 -->
        <el-alert
          title="退货商品明细"
          type="info"
          :closable="false"
          show-icon
          style="margin: 20px 0"
        >
          <template #default>
            <div>
              选择原订单后自动加载商品，或直接添加退货商品
            </div>
          </template>
        </el-alert>

        <el-table
          :data="formData.items"
          style="width: 100%; margin-bottom: 10px"
          border
        >
          <el-table-column label="商品" min-width="200">
            <template #default="{ row }">
              <el-select
                v-model="row.productId"
                placeholder="选择商品"
                filterable
                style="width: 100%"
                @change="handleProductChange(row)"
              >
                <el-option
                  v-for="product in selectableProducts"
                  :key="product.id"
                  :label="`${product.code} - ${product.name}`"
                  :value="product.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column prop="productName" label="商品名称" min-width="150" />
          <el-table-column prop="specification" label="规格" width="120" />
          <el-table-column prop="unit" label="单位" width="80" />
          <el-table-column label="退货数量" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.quantity"
                :min="1"
                :precision="2"
                controls-position="right"
                style="width: 100%"
                @focus="handleFocus(row, 'quantity')"
                @change="calculateRowTotals(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="单价 (不含税)" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.unitPrice"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 100%"
                @focus="handleFocus(row, 'unitPrice')"
                @change="updateRowBy(row, 'unitPrice')"
              />
            </template>
          </el-table-column>
          <el-table-column label="单价 (含税)" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.unitPriceIncl"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 100%"
                @focus="handleFocus(row, 'unitPriceIncl')"
                @change="updateRowBy(row, 'unitPriceIncl')"
              />
            </template>
          </el-table-column>
          <el-table-column label="税率 (%)" width="100">
            <template #default="{ row }">
              <el-select
                v-model="row.taxRate"
                filterable
                allow-create
                placeholder="选择或输入税率"
                style="width: 100%"
                @change="calculateRowTotals(row)"
              >
                <el-option label="免税" :value="0" />
                <el-option label="1%" :value="1" />
                <el-option label="3%" :value="3" />
                <el-option label="5%" :value="5" />
                <el-option label="6%" :value="6" />
                <el-option label="9%" :value="9" />
                <el-option label="13%" :value="13" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="税额" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.taxAmount"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 100%"
                @focus="handleFocus(row, 'taxAmount')"
                @change="updateRowBy(row, 'taxAmount')"
              />
            </template>
          </el-table-column>
          <el-table-column label="金额 (含税)" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.totalInc"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 100%"
                @focus="handleFocus(row, 'totalInc')"
                @change="updateRowBy(row, 'totalInc')"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ $index }">
              <el-button
                type="danger"
                size="small"
                @click="removeItem($index)"
                :disabled="isViewMode"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-button
          type="primary"
          size="small"
          @click="addItem"
          :disabled="isViewMode"
          style="margin-bottom: 20px"
        >
          <el-icon><Plus /></el-icon>
          添加商品
        </el-button>

        <!-- 合计信息 -->
        <el-descriptions
          :column="2"
          border
          style="margin-top: 20px"
        >
          <el-descriptions-item label="退货总金额（不含税）">
            -¥{{ Math.abs(formData.totalAmount).toFixed(2) }}
          </el-descriptions-item>
          <el-descriptions-item label="退货总金额（含税）">
            -¥{{ Math.abs(formData.totalInc || 0).toFixed(2) }}
          </el-descriptions-item>
          <el-descriptions-item label="商品行数">
            {{ formData.items.length }}
          </el-descriptions-item>
        </el-descriptions>

        <el-form-item label="备注">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button
            v-if="isViewMode"
            type="primary"
            @click="handlePrintCurrent"
          >
            打印
          </el-button>
          <el-button
            v-else
            type="primary"
            @click="handleSubmit"
            :loading="submitLoading"
          >
            保存
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Printer, Download, Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { handleDocumentSave, DocumentType } from '@/utils/cost-recalculation'

// 类型定义
interface ReturnItem {
  productId?: number
  productName?: string
  specification?: string
  unit?: string
  quantity: number
  unitPrice: number  // 不含税单价
  unitPriceIncl?: number  // 含税单价
  taxRate: number
  amount: number
  taxAmount: number
  totalInc?: number  // 含税金额
}

interface ReturnRecord {
  id?: number
  voucherNo: string
  voucherDate: string
  originalOrderNo?: string
  customerId?: number
  customerName: string
  warehouseId?: number
  warehouseName?: string
  handlerId?: number
  handlerName: string
  operator?: string
  returnReason?: string
  items: ReturnItem[]
  totalAmount: number
  totalInc?: number
  remark?: string
  createdAt?: string
}

interface Product {
  id: number
  code: string
  name: string
  specification?: string
  spec?: string  // 兼容两种字段名
  unit?: string
  costPrice?: number
  status?: number | boolean
}

interface Customer {
  id: number
  name: string
  status?: number | boolean
}

interface Warehouse {
  id: number
  code: string
  name: string
  status: number
}

interface OrderRecord {
  id?: number
  voucherNo: string
  voucherDate: string
  customerId?: number
  customerName: string
  warehouseId?: number
  warehouseName?: string
  items: any[]
}

// 状态
const dialogVisible = ref(false)
const dialogTitle = ref('新增退货单')
const isViewMode = ref(false)
const submitLoading = ref(false)
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const returnsList = ref<ReturnRecord[]>([])
const orderList = ref<OrderRecord[]>([])
const products = ref<Product[]>([])
const customers = ref<Customer[]>([])
const warehouses = ref<Warehouse[]>([])
const users = ref<any[]>([])
const selectedRows = ref<ReturnRecord[]>([])
const defaultHandlerId = ref<number | undefined>(undefined)
const defaultWarehouseId = ref<number | undefined>(undefined)
const originalOrderProductIds = ref<Set<number>>(new Set())

// 表单数据
const formRef = ref()
const formData = reactive<ReturnRecord>({
  voucherNo: '',
  voucherDate: dayjs().format('YYYY-MM-DD'),
  originalOrderNo: '',
  customerId: undefined,
  customerName: '',
  warehouseId: undefined,
  warehouseName: '',
  handlerId: undefined,
  handlerName: '',
  returnReason: '',
  items: [],
  totalAmount: 0,
  remark: ''
})

const rules = {
  voucherDate: [{ required: true, message: '请选择退货日期', trigger: 'change' }],
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  handlerId: [{ required: true, message: '请选择经办人', trigger: 'change' }],
  returnReason: [{ required: true, message: '请输入退货原因', trigger: 'blur' }]
}

// 计算属性：可选择的商品列表（如果有原订单，只显示原订单中的商品）
const selectableProducts = computed(() => {
  if (originalOrderProductIds.value.size > 0) {
    return products.value.filter(p => originalOrderProductIds.value.has(p.id))
  }
  return products.value
})

// 加载退货单列表
const loadReturnsList = async () => {
  try {
    const saved = localStorage.getItem('salesReturns')
    if (saved) {
      let all = JSON.parse(saved)
      let needsUpdate = false
      
      // 检查并更新旧数据（计算含税总金额）
      for (let i = 0; i < all.length; i++) {
        const ret = all[i]
        if (ret.totalInc == null && ret.items && ret.items.length > 0) {
          ret.totalInc = ret.items.reduce((sum: number, item: any) => sum + (item.totalInc || 0), 0)
          needsUpdate = true
        }
      }
      
      // 如果有更新，保存回 localStorage
      if (needsUpdate) {
        localStorage.setItem('salesReturns', JSON.stringify(all))
      }
      
      // 按日期和时间戳正序排序
      all.sort((a: any, b: any) => {
        const dateA = new Date(a.voucherDate || a.date || '1970-01-01').getTime()
        const dateB = new Date(b.voucherDate || b.date || '1970-01-01').getTime()
        if (dateA !== dateB) {
          return dateA - dateB
        }
        const timeA = a.createdAt || a._timestamp || a.voucherDate || '1970-01-01'
        const timeB = b.createdAt || b._timestamp || b.voucherDate || '1970-01-01'
        return new Date(timeA).getTime() - new Date(timeB).getTime()
      })
      
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      returnsList.value = all.slice(start, end)
      total.value = all.length
    } else {
      returnsList.value = []
      total.value = 0
    }
  } catch (error) {
    console.error('加载销售退货单列表失败:', error)
    ElMessage.error('加载销售退货单列表失败')
  }
}

// 加载订单列表（用于选择原订单）
const loadOrderList = async () => {
  try {
    // 尝试多个可能的键名
    const possibleKeys = ['sales_outbound_records', 'sales_orders', 'sales_outbounds']
    let foundData = null
    
    for (const key of possibleKeys) {
      const saved = localStorage.getItem(key)
      if (saved) {
        foundData = JSON.parse(saved)
        console.log(`从 ${key} 加载出库单列表，共 ${foundData.length} 条记录`)
        break
      }
    }
    
    orderList.value = foundData || []
  } catch (error) {
    console.error('加载订单列表失败:', error)
    orderList.value = []
  }
}

// 加载商品列表
const loadProducts = async () => {
  try {
    const savedProducts = localStorage.getItem('products')
    if (savedProducts) {
      const allProducts = JSON.parse(savedProducts)
      products.value = allProducts
        .filter((p: any) => (p.status as any) === 1 || (p.status as any) === true)
        .map((p: any) => ({
          id: p.id,
          code: p.code || p.productCode || '',
          name: p.name || p.productName || '',
          specification: p.specification || p.spec || '',
          unit: p.unit || '',
          costPrice: p.costPrice || p.cost || 0
        }))
    } else {
      products.value = []
    }
  } catch (error) {
    console.error('加载商品列表失败:', error)
    products.value = []
  }
}

// 加载客户列表
const loadCustomers = async () => {
  try {
    const saved = localStorage.getItem('customers')
    customers.value = saved ? JSON.parse(saved) : []
  } catch (error) {
    console.error('加载客户列表失败:', error)
    customers.value = []
  }
}

// 加载仓库列表
const loadWarehouses = async () => {
  try {
    const savedWarehouses = localStorage.getItem('warehouses')
    if (savedWarehouses) {
      const allWarehouses = JSON.parse(savedWarehouses)
      warehouses.value = allWarehouses.filter((w: Warehouse) => w.status === 1)
    } else {
      warehouses.value = []
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error)
    warehouses.value = []
  }
}

// 加载系统用户（用于经办人下拉），兼容多种存储键与字段
const normalizeUser = (u: any) => ({ id: u.id ?? u.userId ?? u.uid ?? Date.now(), name: u.name || u.realname || u.realName || u.employeeName || u.fullName || u.username || u.userName || '' })
const loadUsers = async () => {
  try {
    // 优先从 employees 键加载员工数据
    const employeeKeys = ['employees', 'employee_list', 'staff', 'system_users']
    let found: any[] = []
    
    for (const k of employeeKeys) {
      const raw = localStorage.getItem(k)
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length > 0) {
            // 检查是否是员工数据（包含员工特有字段）
            if (parsed[0].employeeName || parsed[0].realname || parsed[0].realName || parsed[0].status || parsed[0].department) {
              // 过滤在职员工
              found = parsed.filter((e: any) => 
                (e.status as any) === 'active' || 
                (e.status as any) === 1 || 
                (e.status as any) === true ||
                (e.status as any) === '在职' ||
                !e.status  // 如果没有 status 字段，默认在职
              )
              break
            }
          }
        } catch { continue }
      }
    }

    users.value = (found || []).map(normalizeUser)
    console.log('加载的员工数据:', users.value)

    // 回退：使用当前登录用户作为单条选项
    if ((!users.value || users.value.length === 0) && localStorage.getItem('currentUser')) {
      try {
        const cur = JSON.parse(localStorage.getItem('currentUser')!)
        users.value = [normalizeUser(cur)]
      } catch {
        users.value = []
      }
    }
    
    // 加载默认经办人
    const savedDefaultHandler = localStorage.getItem('defaultHandlerId')
    if (savedDefaultHandler) {
      defaultHandlerId.value = parseInt(savedDefaultHandler)
      console.log('默认经办人 ID:', defaultHandlerId.value)
    }
  } catch (error) {
    console.error('加载系统用户失败:', error)
    users.value = []
  }
  
  // 加载默认仓库
  const savedDefaultWarehouse = localStorage.getItem('defaultWarehouseId')
  if (savedDefaultWarehouse) {
    defaultWarehouseId.value = parseInt(savedDefaultWarehouse)
    console.log('默认仓库 ID:', defaultWarehouseId.value)
  }
}

const handleAdd = () => {
  resetForm()
  loadOrderList() // 加载出库单列表
  dialogTitle.value = '新增退货单'
  isViewMode.value = false
  
  // 设置默认经办人
  if (defaultHandlerId.value) {
    formData.handlerId = defaultHandlerId.value
    const employee = users.value.find(e => e.id === defaultHandlerId.value)
    if (employee) {
      formData.handlerName = employee.name
    }
  }
  
  // 设置默认仓库
  if (defaultWarehouseId.value) {
    formData.warehouseId = defaultWarehouseId.value
    const warehouse = warehouses.value.find(w => w.id === defaultWarehouseId.value)
    if (warehouse) {
      formData.warehouseName = warehouse.name
    }
  }
  
  dialogVisible.value = true
}

const handleEdit = (row: ReturnRecord) => {
  loadOrderList() // 加载出库单列表
  Object.assign(formData, row)
  formData.items = JSON.parse(JSON.stringify(row.items))
  // 兼容旧数据：如果只有 operator 字段，转换为 handlerId 和 handlerName
  if (row.operator && !row.handlerId) {
    formData.handlerName = row.operator
    const employee = users.value.find(e => e.name === row.operator)
    if (employee) {
      formData.handlerId = employee.id
    }
  }
  // 设置原订单商品ID
  if (row.originalOrderNo) {
    const originalOrder = orderList.value.find(item => item.voucherNo === row.originalOrderNo)
    if (originalOrder) {
      originalOrderProductIds.value = new Set(originalOrder.items.map((item: any) => item.productId))
    } else {
      originalOrderProductIds.value = new Set()
    }
  } else {
    originalOrderProductIds.value = new Set()
  }
  dialogTitle.value = '编辑退货单'
  isViewMode.value = false
  dialogVisible.value = true
}

const handleView = (row: ReturnRecord) => {
  loadOrderList() // 加载出库单列表
  Object.assign(formData, row)
  formData.items = JSON.parse(JSON.stringify(row.items))
  // 兼容旧数据：如果只有 operator 字段，转换为 handlerId 和 handlerName
  if (row.operator && !row.handlerId) {
    formData.handlerName = row.operator
    const employee = users.value.find(e => e.name === row.operator)
    if (employee) {
      formData.handlerId = employee.id
    }
  }
  // 设置原订单商品ID
  if (row.originalOrderNo) {
    const originalOrder = orderList.value.find(item => item.voucherNo === row.originalOrderNo)
    if (originalOrder) {
      originalOrderProductIds.value = new Set(originalOrder.items.map((item: any) => item.productId))
    } else {
      originalOrderProductIds.value = new Set()
    }
  } else {
    originalOrderProductIds.value = new Set()
  }
  dialogTitle.value = '查看退货单'
  isViewMode.value = true
  dialogVisible.value = true
}

const handleDelete = async (row: ReturnRecord) => {
  try {
    await ElMessageBox.confirm(`确定要删除退货单 ${row.voucherNo} 吗？`, '警告', {
      type: 'warning'
    })

    const saved = localStorage.getItem('salesReturns')
    if (saved) {
      const all = JSON.parse(saved)
      const filtered = all.filter((r: ReturnRecord) => r.id !== row.id)
      localStorage.setItem('salesReturns', JSON.stringify(filtered))

      // 更新库存（增加回库存）
      updateInventoryOnReturn(row, true)

      ElMessage.success('删除成功')
      loadReturnsList()
    }
  } catch {
    // 取消删除
  }
}

// 更新库存（退货时增加库存）
const updateInventoryOnReturn = (returnRecord: ReturnRecord, isAdding: boolean) => {
  try {
    const savedInventory = localStorage.getItem('inventory')
    const inventory = savedInventory ? JSON.parse(savedInventory) : {}

    returnRecord.items.forEach((item: ReturnItem) => {
      if (item.productId) {
        if (!inventory[item.productId]) {
          inventory[item.productId] = { productId: item.productId, quantity: 0 }
        }

        const changeAmount = item.quantity
        if (isAdding) {
          inventory[item.productId].quantity += changeAmount
        } else {
          inventory[item.productId].quantity -= changeAmount
        }
      }
    })

    localStorage.setItem('inventory', JSON.stringify(inventory))
  } catch (error) {
    console.error('更新库存失败:', error)
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()

    // 必须添加至少一行商品
    if (!formData.items || formData.items.length === 0) {
      ElMessage.error('请至少添加一条退货商品')
      return
    }

    // 如果选择了原订单，校验退货商品
    if (formData.originalOrderNo) {
      const originalOrder = orderList.value.find(item => item.voucherNo === formData.originalOrderNo)
      if (originalOrder) {
        // 校验每一个退货商品
        for (let i = 0; i < formData.items.length; i++) {
          const retItem = formData.items[i]
          
          // 查找原订单中是否有这个商品
          const origItem = originalOrder.items.find((item: any) => item.productId === retItem.productId)
          
          if (!origItem) {
            ElMessage.error(`商品"${retItem.productName}"不在原出库单中，无法退货`)
            return
          }
          
          // 校验退货数量不能超过原订单数量（取绝对值比较）
          const retQty = Math.abs(retItem.quantity)
          if (retQty > origItem.quantity) {
            ElMessage.error(`商品"${retItem.productName}"的退货数量(${retQty})不能超过原出库单数量(${origItem.quantity})`)
            return
          }
          
          // 校验退货数量必须大于0
          if (retQty <= 0) {
            ElMessage.error(`商品"${retItem.productName}"的退货数量必须大于0`)
            return
          }
        }
      }
    }

    // 计算总金额
    formData.totalAmount = formData.items.reduce((sum, item) => sum + item.amount, 0)
    formData.totalInc = formData.items.reduce((sum, item) => sum + (item.totalInc || 0), 0)

    // 生成凭证号（如果是新增）
    if (!formData.id) {
      formData.voucherNo = generateVoucherNo()
    }

    // 保存到 localStorage
    const saved = localStorage.getItem('salesReturns')
    const all = saved ? JSON.parse(saved) : []

    const existingIndex = all.findIndex((r: ReturnRecord) => r.id === formData.id)
    if (existingIndex >= 0) {
      const oldRecord = all[existingIndex]
      updateInventoryOnReturn(oldRecord, true)
      all[existingIndex] = { ...formData, id: formData.id }
    } else {
      formData.id = Date.now()
      formData.createdAt = new Date().toISOString() // 添加精确时间戳
      all.push(formData)
    }

    updateInventoryOnReturn(formData, false)

    localStorage.setItem('salesReturns', JSON.stringify(all))

    ElMessage.success('保存成功')
    
    // 检测是否需要重新结算成本
    await handleDocumentSave(
      DocumentType.SALES_RETURN,
      formData.items || [],
      formData.voucherDate
    )
    
    dialogVisible.value = false
    loadReturnsList()
  } catch (error: any) {
    if (error.validate) {
      ElMessage.error('请完善表单信息')
    } else {
      ElMessage.error('保存失败')
    }
  }
}

const generateVoucherNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `XS${date}${random}`
}

const handleOriginalOrderChange = (voucherNo: string) => {
  const order = orderList.value.find(item => item.voucherNo === voucherNo)
  if (order) {
    formData.customerId = order.customerId
    formData.customerName = order.customerName
    formData.warehouseId = order.warehouseId
    formData.warehouseName = order.warehouseName
    
    // 同步更新经办人
    if (order.operator || order.handlerName) {
      formData.operator = order.operator || order.handlerName || ''
      formData.handlerName = order.handlerName || order.operator || ''
    }

    // 保存原订单商品ID
    originalOrderProductIds.value = new Set(order.items.map((item: any) => item.productId))

    formData.items = order.items.map((item: any) => {
      // 从原订单加载商品，正确映射字段
      // 销售出库单：unitPrice = 含税单价，unitPriceEx = 不含税单价
      const unitPriceIncl = item.unitPrice || 0  // 出库单的 unitPrice 是含税单价
      const unitPriceEx = item.unitPriceEx || 0  // 出库单的 unitPriceEx 是不含税单价
      const taxRate = item.taxRate || 0
      
      return {
        productId: item.productId,
        productName: item.productName,
        specification: item.specification,
        unit: item.unit,
        quantity: 0,  // 退货数量默认为 0，由用户输入
        unitPrice: unitPriceEx,  // 退货单的不含税单价
        unitPriceIncl: unitPriceIncl,  // 退货单的含税单价
        taxRate: taxRate,
        amount: 0,
        taxAmount: 0
      }
    })
    
    // 触发计算，更新总计
    formData.totalAmount = formData.items.reduce((s: number, it: any) => s + (it.amount || 0), 0)
  } else {
    // 清空原订单商品ID
    originalOrderProductIds.value = new Set()
  }
}

// 保留两位小数
const round2 = (v: number) => Math.round(v * 100) / 100

const handleHandlerChange = (handlerId: number) => {
  const employee = users.value.find(e => e.id === handlerId)
  if (employee) {
    formData.handlerName = employee.name
  }
}

const handleWarehouseChange = (warehouseId: number) => {
  const warehouse = warehouses.value.find(w => w.id === warehouseId)
  if (warehouse) {
    formData.warehouseName = warehouse.name
  }
}

const setDefaultHandler = (employeeId: number, isActive: boolean) => {
  if (isActive) {
    defaultHandlerId.value = employeeId
    localStorage.setItem('defaultHandlerId', employeeId.toString())
    ElMessage.success('已设置为默认经办人')
  }
}

const saveDefaultWarehouse = (warehouseId: number | undefined) => {
  if (warehouseId) {
    localStorage.setItem('defaultWarehouseId', warehouseId.toString())
    defaultWarehouseId.value = warehouseId
    ElMessage.success('已设置为默认仓库')
  }
}

const handleProductChange = (row: ReturnItem) => {
  const product = products.value.find(p => p.id === row.productId)
  if (product) {
    row.productName = product.name
    // 优先使用 spec（产品表字段），其次使用 specification，最后使用 code 作为备用
    row.specification = product.spec || product.specification || product.code || ''
    row.unit = product.unit || '个'
    // 如果产品有成本价则使用，否则保持为空
    row.unitPrice = product.costPrice && product.costPrice > 0 ? product.costPrice : ('' as any)
    // initialize derived fields
    row.taxRate = row.taxRate || 0
    // 只有当有价格时才计算总额
    if (row.unitPrice && row.unitPrice !== '') {
      row.taxAmount = Number((row.quantity * row.unitPrice * (row.taxRate / 100)).toFixed(2))
      row.totalInc = Number((row.quantity * row.unitPrice + row.taxAmount).toFixed(2))
      calculateRowTotals(row)
    }
  }
}

const calculateRowTotals = (row: ReturnItem) => {
  row.amount = Number((row.quantity * row.unitPrice).toFixed(2))
  row.taxAmount = Number((row.amount * (row.taxRate / 100)).toFixed(2))
  // totalInc is 含税金额
  row.totalInc = Number((row.amount + row.taxAmount).toFixed(2))
  // 同步含税单价
  row.unitPriceIncl = row.taxRate === 0 ? row.unitPrice : round2(row.unitPrice * (1 + row.taxRate / 100))
  
  // 实时检测
  validateSingleReturnItem(row)
}

// 校验单个退货商品（验证是否在原订单中，且数量不超过原订单数量）
const validateSingleReturnItem = (item: ReturnItem): boolean => {
  // 如果没有选择原订单，不需要这个验证
  if (!formData.originalOrderNo) {
    return true
  }
  
  // 找到原订单
  const originalOrder = orderList.value.find(ib => ib.voucherNo === formData.originalOrderNo)
  if (!originalOrder) {
    return true
  }
  
  // 查找原订单中是否有这个商品
  const origItem = originalOrder.items.find((oItem: any) => oItem.productId === item.productId)
  if (!origItem) {
    ElMessage.error(`商品"${item.productName}"不在原出库单中，无法退货`)
    return false
  }
  
  // 校验退货数量不能超过原订单数量（取绝对值比较）
  const retQty = Math.abs(item.quantity)
  if (retQty > origItem.quantity) {
    ElMessage.error(`商品"${item.productName}"的退货数量(${retQty})不能超过原出库单数量(${origItem.quantity})`)
    return false
  }
  
  return true
}

// Unified updater: when taxRate + any one of unitPrice / unitPriceIncl / taxAmount / totalInc is changed,
// compute the remaining derived fields.
const updateRowBy = (row: any, field: string) => {
  const q = row.quantity || 0
  const t = Number(row.taxRate || 0)
  if (q <= 0) return

  if (field === 'unitPrice' || field === 'taxRate') {
    // unitPrice and taxRate known -> compute amount, taxAmount, totalInc
    row.amount = Number((q * row.unitPrice).toFixed(2))
    row.taxAmount = Number((row.amount * (t / 100)).toFixed(2))
    row.totalInc = Number((row.amount + row.taxAmount).toFixed(2))
    // 同步含税单价
    row.unitPriceIncl = t === 0 ? row.unitPrice : round2(row.unitPrice * (1 + t / 100))
  } else if (field === 'unitPriceIncl') {
    // unitPriceIncl and taxRate known -> compute unitPrice and totals
    const unitPriceIncl = Number(row.unitPriceIncl || 0)
    row.unitPrice = t === 0 ? unitPriceIncl : round2(unitPriceIncl / (1 + t / 100))
    row.amount = Number((q * row.unitPrice).toFixed(2))
    row.taxAmount = Number((row.amount * (t / 100)).toFixed(2))
    row.totalInc = Number((row.amount + row.taxAmount).toFixed(2))
  } else if (field === 'taxAmount') {
    // taxAmount and taxRate known -> compute amount and totals
    if (t === 0) return
    row.amount = Number((row.taxAmount / (t / 100) / q).toFixed(2))
    row.unitPrice = Number((row.amount / q).toFixed(2))
    row.totalInc = Number((row.amount + row.taxAmount).toFixed(2))
    row.unitPriceIncl = round2(row.unitPrice * (1 + t / 100))
  } else if (field === 'totalInc') {
    // totalInc and taxRate known -> compute amount and unitPrice, taxAmount
    const totalInc = Number(row.totalInc || 0)
    row.amount = Number((totalInc / (1 + t / 100)).toFixed(2))
    row.unitPrice = Number((row.amount / q).toFixed(2))
    row.taxAmount = Number((totalInc - row.amount).toFixed(2))
    row.unitPriceIncl = round2(totalInc / q)
  }
  // ensure rounding
  row.amount = Number((row.amount || 0).toFixed(2))
  row.taxAmount = Number((row.taxAmount || 0).toFixed(2))
  row.totalInc = Number((row.totalInc || 0).toFixed(2))
  // update totals
  formData.totalAmount = formData.items.reduce((s: number, it: any) => s + (it.amount || 0), 0)
}

const addItem = () => {
  formData.items.push({
    productId: undefined,
    productName: '',
    specification: '',
    unit: '个',
    quantity: 0,
    unitPrice: 0,
    taxRate: 13,
    amount: 0,
    taxAmount: 0
  })
}

const removeItem = (index: number) => {
  formData.items.splice(index, 1)
}

// 处理输入框聚焦事件，清空 0 值让用户直接输入
const handleFocus = (row: any, field: string) => {
  const value = row[field]
  if (value === 0 || value === '0') {
    row[field] = ''
  }
}

const resetForm = () => {
  Object.assign(formData, {
    voucherNo: '',
    voucherDate: dayjs().format('YYYY-MM-DD'),
    originalOrderNo: '',
    customerId: undefined,
    customerName: '',
    warehouseId: undefined,
    warehouseName: '',
    handlerId: undefined,
    handlerName: '',
    returnReason: '',
    items: [],
    totalAmount: 0,
    remark: ''
  })
  originalOrderProductIds.value = new Set()
  formRef.value?.clearValidate()
}

const handleSearch = () => {
  currentPage.value = 1
  loadReturnsList()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  loadReturnsList()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  loadReturnsList()
}

const handleSelectionChange = (selection: ReturnRecord[]) => {
  selectedRows.value = selection
}

const handlePrint = (row: ReturnRecord) => {
  handleView(row)
}

const handlePrintCurrent = () => {
  if (selectedRows.value.length === 1) {
    handlePrint(selectedRows.value[0])
  } else if (dialogVisible.value) {
    const printContent = generatePrintContent(formData)
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.focus()
        printWindow.print()
      }
    }
  }
}

const handleExport = () => {
  ElMessage.info('导出功能开发中...')
}

const generatePrintContent = (data: ReturnRecord) => {
  const itemsHtml = data.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.productName || '-'}</td>
      <td>${item.specification || '-'}</td>
      <td>${item.quantity}</td>
      <td>${item.unit}</td>
      <td>${item.unitPrice.toFixed(2)}</td>
      <td>${(item.unitPrice * (1 + item.taxRate / 100)).toFixed(2)}</td>
      <td>${item.taxRate}%</td>
      <td>${item.taxAmount.toFixed(2)}</td>
      <td>${item.amount.toFixed(2)}</td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>销售退货单 - ${data.voucherNo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .info { margin-bottom: 10px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; }
          .table th { background-color: #f5f5f5; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>销售退货单</h2>
          <p>凭证号：${data.voucherNo}</p>
        </div>
        <div class="info">
          <div>退货日期：${data.voucherDate}</div>
          <div>原订单号：${data.originalOrderNo || '-'}</div>
          <div>客户：${data.customerName}</div>
          <div>经办人：${data.handlerName || data.operator}</div>
          <div>退货原因：${data.returnReason || '-'}</div>
          <div>备注：${data.remark || '-'}</div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>商品</th>
              <th>规格</th>
              <th>退货数量</th>
              <th>单位</th>
              <th>单价</th>
              <th>含税单价</th>
              <th>税率</th>
              <th>税额</th>
              <th>退货金额</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div style="text-align: right; font-weight: bold;">退货总金额：-¥${Math.abs(data.totalAmount).toFixed(2)}</div>
        <div style="text-align: right; margin-top: 10px;">打印时间：${dayjs().format('YYYY-MM-DD HH:mm:ss')}</div>
      </body>
    </html>
  `
}

onMounted(() => {
  loadReturnsList()
  loadOrderList()
  loadProducts()
  loadCustomers()
  loadWarehouses()
  loadUsers()
})
</script>

<style scoped>
.returns-page {
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

.action-buttons {
  display: flex;
  gap: 6px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
