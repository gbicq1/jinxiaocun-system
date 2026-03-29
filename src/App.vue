<template>
  <el-config-provider :locale="locale">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const locale = ref(zhCn)
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

/* ==================== 全局滚动条样式 ==================== */
/* 滚动条宽度（横向和纵向） */
::-webkit-scrollbar {
  width: 28px !important;
  height: 28px !important;
}

/* 滚动条轨道 */
::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 6px;
}

/* 滚动条滑块 */
::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 6px;
  min-height: 40px;
}

/* 滚动条滑块悬停 */
::-webkit-scrollbar-thumb:hover {
  background: #a8abb2;
}

/* 滚动条角落 */
::-webkit-scrollbar-corner {
  background: #f1f1f1;
}

/* Element Plus 表格滚动条特殊处理 */
:deep(.el-table__body-wrapper) ::-webkit-scrollbar {
  width: 28px !important;
  height: 28px !important;
}

:deep(.el-table__header-wrapper) ::-webkit-scrollbar {
  width: 28px !important;
  height: 28px !important;
}

:deep(.el-scrollbar) ::-webkit-scrollbar {
  width: 28px !important;
  height: 28px !important;
}
</style>
