<template>
  <div class="suppliers-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增供应商
        </el-button>
      </div>
      <el-table :data="suppliers" style="width: 100%">
        <el-table-column prop="code" label="供应商编码" width="120" />
        <el-table-column prop="name" label="供应商名称" />
        <el-table-column prop="contactPerson" label="联系人" width="120" />
        <el-table-column prop="contactPhone" label="联系电话" width="150" />
        <el-table-column prop="contactEmail" label="邮箱" min-width="180" />
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
    <el-dialog v-model="dialogVisible" title="供应商" width="600px">
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-form-item label="编码" prop="code"><el-input v-model="formData.code" /></el-form-item>
        <el-form-item label="名称" prop="name"><el-input v-model="formData.name" /></el-form-item>
        <el-form-item label="联系人"><el-input v-model="formData.contactPerson" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="formData.contactPhone" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="formData.contactEmail" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="formData.status" active-text="启用" inactive-text="停用" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { dbQuery, dbInsert, dbUpdate, dbDelete } from '@/utils/db'

const suppliers = ref<any[]>([])
const dialogVisible = ref(false)
const formRef = ref<any>(null)
const formData = reactive({ id: 0, code: '', name: '', contactPerson: '', contactPhone: '', contactEmail: '', status: 1 })

const formRules = {
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }]
}

const loadSuppliers = async () => {
  try {
    const result = await dbQuery('SELECT * FROM suppliers ORDER BY created_at DESC')
    suppliers.value = result
  } catch (error: any) {
    console.error('加载供应商列表失败:', error)
  }
}

const handleAdd = () => {
  Object.assign(formData, { id: null, code: '', name: '', contactPerson: '', contactPhone: '', contactEmail: '', status: 1 })
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  Object.assign(formData, { ...row })
  dialogVisible.value = true
}

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除该供应商吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await dbDelete('suppliers', 'id = ?', [row.id])
    loadSuppliers()
    ElMessage.success('删除成功')
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败：' + error.message)
    }
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    
    if (formData.id) {
      await dbUpdate('suppliers', formData, 'id = ?', [formData.id])
      ElMessage.success('更新成功')
    } else {
      await dbInsert('suppliers', formData)
      ElMessage.success('新增成功')
    }
    
    dialogVisible.value = false
    loadSuppliers()
  } catch (error: any) {
    console.error('表单验证失败:', error)
  }
}

onMounted(() => loadSuppliers())
</script>

<style scoped>
.suppliers-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
