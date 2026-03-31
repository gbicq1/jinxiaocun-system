<template>
  <div class="migration-container">
    <el-card class="migration-card">
      <template #header>
        <div class="card-header">
          <span>📦 数据迁移工具</span>
          <el-button type="primary" @click="startMigration" :loading="migrating" :disabled="migrating">
            开始迁移
          </el-button>
        </div>
      </template>

      <div class="migration-content">
        <el-alert
          title="数据迁移说明"
          type="info"
          :closable="false"
          show-icon
          class="mb-4"
        >
          <p>此工具将浏览器 localStorage 中的数据迁移到 SQLite 数据库。</p>
          <p>迁移完成后，您可以在 Electron 应用中访问所有数据。</p>
        </el-alert>

        <!-- 迁移进度 -->
        <div v-if="migrationLog.length > 0" class="migration-log">
          <h4>迁移日志</h4>
          <div class="log-content">
            <div v-for="(log, index) in migrationLog" :key="index" class="log-item">
              <el-tag :type="log.type" size="small" class="mr-2">
                {{ log.status }}
              </el-tag>
              <span>{{ log.message }}</span>
            </div>
          </div>
        </div>

        <!-- 数据概览 -->
        <el-row :gutter="20" class="mt-4">
          <el-col :span="8" v-for="item in dataOverview" :key="item.name">
            <el-card shadow="hover" class="data-card">
              <div class="data-card-content">
                <div class="data-icon">{{ item.icon }}</div>
                <div class="data-info">
                  <div class="data-label">{{ item.label }}</div>
                  <div class="data-value">{{ item.count }} 条</div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <template #footer>
        <div class="migration-footer">
          <el-button @click="refreshData" :disabled="migrating">刷新数据</el-button>
          <el-button type="success" @click="exportToJSON" :disabled="migrating || !hasData">
            导出为 JSON
          </el-button>
          <el-button type="primary" @click="startMigration" :loading="migrating" :disabled="!hasData">
            开始迁移到数据库
          </el-button>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

interface MigrationLog {
  status: 'info' | 'success' | 'warning' | 'error'
  message: string
  type: 'info' | 'success' | 'warning' | 'danger'
}

interface DataItem {
  name: string
  label: string
  icon: string
  count: number
  data: any[]
}

const migrating = ref(false)
const migrationLog = ref<MigrationLog[]>([])
const dataItems = ref<DataItem[]>([])

const hasData = computed(() => {
  return dataItems.value.some(item => item.count > 0)
})

const dataOverview = computed(() => {
  return dataItems.value.map(item => ({
    name: item.name,
    label: item.label,
    icon: item.icon,
    count: item.count
  }))
})

// 加载 localStorage 数据
const loadLocalStorageData = () => {
  const dataSources = [
    { name: 'inbound_records', label: '采购入库单', icon: '📥' },
    { name: 'purchaseReturns', label: '采购退货单', icon: '↩️' },
    { name: 'sales_outbound_records', label: '销售出库单', icon: '📤' },
    { name: 'salesReturns', label: '销售退货单', icon: '↩️' },
    { name: 'inventory_transfers', label: '库存调拨单', icon: '🔄' },
    { name: 'cost_settlements', label: '成本结算数据', icon: '💰' },
    { name: 'inventory', label: '库存数据', icon: '📦' },
    { name: 'recycle_bin', label: '回收站', icon: '🗑️' }
  ]

  dataItems.value = dataSources.map(source => {
    const rawData = localStorage.getItem(source.name)
    const data = rawData ? JSON.parse(rawData) : []
    return {
      ...source,
      count: Array.isArray(data) ? data.length : 0,
      data: Array.isArray(data) ? data : []
    }
  })

  addLog('info', `已加载 ${dataItems.value.filter(item => item.count > 0).length} 个数据源`)
}

const addLog = (status: MigrationLog['status'], message: string) => {
  const typeMap: Record<MigrationLog['status'], MigrationLog['type']> = {
    info: 'info',
    success: 'success',
    warning: 'warning',
    error: 'danger'
  }
  
  migrationLog.value.push({
    status,
    message,
    type: typeMap[status]
  })
}

