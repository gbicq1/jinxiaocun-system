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
          <el-table-column label="序号" width="60" type="index" />
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
          <el-table-column label="退货数量" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.quantity"
                :min="0"
                :max="row.originalQuantity || 999999"
                :precision="2"
                :controls="false"
                :clearable="true"
                style="width: 100%"
                @focus="handleQuantityFocus(row)"
                @change="calculateRowTotalss(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="原出库数量" width="120">
            <template #default="{ row }">
              <el-input
                v-model="row.originalQuantity"
                disabled
                style="color: #909399"
              />
            </template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="80" />
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
                @change="calculateRowTotalss(row)"
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
import { dbQuery } from '@/utils/db'

// 类型定义
interface ReturnItem {
  productId?: number
  productName?: string
  specification?: string
  unit?: string
  quantity: number
  originalQuantity?: number  // 原订单数量（用于校验和显示）
  originalItemIndex?: number  // 原订单中的索引（用于编辑时匹配）
  unitPrice: number  // 不含税单价
  unitPriceEx?: number  // 不含税单价（兼容字段）
  unitPriceIncl?: number  // 含税单价
  taxRate: number
  amount: number
  taxAmount: number
  totalAmount?: number  // 不含税金额（兼容字段）
  totalInc?: number  // 含税金额
  deductionAmount?: number  // 加计扣除金额
  allowDeduction?: boolean  // 是否允许加计扣除
  _lastEdited?: string  // 最后编辑的字段
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
  originalOrderNo: [{ required: true, message: '请选择原订单号', trigger: 'change' }],
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
    const electron = (window as any).electron
    if (electron) {
      const result = await electron.salesReturnList(currentPage.value, pageSize.value)
      console.log('退货单列表结果:', result)
      console.log('返回的原始数据项:', result.data?.[0])

      returnsList.value = (result.data || []).map((item: any) => {
        console.log('处理退货单项，return_no:', item.return_no, 'id:', item.id)
        return {
          id: item.id,
          voucherNo: item.return_no || '',
          voucherDate: item.return_date,
          originalOrderNo: item.original_order_no,
          totalAmount: item.total_amount || 0,
          totalInc: item.total_inc || 0,
          returnReason: item.return_reason || '',
          customerName: item.customer_name || '',
          warehouseName: item.warehouse_name || '',
          handlerName: item.handler_name || '',
          customerId: item.customer_id,
          warehouseId: item.warehouse_id,
          handlerId: item.handler_id,
          // 转换 items 字段名
          items: (Array.isArray(item.items) ? item.items : []).map((it: any) => ({
            productId: it.product_id,
            productName: it.product_name || '',
            specification: it.specification || '',
            unit: it.unit || '',
            quantity: it.quantity || 0,
            originalQuantity: it.original_quantity || 0,  // 添加原出库数量字段
            unitPrice: it.unit_price || 0,
            unitPriceIncl: it.unit_price_incl || 0,
            taxRate: it.tax_rate || 0,
            taxAmount: it.tax_amount || 0,
            totalInc: it.total_inc || 0,
            amount: it.amount || 0,
            costPrice: it.cost_price || 0,
            originalItemIndex: it.original_item_index !== undefined ? it.original_item_index : 0
          }))
        }
      })
      console.log('处理后的列表数据:', returnsList.value)
      total.value = result.total || returnsList.value.length
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
    // 从数据库读取销售出库单列表
    const electron = (window as any).electron
    if (electron && electron.outboundList) {
      const result = await electron.outboundList(1, 1000) // 获取所有数据
      console.log('出库单列表结果:', result)
      console.log('result.data:', result.data)

      // 转换字段格式
      orderList.value = (result.data || result).map((item: any) => ({
        id: item.id,
        voucherNo: item.voucherNo,
        voucherDate: item.voucherDate,
        customerId: item.customerId,
        customerName: item.customerName,
        warehouseId: item.warehouseId,
        warehouseName: item.warehouseName,
        operator: item.handlerName || item.createdBy,
        handlerName: item.handlerName || item.createdBy,
        items: item.items || []
      }))

      console.log(`从数据库加载出库单列表，共 ${orderList.value.length} 条记录`)
      // 输出每个出库单的商品数量
      orderList.value.forEach(order => {
        console.log(`出库单 ${order.voucherNo}: ${order.items.length} 个商品`)
      })
    } else {
      console.error('outboundList 方法不可用')
      orderList.value = []
    }
  } catch (error) {
    console.error('加载订单列表失败:', error)
    orderList.value = []
  }
}

