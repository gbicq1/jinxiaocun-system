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
          placeholder="搜索凭证号/产品编码/供应商"
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
        <el-table-column prop="supplierName" label="供应商" min-width="120" />
        <el-table-column prop="warehouseName" label="仓库" width="120">
          <template #default="{ row }">
            {{ row.warehouseName || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="originalVoucherNo" label="原入库单号" width="150" />
        <el-table-column prop="itemCount" label="商品行数" width="80">
          <template #default="{ row }">
            {{ row.items?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="退货金额" width="120">
          <template #default="{ row }">
            -¥{{ Math.abs(row.totalAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="经办人" width="100" />
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
          title="采购退货单 - 冲减入库数据"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 20px"
        >
          <template #default>
            <div>
              退货单将冲减对应商品的库存数量，并生成负向入库记录
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
            <el-form-item label="原入库单号" prop="originalVoucherNo">
              <el-select
                v-model="formData.originalVoucherNo"
                placeholder="选择原入库单"
                style="width: 100%"
                clearable
                @change="handleOriginalVoucherChange"
              >
                <el-option
                  v-for="(item, index) in inboundList"
                  :key="item.id || item.voucherNo || index"
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
            <el-form-item label="供应商" prop="supplierId">
              <el-select
                v-model="formData.supplierId"
                placeholder="选择供应商"
                style="width: 100%"
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
            <el-form-item label="供应商名称">
              <el-input v-model="formData.supplierName" readonly />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="经办人" prop="operator">
              <el-select v-model="formData.operator" placeholder="选择经办人" filterable>
                <el-option
                  v-for="u in users"
                  :key="u.id"
                  :label="u.name"
                  :value="u.name"
                >
                  <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span>{{ u.name }}</span>
                    <el-switch
                      :model-value="defaultOperator === u.name"
                      :active-value="true"
                      :inactive-value="false"
                      inline-prompt
                      active-text="默认"
                      inactive-text=""
                      style="--el-switch-width: 60px; --el-switch-inactive-color: #dcdfe6;"
                      :disabled="isViewMode"
                      @click.stop
                      @change="(val: boolean) => saveDefaultOperator(u.id, u.name)"
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
              选择原入库单后自动加载商品，或直接添加退货商品
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
                placeholder="请选择商品"
                style="width: 100%"
                filterable
                @change="handleProductChange(row)"
              >
                <el-option
                  v-for="product in availableProducts"
                  :key="product.id"
                  :label="`${product.code} - ${product.name}`"
                  :value="product.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="商品名称" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.productName" disabled />
            </template>
          </el-table-column>
          <el-table-column label="规格" width="120">
            <template #default="{ row }">
              <el-input v-model="row.specification" disabled />
            </template>
          </el-table-column>
          <el-table-column label="数量" width="100">
            <template #default="{ row }">
              <el-input-number
                v-model="row.quantity"
                :min="0"
                :precision="2"
                :controls="false"
                style="width: 100%"
                @focus="handleFocus(row, 'quantity')"
                @change="onQuantityChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="原入库数量" width="100">
            <template #default="{ row }">
              <el-input
                v-model="row.originalQuantity"
                disabled
                style="color: #909399"
              />
            </template>
          </el-table-column>
          <el-table-column label="单位" width="80">
            <template #default="{ row }">
              <el-input v-model="row.unit" disabled />
            </template>
          </el-table-column>
          <el-table-column label="单价（不含税）" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.unitPriceEx"
                :min="0"
                :precision="2"
                :step="0.01"
                :controls="false"
                style="width: 100%"
                @focus="handleFocus(row, 'unitPriceEx')"
                @change="onUnitPriceExChange(row)"
              />
            </template>
          </el-table-column>

          <el-table-column label="单价 (含税)" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.unitPrice"
                :min="0"
                :precision="2"
                :step="0.01"
                :controls="false"
                :step-strictly="false"
                style="width: 100%"
                @focus="handleFocus(row, 'unitPrice')"
                @change="onUnitPriceInclChange(row)"
              />
            </template>
          </el-table-column>

          <el-table-column label="税率 (%)" width="120">
            <template #default="{ row }">
              <el-select v-model="row.taxRate" filterable allow-create placeholder="选择或输入税率" style="width: 100%" @change="onTaxRateChange(row)">
                <el-option label="免税" :value="'免税'" />
                <el-option label="1%" :value="1" />
                <el-option label="3%" :value="3" />
                <el-option label="5%" :value="5" />
                <el-option label="6%" :value="6" />
                <el-option label="9%" :value="9" />
                <el-option label="13%" :value="13" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="税额" width="100">
            <template #default="{ row }">
              <el-input v-model="row.taxAmount" disabled />
            </template>
          </el-table-column>
          <el-table-column label="金额" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.totalAmount" :min="0" :precision="2" :controls="false" style="width: 100%" @focus="handleFocus(row, 'totalAmount')" @change="onAmountChange(row)" />
            </template>
          </el-table-column>
          <el-table-column label="加计扣除" width="120">
            <template #default="{ row }">
              <el-switch
                v-model="row.allowDeduction"
                :disabled="row.taxRate !== '免税'"
                active-color="#13ce66"
                inactive-color="#909399"
                @change="onDeductionSwitchChange(row)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ $index }">
              <el-button type="danger" size="small" @click="removeItem($index)">
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

        <!-- 发票状态 -->
        <el-row :gutter="20" style="background: #f5f7fa; padding: 15px; border-radius: 4px; margin-bottom: 20px">
          <el-col :span="12">
            <div style="display: flex; align-items: center">
              <span style="font-weight: 500; margin-right: 10px">发票状态：</span>
              <el-switch
                v-model="formData.invoiceIssued"
                @change="handleInvoiceIssuedChange"
                active-text="已开票"
                inactive-text="未开票"
                active-color="#13ce66"
                inactive-color="#ff4949"
              />
              <span v-if="formData.invoiceIssued" style="margin-left: 20px">
                发票类型：
                <el-select
                  v-model="formData.invoiceType"
                  placeholder="选择发票类型"
                  size="small"
                  style="width: 120px"
                  @change="handleInvoiceTypeChange"
                >
                  <el-option label="普票" value="普票" />
                  <el-option label="专票" value="专票" />
                </el-select>
              </span>
            </div>
          </el-col>
        </el-row>

        <!-- 合计信息 -->
        <el-descriptions
          :column="2"
          border
          style="margin-top: 20px"
        >
          <el-descriptions-item label="退货总金额">
            -¥{{ Math.abs(formData.totalAmount).toFixed(2) }}
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
import { getStockBeforeDateTime } from '@/utils/stock'
import { handleDocumentSave, DocumentType } from '@/utils/cost-recalculation'
import { dbQuery } from '@/utils/db'
import { db } from '@/utils/db-ipc'

// 类型定义
interface ReturnItem {
  productId?: number
  productName: string
  specification: string
  quantity: number
  unit: string
  unitPrice: number
  unitPriceEx?: number
  taxRate: number | string
  taxAmount: number
  totalAmount: number
  deductionAmount?: number
  allowDeduction?: boolean
  _lastEdited?: 'unitEx' | 'unitIncl' | 'amount'
}

interface ReturnRecord {
  id?: number
  voucherNo: string
  voucherDate: string
  originalVoucherNo?: string
  supplierId?: number
  supplierName: string
  warehouseId?: number
  warehouseName?: string
  operator: string
  returnReason?: string
  items: ReturnItem[]
  totalAmount: number
  remark?: string
  createdAt?: string
  invoiceIssued?: boolean
  invoiceType?: string
}

interface Product {
  id: number
  code: string
  name: string
  specification?: string
  unit?: string
  costPrice?: number
  status?: number | boolean
}

interface Supplier {
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

interface InboundRecord {
  id?: number
  voucherNo: string
  voucherDate: string
  supplierId?: number
  supplierName: string
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
const inboundList = ref<InboundRecord[]>([])
const products = ref<Product[]>([])
const suppliers = ref<Supplier[]>([])
const warehouses = ref<Warehouse[]>([])
const selectedRows = ref<ReturnRecord[]>([])

// 默认经办人 ID
const defaultHandlerId = ref<number | undefined>(undefined)
const defaultOperator = ref<string | undefined>(undefined)
// 默认仓库 ID
const defaultWarehouseId = ref<number | undefined>(undefined)

// 计算属性：可选择的商品列表（如果选择了原入库单，只显示原入库单中的商品）
const availableProducts = computed(() => {
  if (!formData.originalVoucherNo) {
    return products.value
  }
  
  // 找到原入库单
  const originalOrder = inboundList.value.find(ib => ib.voucherNo === formData.originalVoucherNo)
  if (!originalOrder || !originalOrder.items) {
    return products.value
  }
  
  // 只返回原入库单中存在的商品
  return products.value.filter(p => 
    originalOrder.items.some((item: any) => item.productId === p.id)
  )
})

// 表单数据
const formRef = ref()
const formData = reactive<ReturnRecord>({
  voucherNo: '',
  voucherDate: dayjs().format('YYYY-MM-DD'),
  originalVoucherNo: '',
  supplierId: undefined,
  supplierName: '',
  warehouseId: undefined,
  warehouseName: '',
  operator: '',
  returnReason: '',
  items: [],
  totalAmount: 0,
  remark: '',
  invoiceIssued: false,
  invoiceType: '普票'
})

const rules = {
  voucherDate: [{ required: true, message: '请选择退货日期', trigger: 'change' }],
  supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  operator: [{ required: true, message: '请输入经办人', trigger: 'blur' }],
  returnReason: [{ required: true, message: '请输入退货原因', trigger: 'blur' }]
}

// 加载退货单列表
const loadReturnsList = async () => {
  try {
    const result = await db.getPurchaseReturns(currentPage.value, pageSize.value)
    // 获取供应商和仓库的映射
    const supplierMap = new Map(suppliers.value.map(s => [s.id, s.name]))
    const warehouseMap = new Map(warehouses.value.map(w => [w.id, w.name]))

    returnsList.value = result.data.map((item: any) => ({
      ...item,
      voucherNo: item.return_no,
      voucherDate: item.return_date,
      originalVoucherNo: item.original_inbound_no,
      supplierId: item.supplier_id,
      supplierName: supplierMap.get(item.supplier_id) || '',
      warehouseId: item.warehouse_id,
      warehouseName: warehouseMap.get(item.warehouse_id) || '',
      totalAmount: item.total_amount,
      returnReason: item.return_reason,
      invoiceIssued: item.invoice_issued === 1,
      invoiceType: item.invoice_type || '普票'
    }))
    total.value = result.total
  } catch (error) {
    console.error('加载退货单列表失败:', error)
    ElMessage.error('加载退货单列表失败')
  }
}

// 加载入库单列表（用于选择原入库单）
const loadInboundList = async () => {
  try {
    const result = await db.getInboundList(1, 1000)
    inboundList.value = result.data || []
    console.log('成功从数据库加载入库单列表，共', inboundList.value.length, '条记录')
  } catch (error) {
    console.error('加载入库单列表失败:', error)
    inboundList.value = []
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

// 加载供应商列表
const loadSuppliers = async () => {
  try {
    const result = await dbQuery('SELECT * FROM suppliers WHERE status = 1 ORDER BY name')
    suppliers.value = result
  } catch (error) {
    console.error('加载供应商列表失败:', error)
    suppliers.value = []
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
const users = ref<any[]>([])
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

// 加载当前用户和默认值
const loadCurrentUser = () => {
  const user = localStorage.getItem('currentUser')
  if (user) {
    const userData = JSON.parse(user)
    formData.operator = userData.name || '管理员'
  }
  
  // 加载默认经办人
  const savedOperatorId = localStorage.getItem('defaultHandlerId')
  const savedOperatorName = localStorage.getItem('defaultOperator')
  if (savedOperatorId && savedOperatorName) {
    defaultHandlerId.value = Number(savedOperatorId)
    defaultOperator.value = savedOperatorName
  }
  
  // 加载默认仓库
  const savedWarehouseId = localStorage.getItem('defaultWarehouseId')
  if (savedWarehouseId) {
    defaultWarehouseId.value = Number(savedWarehouseId)
  }
}

// 新增
const handleAdd = () => {
  resetForm()
  loadInboundList() // 加载入库单列表
  dialogTitle.value = '新增退货单'
  isViewMode.value = false
  
  // 设置默认经办人
  if (defaultHandlerId.value) {
    formData.operator = users.value.find(u => u.id === defaultHandlerId.value)?.name || ''
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

// 编辑
const handleEdit = async (row: ReturnRecord) => {
  loadInboundList() // 加载入库单列表
  
  // 先加载主表数据，包括发票状态（但不包含 items）
  const { items, ...mainData } = row as any
  Object.assign(formData, mainData)
  // 确保发票状态字段正确加载
  formData.invoiceIssued = row.invoiceIssued === true || row.invoiceIssued === 1 || row.invoiceIssued === '1'
  formData.invoiceType = row.invoiceType || '普票'

  // 如果有原入库单号，先从原入库单加载所有商品，再填充已保存的数量
  if (formData.originalVoucherNo) {
    const inbound = inboundList.value.find(item => item.voucherNo === formData.originalVoucherNo)
    if (inbound) {
      // 先从原入库单加载所有商品
      const tempItems = inbound.items.map((item: any, index: number) => ({
        productId: item.productId,
        productName: item.productName,
        specification: item.specification,
        quantity: 0,
        unit: item.unit,
        unitPrice: item.unitPrice || 0,
        unitPriceEx: item.unitPriceEx || 0,
        taxRate: item.taxRate !== undefined ? item.taxRate : '免税',
        taxAmount: 0,
        totalAmount: 0,
        deductionAmount: item.deductionAmount || 0,
        allowDeduction: item.allowDeduction || false,
        originalQuantity: item.quantity,  // 保存原入库单中的数量
        originalItemIndex: index,         // 保存原入库单中的索引
        _lastEdited: 'unitIncl'
      }))

      // 然后根据已保存的数据填充数量和其他信息（通过原索引匹配）
      const savedItems = row.items || []
      console.log('【前端调试】已保存的退货明细数据:', savedItems)
      savedItems.forEach(savedItem => {
        const origIndex = savedItem.original_item_index
        console.log('【前端调试】尝试匹配:', { origIndex, productId: savedItem.product_id || savedItem.productId, quantity: savedItem.quantity })
        if (origIndex !== undefined && origIndex >= 0 && origIndex < tempItems.length) {
          const matchedItem = tempItems[origIndex]
          console.log('【前端调试】匹配到的原入库单商品:', matchedItem)
          if (matchedItem && matchedItem.productId === (savedItem.product_id || savedItem.productId)) {
            matchedItem.quantity = savedItem.quantity || 0
            // 填充价格信息
            matchedItem.unitPrice = savedItem.unit_price || savedItem.unitPrice || 0
            matchedItem.unitPriceEx = savedItem.unit_price_ex || savedItem.unitPriceEx || 0
            matchedItem.taxRate = savedItem.tax_rate !== undefined ? savedItem.tax_rate : (savedItem.taxRate || '免税')
            matchedItem.taxAmount = savedItem.tax_amount || savedItem.taxAmount || 0
            matchedItem.totalAmount = savedItem.total_amount || savedItem.totalAmount || 0
            matchedItem.deductionAmount = savedItem.deductionAmount || 0
            matchedItem.allowDeduction = savedItem.allowDeduction || false
            console.log('【前端调试】填充后的商品数据:', matchedItem)
            // 重新计算
            calculateRowTotal(matchedItem)
          }
        }
      })
      
      // 最后一次性赋值给 formData.items，确保触发响应式更新
      formData.items = tempItems
    }
  } else {
    // 没有原入库单，直接加载保存的商品，需要转换字段名
    formData.items = (row.items || []).map((item: any) => ({
      productId: item.product_id || item.productId,
      productName: item.product_name || item.productName || '',
      specification: item.specification || '',
      quantity: item.quantity || 0,
      unit: item.unit || '',
      unitPrice: item.unit_price || item.unitPrice || 0,
      unitPriceEx: item.unit_price_ex || item.unitPriceEx || 0,
      taxRate: item.tax_rate !== undefined ? item.tax_rate : (item.taxRate || '免税'),
      taxAmount: item.tax_amount || item.taxAmount || 0,
      totalAmount: item.total_amount || item.totalAmount || 0,
      deductionAmount: item.deductionAmount || 0,
      allowDeduction: item.allowDeduction || false,
      _lastEdited: 'unitIncl'
    }))
  }
  
  // 确保供应商和仓库名称正确显示
  if (formData.supplierId) {
    const supplier = suppliers.value.find(s => s.id === formData.supplierId)
    if (supplier) {
      formData.supplierName = supplier.name
    }
  }
  if (formData.warehouseId) {
    const warehouse = warehouses.value.find(w => w.id === formData.warehouseId)
    if (warehouse) {
      formData.warehouseName = warehouse.name
    }
  }

  // 重新计算总金额
  calculateTotalAmount()

  dialogTitle.value = '编辑退货单'
  isViewMode.value = false
  dialogVisible.value = true
}

// 查看
const handleView = async (row: ReturnRecord) => {
  // 先加载主表数据，包括发票状态（但不包含 items）
  const { items, ...mainData } = row as any
  Object.assign(formData, mainData)
  // 确保发票状态字段正确加载
  formData.invoiceIssued = row.invoiceIssued === true || row.invoiceIssued === 1 || row.invoiceIssued === '1'
  formData.invoiceType = row.invoiceType || '普票'

  // 如果有原入库单号，先从原入库单加载所有商品，再填充已保存的数量
  if (formData.originalVoucherNo) {
    const inbound = inboundList.value.find(item => item.voucherNo === formData.originalVoucherNo)
    if (inbound) {
      // 先从原入库单加载所有商品
      const tempItems = inbound.items.map((item: any, index: number) => ({
        productId: item.productId,
        productName: item.productName,
        specification: item.specification,
        quantity: 0,
        unit: item.unit,
        unitPrice: item.unitPrice || 0,
        unitPriceEx: item.unitPriceEx || 0,
        taxRate: item.taxRate !== undefined ? item.taxRate : '免税',
        taxAmount: 0,
        totalAmount: 0,
        deductionAmount: item.deductionAmount || 0,
        allowDeduction: item.allowDeduction || false,
        originalQuantity: item.quantity,  // 保存原入库单中的数量
        originalItemIndex: index,         // 保存原入库单中的索引
        _lastEdited: 'unitIncl'
      }))

      // 然后根据已保存的数据填充数量和其他信息（通过原索引匹配）
      const savedItems = row.items || []
      console.log('【前端调试 - 查看】已保存的退货明细数据:', savedItems)
      savedItems.forEach(savedItem => {
        const origIndex = savedItem.original_item_index
        console.log('【前端调试 - 查看】尝试匹配:', { origIndex, productId: savedItem.product_id || savedItem.productId, quantity: savedItem.quantity })
        if (origIndex !== undefined && origIndex >= 0 && origIndex < tempItems.length) {
          const matchedItem = tempItems[origIndex]
          console.log('【前端调试 - 查看】匹配到的原入库单商品:', matchedItem)
          if (matchedItem && matchedItem.productId === (savedItem.product_id || savedItem.productId)) {
            matchedItem.quantity = savedItem.quantity || 0
            // 填充价格信息
            matchedItem.unitPrice = savedItem.unit_price || savedItem.unitPrice || 0
            matchedItem.unitPriceEx = savedItem.unit_price_ex || savedItem.unitPriceEx || 0
            matchedItem.taxRate = savedItem.tax_rate !== undefined ? savedItem.tax_rate : (savedItem.taxRate || '免税')
            matchedItem.taxAmount = savedItem.tax_amount || savedItem.taxAmount || 0
            matchedItem.totalAmount = savedItem.total_amount || savedItem.totalAmount || 0
            matchedItem.deductionAmount = savedItem.deductionAmount || 0
            matchedItem.allowDeduction = savedItem.allowDeduction || false
            console.log('【前端调试 - 查看】填充后的商品数据:', matchedItem)
            // 重新计算
            calculateRowTotal(matchedItem)
          }
        }
      })
      
      // 最后一次性赋值给 formData.items，确保触发响应式更新
      formData.items = tempItems
    }
  } else {
    // 没有原入库单，直接加载保存的商品，需要转换字段名
    formData.items = (row.items || []).map((item: any) => ({
      productId: item.product_id || item.productId,
      productName: item.product_name || item.productName || '',
      specification: item.specification || '',
      quantity: item.quantity || 0,
      unit: item.unit || '',
      unitPrice: item.unit_price || item.unitPrice || 0,
      unitPriceEx: item.unit_price_ex || item.unitPriceEx || 0,
      taxRate: item.tax_rate !== undefined ? item.tax_rate : (item.taxRate || '免税'),
      taxAmount: item.tax_amount || item.taxAmount || 0,
      totalAmount: item.total_amount || item.totalAmount || 0,
      deductionAmount: item.deductionAmount || 0,
      allowDeduction: item.allowDeduction || false,
      _lastEdited: 'unitIncl'
    }))
  }

  // 确保供应商和仓库名称正确显示
  if (formData.supplierId) {
    const supplier = suppliers.value.find(s => s.id === formData.supplierId)
    if (supplier) {
      formData.supplierName = supplier.name
    }
  }
  if (formData.warehouseId) {
    const warehouse = warehouses.value.find(w => w.id === formData.warehouseId)
    if (warehouse) {
      formData.warehouseName = warehouse.name
    }
  }

  // 重新计算总金额
  calculateTotalAmount()

  dialogTitle.value = '查看退货单'
  isViewMode.value = true
  dialogVisible.value = true
}

// 删除
const handleDelete = async (row: ReturnRecord) => {
  try {
    await ElMessageBox.confirm(`确定要删除退货单 ${row.voucherNo} 吗？`, '警告', {
      type: 'warning'
    })

    const electron = (window as any).electron
    if (electron) {
      console.log('开始删除采购退货单，ID:', row.id)
      await electron.purchaseReturnDelete(row.id)
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

// 检查库存是否足够
const checkStockAvailability = (): boolean => {
  const warehouseId = formData.warehouseId
  const voucherDate = formData.voucherDate
  const createdAt = formData.createdAt
  
  if (!warehouseId) {
    ElMessage.warning('请先选择仓库')
    return false
  }
  if (!voucherDate) {
    ElMessage.warning('请先选择退货日期')
    return false
  }
  
  // 如果选择了原入库单，不检查实时库存，因为已经在validateReturnItems中检查过原入库单数量了
  if (formData.originalVoucherNo) {
    return true
  }
  
  // 没有选择原入库单时，才检查实时库存
  for (let i = 0; i < formData.items.length; i++) {
    const item = formData.items[i]
    if (!item.productId || !item.quantity) continue
    
    // 获取该日期和时间之前的库存（不包括该日期和时间的单据）
    const stockBeforeDateTime = getStockBeforeDateTime(
      item.productId, 
      warehouseId, 
      voucherDate, 
      createdAt,
      formData.id
    )
    
    if (stockBeforeDateTime < item.quantity) {
      const productName = item.productName || `第 ${i + 1} 行商品`
      ElMessage.error(
        `库存不足：${productName}\n` +
        `退货日期：${voucherDate}\n` +
        `该时间前库存：${stockBeforeDateTime}\n` +
        `需要退货：${item.quantity}\n\n` +
        `请修改退货日期或退货数量！`
      )
      return false
    }
  }
  
  return true
}

// 校验退货商品（按商品汇总验证是否超过原入库单总数量）
const validateReturnItems = async (): Promise<boolean> => {
  // 如果没有选择原入库单，不需要这个验证
  if (!formData.originalVoucherNo) {
    return true
  }

  // 找到原入库单
  const originalOrder = inboundList.value.find(ib => ib.voucherNo === formData.originalVoucherNo)
  if (!originalOrder) {
    ElMessage.error('找不到原入库单')
    return false
  }

  // 统计原入库单中每个商品的总数量（处理相同商品多行）
  const originalProductQty = new Map<number, { name: string, totalQty: number }>()
  originalOrder.items.forEach((item: any) => {
    if (item.productId) {
      const existing = originalProductQty.get(item.productId)
      if (existing) {
        existing.totalQty += (item.quantity || 0)
      } else {
        originalProductQty.set(item.productId, {
          name: item.productName || '',
          totalQty: item.quantity || 0
        })
      }
    }
  })

  // 获取该原入库单的所有历史退货单
  const electron = (window as any).electron
  if (!electron || !electron.purchaseReturnList) {
    return true
  }

  const result = await electron.purchaseReturnList(1, 1000)
  const allReturns = result.data || []

  // 筛选出与原入库单相关的退货单（排除当前正在编辑的退货单）
  const relatedReturns = allReturns.filter((r: any) => {
    return r.original_inbound_no === formData.originalVoucherNo && (!formData.id || r.id !== formData.id)
  })

  // 统计每个商品的历史退货数量
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

  // 统计当前退货单中每个商品的总退货数量
  const currentReturnByProduct = new Map<number, number>()
  formData.items.forEach((item: any) => {
    if (item.productId && (item.quantity || 0) > 0) {
      currentReturnByProduct.set(item.productId, (currentReturnByProduct.get(item.productId) || 0) + (item.quantity || 0))
    }
  })

  // 按商品汇总校验
  for (const [productId, currentQty] of currentReturnByProduct.entries()) {
    const historicalQty = historicalQtyMap.get(productId) || 0
    const productInfo = originalProductQty.get(productId)

    if (!productInfo) {
      ElMessage.error(`商品 ID ${productId} 在原入库单中不存在`)
      return false
    }

    const originalTotalQty = productInfo.totalQty
    const totalReturnedQty = historicalQty + currentQty

    if (totalReturnedQty > originalTotalQty) {
      ElMessage.error(`商品"${productInfo.name}"累计退货数量 (${totalReturnedQty}) 超过原入库单中该商品总数量 (${originalTotalQty})。历史已退货：${historicalQty}，本次退货：${currentQty}`)
      return false
    }
  }

  return true
}


// 保存
const handleSubmit = async () => {
  try {
    await formRef.value.validate()

    // 必须添加至少一行商品
    if (!formData.items || formData.items.length === 0) {
      ElMessage.error('请至少添加一条退货商品')
      return
    }
    
    // 先验证退货商品是否在原入库单中，且数量不超过原入库单数量
    if (!await validateReturnItems()) {
      return
    }
    
    // 再检查库存是否足够
    if (!checkStockAvailability()) {
      return
    }

    // 计算总金额
    calculateTotalAmount()

    // 生成凭证号（如果是新增）
    if (!formData.id) {
      formData.voucherNo = generateVoucherNo()
    }

    // 转换数据格式
    const dbData = {
      return_no: formData.voucherNo,
      original_inbound_no: formData.originalVoucherNo,
      supplier_id: formData.supplierId,
      warehouse_id: formData.warehouseId,
      return_date: formData.voucherDate,
      total_amount: formData.totalAmount,
      return_reason: formData.returnReason,
      remark: formData.remark,
      operator: formData.operator, // 添加经办人字段
      invoice_issued: formData.invoiceIssued ? 1 : 0, // 保存发票状态
      invoice_type: formData.invoiceType, // 保存发票类型
      items: formData.items
        .filter((item: any) => item.quantity > 0) // 只保存数量>0 的商品
        .map((item: any) => ({
          product_id: item.productId,
          product_name: item.productName, // 添加商品名称
          specification: item.specification, // 添加规格
          unit: item.unit, // 添加单位
          quantity: item.quantity,
          unit_price: item.unitPrice, // 添加含税单价
          unit_price_ex: item.unitPriceEx, // 添加不含税单价
          total_amount: item.totalAmount, // 添加金额
          tax_rate: item.taxRate, // 添加税率
          tax_amount: item.taxAmount, // 添加税额
          cost_price: item.unitPrice,
          deduction_amount: item.deductionAmount || 0, // 添加加计扣除金额
          allow_deduction: item.allowDeduction ? 1 : 0, // 添加加计扣除标记
          remark: item.remark,
          original_item_index: item.originalItemIndex // 保存原索引，用于重新加载时匹配
        }))
    }

    if (formData.id) {
      // 更新现有单据
      dbData.id = formData.id
      await db.updatePurchaseReturn(dbData)
    } else {
      // 新增单据
      await db.addPurchaseReturn(dbData)
    }

    ElMessage.success('保存成功')

    // 检测是否需要重新结算成本
    await handleDocumentSave(
      DocumentType.PURCHASE_RETURN,
      formData.items,
      formData.voucherDate
    )

    dialogVisible.value = false
    resetForm()  // 关键：重置表单，清空 id
    loadReturnsList()
  } catch (error: any) {
    if (error.validate) {
      ElMessage.error('请完善表单信息')
    } else {
      ElMessage.error('保存失败：' + (error.message || '未知错误'))
    }
  }
}

// 生成凭证号
const generateVoucherNo = () => {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `CH${date}${random}`
}

// 选择原入库单
const handleOriginalVoucherChange = (voucherNo: string) => {
  const inbound = inboundList.value.find(item => item.voucherNo === voucherNo)
  if (inbound) {
    formData.supplierId = inbound.supplierId
    formData.supplierName = inbound.supplierName

    // 同步更新仓库信息
    if (inbound.warehouseId) {
      formData.warehouseId = inbound.warehouseId
      formData.warehouseName = inbound.warehouseName || ''
    }

    // 同步更新经办人
    if (inbound.operator) {
      formData.operator = inbound.operator
    }

    // 自动提取原入库单的发票状态
    formData.invoiceIssued = inbound.invoiceIssued || false
    formData.invoiceType = inbound.invoiceType || '普票'

    // 加载原入库单的商品，同步所有字段包括税率和加计扣除
    // 处理相同商品多行的情况：使用 productMatchCount 计数器
    const productMatchCount = new Map<number, number>()

    formData.items = inbound.items.map((item: any, index: number) => {
      const productId = item.productId
      const count = productMatchCount.get(productId) || 0
      productMatchCount.set(productId, count + 1)

      return {
        productId: item.productId,
        productName: item.productName,
        specification: item.specification,
        quantity: 0,
        unit: item.unit,
        unitPrice: round2(item.unitPrice || 0),  // 确保四舍五入到 2 位小数
        unitPriceEx: round2(item.unitPriceEx || 0),  // 确保四舍五入到 2 位小数
        taxRate: item.taxRate !== undefined ? item.taxRate : '免税',
        taxAmount: 0,
        totalAmount: 0,
        deductionAmount: item.deductionAmount || 0,
        allowDeduction: item.allowDeduction || false,
        originalQuantity: item.quantity,  // 显示原入库单中的数量
        originalItemIndex: index,         // 保存原入库单中的索引，用于匹配数量
        _lastEdited: 'unitIncl'           // 使用含税价作为基准，保持与原入库单一致
      }
    })
  }
}

// 供应商选择变化
const handleSupplierChange = (supplierId: number) => {
  const supplier = suppliers.value.find(s => s.id === supplierId)
  if (supplier) {
    formData.supplierName = supplier.name
  }
}

// 仓库选择变化
const handleWarehouseChange = (warehouseId: number) => {
  const warehouse = warehouses.value.find(w => w.id === warehouseId)
  if (warehouse) {
    formData.warehouseName = warehouse.name
  }
}

// 处理发票状态变化
const handleInvoiceIssuedChange = (val: boolean) => {
  if (!val) {
    // 如果改为未开票，重置加计扣除开关
    formData.items.forEach(item => {
      if (item.allowDeduction) {
        item.allowDeduction = false
      }
    })
    ElMessage.info('未开票状态下无法使用加计扣除')
  }
}

// 处理发票类型变化
const handleInvoiceTypeChange = (val: string) => {
  if (val !== '普票') {
    // 如果改为专票，重置加计扣除开关
    formData.items.forEach(item => {
      if (item.allowDeduction) {
        item.allowDeduction = false
      }
    })
    ElMessage.info('只有普票才允许加计扣除')
  }
}

// 保存默认仓库
const saveDefaultWarehouse = (warehouseId: number | undefined) => {
  if (warehouseId) {
    localStorage.setItem('defaultWarehouseId', warehouseId.toString())
    defaultWarehouseId.value = warehouseId
    ElMessage.success('已设置为默认仓库')
  }
}

// 保存默认经办人
const saveDefaultOperator = (handlerId: number, handlerName: string) => {
  localStorage.setItem('defaultHandlerId', handlerId.toString())
  localStorage.setItem('defaultOperator', handlerName)
  defaultHandlerId.value = handlerId
  defaultOperator.value = handlerName
  ElMessage.success('已设置为默认经办人')
}

// 商品选择变化
const handleProductChange = (row: ReturnItem) => {
  const product = products.value.find(p => p.id === row.productId)
  if (product) {
    row.productName = product.name
    // 优先使用 spec（产品表字段），其次使用 specification，最后使用 code 作为备用
    row.specification = product.spec || product.specification || product.code || ''
    row.unit = product.unit || '个'
    
    // 如果选择了原入库单，保持原入库单的价格和计算基准
    if (!formData.originalVoucherNo) {
      // 没有选择原入库单时，使用产品的成本价
      row.unitPriceEx = product.costPrice && product.costPrice > 0 ? product.costPrice : ('' as any)
      row._lastEdited = 'unitEx'
      // 只有当有价格时才计算总额
      if (row.unitPriceEx && row.unitPriceEx !== '') {
        calculateRowTotal(row)
      }
    }
    // 如果选择了原入库单，保持原入库单的价格和_lastEdited设置
  }
}

// 计算单行总额（支持不含税/含税/金额任填其一）
const round2 = (v: number) => Math.round(v * 100) / 100

const calculateRowTotal = (item: ReturnItem) => {
  const qty = item.quantity || 0
  const taxRaw = item.taxRate === '免税' ? 0 : Number(item.taxRate || 0)
  const r = taxRaw / 100
  const isDeduction = item.allowDeduction || false

  const last = item._lastEdited

  if (last === 'unitEx') {
    const unitEx = Number(item.unitPriceEx || 0)
    let unitIncl: number
    let taxAmount: number
    let totalAmount: number
    let deductionAmount: number

    if (isDeduction) {
      // 加计扣除模式：单价（不含税）= 金额 * (1-9%) / 数量
      // 反推：金额 = 单价（不含税）* 数量 / (1-9%)
      totalAmount = round2(unitEx * qty / 0.91)
      unitIncl = round2(totalAmount / qty) // 单价（含税）= 金额 / 数量
      taxAmount = round2(totalAmount - unitEx * qty)
      deductionAmount = round2(totalAmount * 0.09) // 加计扣除 = 金额 × 9%
    } else {
      // 正常模式
      unitIncl = r === 0 ? unitEx : round2(unitEx * (1 + r))
      totalAmount = round2(unitIncl * qty)
      taxAmount = round2(totalAmount - unitEx * qty)
      deductionAmount = 0
    }
    item.unitPrice = unitIncl
    item.taxAmount = taxAmount
    item.totalAmount = totalAmount
    item.deductionAmount = deductionAmount
  } else if (last === 'unitIncl') {
    const unitIncl = Number(item.unitPrice || 0)
    let unitEx: number
    let taxAmount: number
    let totalAmount: number
    let deductionAmount: number

    if (isDeduction) {
      // 加计扣除模式：单价（不含税）= 单价（含税）* (1-9%)
      totalAmount = round2(unitIncl * qty) // 金额 = 单价（含税）* 数量
      unitEx = round2(unitIncl * 0.91) // 单价（不含税）= 单价（含税）* (1-9%)
      taxAmount = round2(totalAmount - unitEx * qty)
      deductionAmount = round2(totalAmount * 0.09) // 加计扣除 = 金额 × 9%
    } else {
      // 正常模式：金额直接由含税单价 × 数量得出，避免中间精度损失
      totalAmount = round2(unitIncl * qty)
      unitEx = r === 0 ? unitIncl : round2(unitIncl / (1 + r))
      taxAmount = round2(totalAmount - unitEx * qty)
      deductionAmount = 0
    }
    item.unitPriceEx = unitEx
    item.taxAmount = taxAmount
    item.totalAmount = totalAmount
    item.deductionAmount = deductionAmount
  } else if (last === 'amount') {
    const total = Number(item.totalAmount || 0)
    if (qty === 0) {
      item.unitPrice = 0
      item.unitPriceEx = 0
      item.taxAmount = 0
      item.deductionAmount = 0
    } else {
      let unitIncl: number
      let unitEx: number
      let taxAmount: number
      let deductionAmount: number

      if (isDeduction) {
        // 加计扣除模式：单价（不含税）= 金额 * (1-9%) / 数量
        unitIncl = round2(total / qty) // 单价（含税）= 金额 / 数量
        unitEx = round2(total * 0.91 / qty) // 单价（不含税）= 金额 * (1-9%) / 数量
        taxAmount = round2(total - unitEx * qty)
        deductionAmount = round2(total * 0.09) // 加计扣除 = 金额 × 9%
      } else {
        // 正常模式
        unitIncl = round2(total / qty)
        unitEx = r === 0 ? unitIncl : round2(unitIncl / (1 + r))
        taxAmount = round2(total - unitEx * qty)
        deductionAmount = 0
      }
      item.unitPrice = unitIncl
      item.unitPriceEx = unitEx
      item.taxAmount = taxAmount
      item.deductionAmount = deductionAmount
    }
  } else {
    if (item.unitPriceEx || item.unitPriceEx === 0) {
      item._lastEdited = 'unitEx'
      calculateRowTotal(item)
      return
    }
    if (item.unitPrice || item.unitPrice === 0) {
      item._lastEdited = 'unitIncl'
      calculateRowTotal(item)
      return
    }
    if (item.totalAmount || item.totalAmount === 0) {
      item._lastEdited = 'amount'
      calculateRowTotal(item)
      return
    }
  }

  calculateTotalAmount()
}

const onUnitPriceExChange = (item: ReturnItem) => {
  // 确保不含税单价四舍五入到 2 位小数
  item.unitPriceEx = round2(item.unitPriceEx)
  item._lastEdited = 'unitEx'
  calculateRowTotal(item)
}

const onUnitPriceInclChange = (item: ReturnItem) => {
  // 确保含税单价四舍五入到 2 位小数
  item.unitPrice = round2(item.unitPrice)
  item._lastEdited = 'unitIncl'
  calculateRowTotal(item)
}

const onAmountChange = (item: ReturnItem) => {
  // 确保金额四舍五入到 2 位小数
  item.totalAmount = round2(item.totalAmount)
  item._lastEdited = 'amount'
  calculateRowTotal(item)
}

// 处理加计扣除开关变化
const onDeductionSwitchChange = (item: ReturnItem) => {
  // 如果不满足条件，自动关闭开关
  if (!formData.invoiceIssued) {
    item.allowDeduction = false
    ElMessage.warning('请先标记为已开票')
  } else if (formData.invoiceType !== '普票') {
    item.allowDeduction = false
    ElMessage.warning('只有普票才允许加计扣除')
  } else if (item.taxRate !== '免税') {
    item.allowDeduction = false
    ElMessage.warning('只有免税商品才允许加计扣除')
  }
  // 重新计算该行
  calculateRowTotal(item)
}

const onTaxRateChange = (item: ReturnItem) => {
  // 如果税率不是免税，关闭加计扣除开关
  if (item.taxRate !== '免税' && item.allowDeduction) {
    item.allowDeduction = false
  }
  calculateRowTotal(item)
}

// 校验单个退货商品（验证是否在原入库单中，且数量不超过原入库单数量）
const validateSingleReturnItem = (item: ReturnItem): boolean => {
  // 如果没有选择原入库单，不需要这个验证
  if (!formData.originalVoucherNo) {
    return true
  }
  
  // 找到原入库单
  const originalOrder = inboundList.value.find(ib => ib.voucherNo === formData.originalVoucherNo)
  if (!originalOrder) {
    return true
  }
  
  // 通过 originalItemIndex 找到原入库单中对应的商品行
  const origIndex = item.originalItemIndex
  if (origIndex !== undefined && origIndex >= 0 && origIndex < originalOrder.items.length) {
    const origItem = originalOrder.items[origIndex]
    
    // 检查商品是否匹配
    if (origItem.productId !== item.productId) {
      ElMessage.error(`商品"${item.productName}"与原入库单不匹配`)
      return false
    }
    
    // 校验退货数量不能超过原订单对应行的数量（允许数量为0，表示不退货）
    const retQty = Math.abs(item.quantity)
    if (retQty > origItem.quantity) {
      ElMessage.error(`商品"${item.productName}"的退货数量(${retQty})不能超过原入库单数量(${origItem.quantity})`)
      return false
    }
  }
  
  return true
}

// 检查单个商品库存是否足够
const checkSingleStockAvailability = (item: ReturnItem): boolean => {
  const warehouseId = formData.warehouseId
  const voucherDate = formData.voucherDate
  const createdAt = formData.createdAt
  
  if (!warehouseId || !voucherDate) {
    return true
  }
  
  // 如果选择了原入库单，不检查实时库存
  if (formData.originalVoucherNo) {
    return true
  }
  
  if (!item.productId || !item.quantity) return true
  
  // 获取该日期和时间之前的库存
  const stockBeforeDateTime = getStockBeforeDateTime(
    item.productId, 
    warehouseId, 
    voucherDate, 
    createdAt,
    formData.id
  )
  
  if (stockBeforeDateTime < item.quantity) {
    const productName = item.productName || '该商品'
    ElMessage.error(
      `库存不足：${productName}\n` +
      `退货日期：${voucherDate}\n` +
      `该时间前库存：${stockBeforeDateTime}\n` +
      `需要退货：${item.quantity}`
    )
    return false
  }
  
  return true
}

// 数量变化时处理
const onQuantityChange = (item: ReturnItem) => {
  // 数量变化时，优先使用含税单价作为计算基准
  if (item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== '') {
    item._lastEdited = 'unitIncl'
  }
  calculateRowTotal(item)

  // 实时检测：先验证原入库单数量
  if (!validateSingleReturnItem(item)) {
    return
  }

  // 实时检测：再检查库存
  checkSingleStockAvailability(item)
}

// 计算单据总额（只计算数量>0的商品）
const calculateTotalAmount = () => {
  formData.totalAmount = formData.items.reduce((sum, item) => {
    if (item.quantity > 0) {
      return sum + (item.totalAmount || 0)
    }
    return sum
  }, 0)
}

// 添加商品
const addItem = () => {
  // 如果选择了原入库单，不允许添加新商品，只能从原入库单的商品中选择
  if (formData.originalVoucherNo) {
    ElMessage.warning('已选择原入库单，商品已从原入库单自动加载，如需退货请直接修改对应商品的数量')
    return
  }
  
  formData.items.push({
    productId: undefined,
    productName: '',
    specification: '',
    quantity: undefined,
    unit: '个',
    unitPrice: undefined,
    unitPriceEx: undefined,
    taxRate: 13, // 默认税率 13%
    taxAmount: undefined,
    totalAmount: undefined,
    deductionAmount: undefined,
    allowDeduction: false,
    _lastEdited: 'unitEx'
  })
}

// 删除商品
const removeItem = (index: number) => {
  formData.items.splice(index, 1)
  calculateTotalAmount()
}

// 处理输入框聚焦事件，清空 0 值让用户直接输入
const handleFocus = (row: any, field: string) => {
  const value = row[field]
  if (value === 0 || value === '0') {
    row[field] = ''
  }
}

// 重置表单
const resetForm = () => {
  Object.assign(formData, {
    id: undefined,  // 关键：清空 id，确保每次新增时都会生成新单号
    voucherNo: '',
    voucherDate: dayjs().format('YYYY-MM-DD'),
    originalVoucherNo: '',
    supplierId: undefined,
    supplierName: '',
    warehouseId: undefined,
    warehouseName: '',
    operator: localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')!).name : '',
    returnReason: '',
    items: [],
    totalAmount: 0,
    remark: '',
    invoiceIssued: false,
    invoiceType: '普票'
  })

  // 设置默认经办人
  if (defaultHandlerId.value) {
    formData.operator = users.value.find(u => u.id === defaultHandlerId.value)?.name || ''
  }

  formRef.value?.clearValidate()
}

// 搜索
const handleSearch = () => {
  currentPage.value = 1
  loadReturnsList()
}

// 分页
const handleSizeChange = (size: number) => {
  pageSize.value = size
  loadReturnsList()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  loadReturnsList()
}

// 选择变化
const handleSelectionChange = (selection: ReturnRecord[]) => {
  selectedRows.value = selection
}

// 打印
const handlePrint = (row: ReturnRecord) => {
  handleView(row)
}

const handlePrintCurrent = () => {
  if (selectedRows.value.length === 1) {
    handlePrint(selectedRows.value[0])
  } else if (dialogVisible.value) {
    // 当前对话框中的单据
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

// 导出
const handleExport = () => {
  ElMessage.info('导出功能开发中...')
}

// 生成打印内容
const generatePrintContent = (data: ReturnRecord) => {
  const itemsHtml = data.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.productName || '-'}</td>
      <td>${item.specification || '-'}</td>
      <td>${item.quantity}</td>
      <td>${item.unit}</td>
      <td>${(item.unitPriceEx || 0).toFixed(2)}</td>
      <td>${(item.unitPrice || 0).toFixed(2)}</td>
      <td>${item.taxRate}%</td>
      <td>${(item.taxAmount || 0).toFixed(2)}</td>
      <td>${(item.totalAmount || 0).toFixed(2)}</td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>采购退货单 - ${data.voucherNo}</title>
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
          <h2>采购退货单</h2>
          <p>凭证号：${data.voucherNo}</p>
        </div>
        <div class="info">
          <div>退货日期：${data.voucherDate}</div>
          <div>原入库单号：${data.originalVoucherNo || '-'}</div>
          <div>供应商：${data.supplierName}</div>
          <div>经办人：${data.operator}</div>
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
              <th>单价 (不含税)</th>
              <th>单价 (含税)</th>
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

// 初始化
onMounted(async () => {
  // 先加载基础数据
  await loadSuppliers()
  await loadWarehouses()
  await loadProducts()
  await loadUsers()
  loadCurrentUser()
  // 再加载业务数据
  loadReturnsList()
  loadInboundList()
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
