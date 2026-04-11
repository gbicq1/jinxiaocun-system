<template>
  <div class="backup-container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>数据库备份与恢复</span>
        </div>
      </template>

      <!-- 备份统计 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <el-statistic title="备份总数" :value="stats.totalBackups" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="备份总大小" :value="formatSize(stats.totalSize)" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="最早备份" :value="formatDate(stats.oldestBackup)" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="最新备份" :value="formatDate(stats.newestBackup)" />
        </el-col>
      </el-row>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button type="primary" @click="handleManualBackup" :loading="backingUp">
          <el-icon><Download /></el-icon> 立即备份
        </el-button>
        <el-button type="success" @click="handleExport">
          <el-icon><Upload /></el-icon> 导出数据库
        </el-button>
        <el-button type="warning" @click="handleRestore" :disabled="backupList.length === 0">
          <el-icon><RefreshLeft /></el-icon> 恢复数据库
        </el-button>
        <el-button @click="refreshList">
          <el-icon><Refresh /></el-icon> 刷新列表
        </el-button>
      </div>

      <!-- 备份列表 -->
      <el-table :data="backupList" style="width: 100%" v-loading="loading">
        <el-table-column prop="filename" label="文件名" show-overflow-tooltip />
        <el-table-column prop="size" label="文件大小" width="120">
          <template #default="{ row }">
            {{ formatSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column prop="date" label="备份时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.date) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="handleRestoreFrom(row)">
              恢复
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 备份设置 -->
      <el-divider>备份设置</el-divider>
      <el-form :model="config" label-width="120px" size="default">
        <el-form-item label="自动备份">
          <el-switch v-model="config.autoBackupEnabled" @change="saveConfig" />
        </el-form-item>
        <el-form-item label="备份间隔" v-if="config.autoBackupEnabled">
          <el-select v-model="config.autoBackupInterval" @change="saveConfig" style="width: 150px">
            <el-option label="每天" :value="1" />
            <el-option label="每 2 天" :value="2" />
            <el-option label="每 3 天" :value="3" />
            <el-option label="每周" :value="7" />
            <el-option label="每 15 天" :value="15" />
            <el-option label="每月" :value="30" />
          </el-select>
        </el-form-item>
        <el-form-item label="保留数量">
          <el-input-number v-model="config.keepCount" :min="1" :max="100" @change="saveConfig" />
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Upload, RefreshLeft, Refresh } from '@element-plus/icons-vue'

const loading = ref(false)
const backingUp = ref(false)
const backupList = ref<any[]>([])
const stats = ref({
  totalBackups: 0,
  totalSize: 0,
  oldestBackup: null as Date | null,
  newestBackup: null as Date | null
})
const config = ref({
  autoBackupEnabled: true,
  autoBackupInterval: 1,
  keepCount: 10
})

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const formatDate = (date: Date | string | null): string => {
  if (!date) return '无'
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const loadBackupList = async () => {
  loading.value = true
  try {
    backupList.value = await window.electron!.dbBackupList!()
    stats.value = await window.electron!.dbBackupStats!()
  } catch (error: any) {
    ElMessage.error('加载备份列表失败：' + error.message)
  } finally {
    loading.value = false
  }
}

const loadConfig = async () => {
  try {
    config.value = await window.electron!.dbBackupConfig!()
  } catch (error: any) {
    console.error('加载配置失败:', error)
  }
}

const saveConfig = async () => {
  try {
    await window.electron!.dbBackupSaveConfig!(config.value)
    ElMessage.success('配置已保存')
  } catch (error: any) {
    ElMessage.error('保存配置失败：' + error.message)
  }
}

const refreshList = () => {
  loadBackupList()
}

const handleManualBackup = async () => {
  backingUp.value = true
  try {
    await window.electron!.dbBackupManual!()
    ElMessage.success('备份成功')
    await loadBackupList()
  } catch (error: any) {
    ElMessage.error('备份失败：' + error.message)
  } finally {
    backingUp.value = false
  }
}

const handleExport = async () => {
  try {
    await window.electron!.dbBackupExport!()
    ElMessage.success('导出成功')
  } catch (error: any) {
    ElMessage.error('导出失败：' + error.message)
  }
}

const handleRestore = async () => {
  if (backupList.value.length === 0) {
    ElMessage.warning('没有可用的备份文件')
    return
  }

  try {
    await window.electron!.dbBackupRestore!()
    ElMessage.success('恢复成功，请重启系统以应用更改')
    await loadBackupList()
  } catch (error: any) {
    ElMessage.error('恢复失败：' + error.message)
  }
}

const handleRestoreFrom = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要从备份文件 "${row.filename}" 恢复吗？恢复前会自动备份当前数据。`,
      '确认恢复',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await window.electron!.dbBackupRestoreFromPath!(row.path)
    ElMessage.success('恢复成功，请重启系统以应用更改')
    await loadBackupList()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('恢复失败：' + error.message)
    }
  }
}

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除备份文件 "${row.filename}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const result = await window.electron!.dbBackupDelete!(row.filename)
    if (result.success) {
      ElMessage.success('删除成功')
      await loadBackupList()
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败：' + error.message)
    }
  }
}

onMounted(() => {
  loadBackupList()
  loadConfig()
})
</script>

<style scoped>
.backup-container {
  padding: 20px;
}

.box-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
}

.stats-row {
  margin-bottom: 20px;
}

.action-buttons {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}
</style>