// 加载商品列表
const loadProducts = async () => {
  try {
    const result = await dbQuery('SELECT * FROM products WHERE status = 1 ORDER BY code')
    products.value = result.map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      specification: p.spec || p.specification || '',
      unit: p.unit || '',
      costPrice: p.costPrice || 0
    }))
  } catch (error) {
    console.error('加载商品列表失败:', error)
    products.value = []
  }
}

// 加载客户列表
const loadCustomers = async () => {
  try {
    const result = await dbQuery('SELECT * FROM customers WHERE status = 1 ORDER BY name')
    customers.value = result
  } catch (error) {
    console.error('加载客户列表失败:', error)
    customers.value = []
  }
}

// 加载仓库列表
const loadWarehouses = async () => {
  try {
    const result = await dbQuery('SELECT * FROM warehouses WHERE status = 1 ORDER BY name')
    warehouses.value = result
  } catch (error) {
    console.error('加载仓库列表失败:', error)
    warehouses.value = []
  }
}

// 加载系统用户（用于经办人下拉）
const loadUsers = async () => {
  try {
    const result = await dbQuery("SELECT * FROM employees WHERE status = 'active' OR status = 1 ORDER BY name")
    users.value = result.map((e: any) => ({
      id: e.id,
      name: e.name
    }))
  } catch (error) {
    console.error('加载员工列表失败:', error)
    users.value = []
  }
}

