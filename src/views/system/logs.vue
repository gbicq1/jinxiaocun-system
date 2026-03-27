<template>
  <div class="system-logs-page">
    <el-card>
      <div class="toolbar">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 240px"
        />
        <el-button @click="handleSearch" style="margin-left: 10px;">查询</el-button>
        <el-button @click="handleClear">清空</el-button>
      </div>
      <el-table :data="logs" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="module" label="模块" width="100" />
        <el-table-column prop="action" label="操作" width="120" />
        <el-table-column prop="content" label="内容" min-width="200" />
        <el-table-column prop="ip" label="IP 地址" width="150" />
        <el-table-column prop="createTime" label="时间" width="180" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleView(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    <el-dialog v-model="dialogVisible" title="日志详情" width="700px">
      <pre style="white-space:pre-wrap; word-break:break-word">{{ JSON.stringify(selectedRow, null, 2) }}</pre>
      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const dateRange = ref<[Date, Date] | null>(null)
const logs = ref<any[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const dialogVisible = ref(false)
const selectedRow = ref<any>(null)

const handleSearch = () => {
  // 简单示例：如果没有日志则生成示例数据
  if (!logs.value || logs.value.length === 0) {
    logs.value = [
      { id: 1, username: 'admin', module: '系统', action: '登录', content: '用户 admin 登录', ip: '127.0.0.1', createTime: new Date().toISOString() }
    ]
  }
}

const handleClear = () => {
  logs.value = []
}

const handleView = (row: any) => {
  selectedRow.value = row
  dialogVisible.value = true
}
</script>

<style scoped>
.system-logs-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
.pagination { margin-top: 20px; display: flex; justify-content: flex-end; }
</style>
