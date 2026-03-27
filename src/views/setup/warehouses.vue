<template>
  <div class="warehouses-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增仓库
        </el-button>
      </div>
      <el-table :data="warehouses" style="width: 100%">
        <el-table-column prop="code" label="仓库编码" width="120" />
        <el-table-column prop="name" label="仓库名称" />
        <el-table-column prop="address" label="地址" min-width="200" />
        <el-table-column prop="contactPerson" label="联系人" width="120" />
        <el-table-column prop="contactPhone" label="联系电话" width="150" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
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
          code: [{ required: true, message: '请输入仓库编码', trigger: 'blur' }],
          name: [{ required: true, message: '请输入仓库名称', trigger: 'blur' }],
          address: [{ required: true, message: '请输入地址', trigger: 'blur' }]
        }"
        label-width="100px"
      >
        <el-form-item label="仓库编码" prop="code">
          <el-input v-model="formData.code" placeholder="请输入仓库编码" />
        </el-form-item>
        <el-form-item label="仓库名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入仓库名称" />
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input v-model="formData.address" placeholder="请输入地址" />
        </el-form-item>
        <el-form-item label="联系人" prop="contactPerson">
          <el-input v-model="formData.contactPerson" placeholder="请输入联系人" />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactPhone">
          <el-input v-model="formData.contactPhone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch
            v-model="formData.status"
            :active-value="1"
            :inactive-value="0"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
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

interface Warehouse {
  id?: number
  code: string
  name: string
  address: string
  contactPerson?: string
  contactPhone?: string
  status: number
  remark?: string
}

const warehouses = ref<Warehouse[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增仓库')
const formRef = ref()
const selectedRow = ref<Warehouse | null>(null)

const formData = reactive<Warehouse>({
  code: '',
  name: '',
  address: '',
  contactPerson: '',
  contactPhone: '',
  status: 1,
  remark: ''
})

// 加载仓库列表
const loadWarehouses = async () => {
  try {
    if (window.electron && window.electron.dbQuery) {
      const result = await window.electron.dbQuery('warehouses', 'SELECT * FROM warehouses ORDER BY created_at DESC')
      warehouses.value = result
    } else {
      const savedData = localStorage.getItem('warehouses')
      warehouses.value = savedData ? JSON.parse(savedData) : []
    }
  } catch (error) {
    ElMessage.error('加载仓库列表失败')
    console.error(error)
  }
}

// 新增仓库
const handleAdd = () => {
  dialogTitle.value = '新增仓库'
  Object.assign(formData, {
    code: '',
    name: '',
    address: '',
    contactPerson: '',
    contactPhone: '',
    status: 1,
    remark: ''
  })
  dialogVisible.value = true
}

// 编辑仓库
const handleEdit = (row: Warehouse) => {
  dialogTitle.value = '编辑仓库'
  Object.assign(formData, row)
  selectedRow.value = row
  dialogVisible.value = true
}

// 删除仓库
const handleDelete = async (row: Warehouse) => {
  try {
    await ElMessageBox.confirm('确定要删除该仓库吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    if (window.electron && window.electron.dbDelete) {
      await window.electron.dbDelete('warehouses', 'id = ?', [row.id])
    } else {
      const filtered = warehouses.value.filter((r: Warehouse) => r.id !== row.id)
      localStorage.setItem('warehouses', JSON.stringify(filtered))
    }
    
    ElMessage.success('删除成功')
    loadWarehouses()
  } catch {
    // 用户取消删除
  }
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    
    if (formData.id) {
      // 更新
      if (window.electron && window.electron.dbUpdate) {
        await window.electron.dbUpdate('warehouses', formData, 'id = ?', [formData.id])
      } else {
        const savedData = localStorage.getItem('warehouses')
        const allWarehouses = savedData ? JSON.parse(savedData) : []
        const index = allWarehouses.findIndex((r: Warehouse) => r.id === formData.id)
        if (index !== -1) {
          allWarehouses[index] = { ...formData }
          localStorage.setItem('warehouses', JSON.stringify(allWarehouses))
        }
      }
      ElMessage.success('更新成功')
    } else {
      // 新增
      const newWarehouse = {
        ...formData,
        id: Date.now()
      }
      
      if (window.electron && window.electron.dbInsert) {
        await window.electron.dbInsert('warehouses', newWarehouse)
      } else {
        const savedData = localStorage.getItem('warehouses')
        const allWarehouses = savedData ? JSON.parse(savedData) : []
        allWarehouses.push(newWarehouse)
        localStorage.setItem('warehouses', JSON.stringify(allWarehouses))
      }
      
      ElMessage.success('新增成功')
    }
    
    dialogVisible.value = false
    loadWarehouses()
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

onMounted(() => {
  loadWarehouses()
})
</script>

<style scoped>
.warehouses-page {
  padding: 20px;
}

.toolbar {
  margin-bottom: 20px;
}
</style>
