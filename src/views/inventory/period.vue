<template>
  <div class="inventory-period-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增期初库存
        </el-button>
        <el-input
          v-model="searchQuery"
          placeholder="搜索产品编码/名称"
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
      <el-table :data="periodList" style="width: 100%">
        <el-table-column prop="productCode" label="产品编码" width="120" />
        <el-table-column prop="productName" label="产品名称" min-width="150" />
        <el-table-column prop="warehouseName" label="仓库" width="120" />
        <el-table-column prop="periodType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.periodType === 'begin' ? 'success' : 'warning'">
              {{ row.periodType === 'begin' ? '期初' : '期末' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="100" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑期初/期末' : '新增期初库存'" width="600px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="类型" required>
          <el-radio-group v-model="formData.periodType">
            <el-radio label="begin">期初</el-radio>
            <el-radio label="end">期末</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="formData.date"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="产品" required>
          <el-select
            v-model="formData.productId"
            placeholder="请选择产品"
            filterable
            style="width: 100%"
            @change="handleProductChange"
          >
            <el-option
              v-for="p in products"
              :key="p.id"
              :label="`${p.code} - ${p.name}`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库" required>
          <el-select v-model="formData.warehouseId" placeholder="请选择仓库" style="width: 100%">
            <el-option
              v-for="wh in warehouses"
              :key="wh.id"
              :label="wh.name"
              :value="wh.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" required>
          <el-input-number v-model="formData.quantity" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="formData.unit" disabled />
        </el-form-item>
        <el-form-item label="备注">
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { db } from '@/utils/db-ipc'

const searchQuery = ref('')
const periodList = ref<any[]>([])
const warehouses = ref<any[]>([])
const products = ref<any[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)

const formData = reactive<any>({
  id: null,
  productCode: '',
  productName: '',
  productId: null,
  warehouseId: null,
  warehouseName: '',
  periodType: 'begin',
  quantity: 0,
  unit: '',
  date: new Date().toISOString().split('T')[0],
  remark: ''
})

// 加载仓库列表（从数据库获取）
const loadWarehouses = async () => {
  try {
    warehouses.value = await db.getWarehouses()
    console.log('加载仓库列表成功（数据库），共', warehouses.value.length, '个仓库')
  } catch (error) {
    console.error('加载仓库列表失败:', error)
  }
}

// 加载产品列表（从数据库获取）
const loadProducts = async () => {
  try {
    const savedProducts = await db.getProducts()
    products.value = savedProducts
      .filter((p: any) => (p.status as any) === 1 || (p.status as any) === true)
      .map((p: any) => ({
        id: p.id,
        code: p.code || p.productCode || '',
        name: p.name || p.productName || '',
        unit: p.unit || ''
      }))
    console.log('加载产品列表成功（数据库），共', products.value.length, '个产品')
  } catch (error) {
    console.error('加载产品列表失败:', error)
  }
}

// 加载期初期末列表（从数据库获取）
const loadPeriodList = async () => {
  try {
    let list = await db.getInventoryPeriodList()

    // 搜索过滤
    if (searchQuery.value) {
      list = list.filter((item: any) =>
        item.productCode?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        item.productName?.toLowerCase().includes(searchQuery.value.toLowerCase())
      )
    }

    periodList.value = list
  } catch (error) {
    console.error('加载期初期末列表失败:', error)
    periodList.value = []
  }
}

// 产品选择变化
const handleProductChange = (productId: number) => {
  const product = products.value.find(p => p.id === productId)
  if (product) {
    formData.productCode = product.code
    formData.productName = product.name
    formData.unit = product.unit
  }
}

// 新增期初库存
const handleAdd = () => {
  isEdit.value = false
  Object.assign(formData, {
    id: null,
    productCode: '',
    productName: '',
    productId: null,
    warehouseId: null,
    warehouseName: '',
    periodType: 'begin',
    quantity: 0,
    unit: '',
    date: new Date().toISOString().split('T')[0],
    remark: ''
  })
  dialogVisible.value = true
}

// 编辑期初/期末
const handleEdit = (row: any) => {
  isEdit.value = true
  Object.assign(formData, {
    id: row.id,
    productCode: row.productCode,
    productName: row.productName,
    productId: row.productId,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    periodType: row.periodType,
    quantity: row.quantity,
    unit: row.unit,
    date: row.date,
    remark: row.remark || ''
  })
  dialogVisible.value = true
}

// 删除期初/期末
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除该记录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await db.deleteInventoryPeriod(row.id)
    await loadPeriodList()
    ElMessage.success('删除成功')
  } catch {
    // 用户取消删除
  }
}

// 提交表单（保存到数据库）
const handleSubmit = async () => {
  // 验证必填字段
  if (!formData.productId) {
    ElMessage.warning('请选择产品')
    return
  }
  if (!formData.warehouseId) {
    ElMessage.warning('请选择仓库')
    return
  }

  // 获取仓库名称
  const warehouse = warehouses.value.find(w => w.id === formData.warehouseId)
  formData.warehouseName = warehouse?.name || ''

  try {
    const saved = await db.saveInventoryPeriod({ ...formData })

    if (isEdit.value) {
      ElMessage.success('更新成功')
    } else {
      formData.id = saved.id
      ElMessage.success('新增成功')
    }

    dialogVisible.value = false
    await loadPeriodList()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  }
}

// 搜索
const handleSearch = () => {
  loadPeriodList()
}

onMounted(async () => {
  await loadWarehouses()
  await loadProducts()
  await loadPeriodList()
})
</script>

<style scoped>
.inventory-period-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
