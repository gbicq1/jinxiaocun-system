<template>
  <div class="inventory-count-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增盘点单
        </el-button>
        <el-input
          v-model="searchQuery"
          placeholder="搜索盘点单号"
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
      <el-table :data="countList" style="width: 100%">
        <el-table-column prop="countNo" label="盘点单号" width="150" />
        <el-table-column prop="warehouseName" label="仓库" width="120" />
        <el-table-column prop="countDate" label="盘点日期" width="120" />
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑盘点单' : '新增盘点单'" width="600px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="盘点单号">
          <el-input v-model="formData.countNo" disabled />
        </el-form-item>
        <el-form-item label="盘点日期">
          <el-date-picker
            v-model="formData.countDate"
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
const countList = ref<any[]>([])
const warehouses = ref<any[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)

const formData = reactive<any>({
  id: null,
  countNo: '',
  countDate: new Date().toISOString().split('T')[0],
  warehouseId: null,
  warehouseName: '',
  remark: '',
  status: 'draft'
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

// 加载盘点单列表
const loadCountList = () => {
  try {
    const saved = localStorage.getItem('inventory_counts')
    if (saved) {
      let list = JSON.parse(saved)
      
      // 搜索过滤
      if (searchQuery.value) {
        list = list.filter((item: any) => 
          item.countNo?.toLowerCase().includes(searchQuery.value.toLowerCase())
        )
      }
      
      countList.value = list
    } else {
      countList.value = []
    }
  } catch (error) {
    console.error('加载盘点单列表失败:', error)
  }
}

// 生成盘点单号
const generateCountNo = () => {
  const date = new Date()
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `PD${dateStr}${random}`
}

// 新增盘点单
const handleAdd = () => {
  isEdit.value = false
  Object.assign(formData, {
    id: null,
    countNo: generateCountNo(),
    countDate: new Date().toISOString().split('T')[0],
    warehouseId: null,
    warehouseName: '',
    remark: '',
    status: 'draft'
  })
  dialogVisible.value = true
}

// 编辑盘点单
const handleEdit = (row: any) => {
  isEdit.value = true
  Object.assign(formData, {
    id: row.id,
    countNo: row.countNo,
    countDate: row.countDate,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    remark: row.remark || '',
    status: row.status
  })
  dialogVisible.value = true
}

// 删除盘点单
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除该盘点单吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    const saved = localStorage.getItem('inventory_counts')
    if (saved) {
      const list = JSON.parse(saved)
      const filtered = list.filter((item: any) => item.id !== row.id)
      localStorage.setItem('inventory_counts', JSON.stringify(filtered))
      loadCountList()
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
  
  // 获取仓库名称
  const warehouse = warehouses.value.find(w => w.id === formData.warehouseId)
  formData.warehouseName = warehouse?.name || ''
  
  try {
    const saved = localStorage.getItem('inventory_counts')
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
    
    localStorage.setItem('inventory_counts', JSON.stringify(list))
    dialogVisible.value = false
    loadCountList()
  } catch (error) {
    console.error('保存盘点单失败:', error)
    ElMessage.error('保存失败')
  }
}

// 搜索
const handleSearch = () => {
  loadCountList()
}

onMounted(() => {
  loadWarehouses()
  loadCountList()
})
</script>

<style scoped>
.inventory-count-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
