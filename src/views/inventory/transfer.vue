<template>
  <div class="inventory-transfer-page">
    <el-card>
        <div class="toolbar">
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            新增调拨单
          </el-button>
          <el-input
            v-model="searchQuery"
            placeholder="搜索调拨单号"
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
        <el-table :data="transferList" style="width: 100%">
        <el-table-column prop="transferNo" label="调拨单号" width="150" />
        <el-table-column prop="fromWarehouseName" label="调出仓库" width="120" />
        <el-table-column prop="toWarehouseName" label="调入仓库" width="120" />
        <el-table-column prop="transferDate" label="调拨日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : 'warning'">
              {{ row.status === 'completed' ? '已完成' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑调拨单' : '新增调拨单'" width="90%">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="调拨单号">
          <el-input v-model="formData.transferNo" disabled />
        </el-form-item>
        <el-form-item label="调拨日期">
          <el-date-picker
            v-model="formData.transferDate"
            type="date"
            placeholder="选择日期"
            style="width: 200px"
            @change="handleTransferDateChange"
          />
        </el-form-item>
        <el-form-item label="调出仓库" required>
          <el-select
            v-model="formData.fromWarehouseId"
            placeholder="请选择调出仓库"
            style="width: 200px"
            filterable
            @change="handleFromWarehouseChange"
          >
            <el-option
              v-for="wh in warehouses"
              :key="wh.id"
              :label="wh.name"
              :value="wh.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="调入仓库" required>
          <el-select
            v-model="formData.toWarehouseId"
            placeholder="请选择调入仓库"
            style="width: 200px"
            filterable
            @change="handleToWarehouseChange"
          >
            <el-option
              v-for="wh in warehouses"
              :key="wh.id"
              :label="wh.name"
              :value="wh.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="2"
            placeholder="请输入备注"
          />
        </el-form-item>
      </el-form>

      <!-- 产品明细 -->
      <el-divider>产品明细</el-divider>
      <el-table :data="formData.items" style="width: 100%; margin-bottom: 10px;" border>
        <el-table-column label="产品" min-width="200">
          <template #default="{ row, $index }">
            <el-select
              v-model="row.productId"
              placeholder="选择产品"
              filterable
              style="width: 100%"
              @change="handleProductChange($index)"
            >
              <el-option
                v-for="p in products"
                :key="p.id"
                :label="`${p.code} - ${p.name}`"
                :value="p.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="产品名称" min-width="150">
          <template #default="{ row }">
            <el-input v-model="row.productName" disabled />
          </template>
        </el-table-column>
        <el-table-column label="规格" width="120">
          <template #default="{ row }">
            <el-input v-model="row.specification" disabled />
          </template>
        </el-table-column>
        <el-table-column label="调拨数量" width="120">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="row.quantity"
              :min="0"
              :precision="2"
              :controls="false"
              style="width: 100%"
              @focus="handleFocus(row, 'quantity')"
              @change="handleQuantityChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="单位" width="80">
          <template #default="{ row }">
            <el-input v-model="row.unit" disabled />
          </template>
        </el-table-column>
        <el-table-column label="当前库存" width="100" fixed>
          <template #default="{ row }">
            <el-tag :type="row.quantity > (row.currentStock || 0) ? 'danger' : 'success'">
              {{ row.currentStock || 0 }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="成本价" width="130">
          <template #default="{ row }">
            <el-input-number
              v-model="row.unitPriceEx"
              :min="0"
              :precision="2"
              :step="0.01"
              :controls="false"
              style="width: 100%"
              @focus="handleFocus(row, 'unitPriceEx')"
              @change="handleUnitPriceExChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="金额" width="130">
          <template #default="{ row }">
            <el-input-number
              v-model="row.totalAmountEx"
              :min="0"
              :precision="2"
              :controls="false"
              style="width: 100%"
              @focus="handleFocus(row, 'totalAmountEx')"
              @change="handleTotalAmountExChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ $index }">
            <el-button type="danger" size="small" @click="handleDeleteItem($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-button type="primary" size="small" @click="handleAddItem">
        <el-icon><Plus /></el-icon>
        添加产品
      </el-button>

      <!-- 单据汇总 -->
      <el-divider>单据汇总</el-divider>
      <el-row :gutter="20" style="margin-top: 10px;">
        <el-col :span="8">
          <el-statistic title="产品种类" :value="formData.items.length" />
        </el-col>
        <el-col :span="8">
          <el-statistic title="总数量" :value="totalQuantity" :precision="2" />
        </el-col>
        <el-col :span="8">
          <el-statistic title="总金额" :value="totalAmountEx" :precision="2" prefix="¥" />
        </el-col>
      </el-row>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { db } from '@/utils/db-ipc'
import { handleDocumentSave, DocumentType } from '@/utils/cost-recalculation'

const searchQuery = ref('')
const transferList = ref<any[]>([])
const warehouses = ref<any[]>([])
const products = ref<any[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const selectedRow = ref<any>(null)

const formData = reactive<any>({
  id: null,
  transferNo: '',
  transferDate: new Date().toISOString().split('T')[0],
  fromWarehouseId: null,
  fromWarehouseName: '',
  toWarehouseId: null,
  toWarehouseName: '',
  remark: '',
  status: 'draft',
  items: []
})

// 计算总数量
const totalQuantity = computed(() => {
  return formData.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0)
})

// 计算总金额（不含税）
const totalAmountEx = computed(() => {
  return formData.items.reduce((sum: number, item: any) => sum + (Number(item.totalAmountEx) || 0), 0)
})

// 加载仓库列表
const loadWarehouses = async () => {
  try {
    const list = await db.getWarehouses()
    console.log('加载仓库列表:', list)
    warehouses.value = list
  } catch (error) {
    console.error('加载仓库列表失败:', error)
  }
}

// 加载产品列表
const loadProducts = async () => {
  try {
    const productsList = await db.getProducts()
    console.log('加载产品列表:', productsList)
    products.value = productsList.map((p: any) => ({
      id: p.id,
      code: p.code || p.productCode || '',
      name: p.name || p.productName || '',
      specification: p.specification || '',
      unit: p.unit || ''
    }))
    console.log('转换后的产品列表:', products.value)
  } catch (error) {
    console.error('加载产品列表失败:', error)
  }
}

// 加载调拨单列表
const loadTransferList = async () => {
  try {
    const data = await db.getTransfers(1, 100000)
    let list = data.data || []

    // 搜索过滤
    if (searchQuery.value) {
      list = list.filter((item: any) =>
        item.transfer_no?.toLowerCase().includes(searchQuery.value.toLowerCase())
      )
    }

    // 转换数据格式
    transferList.value = list.map((item: any) => ({
      id: item.id,
      transferNo: item.transfer_no,
      transferDate: item.transfer_date,
      fromWarehouseId: item.from_warehouse_id,
      fromWarehouseName: item.from_warehouse_name || '',
      toWarehouseId: item.to_warehouse_id,
      toWarehouseName: item.to_warehouse_name || '',
      remark: item.remark || '',
      status: item.status || 'pending',
      items: (item.items || []).map((i: any) => ({
        productId: i.product_id,
        productName: i.product_name || '',
        specification: '',
        unit: '',
        quantity: i.quantity,
        unitPriceEx: i.cost || 0,
        totalAmountEx: i.amount || 0
      }))
    }))

    console.log('调拨单列表加载成功，共', transferList.value.length, '条记录')
  } catch (error) {
    console.error('加载调拨单列表失败:', error)
  }
}

// 生成调拨单号
const generateTransferNo = () => {
  const date = new Date()
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `DB${dateStr}${random}`
}

// 新增调拨单
const handleAdd = () => {
  isEdit.value = false
  Object.assign(formData, {
    id: null,
    transferNo: generateTransferNo(),
    transferDate: new Date().toISOString().split('T')[0],
    fromWarehouseId: null,
    fromWarehouseName: '',
    toWarehouseId: null,
    toWarehouseName: '',
    remark: '',
    status: 'draft',
    items: []
  })
  dialogVisible.value = true
}

// 编辑调拨单
const handleEdit = (row: any) => {
  isEdit.value = true
  Object.assign(formData, {
    id: row.id,
    transferNo: row.transferNo,
    transferDate: row.transferDate,
    fromWarehouseId: row.fromWarehouseId,
    fromWarehouseName: row.fromWarehouseName,
    toWarehouseId: row.toWarehouseId,
    toWarehouseName: row.toWarehouseName,
    remark: row.remark || '',
    status: row.status,
    items: row.items || []
  })
  dialogVisible.value = true

  // 确保仓库名称正确显示
  if (formData.fromWarehouseId) {
    const fromWh = warehouses.value.find(w => w.id === formData.fromWarehouseId)
    if (fromWh) {
      formData.fromWarehouseName = fromWh.name
    }
  }
  if (formData.toWarehouseId) {
    const toWh = warehouses.value.find(w => w.id === formData.toWarehouseId)
    if (toWh) {
      formData.toWarehouseName = toWh.name
    }
  }

  // 编辑时，重新获取每个产品的最新成本价
  setTimeout(async () => {
    for (const item of formData.items) {
      if (item.productId && formData.fromWarehouseId && formData.transferDate) {
        const costPrice = await db.getProductCost(String(item.productId), formData.fromWarehouseId, formData.transferDate)
        if (costPrice !== null && costPrice > 0) {
          item.unitPriceEx = costPrice
          if (item.quantity > 0) {
            item.totalAmountEx = Number((item.unitPriceEx * item.quantity).toFixed(2))
          }
        }
      }
    }
  }, 100)
}

// 添加产品
const handleAddItem = () => {
  formData.items.push({
    productId: null,
    productName: '',
    specification: '',
    unit: '',
    quantity: 0,
    unitPriceEx: 0,
    totalAmountEx: 0
  })
}

// 删除产品
const handleDeleteItem = (index: number) => {
  formData.items.splice(index, 1)
}

// 产品选择变化
const handleProductChange = async (index: number) => {
  const item = formData.items[index]
  const product = products.value.find(p => p.id === item.productId)
  if (product) {
    item.productName = product.name
    item.specification = product.specification
    item.unit = product.unit

    // 加载调出仓库的库存
    if (formData.fromWarehouseId && item.productId) {
      item.currentStock = await db.getProductStock(item.productId, formData.fromWarehouseId)
    }

    // 自动从数据库获取成本价
    if (formData.fromWarehouseId && item.productId && formData.transferDate) {
      const costPrice = await db.getProductCost(String(item.productId), formData.fromWarehouseId, formData.transferDate)
      if (costPrice !== null && costPrice > 0) {
        item.unitPriceEx = costPrice
        if (item.quantity > 0) {
          item.totalAmountEx = Number((item.unitPriceEx * item.quantity).toFixed(2))
        }
      }
    }
  }
}

// 数量变化
const handleQuantityChange = (item: any) => {
  if (item.quantity === '') {
    item.quantity = ''
    return
  }
  if (Number(item.quantity) < 0) {
    item.quantity = 0
  }
  // 根据数量和单价重新计算金额
  if (Number(item.unitPriceEx) && Number(item.quantity)) {
    item.totalAmountEx = Number((Number(item.unitPriceEx) * Number(item.quantity)).toFixed(2))
  }
  
  // TODO: 实时检查库存
  // if (item.productId && item.quantity && formData.fromWarehouseId) {
  //   const stockBeforeDateTime = getStockBeforeDateTime(
  //     item.productId, 
  //     formData.fromWarehouseId, 
  //     formData.transferDate, 
  //     formData.createdAt,
  //     formData.id
  //   )
  //   
  //   if (item.quantity > stockBeforeDateTime) {
  //     const shortage = item.quantity - stockBeforeDateTime
  //     ElMessage.warning({
  //       message: `库存不足：${item.productName || '该商品'}，${formData.transferDate}前库存 ${stockBeforeDateTime}，您输入的数量 ${item.quantity}，还差 ${shortage}`,
  //       duration: 5000
  //     })
  //   }
  // }
}

// 单价变化
const handleUnitPriceExChange = (item: any) => {
  if (item.unitPriceEx === '') {
    item.unitPriceEx = ''
    return
  }
  if (Number(item.unitPriceEx) < 0) {
    item.unitPriceEx = 0
  }
  // 根据单价和数量重新计算金额
  if (Number(item.unitPriceEx) && Number(item.quantity)) {
    item.totalAmountEx = Number((Number(item.unitPriceEx) * Number(item.quantity)).toFixed(2))
  }
}

// 金额变化
const handleTotalAmountExChange = (item: any) => {
  if (item.totalAmountEx === '') {
    item.totalAmountEx = ''
    return
  }
  if (Number(item.totalAmountEx) < 0) {
    item.totalAmountEx = 0
  }
  // 根据金额和数量反推单价
  if (Number(item.totalAmountEx) && Number(item.quantity)) {
    item.unitPriceEx = Number((Number(item.totalAmountEx) / Number(item.quantity)).toFixed(2))
  }
}

// 处理输入框聚焦事件，清空 0 值让用户直接输入
const handleFocus = (row: any, field: string) => {
  const value = row[field]
  if (value === 0 || value === '0') {
    row[field] = ''
  }
}

// 调出仓库变化
const handleFromWarehouseChange = async () => {
  // 重新加载所有已选产品的库存和成本价
  await loadItemsStock()

  // 重新获取所有已选产品的成本价
  if (formData.fromWarehouseId && formData.transferDate) {
    for (const item of formData.items) {
      if (item.productId) {
        const costPrice = await db.getProductCost(String(item.productId), formData.fromWarehouseId, formData.transferDate)
        if (costPrice !== null && costPrice > 0) {
          item.unitPriceEx = costPrice
          if (item.quantity > 0) {
            item.totalAmountEx = Number((item.unitPriceEx * item.quantity).toFixed(2))
          }
        }
      }
    }
  }
}

// 调入仓库变化
const handleToWarehouseChange = () => {
  // 可以在这里添加库存检查逻辑
}

// 加载所有产品项的库存
const loadItemsStock = async () => {
  if (!formData.fromWarehouseId) return
  for (const item of formData.items) {
    if (item.productId) {
      item.currentStock = await db.getProductStock(item.productId, formData.fromWarehouseId)
    }
  }
}

// 调拨日期变化
const handleTransferDateChange = async () => {
  // 重新从成本结算模块获取所有已选产品的成本价
  for (const item of formData.items) {
    if (item.productId && formData.fromWarehouseId && formData.transferDate) {
      const costPrice = await db.getProductCost(String(item.productId), formData.fromWarehouseId, formData.transferDate)
      if (costPrice !== null && costPrice > 0) {
        item.unitPriceEx = costPrice
        if (item.quantity > 0) {
          item.totalAmountEx = Number((item.unitPriceEx * item.quantity).toFixed(2))
        }
      }
    }
  }
}

// 删除调拨单
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除该调拨单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await db.deleteTransfer(row.id)
    ElMessage.success('删除成功')
    loadTransferList()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败：' + (error.message || '未知错误'))
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  // 验证必填字段
  if (!formData.fromWarehouseId) {
    ElMessage.warning('请选择调出仓库')
    return
  }
  if (!formData.toWarehouseId) {
    ElMessage.warning('请选择调入仓库')
    return
  }
  if (formData.fromWarehouseId === formData.toWarehouseId) {
    ElMessage.warning('调出仓库和调入仓库不能相同')
    return
  }
  if (!formData.items || formData.items.length === 0) {
    ElMessage.warning('请至少添加一个产品')
    return
  }

  // 验证产品是否都已选择
  for (const item of formData.items) {
    if (!item.productId) {
      ElMessage.warning('请选择产品')
      return
    }
    if (!item.quantity || item.quantity <= 0) {
      ElMessage.warning('调拨数量必须大于 0')
      return
    }
  }

  // 验证库存是否充足
  for (const item of formData.items) {
    if (item.productId && formData.fromWarehouseId) {
      const stock = await db.getProductStock(item.productId, formData.fromWarehouseId)
      if (item.quantity > stock) {
        ElMessage.error(`库存不足：${item.productName || '该产品'}，调出仓库库存仅 ${stock}，调拨数量 ${item.quantity}`)
        return
      }
    }
  }

  // 获取仓库名称
  const fromWarehouse = warehouses.value.find(w => w.id === formData.fromWarehouseId)
  const toWarehouse = warehouses.value.find(w => w.id === formData.toWarehouseId)
  formData.fromWarehouseName = fromWarehouse?.name || ''
  formData.toWarehouseName = toWarehouse?.name || ''
  
  try {
    // 准备保存到数据库的数据
    const transferData = {
      id: formData.id || undefined,
      transfer_no: formData.transferNo,
      transfer_date: formData.transferDate,
      from_warehouse_id: formData.fromWarehouseId,
      to_warehouse_id: formData.toWarehouseId,
      remark: formData.remark,
      status: formData.status,
      items: formData.items.map((item: any) => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: Number(item.quantity),
        cost: Number(item.unitPriceEx) || 0,
        amount: Number(item.totalAmountEx) || 0
      }))
    }

    if (isEdit.value && formData.id) {
      // 更新
      await db.updateTransfer(transferData)
      ElMessage.success('更新成功')
    } else {
      // 新增
      const id = await db.addTransfer(transferData)
      ElMessage.success('新增成功')
      formData.id = id

      // 检测是否需要重新结算成本
      await handleDocumentSave(
        DocumentType.INVENTORY_TRANSFER,
        formData.items || [],
        formData.transferDate
      )
    }

    dialogVisible.value = false
    loadTransferList()
  } catch (error: any) {
    console.error('保存调拨单失败:', error)
    ElMessage.error('保存失败：' + (error.message || error))
  }
}

// 搜索
const handleSearch = () => {
  loadTransferList()
}

onMounted(() => {
  loadWarehouses()
  loadProducts()
  loadTransferList()
})
</script>

<style scoped>
.inventory-transfer-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
