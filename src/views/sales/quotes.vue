<template>
  <div class="sales-quotes-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增报价单
        </el-button>
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出 Excel
        </el-button>
      </div>
      <el-table :data="quotes" style="width: 100%">
        <el-table-column prop="quoteNo" label="报价单号" width="150" />
        <el-table-column prop="customerName" label="客户名称" width="150" />
        <el-table-column prop="quoteDate" label="报价日期" width="120" />
        <el-table-column prop="validDate" label="有效期至" width="120" />
        <el-table-column prop="totalAmount" label="总金额" width="120">
          <template #default="{ row }">
            ¥{{ row.totalAmount.toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="success" size="small" @click="handleConvert(row)">转订单</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const quotes = ref([])

const handleAdd = () => console.log('新增报价单')
const handleEdit = (row: any) => console.log('编辑报价单:', row)
const handleDelete = (row: any) => console.log('删除报价单:', row)
const handleConvert = (row: any) => console.log('转订单:', row)
const handleExport = () => console.log('导出 Excel')

const getStatusType = (status: string) => {
  const map: any = {
    'draft': 'info',
    'approved': 'success',
    'converted': 'warning',
    'cancelled': 'danger'
  }
  return map[status] || ''
}
</script>

<style scoped>
.sales-quotes-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