const handleAdd = async () => {
  resetForm()
  await loadOrderList() // 加载出库单列表
  dialogTitle.value = '新增退货单'
  isViewMode.value = false
  
  // 确保用户列表已加载
  if (users.value.length === 0) {
    await loadUsers()
  }
  
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

const handleEdit = async (row: ReturnRecord) => {
  console.log('[handleEdit] 开始编辑，row:', row)
  // 先加载最新的出库单列表
  await loadOrderList()
  console.log('[handleEdit] 出库单列表加载完成:', orderList.value.length, '条')
  Object.assign(formData, row)
  console.log('[handleEdit] formData 赋值完成:', formData.voucherNo)

  // 如果有原订单号，先从原订单加载所有商品，再填充已保存的数量
  if (formData.originalOrderNo) {
    const order = orderList.value.find(item => item.voucherNo === formData.originalOrderNo)
    if (order) {
      // 先从原订单加载所有商品（优先使用含税单价计算）
      formData.items = order.items.map((item: any, index: number) => {
        // 优先从原出库单提取含税单价，然后计算不含税单价
        const unitPriceIncl = item.unitPrice || 0      // 含税单价（出库单字段）
        const taxRate = item.taxRate !== undefined ? item.taxRate : 13
        const r = taxRate / 100
        const unitPriceEx = taxRate === 0 ? unitPriceIncl : round2(unitPriceIncl / (1 + r))  // 计算不含税单价

        return {
          productId: item.productId,
          productName: item.productName || '',
          specification: item.specification || '',
          quantity: 0,
          unit: item.unit || '',
          unitPrice: unitPriceEx,        // 不含税单价（退货单字段）
          unitPriceEx: unitPriceEx,
          unitPriceIncl: unitPriceIncl,  // 含税单价（退货单字段）
          taxRate: taxRate,
          taxAmount: 0,
          totalAmount: 0,
          deductionAmount: item.deductionAmount || 0,
          allowDeduction: item.allowDeduction || false,
          originalQuantity: item.quantity,  // 保存原订单中的数量
          originalItemIndex: index          // 保存原订单中的索引
        }
      })

      // 然后根据已保存的数据填充数量（通过原索引匹配）
      const savedItems = row.items || []
      savedItems.forEach(savedItem => {
        const origIndex = savedItem.originalItemIndex
        if (origIndex !== undefined && origIndex >= 0 && origIndex < formData.items.length) {
          const matchedItem = formData.items[origIndex]
          if (matchedItem && matchedItem.productId === savedItem.productId) {
            matchedItem.quantity = savedItem.quantity
            calculateRowTotalss(matchedItem)
          }
        }
      })
    }
  } else {
    // 没有原订单，直接加载保存的商品
    formData.items = JSON.parse(JSON.stringify(row.items))
  }

  // 确保客户和仓库名称正确显示
  if (formData.customerId) {
    const customer = customers.value.find(c => c.id === formData.customerId)
    if (customer) {
      formData.customerName = customer.name
    }
  }
  if (formData.warehouseId) {
    const warehouse = warehouses.value.find(w => w.id === formData.warehouseId)
    if (warehouse) {
      formData.warehouseName = warehouse.name
    }
  }

  // 重新计算总金额
  updateFormTotals()

  dialogTitle.value = '编辑退货单'
  isViewMode.value = false
  dialogVisible.value = true
}

const handleView = async (row: ReturnRecord) => {
  console.log('[handleView] 开始查看，row:', row)
  // 先加载最新的出库单列表
  await loadOrderList()
  console.log('[handleView] 出库单列表加载完成:', orderList.value.length, '条')
  Object.assign(formData, row)
  console.log('[handleView] formData 赋值完成:', formData.voucherNo)

  // 如果有原订单号，先从原订单加载所有商品，再填充已保存的数量
  if (formData.originalOrderNo) {
    const order = orderList.value.find(item => item.voucherNo === formData.originalOrderNo)
    if (order) {
      // 先从原订单加载所有商品（优先使用含税单价计算）
      formData.items = order.items.map((item: any, index: number) => {
        // 优先从原出库单提取含税单价，然后计算不含税单价
        const unitPriceIncl = item.unitPrice || 0      // 含税单价（出库单字段）
        const taxRate = item.taxRate !== undefined ? item.taxRate : 13
        const r = taxRate / 100
        const unitPriceEx = taxRate === 0 ? unitPriceIncl : round2(unitPriceIncl / (1 + r))  // 计算不含税单价

        return {
          productId: item.productId,
          productName: item.productName || '',
          specification: item.specification || '',
          quantity: 0,
          unit: item.unit || '',
          unitPrice: unitPriceEx,        // 不含税单价（退货单字段）
          unitPriceEx: unitPriceEx,
          unitPriceIncl: unitPriceIncl,  // 含税单价（退货单字段）
          taxRate: taxRate,
          taxAmount: 0,
          totalAmount: 0,
          deductionAmount: item.deductionAmount || 0,
          allowDeduction: item.allowDeduction || false,
          originalQuantity: item.quantity,  // 保存原订单中的数量
          originalItemIndex: index          // 保存原订单中的索引
        }
      })

      // 然后根据已保存的数据填充数量（通过原索引匹配）
      const savedItems = row.items || []
      savedItems.forEach(savedItem => {
        const origIndex = savedItem.originalItemIndex
        if (origIndex !== undefined && origIndex >= 0 && origIndex < formData.items.length) {
          const matchedItem = formData.items[origIndex]
          if (matchedItem && matchedItem.productId === savedItem.productId) {
            matchedItem.quantity = savedItem.quantity
            calculateRowTotalss(matchedItem)
          }
        }
      })
    }
  } else {
    // 没有原订单，直接加载保存的商品
    formData.items = JSON.parse(JSON.stringify(row.items))
  }

  // 确保客户和仓库名称正确显示
  if (formData.customerId) {
    const customer = customers.value.find(c => c.id === formData.customerId)
    if (customer) {
      formData.customerName = customer.name
    }
  }
  if (formData.warehouseId) {
    const warehouse = warehouses.value.find(w => w.id === formData.warehouseId)
    if (warehouse) {
      formData.warehouseName = warehouse.name
    }
  }

  // 重新计算总金额
  updateFormTotals()

  dialogTitle.value = '查看退货单'
  isViewMode.value = true
  dialogVisible.value = true
}

const handleDelete = async (row: ReturnRecord) => {
  try {
    await ElMessageBox.confirm(`确定要删除退货单 ${row.voucherNo} 吗？`, '警告', {
      type: 'warning'
    })

    const electron = (window as any).electron
    if (electron) {
      console.log('开始删除销售退货单，ID:', row.id)
      await electron.salesReturnDelete(row.id)
      console.log('删除成功')
      ElMessage.success('删除成功')
      loadReturnsList()
    } else {
      console.error('未找到 electron API')
      ElMessage.error('未找到 electron API')
    }
  } catch (error: any) {
    console.error('删除失败，错误:', error)
    if (error !== 'cancel') {
      ElMessage.error('删除失败：' + (error.message || '未知错误'))
    }
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

    // 如果有原订单，校验退货数量
    if (formData.originalOrderNo) {
      const isValid = await validateReturnQuantities()
      if (!isValid) {
        return
      }
    }

    // 计算总金额
    formData.totalAmount = formData.items.reduce((sum, item) => sum + item.amount, 0)
    formData.totalInc = formData.items.reduce((sum, item) => sum + (item.totalInc || 0), 0)

    // 生成凭证号（如果是新增）
    if (!formData.id) {
      formData.voucherNo = generateVoucherNo()
    }

    const electron = (window as any).electron
    if (electron) {
      // 转换数据格式
      const dbData = {
        return_no: formData.voucherNo,
        original_order_no: formData.originalOrderNo,
        customer_id: formData.customerId,
        warehouse_id: formData.warehouseId,
        handler_id: formData.handlerId,
        handler_name: formData.handlerName,
        return_date: formData.voucherDate,
        total_amount: formData.totalAmount,
        total_inc: formData.totalInc || 0,
        return_reason: formData.returnReason,
        remark: formData.remark,
        items: formData.items
          .filter((item: any) => item.quantity > 0) // 只保存数量>0 的商品
          .map((item: any) => {
            console.log('[销售退货保存前] item.unitPrice:', item.unitPrice, 'unitPriceIncl:', item.unitPriceIncl, 'totalInc:', item.totalInc, 'taxRate:', item.taxRate)
            return {
              product_id: item.productId,
              product_name: item.productName || '',
              specification: item.specification || '',
              unit: item.unit || '',
              quantity: item.quantity,
              original_quantity: item.originalQuantity || 0,  // 保存原出库数量
              unit_price: item.unitPrice || 0,           // 不含税单价
              unit_price_incl: item.unitPriceIncl || 0,  // 含税单价
              tax_rate: item.taxRate || 0,               // 税率
              tax_amount: item.taxAmount || 0,           // 税额
              total_inc: item.totalInc || 0,             // 含税金额
              amount: item.amount || 0,                  // 不含税金额
              cost_price: item.costPrice || 0,           // 成本价
              remark: item.remark || '',
              original_item_index: item.originalItemIndex // 保存原订单中的索引，用于重新加载时匹配
            }
          })
      }

      const resultId = formData.id ?
        await electron.salesReturnUpdate({...dbData, id: formData.id}) :
        await electron.salesReturnAdd(dbData)

      // 保存成功后，如果是新增，更新 formData 的 voucherNo（虽然对话框已关闭，但为了后续操作）
      if (!formData.id) {
        // 单号已在 dbData 中设置
        console.log('新增退货单成功，单号:', formData.voucherNo)
      }

      ElMessage.success('保存成功')

      dialogVisible.value = false
      resetForm()  // 重置表单，清空 id 和其他数据
      await loadReturnsList()
    }
  } catch (error: any) {
    if (error.validate) {
      ElMessage.error('请完善表单信息')
    } else {
      ElMessage.error('保存失败：' + (error.message || '未知错误'))
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

    // 处理相同商品多行的情况：使用 productMatchCount 计数器
    const productMatchCount = new Map<number, number>()

    formData.items = order.items.map((item: any, index: number) => {
      const productId = item.productId
      const count = productMatchCount.get(productId) || 0
      productMatchCount.set(productId, count + 1)

      // 优先从原出库单提取含税单价，然后计算不含税单价
      const unitPriceIncl = item.unitPrice || 0      // 含税单价（出库单字段）
      const taxRate = item.taxRate !== undefined ? item.taxRate : 13
      const r = taxRate / 100
      const unitPriceEx = taxRate === 0 ? unitPriceIncl : round2(unitPriceIncl / (1 + r))  // 计算不含税单价

      return {
        productId: item.productId,
        productName: item.productName || '',
        specification: item.specification || '',
        quantity: 0,
        unit: item.unit || '',
        unitPrice: unitPriceEx,        // 不含税单价（退货单字段）
        unitPriceEx: unitPriceEx,
        unitPriceIncl: unitPriceIncl,  // 含税单价（退货单字段）
        taxRate: taxRate,
        taxAmount: 0,
        totalAmount: 0,
        deductionAmount: item.deductionAmount || 0,
        allowDeduction: item.allowDeduction || false,
        originalQuantity: item.quantity,  // 显示原订单中的数量
        originalItemIndex: index          // 保存原订单中的索引，用于匹配数量
      }
    })
    
    // 同步更新仓库信息
    if (order.warehouseId) {
      formData.warehouseId = order.warehouseId
      formData.warehouseName = order.warehouseName || ''
    }

    // 计算总金额
    updateFormTotals()
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
      calculateRowTotalss(row)
    }
  }
}

// 更新表单合计
const updateFormTotals = () => {
  formData.totalAmount = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0)
  formData.totalInc = formData.items.reduce((sum, item) => sum + (item.totalInc || 0), 0)
}

