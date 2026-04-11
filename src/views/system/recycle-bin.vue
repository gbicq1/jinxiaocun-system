<template>
  <div class="recycle-bin-page">
    <el-card>
      <div class="toolbar">
        <el-button type="danger" @click="handleEmptyRecycleBin">
          <el-icon><Delete /></el-icon>
          清空回收站
        </el-button>
        <el-alert
          v-if="recycleBinItems.length === 0"
          title="回收站为空"
          type="info"
          :closable="false"
          show-icon
          style="margin-top: 20px"
        />
      </div>

      <el-table
        v-if="recycleBinItems.length > 0"
        :data="recycleBinItems"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'inbound' ? 'success' : 'warning'">
              {{ row.type === 'inbound' ? '入库单' : '出库单' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="voucherNo" label="凭证号" width="150" />
        <el-table-column prop="voucherDate" label="单据日期" width="120" />
        <el-table-column label="客户/供应商" min-width="120">
          <template #default="{ row }">
            {{ row.type === 'inbound' ? row.supplierName : row.customerName }}
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="总金额" width="120">
          <template #default="{ row }">
            {{ row.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
          </template>
        </el-table-column>
        <el-table-column prop="deletedAt" label="删除时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.deletedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="operation-buttons">
              <el-button type="success" size="small" @click="handleRestore(row)">恢复</el-button>
              <el-button type="danger" size="small" @click="handlePermanentDelete(row)">永久删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 批量操作 -->
    <el-card v-if="selectedItems.length > 0" style="margin-top: 20px">
      <div class="batch-toolbar">
        <span>已选择 {{ selectedItems.length }} 项</span>
        <div>
          <el-button type="success" @click="handleBatchRestore">批量恢复</el-button>
          <el-button type="danger" @click="handleBatchDelete">批量永久删除</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

interface RecycleBinItem {
  id: number
  type: 'inbound' | 'outbound'
  voucherNo: string
  voucherDate: string
  customerName?: string
  supplierName?: string
  totalAmount: number
  deletedAt: string
  originalData: any
}

const recycleBinItems = ref<RecycleBinItem[]>([])
const selectedItems = ref<RecycleBinItem[]>([])

// 加载回收站数据
const loadRecycleBin = async () => {
  try {
    recycleBinItems.value = await db.getRecycleBinItems()
  } catch (error) {
    console.error('加载回收站数据失败:', error)
    recycleBinItems.value = []
  }
}

// 保存回收站数据
const saveRecycleBin = async () => {
  try {
    await db.saveRecycleBinItems(recycleBinItems.value)
  } catch (error) {
    console.error('保存回收站数据失败:', error)
  }
}

// 格式化日期时间
const formatDateTime = (dateTime: string) => {
  return dayjs(dateTime).format('YYYY-MM-DD HH:mm:ss')
}

// 恢复单个项目
const handleRestore = async (item: RecycleBinItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要恢复 ${item.type === 'inbound' ? '入库单' : '出库单'} "${item.voucherNo}" 吗？`,
      '恢复确认',
      {
        confirmButtonText: '确定恢复',
        cancelButtonText: '取消',
        type: 'success'
      }
    )

    if (item.type === 'inbound') {
      await db.addInbound(item.originalData)
    } else {
      await db.addOutbound(item.originalData)
    }

    recycleBinItems.value = recycleBinItems.value.filter(r => r.id !== item.id)
    await saveRecycleBin()
    ElMessage.success('恢复成功')
  } catch {
    ElMessage.info('已取消恢复')
  }
}

// 永久删除单个项目
const handlePermanentDelete = async (item: RecycleBinItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要永久删除 ${item.type === 'inbound' ? '入库单' : '出库单'} "${item.voucherNo}" 吗？此操作不可恢复！`,
      '永久删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    recycleBinItems.value = recycleBinItems.value.filter(r => r.id !== item.id)
    saveRecycleBin()
    ElMessage.success('永久删除成功')
  } catch {
    ElMessage.info('已取消删除')
  }
}

// 清空回收站
const handleEmptyRecycleBin = async () => {
  if (recycleBinItems.value.length === 0) {
    ElMessage.warning('回收站已经是空的')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要清空回收站吗？将永久删除所有 ${recycleBinItems.value.length} 项数据，此操作不可恢复！`,
      '清空回收站确认',
      {
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    recycleBinItems.value = []
    saveRecycleBin()
    ElMessage.success('回收站已清空')
  } catch {
    ElMessage.info('已取消清空')
  }
}

// 批量恢复
const handleBatchRestore = async () => {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请先选择要恢复的项目')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要批量恢复选中的 ${selectedItems.value.length} 项吗？`,
      '批量恢复确认',
      {
        confirmButtonText: '确定恢复',
        cancelButtonText: '取消',
        type: 'success'
      }
    )

    // 恢复选中的项目
    for (const item of selectedItems.value) {
      if (item.type === 'inbound') {
        await db.addInbound(item.originalData)
      } else {
        await db.addOutbound(item.originalData)
      }
      recycleBinItems.value = recycleBinItems.value.filter(r => r.id !== item.id)
    }

    const restoredCount = selectedItems.value.length
    await saveRecycleBin()
    selectedItems.value = []
    ElMessage.success(`成功恢复 ${restoredCount} 项`)
  } catch {
    ElMessage.info('已取消批量恢复')
  }
}

// 批量永久删除
const handleBatchDelete = async () => {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请先选择要删除的项目')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要批量永久删除选中的 ${selectedItems.value.length} 项吗？此操作不可恢复！`,
      '批量永久删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    // 删除选中的项目
    const selectedIds = selectedItems.value.map(item => item.id)
    recycleBinItems.value = recycleBinItems.value.filter(item => !selectedIds.includes(item.id))

    const deletedCount = selectedItems.value.length
    saveRecycleBin()
    selectedItems.value = []
    ElMessage.success(`成功永久删除 ${deletedCount} 项`)
  } catch {
    ElMessage.info('已取消批量删除')
  }
}

// 选择变化处理
const handleSelectionChange = (selection: RecycleBinItem[]) => {
  selectedItems.value = selection
}

onMounted(() => {
  loadRecycleBin()
})
</script>

<style scoped>
.recycle-bin-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
.batch-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.operation-buttons {
  display: flex;
  gap: 8px;
}
</style>