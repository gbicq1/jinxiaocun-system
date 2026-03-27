<template>
  <div class="customers-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增客户
        </el-button>
      </div>
      <el-table :data="customers" style="width: 100%">
        <el-table-column prop="code" label="客户编码" width="120" />
        <el-table-column prop="name" label="客户名称" />
        <el-table-column prop="contactPerson" label="联系人" width="120" />
        <el-table-column prop="contactPhone" label="联系电话" width="150" />
        <el-table-column prop="creditLimit" label="信用额度" width="120">
          <template #default="{ row }">
            ¥{{ row.creditLimit }}
          </template>
        </el-table-column>
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
    <el-dialog v-model="dialogVisible" title="客户" width="600px">
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-form-item label="编码" prop="code"><el-input v-model="formData.code" /></el-form-item>
        <el-form-item label="名称" prop="name"><el-input v-model="formData.name" /></el-form-item>
        <el-form-item label="联系人"><el-input v-model="formData.contactPerson" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="formData.contactPhone" /></el-form-item>
        <el-form-item label="信用额度"><el-input-number v-model="formData.creditLimit" :min="0" /></el-form-item>
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

const customers = ref<any[]>([])
const dialogVisible = ref(false)
const formRef = ref<any>(null)
const formData = reactive({ id: 0, code: '', name: '', contactPerson: '', contactPhone: '', creditLimit: 0, status: 1 })

const formRules = {
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }]
}

const loadCustomers = () => {
  const saved = localStorage.getItem('customers')
  customers.value = saved ? JSON.parse(saved) : []
}

const saveCustomers = () => localStorage.setItem('customers', JSON.stringify(customers.value))

const handleAdd = () => {
  Object.assign(formData, { id: Date.now(), code: '', name: '', contactPerson: '', contactPhone: '', creditLimit: 0, status: 1 })
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  Object.assign(formData, { ...row })
  dialogVisible.value = true
}

const handleDelete = (row: any) => {
  customers.value = customers.value.filter(c => c.id !== row.id)
  saveCustomers()
}

const handleSubmit = () => {
  if (!formRef.value) return
  
  formRef.value.validate((valid: boolean) => {
    if (valid) {
      const idx = customers.value.findIndex(c => c.id === formData.id)
      if (idx === -1) customers.value.push({ ...formData })
      else customers.value[idx] = { ...formData }
      saveCustomers()
      dialogVisible.value = false
    } else {
      return false
    }
  })
}

onMounted(() => loadCustomers())
</script>

<style scoped>
.customers-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