const calculateRowTotalss = (row: ReturnItem) => {
  const qty = row.quantity || 0
  const taxRate = row.taxRate || 0
  const r = taxRate / 100

  // 优先使用含税单价计算（如果存在）
  if (row.unitPriceIncl && row.unitPriceIncl > 0) {
    const unitPriceIncl = row.unitPriceIncl
    row.totalInc = round2(unitPriceIncl * qty)  // 含税金额 = 含税单价 × 数量
    row.amount = taxRate === 0 ? row.totalInc : round2(row.totalInc / (1 + r))  // 不含税金额 = 含税金额 / (1+ 税率)
    row.unitPrice = taxRate === 0 ? round2(row.totalInc / qty) : round2(row.amount / qty)  // 不含税单价 = 不含税金额 / 数量
    row.taxAmount = round2(row.totalInc - row.amount)  // 税额 = 含税金额 - 不含税金额
  } else {
    // 否则使用不含税单价计算
    const price = row.unitPrice || 0
    row.amount = round2(qty * price)
    row.taxAmount = round2(row.amount * r)
    row.totalInc = round2(row.amount + row.taxAmount)
    row.unitPriceIncl = taxRate === 0 ? price : round2(price * (1 + r))
  }

  updateFormTotals()
}

// 处理数量输入框聚焦事件，清空 0 值方便直接输入
const handleQuantityFocus = (row: ReturnItem) => {
  if (row.quantity === 0 || row.quantity === null || row.quantity === undefined) {
    row.quantity = '' as any
  }
}

