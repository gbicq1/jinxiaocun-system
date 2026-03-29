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
import { getWeightedAverageCost, getCostFromSettlement } from '@/utils/cost'
import { getRealTimeStock, getStockBeforeDateTime } from '@/utils/stock'

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
const loadWarehouses = () => {
  try {
    const saved = localStorage.getItem('warehouses')
    if (saved) {
      warehouses.value = JSON.parse(saved).filter((w: any) => w.status === 1)
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error)
  }
}

// 加载产品列表
const loadProducts = () => {
  try {
    const saved = localStorage.getItem('products')
    if (saved) {
      products.value = JSON.parse(saved)
        .filter((p: any) => p.status === 1)
        .map((p: any) => ({
          id: p.id,
          code: p.code || p.productCode || '',
          name: p.name || p.productName || '',
          specification: p.specification || '',
          unit: p.unit || ''
        }))
    }
  } catch (error) {
    console.error('加载产品列表失败:', error)
  }
}

// 加载调拨单列表
const loadTransferList = () => {
  try {
    const saved = localStorage.getItem('inventory_transfers')
    if (saved) {
      let list = JSON.parse(saved)
      
      // 搜索过滤
      if (searchQuery.value) {
        list = list.filter((item: any) => 
          item.transferNo?.toLowerCase().includes(searchQuery.value.toLowerCase())
        )
      }
      
      transferList.value = list
    } else {
      transferList.value = []
    }
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
const handleProductChange = (index: number) => {
  const item = formData.items[index]
  const product = products.value.find(p => p.id === item.productId)
  if (product) {
    item.productName = product.name
    item.specification = product.specification
    item.unit = product.unit
    
    // 自动从成本结算模块获取成本价
    const costPrice = getCostFromSettlement(item.productId, formData.fromWarehouseId, formData.transferDate)
    if (costPrice > 0) {
      item.unitPriceEx = costPrice
      // 根据数量和单价计算金额
      if (item.quantity > 0) {
        item.totalAmountEx = Number((item.unitPriceEx * item.quantity).toFixed(2))
      }
    }
    
    // 如果已经有数量，检查库存
    if (item.quantity && formData.fromWarehouseId) {
      const stockBeforeDateTime = getStockBeforeDateTime(
        item.productId, 
        formData.fromWarehouseId, 
        formData.transferDate, 
        formData.createdAt,
        formData.id
      )
      if (item.quantity > stockBeforeDateTime) {
        ElMessage.warning({
          message: `库存不足：${item.productName || '该商品'}，${formData.transferDate}前库存 ${stockBeforeDateTime}，调拨数量 ${item.quantity}`,
          duration: 5000
        })
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
  
  // 实时检查库存
  if (item.productId && item.quantity && formData.fromWarehouseId) {
    const stockBeforeDateTime = getStockBeforeDateTime(
      item.productId, 
      formData.fromWarehouseId, 
      formData.transferDate, 
      formData.createdAt,
      formData.id
    )
    
    if (item.quantity > stockBeforeDateTime) {
      const shortage = item.quantity - stockBeforeDateTime
      ElMessage.warning({
        message: `库存不足：${item.productName || '该商品'}，${formData.transferDate}前库存 ${stockBeforeDateTime}，您输入的数量 ${item.quantity}，还差 ${shortage}`,
        duration: 5000
      })
    }
  }
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
const handleFromWarehouseChange = () => {
  // 重新从成本结算模块获取所有已选产品的成本价
  formData.items.forEach((item: any, index: number) => {
    if (item.productId) {
      const costPrice = getCostFromSettlement(item.productId, formData.fromWarehouseId, formData.transferDate)
      if (costPrice > 0) {
        item.unitPriceEx = costPrice
        // 根据数量和单价重新计算金额
        if (item.quantity > 0) {
          item.totalAmountEx = Number((item.unitPriceEx * item.quantity).toFixed(2))
        }
      }
    }
  })
  
  // 仓库变化时，检查所有已添加商品的库存
  if (formData.items && formData.items.length > 0) {
    setTimeout(() => {
      formData.items.forEach(item => {
        if (item.productId && item.quantity) {
          const stockBeforeDateTime = getStockBeforeDateTime(
            item.productId, 
            formData.fromWarehouseId, 
            formData.transferDate, 
            formData.createdAt,
            formData.id
          )
          if (item.quantity > stockBeforeDateTime) {
            ElMessage.warning({
              message: `库存不足：${item.productName || '该商品'}，${formData.transferDate}前库存 ${stockBeforeDateTime}，调拨数量 ${item.quantity}`,
              duration: 5000
            })
          }
        }
      })
    }, 100)
  }
}

// 调入仓库变化
const handleToWarehouseChange = () => {
  // 可以在这里添加库存检查逻辑
}

// 调拨日期变化
const handleTransferDateChange = () => {
  // 重新从成本结算模块获取所有已选产品的成本价
  formData.items.forEach((item: any, index: number) => {
    if (item.productId) {
      const costPrice = getCostFromSettlement(item.productId, formData.fromWarehouseId, formData.transferDate)
      if (costPrice > 0) {
        item.unitPriceEx = costPrice
        // 根据数量和单价重新计算金额
        if (item.quantity > 0) {
          item.totalAmountEx = Number((item.unitPriceEx * item.quantity).toFixed(2))
        }
      }
    }
  })
}

// 检查库存是否足够
const checkStockAvailability = (): boolean => {
  const warehouseId = formData.fromWarehouseId
  const transferDate = formData.transferDate
  const createdAt = formData.createdAt
  
  if (!warehouseId) {
    ElMessage.warning('请先选择调出仓库')
    return false
  }
  if (!transferDate) {
    ElMessage.warning('请先选择调拨日期')
    return false
  }
  
  for (let i = 0; i < formData.items.length; i++) {
    const item = formData.items[i]
    if (!item.productId || !item.quantity) continue
    
    // 获取该日期和时间之前的库存（不包括该日期和时间的单据）
    const stockBeforeDateTime = getStockBeforeDateTime(
      item.productId, 
      warehouseId, 
      transferDate, 
      createdAt,
      formData.id
    )
    
    if (stockBeforeDateTime < item.quantity) {
      const productName = item.productName || `第 ${i + 1} 行商品`
      ElMessage.error(
        `库存不足：${productName}\n` +
        `调拨日期：${transferDate}\n` +
        `该时间前库存：${stockBeforeDateTime}\n` +
        `需要调拨：${item.quantity}\n\n` +
        `请修改调拨日期或调拨数量！`
      )
      return false
    }
  }
  
  return true
}

// 删除调拨单
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除该调拨单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const saved = localStorage.getItem('inventory_transfers')
    if (saved) {
      const list = JSON.parse(saved)
      const filtered = list.filter((item: any) => item.id !== row.id)
      localStorage.setItem('inventory_transfers', JSON.stringify(filtered))
      loadTransferList()
      ElMessage.success('删除成功')
    }
  } catch {
    // 用户取消删除
  }
}

// 提交表单
const handleSubmit = () => {
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
  
  // 检查库存是否足够
  if (!checkStockAvailability()) {
    return
  }
  
  // 获取仓库名称
  const fromWarehouse = warehouses.value.find(w => w.id === formData.fromWarehouseId)
  const toWarehouse = warehouses.value.find(w => w.id === formData.toWarehouseId)
  formData.fromWarehouseName = fromWarehouse?.name || ''
  formData.toWarehouseName = toWarehouse?.name || ''
  
  try {
    const saved = localStorage.getItem('inventory_transfers')
    let list = saved ? JSON.parse(saved) : []
    
    if (isEdit.value) {
      // 更新
      const index = list.findIndex((item: any) => item.id === formData.id)
      if (index !== -1) {
        list[index] = { ...formData }
      }
      ElMessage.success('更新成功')
    } else {
      // 新增
      formData.id = Date.now()
      list.push({ ...formData })
      ElMessage.success('新增成功')
    }
    
    localStorage.setItem('inventory_transfers', JSON.stringify(list))
    
    // 更新库存（只在新增时更新，编辑时不重复更新）
    if (!isEdit.value) {
      updateInventory()
    }
    
    dialogVisible.value = false
    loadTransferList()
  } catch (error) {
    console.error('保存调拨单失败:', error)
    ElMessage.error('保存失败')
  }
}

// 更新库存
const updateInventory = () => {
  // 调拨单会影响两个仓库的库存
  // 调出仓库：减少库存
  // 调入仓库：增加库存
  formData.items.forEach((item: any) => {
    if (!item.productId || !item.quantity) return
    
    const quantity = Number(item.quantity)
    const unitPriceEx = Number(item.unitPriceEx) || 0
    const totalAmountEx = Number(item.totalAmountEx) || 0
    
    // 获取所有入库记录
    const inboundKey = 'purchase_inbound_records'
    const inboundRaw = localStorage.getItem(inboundKey)
    const inboundRecords = inboundRaw ? JSON.parse(inboundRaw) : []
    
    // 获取所有出库记录
    const outboundKey = 'sales_outbound_records'
    const outboundRaw = localStorage.getItem(outboundKey)
    const outboundRecords = outboundRaw ? JSON.parse(outboundRaw) : []
    
    // 获取所有调拨记录
    const transferKey = 'inventory_transfers'
    const transferRaw = localStorage.getItem(transferKey)
    const transferRecords = transferRaw ? JSON.parse(transferRaw) : []
    
    // 计算调出仓库的库存变化（减少）
    const fromStockKey = `stock_${formData.fromWarehouseId}_${item.productId}`
    let fromStock = Number(localStorage.getItem(fromStockKey) || 0)
    fromStock -= quantity
    localStorage.setItem(fromStockKey, String(fromStock))
    
    // 计算调入仓库的库存变化（增加）
    const toStockKey = `stock_${formData.toWarehouseId}_${item.productId}`
    let toStock = Number(localStorage.getItem(toStockKey) || 0)
    toStock += quantity
    localStorage.setItem(toStockKey, String(toStock))
    
    // 记录库存变动日志（包含成本信息）
    const stockLogKey = 'stock_movement_log'
    const stockLogRaw = localStorage.getItem(stockLogKey)
    const stockLog = stockLogRaw ? JSON.parse(stockLogRaw) : []
    
    stockLog.push({
      id: Date.now() + Math.random(),
      date: new Date().toISOString().split('T')[0],
      type: 'transfer',
      productName: item.productName,
      productId: item.productId,
      quantity: quantity,
      unitPrice: unitPriceEx,
      totalAmount: totalAmountEx,
      fromWarehouseId: formData.fromWarehouseId,
      fromWarehouseName: formData.fromWarehouseName,
      toWarehouseId: formData.toWarehouseId,
      toWarehouseName: formData.toWarehouseName,
      transferNo: formData.transferNo,
      remark: '调拨单库存调整'
    })
    
    localStorage.setItem(stockLogKey, JSON.stringify(stockLog))
  })
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
