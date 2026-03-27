<template>
  <div class="employee-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增职工
        </el-button>
      </div>

      <el-table :data="employees" style="width: 100%" border>
        <el-table-column prop="code" label="工号" width="100" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="position" label="职位" width="120" />
        <el-table-column prop="department" label="部门" width="120" />
        <el-table-column prop="phone" label="电话" width="150" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '在职' : '离职' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="joinDate" label="入职日期" width="120" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="工号" prop="code">
              <el-input v-model="formData.code" placeholder="请输入工号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="formData.name" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="职位" prop="position">
              <el-input v-model="formData.position" placeholder="请输入职位" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="部门" prop="department">
              <el-input v-model="formData.department" placeholder="请输入部门" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="电话" prop="phone">
              <el-input v-model="formData.phone" placeholder="请输入电话" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="formData.email" placeholder="请输入邮箱" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="入职日期" prop="joinDate">
              <el-date-picker v-model="formData.joinDate" type="date" placeholder="选择入职日期" style="width: 100%" value-format="YYYY-MM-DD" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="formData.status" style="width: 100%">
                <el-option label="在职" value="active" />
                <el-option label="离职" value="inactive" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注" prop="remark">
          <el-input v-model="formData.remark" type="textarea" :rows="3" placeholder="请输入备注" />
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
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

interface Employee {
  id?: number
  code: string
  name: string
  position: string
  department: string
  phone: string
  email: string
  status: 'active' | 'inactive'
  joinDate?: string
  remark?: string
}

const employees = ref<Employee[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增员工')
const formRef = ref<FormInstance>()
const isEditMode = ref(false)

const formData = reactive<Employee>({
  code: '',
  name: '',
  position: '',
  department: '',
  phone: '',
  email: '',
  status: 'active',
  joinDate: '',
  remark: ''
})

const rules = reactive<FormRules>({
  code: [{ required: true, message: '请输入员工编号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  position: [{ required: true, message: '请输入职位', trigger: 'blur' }],
  department: [{ required: true, message: '请输入部门', trigger: 'blur' }]
})

const loadEmployees = () => {
  const saved = localStorage.getItem('employees')
  employees.value = saved ? JSON.parse(saved) : []
}

const saveEmployees = () => {
  localStorage.setItem('employees', JSON.stringify(employees.value))
}

const handleAdd = () => {
  dialogTitle.value = '新增职工'
  isEditMode.value = false
  Object.assign(formData, {
    id: undefined,
    code: '',
    name: '',
    position: '',
    department: '',
    phone: '',
    email: '',
    status: 'active',
    joinDate: '',
    remark: ''
  })
  dialogVisible.value = true
}

const handleEdit = (row: Employee) => {
  dialogTitle.value = '编辑职工'
  isEditMode.value = true
  Object.assign(formData, { ...row })
  dialogVisible.value = true
}

const handleDelete = async (row: Employee) => {
  try {
    await ElMessageBox.confirm(`确定要删除员工 "${row.name}" 吗？`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    employees.value = employees.value.filter(e => e.id !== row.id)
    saveEmployees()
    ElMessage.success('删除成功')
  } catch {
    ElMessage.info('已取消删除')
  }
}

const handleSubmit = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid) return

    if (isEditMode.value && formData.id) {
      const idx = employees.value.findIndex(e => e.id === formData.id)
      if (idx !== -1) {
        employees.value[idx] = { ...formData }
      }
    } else {
      formData.id = Date.now()
      employees.value.push({ ...formData })
    }

    saveEmployees()
    ElMessage.success(isEditMode.value ? '编辑成功' : '新增成功')
    dialogVisible.value = false
    loadEmployees()
  })
}

onMounted(() => {
  loadEmployees()
})
</script>

<style scoped>
.employee-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