// 获取商品历史退货数量（针对同一原订单的多次退货）
const getHistoricalReturnQty = async (productId: number, originalOrderNo: string, currentReturnId?: number): Promise<number> => {
  try {
    const electron = (window as any).electron
    if (!electron || !electron.salesReturnList) return 0
    const result = await electron.salesReturnList(1, 1000)
    const allReturns = result.data || []
    const relatedReturns = allReturns.filter((r: any) => {
      return r.original_order_no === originalOrderNo && (!currentReturnId || r.id !== currentReturnId)
    })
    let totalReturnQty = 0
    relatedReturns.forEach((ret: any) => {
      if (ret.items) {
        ret.items.forEach((item: any) => {
          if (item.productId === productId) {
            totalReturnQty += (item.quantity || 0)
          }
        })
      }
    })
    return totalReturnQty
  } catch (error) {
    console.error('获取历史退货数量失败:', error)
    return 0
  }
}

// 校验单个退货商品（验证是否在原订单中，且数量不超过可退货数量）
const validateSingleReturnItem = async (item: ReturnItem): Promise<boolean> => {
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
  // 优先使用 item.originalQuantity 处理同一商品多行情况
  const originalQty = item.originalQuantity ?? origItem.quantity
  const retQty = Math.abs(item.quantity)
  if (retQty > originalQty) {
    ElMessage.error(`商品"${item.productName}"的退货数量(${retQty})不能超过原出库单数量(${originalQty})`)
    return false
  }
  
  return true
}