// 迁移数据到数据库
const startMigration = async () => {
  if (!window.electron) {
    ElMessage.error('请在 Electron 环境中运行此功能')
    return
  }

  migrating.value = true
  migrationLog.value = []

  try {
    addLog('info', '开始迁移数据...')

    // 迁移采购入库单
    const inboundData = dataItems.value.find(item => item.name === 'inbound_records')
    if (inboundData && inboundData.data.length > 0) {
      addLog('info', `正在迁移采购入库单 (${inboundData.data.length} 条)...`)
      for (const record of inboundData.data) {
        try {
          await window.electron.dbInsert('inbound', record)
        } catch (error) {
          addLog('warning', `入库单 ${record.id} 迁移失败：${(error as Error).message}`)
        }
      }
      addLog('success', `采购入库单迁移完成`)
    }

    // 迁移采购退货单
    const purchaseReturns = dataItems.value.find(item => item.name === 'purchaseReturns')
    if (purchaseReturns && purchaseReturns.data.length > 0) {
      addLog('info', `正在迁移采购退货单 (${purchaseReturns.data.length} 条)...`)
      for (const record of purchaseReturns.data) {
        try {
          await window.electron.dbInsert('purchase_returns', record)
        } catch (error) {
          addLog('warning', `退货单 ${record.id} 迁移失败：${(error as Error).message}`)
        }
      }
      addLog('success', `采购退货单迁移完成`)
    }

    // 迁移销售出库单
    const salesOutbound = dataItems.value.find(item => item.name === 'sales_outbound_records')
    if (salesOutbound && salesOutbound.data.length > 0) {
      addLog('info', `正在迁移销售出库单 (${salesOutbound.data.length} 条)...`)
      for (const record of salesOutbound.data) {
        try {
          await window.electron.dbInsert('outbound', record)
        } catch (error) {
          addLog('warning', `出库单 ${record.id} 迁移失败：${(error as Error).message}`)
        }
      }
      addLog('success', `销售出库单迁移完成`)
    }

    // 迁移销售退货单
    const salesReturns = dataItems.value.find(item => item.name === 'salesReturns')
    if (salesReturns && salesReturns.data.length > 0) {
      addLog('info', `正在迁移销售退货单 (${salesReturns.data.length} 条)...`)
      for (const record of salesReturns.data) {
        try {
          await window.electron.dbInsert('sales_returns', record)
        } catch (error) {
          addLog('warning', `退货单 ${record.id} 迁移失败：${(error as Error).message}`)
        }
      }
      addLog('success', `销售退货单迁移完成`)
    }

    // 迁移库存调拨单
    const transfers = dataItems.value.find(item => item.name === 'inventory_transfers')
    if (transfers && transfers.data.length > 0) {
      addLog('info', `正在迁移库存调拨单 (${transfers.data.length} 条)...`)
      for (const record of transfers.data) {
        try {
          await window.electron.dbInsert('inventory_transfer', record)
        } catch (error) {
          addLog('warning', `调拨单 ${record.id} 迁移失败：${(error as Error).message}`)
        }
      }
      addLog('success', `库存调拨单迁移完成`)
    }

    // 迁移成本结算数据
    const costSettlements = dataItems.value.find(item => item.name === 'cost_settlements')
    if (costSettlements && costSettlements.data.length > 0) {
      addLog('info', `正在迁移成本结算数据 (${costSettlements.data.length} 条)...`)
      for (const record of costSettlements.data) {
        try {
          // 成本结算表名可能不同，需要根据实际情况调整
          await window.electron.dbInsert('cost_settlements', record)
        } catch (error) {
          addLog('warning', `结算数据 ${record.id} 迁移失败：${(error as Error).message}`)
        }
      }
      addLog('success', `成本结算数据迁移完成`)
    }

    addLog('success', '🎉 所有数据迁移完成！')
    ElMessage.success('数据迁移成功！请重启 Electron 应用查看数据。')
    
  } catch (error) {
    addLog('error', `迁移失败：${(error as Error).message}`)
    ElMessage.error('数据迁移失败，请查看日志')
  } finally {
    migrating.value = false
  }
}

const refreshData = () => {
  loadLocalStorageData()
  ElMessage.success('数据已刷新')
}

const exportToJSON = () => {
  const exportData: Record<string, any> = {}
  dataItems.value.forEach(item => {
    if (item.count > 0) {
      exportData[item.name] = item.data
    }
  })

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventory-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  
  ElMessage.success('数据已导出')
}

onMounted(() => {
  loadLocalStorageData()
})
</script>

<style scoped lang="scss">
.migration-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.migration-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 18px;
    font-weight: bold;
  }
}

.migration-content {
  .mb-4 {
    margin-bottom: 20px;
  }

  .mt-4 {
    margin-top: 20px;
  }

  .migration-log {
    margin-top: 20px;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    padding: 15px;
    background: #f5f7fa;

    h4 {
      margin: 0 0 10px 0;
      color: #303133;
    }

    .log-content {
      max-height: 300px;
      overflow-y: auto;

      .log-item {
        display: flex;
        align-items: center;
        padding: 5px 0;
        font-size: 13px;

        .mr-2 {
          margin-right: 8px;
        }
      }
    }
  }

  .data-card {
    margin-bottom: 15px;

    .data-card-content {
      display: flex;
      align-items: center;

      .data-icon {
        font-size: 40px;
        margin-right: 15px;
      }

      .data-info {
        flex: 1;

        .data-label {
          font-size: 14px;
          color: #909399;
          margin-bottom: 5px;
        }

        .data-value {
          font-size: 24px;
          font-weight: bold;
          color: #303133;
        }
      }
    }
  }
}

.migration-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
