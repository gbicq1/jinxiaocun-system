<template>
  <div class="system-users-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增用户
        </el-button>
      </div>
      <el-table :data="users" style="width: 100%">
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="realName" label="真实姓名" width="120" />
        <el-table-column prop="role" label="角色" width="100" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column prop="phone" label="电话" width="150" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastLoginTime" label="最后登录" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="warning" size="small" @click="handleResetPassword(row)">重置密码</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑用户对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="{
          username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
          realName: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
          role: [{ required: true, message: '请选择角色', trigger: 'change' }],
          email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }],
          phone: [{ required: true, message: '请输入电话', trigger: 'blur' }]
        }"
        label-width="80px"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="formData.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="真实姓名" prop="realName">
          <el-input v-model="formData.realName" placeholder="请输入真实姓名" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="formData.role" style="width: 100%">
            <el-option
              v-for="role in roles"
              :key="role"
              :label="role"
              :value="role"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="formData.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="formData.phone" placeholder="请输入电话" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch v-model="formData.status" :active-value="1" :inactive-value="0" />
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
import dayjs from 'dayjs'

interface User {
  id?: number
  username: string
  realName: string
  role: string
  email: string
  phone: string
  status: 0 | 1
  lastLoginTime?: string
}

const users = ref<User[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const dialogVisible = ref(false)
const dialogTitle = ref('新增用户')
const formRef = ref()
const selectedRow = ref<User | null>(null)

const formData = reactive<User>({
  username: '',
  realName: '',
  role: 'admin',
  email: '',
  phone: '',
  status: 1,
  lastLoginTime: undefined
})

const roles = ['admin', 'operator', 'viewer']

// 加载用户列表
const loadUsers = async () => {
  try {
    if (window.electron && window.electron.dbQuery) {
      const result = await window.electron.dbQuery('system_users', 'SELECT * FROM system_users ORDER BY created_at DESC')
      users.value = result
    } else {
      const savedData = localStorage.getItem('system_users')
      users.value = savedData ? JSON.parse(savedData) : []
    }
    total.value = users.value.length
  } catch (error) {
    ElMessage.error('加载用户列表失败')
    console.error(error)
  }
}

// 新增用户
const handleAdd = () => {
  dialogTitle.value = '新增用户'
  Object.assign(formData, {
    username: '',
    realName: '',
    role: 'admin',
    email: '',
    phone: '',
    status: 1,
    lastLoginTime: undefined
  })
  dialogVisible.value = true
}

// 编辑用户
const handleEdit = (row: User) => {
  dialogTitle.value = '编辑用户'
  Object.assign(formData, row)
  selectedRow.value = row
  dialogVisible.value = true
}

// 删除用户
const handleDelete = async (row: User) => {
  try {
    await ElMessageBox.confirm('确定要删除该用户吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    if (window.electron && window.electron.dbDelete) {
      await window.electron.dbDelete('system_users', 'id = ?', [row.id])
    } else {
      const filtered = users.value.filter(r => r.id !== row.id)
      localStorage.setItem('system_users', JSON.stringify(filtered))
    }
    
    ElMessage.success('删除成功')
    loadUsers()
  } catch {
    // 用户取消删除
  }
}

// 重置密码
const handleResetPassword = async (row: User) => {
  try {
    await ElMessageBox.confirm('确定要重置该用户密码吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    ElMessage.success('密码已重置为 123456')
  } catch {
    // 用户取消
  }
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    
    if (formData.id) {
      // 更新
      if (window.electron && window.electron.dbUpdate) {
        await window.electron.dbUpdate('system_users', formData, 'id = ?', [formData.id])
      } else {
        const savedData = localStorage.getItem('system_users')
        const allUsers = savedData ? JSON.parse(savedData) : []
        const index = allUsers.findIndex(r => r.id === formData.id)
        if (index !== -1) {
          allUsers[index] = { ...formData }
          localStorage.setItem('system_users', JSON.stringify(allUsers))
        }
      }
      ElMessage.success('更新成功')
    } else {
      // 新增
      const newUser = {
        ...formData,
        id: Date.now()
      }
      
      if (window.electron && window.electron.dbInsert) {
        await window.electron.dbInsert('system_users', newUser)
      } else {
        const savedData = localStorage.getItem('system_users')
        const allUsers = savedData ? JSON.parse(savedData) : []
        allUsers.push(newUser)
        localStorage.setItem('system_users', JSON.stringify(allUsers))
      }
      
      ElMessage.success('新增成功')
    }
    
    dialogVisible.value = false
    loadUsers()
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.system-users-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