// 校验退货单是否超过可退货数量（在保存前调用）
const validateReturnQuantities = async (): Promise<boolean> => {
  if (!formData.originalOrderNo || !formData.items || formData.items.length === 0) {
    return true
  }

  // 获取所有退货单数据
  const electron = (window as any).electron
  if (!electron || !electron.salesReturnList) return true
  const result = await electron.salesReturnList(1, 1000)
  const allReturns = result.data || []

  // 筛选出与原订单相关的退货单（排除当前正在编辑的退货单）
  const relatedReturns = allReturns.filter((r: any) => {
    return r.original_order_no === formData.originalOrderNo && (!formData.id || r.id !== formData.id)
  })

  // 统计每个商品的历史退货数量（不包含当前编辑的退货单）
  const historicalQtyMap = new Map<number, number>()
  relatedReturns.forEach((ret: any) => {
    if (ret.items) {
      ret.items.forEach((item: any) => {
        const productId = item.productId || item.product_id
        const qty = item.quantity || 0
        historicalQtyMap.set(productId, (historicalQtyMap.get(productId) || 0) + qty)
      })
    }
  })

  // 获取原订单，计算每个商品在原订单中的总数量
  const originalOrder = orderList.value.find(item => item.voucherNo === formData.originalOrderNo)
  if (!originalOrder) {
    return true
  }

  // 统计原订单中每个商品的总数量（处理同一商品多行的情况）
  const originalProductQty = new Map<number, number>()
  originalOrder.items.forEach((item: any) => {
    if (item.productId) {
      originalProductQty.set(item.productId, (originalProductQty.get(item.productId) || 0) + (item.quantity || 0))
    }
  })

  // 统计当前退货单中每个商品的总退货数量
  const currentReturnByProduct = new Map<number, { qty: number, name: string }>()
  formData.items.forEach((item: any) => {
    if (item.productId && (item.quantity || 0) > 0) {
      const existing = currentReturnByProduct.get(item.productId)
      if (existing) {
        existing.qty += (item.quantity || 0)
      } else {
        currentReturnByProduct.set(item.productId, {
          qty: item.quantity || 0,
          name: item.productName || ''
        })
      }
    }
  })

  // 按商品汇总校验
  for (const [productId, productInfo] of currentReturnByProduct.entries()) {
    const historicalQty = historicalQtyMap.get(productId) || 0
    const currentQty = productInfo.qty
    const originalTotalQty = originalProductQty.get(productId) || 0
    const totalReturnedQty = historicalQty + currentQty

    if (totalReturnedQty > originalTotalQty) {
      ElMessage.error(`商品"${productInfo.name}"累计退货数量 (${totalReturnedQty}) 超过原出库单中该商品总数量 (${originalTotalQty})。历史已退货：${historicalQty}，本次退货：${currentQty}`)
      return false
    }
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
    quantity: '' as any,
    unitPrice: '' as any,
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
  if (value === 0 || value === '0' || value === null || value === undefined) {
    row[field] = undefined
  }
}

const resetForm = () => {
  Object.assign(formData, {
    id: undefined,  // 重要：清空 id，确保下次是新增模式
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
    totalInc: 0,
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
  // 不预加载出库单列表，等待用户打开编辑/新增对话框时再加载
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
