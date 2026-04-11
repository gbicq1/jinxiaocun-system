<template>
  <div class="system-roles-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增角色
        </el-button>
      </div>
      <el-table :data="roles" style="width: 100%">
        <el-table-column prop="name" label="角色名称" width="120" />
        <el-table-column prop="code" label="角色编码" width="120" />
        <el-table-column prop="description" label="描述" min-width="200" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="warning" size="small" @click="handlePermissions(row)">权限</el-button>
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
          name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
          code: [{ required: true, message: '请输入角色编码', trigger: 'blur' }]
        }"
        label-width="100px"
      >
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="角色编码" prop="code">
          <el-input v-model="formData.code" placeholder="请输入角色编码" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述"
          />
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

interface Role {
  id?: number
  name: string
  code: string
  description?: string
  status: number
}

const roles = ref<Role[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增角色')
const formRef = ref()
const selectedRow = ref<Role | null>(null)

const formData = reactive<Role>({
  name: '',
  code: '',
  description: '',
  status: 1
})

// 加载角色列表
const loadRoles = async () => {
  try {
    roles.value = await db.getRoles()
  } catch (error) {
    ElMessage.error('加载角色列表失败')
    console.error(error)
  }
}

// 新增角色
const handleAdd = () => {
  dialogTitle.value = '新增角色'
  Object.assign(formData, {
    name: '',
    code: '',
    description: '',
    status: 1
  })
  dialogVisible.value = true
}

// 编辑角色
const handleEdit = (row: Role) => {
  dialogTitle.value = '编辑角色'
  Object.assign(formData, row)
  selectedRow.value = row
  dialogVisible.value = true
}

// 删除角色
const handleDelete = async (row: Role) => {
  try {
    await ElMessageBox.confirm('确定要删除该角色吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await db.deleteRole(row.id)

    ElMessage.success('删除成功')
    loadRoles()
  } catch {
    // 用户取消删除
  }
}

// 权限设置
const handlePermissions = (row: Role) => {
  ElMessage.info('权限设置功能待实现')
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()

    if (formData.id) {
      await db.updateRole(formData)
      ElMessage.success('更新成功')
    } else {
      const saved = await db.addRole(formData)
      formData.id = saved.id
      ElMessage.success('新增成功')
    }

    dialogVisible.value = false
    loadRoles()
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

onMounted(() => {
  loadRoles()
})
</script>

<style scoped>
.system-roles-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
