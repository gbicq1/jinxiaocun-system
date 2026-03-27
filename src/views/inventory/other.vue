<template>
  <div class="inventory-other-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增其他出入库
        </el-button>
      </div>
      <el-table :data="otherList" style="width: 100%">
        <el-table-column prop="no" label="单据号" width="150" />
        <el-table-column prop="warehouseName" label="仓库" width="120" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'in' ? 'success' : 'danger'">
              {{ row.type === 'in' ? '入库' : '出库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="150" />
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="其他出入库详情" width="600px">
      <pre style="white-space:pre-wrap; word-break:break-word">{{ JSON.stringify(selectedRow, null, 2) }}</pre>
      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const otherList = ref<any[]>([])
const dialogVisible = ref(false)
const selectedRow = ref<any>(null)

const handleAdd = () => {
  const r = { id: Date.now(), no: `QTRK${Date.now()}`, warehouseName: '默认仓库', type: 'in', reason: '', date: new Date().toISOString() }
  otherList.value.unshift(r)
  selectedRow.value = r
  dialogVisible.value = true
}
const handleView = (row: any) => {
  selectedRow.value = row
  dialogVisible.value = true
}
</script>

<style scoped>
.inventory-other-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
