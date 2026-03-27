<template>
  <div class="finance-reconciliation-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增对账单
        </el-button>
      </div>
      <el-table :data="reconciliationList" style="width: 100%">
        <el-table-column prop="reconciliationNo" label="对账单号" width="150" />
        <el-table-column prop="partnerName" label="客户/供应商" width="150" />
        <el-table-column prop="partnerType" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.partnerType === 'customer' ? 'success' : 'warning'">
              {{ row.partnerType === 'customer' ? '客户' : '供应商' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="startDate" label="开始日期" width="120" />
        <el-table-column prop="endDate" label="结束日期" width="120" />
        <el-table-column prop="totalAmount" label="总金额" width="120">
          <template #default="{ row }">
            ¥{{ row.totalAmount.toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'confirmed' ? 'success' : 'warning'">
              {{ row.status === 'confirmed' ? '已确认' : '待确认' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-dialog v-model="dialogVisible" title="对账单详情" width="700px">
        <pre style="white-space:pre-wrap; word-break:break-word">{{ JSON.stringify(selectedRow, null, 2) }}</pre>
        <template #footer>
          <el-button @click="dialogVisible = false">关闭</el-button>
        </template>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const reconciliationList = ref<any[]>([])
const dialogVisible = ref(false)
const selectedRow = ref<any>(null)

const handleAdd = () => {
  const r = { reconciliationNo: `RB${Date.now()}`, partnerName: '示例客户', partnerType: 'customer', startDate: new Date().toISOString(), endDate: new Date().toISOString(), totalAmount: 0, status: 'pending' }
  reconciliationList.value.unshift(r)
  selectedRow.value = r
  dialogVisible.value = true
}
const handleView = (row: any) => {
  selectedRow.value = row
  dialogVisible.value = true
}
</script>

<style scoped>
.finance-reconciliation-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
