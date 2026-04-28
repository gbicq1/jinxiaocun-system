<template>
  <div class="cost-settlement-page">
    <el-card>
      <div class="toolbar">
        <el-form :inline="true" :model="queryForm" class="query-form">
          <el-form-item label="会计期间">
            <el-date-picker
              v-model="queryForm.periodRange"
              type="month"
              placeholder="选择月份"
              value-format="YYYY-MM"
              style="width: 150px"
            />
          </el-form-item>
          <el-form-item label="商品编码/名称">
            <el-input
              v-model="queryForm.productSearch"
              placeholder="输入商品编码或名称"
              clearable
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item label="仓库">
            <el-select v-model="queryForm.warehouseId" placeholder="选择仓库" clearable style="width: 150px">
              <el-option label="全部仓库" value="" />
              <el-option
                v-for="warehouse in warehouses"
                :key="warehouse.id"
                :label="warehouse.name"
                :value="warehouse.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSearch">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
            <el-button @click="handleReset">
              <el-icon><RefreshLeft /></el-icon>
              重置
            </el-button>
          </el-form-item>
        </el-form>

        <!-- 右侧功能按钮 -->
        <div class="action-buttons">
          <el-button type="warning" @click="handleInitialize">
            <el-icon><Refresh /></el-icon>
            初始化成本数据
          </el-button>
          <el-button type="success" @click="handleCalculate">
            <el-icon><Check /></el-icon>
            开始计算
          </el-button>
          <el-button type="warning" @click="handleReverse">
            <el-icon><Back /></el-icon>
            反结算
          </el-button>
          <el-button type="primary" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出 Excel
          </el-button>
          <el-button @click="handlePrint">
            <el-icon><Printer /></el-icon>
            打印
          </el-button>
        </div>
      </div>

      <!-- 中间表格展示区域 -->
      <el-table
        :data="settlementList"
        style="width: 100%"
        :table-layout="'fixed'"
        border
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="warehouseName" label="仓库" width="120" />
        <el-table-column prop="productCode" label="商品编码" width="120" />
        <el-table-column prop="productName" label="商品名称" width="200" />
        <el-table-column prop="specification" label="规格型号" width="150" />
        <el-table-column prop="unit" label="单位" width="80" />

        <el-table-column prop="openingQty" label="期初数量" width="100" align="right">
          <template #default="{ row }">{{ row.openingQty }}</template>
        </el-table-column>
        <el-table-column prop="openingCost" label="期初成本（不含税）" width="130" align="right">
          <template #default="{ row }">¥{{ row.openingCost.toLocaleString() }}</template>
        </el-table-column>

        <el-table-column prop="inboundQty" label="本期入库数量" width="110" align="right">
          <template #default="{ row }">{{ row.inboundQty }}</template>
        </el-table-column>
        <el-table-column prop="inboundCost" label="本期入库成本" width="150" align="right">
          <template #default="{ row }">¥{{ row.inboundCost.toLocaleString() }}</template>
        </el-table-column>

        <el-table-column prop="outboundQty" label="本期出库数量" width="110" align="right">
          <template #default="{ row }">{{ row.outboundQty }}</template>
        </el-table-column>
        <el-table-column prop="outboundCost" label="本期出库成本" width="150" align="right">
          <template #default="{ row }">¥{{ row.outboundCost.toLocaleString() }}</template>
        </el-table-column>

        <el-table-column prop="avgPrice" label="加权平均单价" width="130" align="right">
          <template #default="{ row }">¥{{ row.avgPrice.toFixed(2) }}</template>
        </el-table-column>

        <el-table-column prop="closingQty" label="期末结存数量" width="110" align="right">
          <template #default="{ row }">{{ row.closingQty }}</template>
        </el-table-column>
        <el-table-column prop="closingCost" label="期末结存成本" width="150" align="right">
          <template #default="{ row }">¥{{ row.closingCost.toLocaleString() }}</template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleViewDetail(row)">明细</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 底部统计区域 -->
      <div class="summary-bar">
        <div class="summary-item">
          <span class="summary-label">期末结存数量合计：</span>
          <span class="summary-value">{{ totalQty.toLocaleString() }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">期末结存成本合计：</span>
          <span class="summary-value">¥{{ totalCost.toLocaleString() }}</span>
        </div>
      </div>
    </el-card>

    <!-- 成本结算明细弹窗 -->
    <div v-if="dialogVisible" class="settlement-detail-overlay" @click="handleOverlayClick">
      <div class="settlement-detail-dialog" @click.stop>
        <!-- 头部固定区 -->
        <div class="settlement-detail-header">
          <span class="settlement-detail-title">成本结算明细</span>
          <el-icon class="settlement-detail-close" @click="dialogVisible = false">
            <Close />
          </el-icon>
        </div>

        <div v-if="selectedRow" class="settlement-detail-body">
          <!-- 商品基础信息固定区 -->
          <div class="settlement-detail-info">
            <el-descriptions :column="2" border size="default">
              <el-descriptions-item label="商品编码">{{ selectedRow.productCode }}</el-descriptions-item>
              <el-descriptions-item label="商品名称">{{ selectedRow.productName }}</el-descriptions-item>
              <el-descriptions-item label="规格型号">{{ selectedRow.specification || '-' }}</el-descriptions-item>
              <el-descriptions-item label="单位">{{ selectedRow.unit }}</el-descriptions-item>
              <el-descriptions-item label="会计期间">{{ queryForm.periodRange ? queryForm.periodRange + ' 月份' : '-' }}</el-descriptions-item>
              <el-descriptions-item label="加权平均单价">¥{{ selectedRow.avgPrice.toFixed(2) }}</el-descriptions-item>
              <el-descriptions-item label="期初数量">{{ selectedRow.openingQty }}</el-descriptions-item>
              <el-descriptions-item label="期初成本">¥{{ selectedRow.openingCost.toLocaleString() }}</el-descriptions-item>
              <el-descriptions-item label="本期入库数量">{{ selectedRow.inboundQty }}</el-descriptions-item>
              <el-descriptions-item label="本期入库成本">¥{{ selectedRow.inboundCost.toLocaleString() }}</el-descriptions-item>
              <el-descriptions-item label="本期出库数量">{{ selectedRow.outboundQty }}</el-descriptions-item>
              <el-descriptions-item label="本期出库成本">¥{{ selectedRow.outboundCost.toLocaleString() }}</el-descriptions-item>
              <el-descriptions-item label="期末结存数量">{{ selectedRow.closingQty }}</el-descriptions-item>
              <el-descriptions-item label="期末结存成本">¥{{ selectedRow.closingCost.toLocaleString() }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 明细表格滚动区 -->
          <div class="settlement-detail-table-wrapper">
            <el-table :data="ledgerEntries" style="width: 100%; min-width: 1200px" :height="'100%'" :show-summary="false" :row-class="getRowClass">
              <el-table-column prop="date" label="日期" width="120" min-width="100">
                <template #default="{ row }">
                  <span v-if="row.rowType === 'carryover'" style="font-weight: bold; color: #409eff">上月结转</span>
                  <span v-else-if="row.rowType === 'monthly'" style="font-weight: bold">[本月合计]</span>
                  <span v-else-if="row.rowType === 'yearly'" style="font-weight: bold; color: #e6a23c">[本年累计]</span>
                  <span v-else>{{ row.date }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="docNo" label="单号" width="170" min-width="140">
                <template #default="{ row }">
                  <span v-if="row.rowType === 'carryover'">-</span>
                  <span v-else-if="row.rowType === 'monthly' || row.rowType === 'yearly'">-</span>
                  <span v-else>{{ row.docNo }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="type" label="单据类型" width="100" min-width="80">
                <template #default="{ row }">
                  <span>{{ getDocTypeName(row.type) }}</span>
                </template>
              </el-table-column>

              <!-- 入库数据区域 -->
              <el-table-column label="入库数据" align="center">
                <el-table-column prop="inboundQty" label="数量" width="100" min-width="80" class-name="inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'">-</span>
                    <span v-else-if="row.inboundQty > 0" style="color: #67c23a">{{ row.inboundQty }}</span>
                    <span v-else-if="row.inboundQty < 0" style="color: #f56c6c">{{ row.inboundQty }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="inboundUnitPrice" label="成本价" width="120" min-width="100" class-name="inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'">-</span>
                    <span v-else-if="row.inboundQty !== 0">¥{{ (row.inboundUnitPrice || 0).toFixed(2) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="inboundAmount" label="金额" width="140" min-width="120" class-name="inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'">-</span>
                    <span v-else-if="row.inboundQty !== 0">¥{{ (row.inboundAmount || 0).toFixed(2) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <!-- 出库数据区域 -->
              <el-table-column label="出库数据" align="center">
                <el-table-column prop="outboundQty" label="数量" width="100" min-width="80" class-name="outbound-col">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty > 0" style="color: #f56c6c">{{ row.outboundQty }}</span>
                    <span v-else-if="row.outboundQty < 0" style="color: #67c23a">{{ row.outboundQty }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="outboundUnitPrice" label="成本价" width="120" min-width="100" class-name="outbound-col">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty !== 0">¥{{ (row.outboundUnitPrice || 0).toFixed(2) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="outboundAmount" label="金额" width="140" min-width="120" class-name="outbound-col">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty !== 0">¥{{ (row.outboundAmount || 0).toFixed(2) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <!-- 库存结余区域 -->
              <el-table-column label="库存结余" align="center">
                <el-table-column prop="runningQty" label="库存数量" width="120" min-width="100" class-name="stock-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'" style="font-weight: bold">{{ row.runningQty }}</span>
                    <span v-else-if="row.runningQty < 0" style="color: #f56c6c; font-weight: bold;">{{ row.runningQty }} ⚠️</span>
                    <span v-else>{{ row.runningQty }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="costPrice" label="成本价" width="120" min-width="100" class-name="stock-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'" style="font-weight: bold">¥{{ (row.costPrice || 0).toFixed(2) }}</span>
                    <span v-else>¥{{ (row.costPrice || 0).toFixed(2) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="runningAmount" label="库存金额" width="150" min-width="130" class-name="stock-col">
                  <template #default="{ row }">
                    <span v-if="row.rowType === 'carryover'" style="font-weight: bold">¥{{ (row.runningAmount || 0).toFixed(2) }}</span>
                    <span v-else>¥{{ (row.runningAmount || 0).toFixed(2) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <el-table-column prop="counter" label="往来单位" width="150" min-width="120">
                <template #default="{ row }">
                  <span v-if="row.rowType === 'carryover'">-</span>
                  <span v-else-if="row.rowType === 'yearly'" style="font-weight: bold; color: #e6a23c">本年累计</span>
                  <span v-else-if="row.rowType === 'monthly'">-</span>
                  <span v-else>{{ row.counter }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" min-width="200">
                <template #default="{ row }">
                  <span v-if="row.rowType === 'carryover'">-</span>
                  <span v-else-if="row.rowType === 'monthly' || row.rowType === 'yearly'">-</span>
                  <span v-else>{{ row.remark }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <!-- 底部关闭按钮固定区 -->
        <div class="settlement-detail-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Search, RefreshLeft, Check, Back, Download, Printer, Close, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import exportToCsv from '../../utils/exportCsv'
import { getCostSettlementList, initializeCostData, reverseCostSettlement } from '@/api/cost'
import { db } from '@/utils/db-ipc'

// 查询表单
const queryForm = reactive({
  periodRange: '' as string,
  productSearch: '',
  warehouseId: ''
})

// 仓库列表
const warehouses = ref<any[]>([])

// 加载仓库列表
const loadWarehouses = async () => {
  try {
    const data = await db.getWarehouses()
    warehouses.value = data.filter((w: any) => w.status === 1)
  } catch (error) {
    console.error('加载仓库列表失败:', error)
  }
}

// 结算数据列表
const settlementList = ref<any[]>([])

// 弹窗
const dialogVisible = ref(false)
const selectedRow = ref<any>(null)
const ledgerEntries = ref<any[]>([])

// 打开明细弹窗时禁止页面滚动
watch(dialogVisible, (v) => {
  try { document.body.style.overflow = v ? 'hidden' : '' } catch {}
})

// 统计
const totalQty = computed(() => {
  return settlementList.value.reduce((sum, row) => sum + Number(row.closingQty || 0), 0)
})

const totalCost = computed(() => {
  return settlementList.value.reduce((sum, row) => sum + Number(row.closingCost || 0), 0)
})

// 查询
const handleSearch = async () => {
  if (!queryForm.periodRange) {
    ElMessage.warning('请选择会计期间')
    return
  }

  try {
    ElMessage.info('正在查询成本结算数据...')

    const result = await getCostSettlementList({
      periodRange: queryForm.periodRange,
      productSearch: queryForm.productSearch,
      warehouseId: queryForm.warehouseId || undefined
    })

    if (result.success) {
      settlementList.value = result.data || []
      ElMessage.success(`查询成功，共 ${settlementList.value.length} 条记录`)
    } else {
      ElMessage.warning(result.message || '查询失败')
      settlementList.value = []
    }
  } catch (error) {
    console.error('查询成本结算失败:', error)
    ElMessage.error('查询失败')
    settlementList.value = []
  }
}

// 重置
const handleReset = () => {
  queryForm.periodRange = ''
  queryForm.productSearch = ''
  queryForm.warehouseId = ''
  settlementList.value = []
}

// 初始化成本数据
const handleInitialize = async () => {
  ElMessageBox.confirm(
    '初始化成本数据将从系统启用时的第一笔单据开始，全面计算所有产品和仓库的库存结余。\n\n注意：\n1. 此操作会覆盖现有的初始化数据\n2. 如果数据量较大，可能需要几分钟时间\n3. 建议在首次使用或数据不完整时使用\n\n确定要继续吗？',
    '初始化成本数据',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      ElMessage.info('正在初始化成本数据，请稍候...')

      const result = await initializeCostData()

      if (result.success) {
        ElMessage.success(`初始化完成！共为 ${result.count || 0} 个产品仓库组合计算了库存结余`)

        // 自动刷新列表
        if (queryForm.periodRange) {
          await handleSearch()
        }
      } else {
        ElMessage.warning(result.message || '初始化失败')
      }
    } catch (error) {
      console.error('初始化成本数据失败:', error)
      ElMessage.error('初始化失败')
    }
  }).catch(() => {})
}

// 开始计算
const handleCalculate = async () => {
  if (!queryForm.periodRange) {
    ElMessage.warning('请选择会计期间')
    return
  }

  const parts = queryForm.periodRange.split('-').map(Number)
  const year = parts[0]
  const month = parts[1]

  ElMessageBox.confirm(
    `确定要计算 ${year}年${month}月 的成本数据吗？\n\n注意：\n1. 如果该期间已结算，将被覆盖\n2. 请确保期间内的所有单据已录入完成`,
    '开始计算',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      ElMessage.info('正在计算成本数据，请稍候...')

      const result = await db.initializeCostData({
        year,
        month
      })

      if (result?.success) {
        ElMessage.success(`计算完成！共处理 ${result.count || 0} 条记录`)

        // 自动刷新列表
        await handleSearch()
      } else {
        ElMessage.warning(result?.message || '计算失败')
      }
    } catch (error) {
      console.error('成本计算失败:', error)
      ElMessage.error('计算失败')
    }
  }).catch(() => {})
}

// 反结算
const handleReverse = async () => {
  if (!queryForm.periodRange) {
    ElMessage.warning('请选择会计期间')
    return
  }

  const period = queryForm.periodRange

  ElMessageBox.confirm(`确定要反结算 ${period} 月份的数据吗？这将删除该期间的结算数据`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const result = await reverseCostSettlement({ period })

      if (result.success) {
        ElMessage.success(result.message || '反结算成功')
        settlementList.value = []
      } else {
        ElMessage.warning(result.message || '反结算失败')
      }
    } catch (error) {
      console.error('反结算失败:', error)
      ElMessage.error('反结算失败')
    }
  }).catch(() => {})
}

// 导出 Excel
const handleExport = () => {
  if (settlementList.value.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }

  const columns = [
    { label: '商品编码', key: 'productCode' },
    { label: '商品名称', key: 'productName' },
    { label: '规格型号', key: 'specification' },
    { label: '单位', key: 'unit' },
    { label: '期初数量', key: 'openingQty' },
    { label: '期初成本', key: 'openingCost' },
    { label: '本期入库数量', key: 'inboundQty' },
    { label: '本期入库成本', key: 'inboundCost' },
    { label: '本期出库数量', key: 'outboundQty' },
    { label: '本期出库成本', key: 'outboundCost' },
    { label: '加权平均单价', key: 'avgPrice' },
    { label: '期末结存数量', key: 'closingQty' },
    { label: '期末结存成本', key: 'closingCost' }
  ]

  const filename = `成本结算_${queryForm.periodRange ? queryForm.periodRange[0] + '至' + queryForm.periodRange[1] : '全部'}.csv`
  exportToCsv(filename, columns, settlementList.value)
}

// 打印
const handlePrint = () => {
  if (settlementList.value.length === 0) {
    ElMessage.warning('没有可打印的数据')
    return
  }
  window.print()
}

// 获取行样式类名（财务账簿特殊行）
const getRowClass = (row: any) => {
  if (row.rowType === 'carryover') return 'carryover-row'
  if (row.rowType === 'opening') return 'opening-row'
  if (row.rowType === 'monthly') return 'monthly-row'
  if (row.rowType === 'yearly') return 'yearly-row'
  return ''
}

// 查看明细
const handleViewDetail = (row: any) => {
  selectedRow.value = row
  loadDetailData(row)
  dialogVisible.value = true
}

const handleOverlayClick = () => {
  dialogVisible.value = false
}

// 加载明细数据
const loadDetailData = (row: any) => {
  // TODO: 实现成本明细查询
  ledgerEntries.value = []
}

// 获取单据类型中文名称
const getDocTypeName = (type: string): string => {
  const map: Record<string, string> = {
    purchase_inbound: '采购入库',
    sales_outbound: '销售出库',
    purchase_return: '采购退货',
    sales_return: '销售退货',
    transfer_in: '调拨入库',
    transfer_out: '调拨出库'
  }
  return map[type] || type || '-'
}

onMounted(() => {
  loadWarehouses()
})
</script>

<style scoped>
.cost-settlement-page {
  padding: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.summary-bar {
  margin-top: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
  display: flex;
  gap: 40px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-label {
  font-size: 14px;
  color: #606266;
}

.summary-value {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

/* 明细弹窗样式 */
.settlement-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.settlement-detail-dialog {
  width: 90%;
  max-width: 1400px;
  height: 80vh;
  background: #fff;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.settlement-detail-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.settlement-detail-title {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

.settlement-detail-close {
  font-size: 20px;
  cursor: pointer;
  color: #909399;
}

.settlement-detail-close:hover {
  color: #606266;
}

.settlement-detail-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.settlement-detail-info {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.settlement-detail-table-wrapper {
  flex: 1;
  overflow: auto;
}

.settlement-detail-footer {
  padding: 16px 20px;
  border-top: 1px solid #e4e7ed;
  text-align: right;
  flex-shrink: 0;
}
</style>