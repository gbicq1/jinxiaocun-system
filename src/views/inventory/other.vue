<template>
  <div class="inventory-other-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增其他出入库
        </el-button>
        <el-input
          v-model="searchQuery"
          placeholder="搜索单据号"
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
      <el-table :data="otherList" style="width: 100%">
        <el-table-column prop="no" label="单据号" width="150" />
        <el-table-column prop="warehouseName" label="仓库" width="120" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'in' ? 'success' : 'danger'">
              {{ row.type === 'in' ? '入库' : '出库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="150" />
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑其他出入库' : '新增其他出入库'" width="600px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="单据号">
          <el-input v-model="formData.no" disabled />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-radio-group v-model="formData.type">
            <el-radio label="in">入库</el-radio>
            <el-radio label="out">出库</el-radio>
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
        <el-form-item label="原因" required>
          <el-input v-model="formData.reason" placeholder="请输入出入库原因" />
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

const searchQuery = ref('')
const otherList = ref<any[]>([])
const warehouses = ref<any[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)

const formData = reactive<any>({
  id: null,
  no: '',
  type: 'in',
  date: new Date().toISOString().split('T')[0],
  warehouseId: null,
  warehouseName: '',
  reason: '',
  remark: ''
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

// 加载其他出入库列表
const loadOtherList = () => {
  try {
    const saved = localStorage.getItem('inventory_other')
    if (saved) {
      let list = JSON.parse(saved)
      
      // 搜索过滤
      if (searchQuery.value) {
        list = list.filter((item: any) => 
          item.no?.toLowerCase().includes(searchQuery.value.toLowerCase())
        )
      }
      
      otherList.value = list
    } else {
      otherList.value = []
    }
  } catch (error) {
    console.error('加载其他出入库列表失败:', error)
  }
}

// 生成单据号
const generateNo = () => {
  const date = new Date()
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  const prefix = formData.type === 'in' ? 'QTRK' : 'QTCK'
  return `${prefix}${dateStr}${random}`
}

// 新增其他出入库
const handleAdd = () => {
  isEdit.value = false
  Object.assign(formData, {
    id: null,
    no: generateNo(),
    type: 'in',
    date: new Date().toISOString().split('T')[0],
    warehouseId: null,
    warehouseName: '',
    reason: '',
    remark: ''
  })
  dialogVisible.value = true
}

// 编辑其他出入库
const handleEdit = (row: any) => {
  isEdit.value = true
  Object.assign(formData, {
    id: row.id,
    no: row.no,
    type: row.type,
    date: row.date,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    reason: row.reason,
    remark: row.remark || ''
  })
  dialogVisible.value = true
}

// 删除其他出入库
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除该记录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const saved = localStorage.getItem('inventory_other')
    if (saved) {
      const list = JSON.parse(saved)
      const filtered = list.filter((item: any) => item.id !== row.id)
      localStorage.setItem('inventory_other', JSON.stringify(filtered))
      loadOtherList()
      ElMessage.success('删除成功')
    }
  } catch {
    // 用户取消删除
  }
}

// 提交表单
const handleSubmit = () => {
  // 验证必填字段
  if (!formData.warehouseId) {
    ElMessage.warning('请选择仓库')
    return
  }
  if (!formData.reason) {
    ElMessage.warning('请输入原因')
    return
  }
  
  // 获取仓库名称
  const warehouse = warehouses.value.find(w => w.id === formData.warehouseId)
  formData.warehouseName = warehouse?.name || ''
  
  // 重新生成单据号（如果是新增且类型改变了）
  if (!isEdit.value) {
    formData.no = generateNo()
  }
  
  try {
    const saved = localStorage.getItem('inventory_other')
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
    
    localStorage.setItem('inventory_other', JSON.stringify(list))
    dialogVisible.value = false
    loadOtherList()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  }
}

// 搜索
const handleSearch = () => {
  loadOtherList()
}

onMounted(() => {
  loadWarehouses()
  loadOtherList()
})
</script>

<style scoped>
.inventory-other-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
