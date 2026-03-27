<template>
  <div class="inventory-transfer-page">
    <el-card>
        <div class="toolbar">
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            新增调拨单
          </el-button>
        </div>
        <el-table :data="transfers" style="width: 100%">
        <el-table-column prop="transferNo" label="调拨单号" width="150" />
        <el-table-column prop="fromWarehouse" label="调出仓库" width="120" />
        <el-table-column prop="toWarehouse" label="调入仓库" width="120" />
        <el-table-column prop="transferDate" label="调拨日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : 'warning'">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="调拨单详情" width="600px">
      <pre style="white-space:pre-wrap; word-break:break-word">{{ JSON.stringify(selectedRow, null, 2) }}</pre>
      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const transfers = ref<any[]>([])
const dialogVisible = ref(false)
const selectedRow = ref<any>(null)

const handleAdd = () => {
  // 简单示例：新增空记录并打开查看
  const r = { id: Date.now(), transferNo: `DB${Date.now()}`, fromWarehouse: '仓库A', toWarehouse: '仓库B', transferDate: new Date().toISOString(), status: 'draft' }
  transfers.value.unshift(r)
  selectedRow.value = r
  dialogVisible.value = true
}
const handleView = (row: any) => {
  selectedRow.value = row
  dialogVisible.value = true
}
</script>

<style scoped>
.inventory-transfer-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
