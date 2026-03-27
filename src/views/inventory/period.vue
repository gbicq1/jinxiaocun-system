<template>
  <div class="inventory-period-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增期初库存
        </el-button>
      </div>
      <el-table :data="periodList" style="width: 100%">
        <el-table-column prop="productCode" label="产品编码" width="120" />
        <el-table-column prop="productName" label="产品名称" min-width="150" />
        <el-table-column prop="warehouseName" label="仓库" width="120" />
        <el-table-column prop="periodType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.periodType === 'begin' ? 'success' : 'warning'">
              {{ row.periodType === 'begin' ? '期初' : '期末' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="100" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="期初/期末详情" width="600px">
      <pre style="white-space:pre-wrap; word-break:break-word">{{ JSON.stringify(selectedRow, null, 2) }}</pre>
      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const periodList = ref<any[]>([])
const dialogVisible = ref(false)
const selectedRow = ref<any>(null)

const handleAdd = () => {
  const r = { id: Date.now(), productCode: 'P000', productName: '示例产品', warehouseName: '默认仓库', periodType: 'begin', quantity: 0, unit: '个', date: new Date().toISOString() }
  periodList.value.unshift(r)
  selectedRow.value = r
  dialogVisible.value = true
}
const handleEdit = (row: any) => {
  selectedRow.value = row
  dialogVisible.value = true
}
const handleDelete = (row: any) => {
  periodList.value = periodList.value.filter((p: any) => p.id !== row.id)
}
</script>

<style scoped>
.inventory-period-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
