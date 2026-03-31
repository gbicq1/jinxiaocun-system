<template>
  <div class="cost-settlement-page">
    <el-card>
      <div class="toolbar">
        <el-form :inline="true" :model="queryForm" class="query-form">
          <el-form-item label="会计期间">
            <el-date-picker
              v-model="queryForm.periodRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 240px"
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
            <el-select v-model="queryForm.warehouse" placeholder="选择仓库" clearable style="width: 150px">
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
          <el-button type="info" @click="showDebugInfo = !showDebugInfo">
            <el-icon><InfoFilled /></el-icon>
            调试信息
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

      <!-- 调试信息显示区域 -->
      <div v-if="showDebugInfo" class="debug-info-box">
        <h4>调试信息</h4>
        <div class="debug-item">
          <strong>所有相关数据：</strong>
          <div v-if="debugInfo.allDataInfo && debugInfo.allDataInfo.length > 0">
            <div v-for="(item, index) in debugInfo.allDataInfo" :key="index" class="bill-item">
              <div><strong>Key:</strong> {{ item.key }}</div>
              <div><strong>单据类型:</strong> {{ item.billType || '无' }}</div>
              <div><strong>记录数:</strong> {{ item.count }}</div>
              <div><strong>字段检查:</strong> type={{ item.hasTypeField }}, billType={{ item.hasBillTypeField }}, documentType={{ item.hasDocumentTypeField }}</div>
              <div><strong>示例数据:</strong> <pre style="white-space: pre-wrap; word-break: break-word; margin: 4px 0;">{{ JSON.stringify(item.sample, null, 2) }}</pre></div>
            </div>
          </div>
          <div v-else>没有找到相关数据</div>
        </div>
        <div class="debug-item">
          <strong>退货单数据：</strong>
          <div v-if="debugInfo.returnBills.length > 0">
            <div v-for="(bill, index) in debugInfo.returnBills" :key="index" class="bill-item">
              <div><strong>Key:</strong> {{ bill.key }}</div>
              <div><strong>类型:</strong> {{ bill.type }}</div>
              <div><strong>记录数:</strong> {{ bill.count }}</div>
              <div><strong>示例数据:</strong> {{ JSON.stringify(bill.sample, null, 2) }}</div>
            </div>
          </div>
          <div v-else>没有找到退货单</div>
        </div>
        <div class="debug-item">
          <strong>出入库记录统计：</strong>
          <div>入库单：{{ debugInfo.inboundCount }} 条</div>
          <div>出库单：{{ debugInfo.outboundCount }} 条</div>
          <div>采购退货：{{ debugInfo.purchaseReturnCount }} 条</div>
          <div>销售退货：{{ debugInfo.salesReturnCount }} 条</div>
          <div>调拨单：{{ debugInfo.transferCount }} 条</div>
        </div>
      </div>

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
              <el-descriptions-item label="会计期间">{{ queryForm.periodRange ? queryForm.periodRange[0] + ' 至 ' + queryForm.periodRange[1] : '-' }}</el-descriptions-item>
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
              <el-table-column prop="type" label="单据类型" width="100" min-width="80" />
              
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
import { Search, RefreshLeft, Check, Back, Download, Printer, Close, Refresh, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import exportToCsv from '../../utils/exportCsv'
import { initializeCostCalculation } from '../../utils/cost'

// 调试信息
const showDebugInfo = ref(false)
const debugInfo = reactive({
  allDataInfo: [] as any[],
  returnBills: [] as any[],
  inboundCount: 0,
  outboundCount: 0,
  purchaseReturnCount: 0,
  salesReturnCount: 0,
  transferCount: 0
})

// 查询表单
const queryForm = reactive({
  periodRange: [],
  productSearch: '',
  warehouse: ''
})

// 仓库列表
const warehouses = ref<any[]>([])

// 加载仓库列表
const loadWarehouses = () => {
  try {
    const saved = localStorage.getItem('warehouses')
    if (saved) {
      warehouses.value = JSON.parse(saved).filter((w: any) => w.status === 1)
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error)
  }
}

// 结算数据列表
const settlementList = ref<any[]>([])
const allSettlementData = ref<any[]>([])

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
const handleSearch = () => {
  const q = (queryForm.productSearch || '').toLowerCase()
  if (!q && !queryForm.warehouse) {
    settlementList.value = allSettlementData.value.slice()
    return
  }
  
  settlementList.value = allSettlementData.value.filter(item => {
    const matchProduct = !q || 
      (item.productCode || '').toLowerCase().includes(q) ||
      (item.productName || '').toLowerCase().includes(q)
    const matchWarehouse = !queryForm.warehouse || item.warehouseId === queryForm.warehouse
    return matchProduct && matchWarehouse
  })
}

// 重置
const handleReset = () => {
  queryForm.periodRange = []
  queryForm.productSearch = ''
  queryForm.warehouse = ''
  settlementList.value = []
  allSettlementData.value = []
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
  )
  
  try {
    ElMessage.info('正在初始化成本数据，请稍候...')
    
    // 清空调试信息
      debugInfo.allDataInfo = []
      debugInfo.returnBills = []
      debugInfo.inboundCount = 0
      debugInfo.outboundCount = 0
      debugInfo.purchaseReturnCount = 0
      debugInfo.salesReturnCount = 0
      debugInfo.transferCount = 0
    
    // 收集调试信息
    const allKeys = []
    const allDataInfo = [] as any[]  // 存储所有数据的信息
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      allKeys.push(key)
      
      try {
        const arr = JSON.parse(localStorage.getItem(key) || '[]')
        if (!Array.isArray(arr) || arr.length === 0) continue
        
        // 检查第一笔数据的单据类型
        const firstItem = arr[0]
        const billType = firstItem.type || firstItem.billType || firstItem.documentType || ''
        
        // 收集所有包含"退"、"return"、"Returns"、"inbound"、"outbound"等关键词的数据
        if (key.includes('退') || key.toLowerCase().includes('return') || key.includes('inbound') || 
            key.includes('outbound') || key.includes('purchase') || key.includes('sales') ||
            billType.includes('退') || billType.toLowerCase().includes('return')) {
          allDataInfo.push({
            key: key,
            billType: billType,
            count: arr.length,
            sample: firstItem,
            hasTypeField: !!firstItem.type,
            hasBillTypeField: !!firstItem.billType,
            hasDocumentTypeField: !!firstItem.documentType
          })
        }
        
        // 统计退货单（通过单据类型字段判断，不区分大小写）
        if (key.toLowerCase().includes('return') || billType.includes('退货') || billType.toLowerCase().includes('return')) {
          const isPurchaseReturn = key.includes('purchase') || key.includes('inbound') || 
                                   billType.includes('采购') || billType.includes('采购退货') || billType.includes('购退')
          const isSalesReturn = key.includes('sales') || key.includes('outbound') || 
                                billType.includes('销售') || billType.includes('销售退货') || billType.includes('销退')
          
          debugInfo.returnBills.push({
            key: key,
            type: isPurchaseReturn ? '采购退货' : (isSalesReturn ? '销售退货' : (billType || '未知')),
            count: arr.length,
            sample: firstItem
          })
          
          if (isPurchaseReturn) {
            debugInfo.purchaseReturnCount += arr.length
          } else if (isSalesReturn) {
            debugInfo.salesReturnCount += arr.length
          }
        }
        
        // 统计其他单据
        if (key.includes('inbound') || key.includes('purchase')) {
          debugInfo.inboundCount += arr.length
        }
        if (key.includes('outbound') || key.includes('sales')) {
          debugInfo.outboundCount += arr.length
        }
        if (key.includes('transfer')) {
          debugInfo.transferCount += arr.length
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    console.log('=== 所有相关数据 ===')
    console.log('所有 key:', allKeys)
    console.log('相关数据信息:', allDataInfo)
    
    // 保存到 debugInfo
    debugInfo.allDataInfo = allDataInfo
    
    console.log('=== 调试信息 ===')
    console.log('所有 key:', allKeys)
    console.log('退货单统计:', debugInfo.returnBills)
    console.log('单据统计:', debugInfo)
    
    // 调用初始化函数
    const settlements = initializeCostCalculation()
    
    if (settlements.length === 0) {
      ElMessage.warning('没有可用的出入库记录，初始化失败')
      return
    }
    
    // 保存到 localStorage（只保存初始化数据，不覆盖已结算数据）
    const existingSettlements = JSON.parse(localStorage.getItem('cost_settlements') || '[]')
    
    // 过滤掉旧的初始化数据
    const nonInitializedSettlements = existingSettlements.filter((s: any) => !s._initialized)
    
    // 合并新的初始化数据
    const allSettlements = [...nonInitializedSettlements, ...settlements]
    localStorage.setItem('cost_settlements', JSON.stringify(allSettlements))
    
    console.log('初始化完成，生成的结算数据:', settlements.length)
    console.log('总结算数据:', allSettlements.length)
    
    ElMessage.success(`初始化完成！共为 ${settlements.length} 个产品仓库组合计算了库存结余`)
    showDebugInfo.value = true  // 自动显示调试信息
    
    // 自动刷新列表
    if (queryForm.periodRange && queryForm.periodRange.length === 2) {
      loadSettlementData()
    }
  } catch (error) {
    console.error('初始化成本数据失败:', error)
    ElMessage.error('初始化失败，请查看调试信息')
  }
}

// 开始计算
const handleCalculate = () => {
  console.log('========== 开始计算成本结算 ==========')
  if (!queryForm.periodRange || queryForm.periodRange.length !== 2) {
    ElMessage.warning('请选择会计期间（开始日期至结束日期）')
    return
  }
  loadSettlementData()
  ElMessage.success('成本计算完成')
}

// 反结算
const handleReverse = () => {
  if (!queryForm.periodRange || queryForm.periodRange.length !== 2) {
    ElMessage.warning('请选择会计期间（开始日期至结束日期）')
    return
  }
  
  const startDate = queryForm.periodRange[0]
  const endDate = queryForm.periodRange[1]
  
  ElMessageBox.confirm(`确定要反结算吗？这将删除${startDate}至${endDate}期间的结算数据`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    let settlements = JSON.parse(localStorage.getItem('cost_settlements') || '[]')
    settlements = settlements.filter((s: any) => {
      const periodStart = s.periodRange ? s.periodRange[0] : ''
      return periodStart !== startDate
    })
    localStorage.setItem('cost_settlements', JSON.stringify(settlements))
    
    allSettlementData.value = []
    settlementList.value = []
    ElMessage.success('反结算成功')
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

// 加载结算数据
const loadSettlementData = () => {
  if (!queryForm.periodRange || queryForm.periodRange.length !== 2) {
    ElMessage.warning('请选择会计期间（开始日期至结束日期）')
    return
  }
  
  const startDate = queryForm.periodRange[0]
  const endDate = queryForm.periodRange[1]
  
  // 获取期间范围
  const periodStart = new Date(startDate)
  const periodEnd = new Date(endDate)
  periodEnd.setDate(periodEnd.getDate() + 1) // 包含结束日期当天
  
  console.log('=== 成本结算调试信息 ===')
  console.log('会计期间:', startDate + ' 至 ' + endDate)
  console.log('期间开始:', periodStart.toISOString())
  console.log('期间结束:', periodEnd.toISOString())
  
  // 获取上期期末日期（用于获取期初数据）
  const previousPeriodEnd = new Date(periodStart)
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1)
  
  // 获取上期期间（用于查询上期期末数据）
  const previousPeriod = previousPeriodEnd.toISOString().slice(0, 7) // YYYY-MM
  
  console.log('上期期间:', previousPeriod)
  
  // 获取产品列表
  const products = JSON.parse(localStorage.getItem('products') || '[]')
  console.log('产品数量:', products.length)
  
  // ========== 改进的期初数据获取逻辑 ==========
  // 问题：如果 2025 年有库存，2026 年 1-2 月没有业务，3 月的期初应该从 2025 年结转
  // 解决方案：查找当前期间之前的最后一个有数据的结算期间
  
  // ========== 性能优化说明 ==========
  // 当前采用分层缓存策略，确保准确性和性能的平衡：
  // 
  // 【第一层：成本结算缓存】（当前实现）
  // - 优先使用已结算数据作为期初
  // - 查找当前期间之前最新的结算数据
  // - 优点：计算快速，数据准确
  // - 适用：已结算的会计期间
  //
  // 【第二层：实时库存快照】（建议后续实现）
  // - 为每个仓库每个产品保存实时库存快照
  // - 包含：数量、成本价、最后更新时间
  // - 计算时从快照开始，只计算快照之后的单据
  // - 优点：无需从第一笔单据开始计算
  // - 适用：未结算但有实时库存的期间
  //
  // 【第三层：全量计算】（兜底方案）
  // - 从系统启用时的第一笔单据开始计算
  // - 扫描所有出入库记录
  // - 优点：数据最准确，不会遗漏
  // - 缺点：数据量大时性能较慢
  // - 适用：新系统或没有历史数据的期间
  //
  // ========== 未来优化建议 ==========
  // 1. 添加按月索引：为每个月建立出入库索引，直接读取汇总数据
  // 2. 添加快照机制：每次结算后保存库存快照，后续计算从快照开始
  // 3. 添加增量计算：只计算变动的单据，复用已有的计算结果
  // 4. 添加 Web Worker：将计算逻辑放到后台线程，避免阻塞 UI
  // ================================
  
  const allSettlements = JSON.parse(localStorage.getItem('cost_settlements') || '[]')
  console.log('所有结算数据数量:', allSettlements.length)
  
  // 使用之前已声明的 previousPeriodEnd
  const previousPeriodEndStr = previousPeriodEnd.toISOString().slice(0, 10)
  console.log('上期最后一天:', previousPeriodEndStr)
  
  // 查找当前期间之前的所有结算数据，按结束日期倒序排序
  const previousSettlements = allSettlements
    .filter((s: any) => {
      if (!s.periodRange || s.periodRange.length !== 2) return false
      const periodEnd = s.periodRange[1]
      // 查找当前期间之前（不包括当前期间）的所有结算
      return periodEnd < periodStart.toISOString().slice(0, 10)
    })
    .sort((a: any, b: any) => {
      // 按结束日期倒序排序，最新的在前
      return new Date(b.periodRange[1]).getTime() - new Date(a.periodRange[1]).getTime()
    })
  
  console.log('当前期间之前的结算数据数量:', previousSettlements.length)
  if (previousSettlements.length > 0) {
    console.log('最新的上期结算数据:', previousSettlements[0])
  } else {
    console.log('⚠️ 未找到上期结算数据！尝试从初始化数据中获取...')
    
    // 从初始化数据中获取当前期间之前的最后一个月的数据作为期初
    const initializedSettlements = allSettlements.filter((s: any) => s._initialized === true)
    if (initializedSettlements.length > 0) {
      console.log('找到初始化数据:', initializedSettlements.length, '条')
      // 筛选出当前期间之前的初始化数据
      const previousInitialized = initializedSettlements.filter((s: any) => {
        if (!s.periodRange || s.periodRange.length !== 2) return false
        const periodEnd = s.periodRange[1]
        // 查找当前期间之前（不包括当前期间）的数据
        return periodEnd < periodStart.toISOString().slice(0, 10)
      })
      
      if (previousInitialized.length > 0) {
        // 按结束日期倒序排序，取最新的一个月
        previousInitialized.sort((a: any, b: any) => 
          new Date(b.periodRange[1]).getTime() - new Date(a.periodRange[1]).getTime()
        )
        console.log('✓ 使用初始化数据中', previousInitialized[0].periodRange, '的数据作为期初')
        previousSettlements.push(...previousInitialized)
      } else {
        console.log('⚠️ 初始化数据中也没有当前期间之前的数据，期初将为 0')
      }
    } else {
      console.log('⚠️ 也未找到初始化数据，期初将为 0')
    }
  }
  
  // 参照实时库存查询的明细功能，遍历所有 localStorage 键来查找出入库记录
  const periodInboundRecords: any[] = []  // 本期入库记录
  const periodOutboundRecords: any[] = [] // 本期出库记录

  console.log('=== 开始扫描 localStorage 中的出入库记录 ===')
  console.log('会计期间:', startDate + ' 至 ' + endDate)
  
  // 先处理库存调拨数据（单独处理，因为调拨单同时影响两个仓库）
  try {
    const transferRaw = localStorage.getItem('inventory_transfers')
    if (transferRaw) {
      const transfers = JSON.parse(transferRaw)
      if (Array.isArray(transfers)) {
        console.log(`✓ 找到库存调拨数据：inventory_transfers (${transfers.length} 条记录)`)
        if (transfers.length > 0) {
          console.log('库存调拨单示例数据:', JSON.stringify(transfers[0], null, 2))
        }
        
        for (const rec of transfers) {
          // 获取调拨单日期
          const recDateStr = rec.transferDate || rec.voucherDate || rec.orderDate || rec.date || rec.createdAt || ''
          if (!recDateStr) continue
          
          const recDate = new Date(recDateStr)
          const inRange = recDate >= periodStart && recDate < periodEnd
          
          if (!inRange) continue
          
          const fromWarehouseId = rec.fromWarehouseId || null
          const toWarehouseId = rec.toWarehouseId || null
          const fromWarehouseName = String(rec.fromWarehouseName || '').trim()
          const toWarehouseName = String(rec.toWarehouseName || '').trim()
          const originalRemark = rec.remark || rec.note || ''
          
          // 获取 items 数组
          const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
          if (!Array.isArray(items)) continue
          
          // 遍历每个产品项
          for (const it of items) {
            const productCode = String(it.productCode || it.code || it.sku || '').trim()
            const productName = String(it.productName || it.name || '').trim()
            const productId = it.productId || it.id || null
            const qty = Number(it.quantity || it.qty || it.count || it.num || 0)
            
            // 调拨单使用产品成本价作为成本价（优先使用unitPriceEx）
            const costPrice = Number(it.unitPriceEx || it.costPrice || it.unitPrice || it.price || 0)
            const entryAmount = Number((qty * costPrice).toFixed(2))
            
            // 调出仓库：作为出库处理
            if (fromWarehouseId) {
              let remark = originalRemark
              remark = remark ? `${remark} | 调拨至${toWarehouseName}` : `调拨至${toWarehouseName}`
              
              const outboundRecord = {
                productCode,
                productName,
                productId,
                voucherNo: rec.transferNo || rec.voucherNo || rec.orderNo || rec.number || rec.no || '',
                voucherDate: recDateStr,
                quantity: qty,
                unitPriceInc: costPrice,
                unitPriceEx: costPrice,
                costPrice,
                amount: entryAmount,
                invoiceIssued: false,
                invoiceType: '',
                taxRate: '',
                allowDeduction: false,
                supplierName: '',
                customerName: '',
                remark,
                isReturn: false,
                warehouseId: fromWarehouseId,
                originalOrderNo: rec.transferNo,
                originalVoucherNo: rec.transferNo
              }
              periodOutboundRecords.push(outboundRecord)
            }
            
            // 调入仓库：作为入库处理
            if (toWarehouseId) {
              let remark = originalRemark
              remark = remark ? `${remark} | 从${fromWarehouseName}调拨` : `从${fromWarehouseName}调拨`
              
              const inboundRecord = {
                productCode,
                productName,
                productId,
                voucherNo: rec.transferNo || rec.voucherNo || rec.orderNo || rec.number || rec.no || '',
                voucherDate: recDateStr,
                quantity: qty,
                unitPriceInc: costPrice,
                unitPriceEx: costPrice,
                costPrice,
                amount: entryAmount,
                invoiceIssued: false,
                invoiceType: '',
                taxRate: '',
                allowDeduction: false,
                supplierName: '',
                customerName: '',
                remark,
                isReturn: false,
                warehouseId: toWarehouseId,
                originalOrderNo: rec.transferNo,
                originalVoucherNo: rec.transferNo
              }
              periodInboundRecords.push(inboundRecord)
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('解析库存调拨数据失败:', e)
  }
  
  // 获取 localStorage 所有键
  const allKeys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) allKeys.push(k)
  }
  console.log('localStorage 所有键:', allKeys)

  // 遍历 localStorage 中所有可能的数组
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    
    const raw = localStorage.getItem(key)
    if (!raw) continue
    
    try {
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) {
        console.log(`跳过非数组键：${key}`)
        continue
      }
      
      console.log(`检查键：${key}, 数据量：${arr.length}`)
      
      // 判断是入库还是出库 - 使用 includes 进行模糊匹配
      const isKeyMatch = (key: string, patterns: string[]) => {
        return patterns.some(pattern => key.includes(pattern))
      }
      
      const inboundPatterns = ['inbound_records', 'purchaseInbounds', 'inbounds', 'purchase_inbounds']
      const outboundPatterns = ['sales_outbound_records', 'outbound_records', 'outbounds', 'sales_outbounds', 'salesOutbounds', 'delivery_records']
      const purchaseReturnsPatterns = ['purchaseReturns', 'purchase_returns']
      const salesReturnsPatterns = ['salesReturns', 'sales_returns', 'return']
      
      let isInbound = false
      let isOutbound = false
      let isPurchaseReturn = false
      let isSalesReturn = false
      
      // 使用 some 进行模糊匹配（与库存明细页面保持一致）
      if (inboundPatterns.some(p => key.includes(p))) {
        isInbound = true
        console.log(`✓ 找到入库单数据：${key} (${arr.length} 条记录)`)
        if (arr.length > 0) {
          console.log('入库单示例数据:', JSON.stringify(arr[0], null, 2))
        }
      } else if (outboundPatterns.some(p => key.includes(p))) {
        isOutbound = true
        console.log(`✓ 找到出库单数据：${key} (${arr.length} 条记录)`)
      } else if (purchaseReturnsPatterns.some(p => key.includes(p))) {
        isPurchaseReturn = true
        console.log(`✓ 找到采购退货数据：${key} (${arr.length} 条记录)`)
      } else if (salesReturnsPatterns.some(p => key.includes(p))) {
        isSalesReturn = true
        console.log(`✓ 找到销售退货数据：${key} (${arr.length} 条记录)`)
      } else {
        continue
      }
      
      // 遍历每条记录
      let count = 0
      for (const rec of arr) {
        // 获取记录日期
        const recDateStr = rec.voucherDate || rec.orderDate || rec.date || rec.createdAt || ''
        if (!recDateStr) continue
        
        const recDate = new Date(recDateStr)
        const inRange = recDate >= periodStart && recDate < periodEnd
        
        if (!inRange) continue
        
        // 获取 items 数组
        const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
        if (!Array.isArray(items)) continue
        
        // 遍历每个产品项
        for (const it of items) {
          const productCode = String(it.productCode || it.code || it.sku || '').trim()
          const productName = String(it.productName || it.name || '').trim()
          const productId = it.productId || it.id || null
          let qty = Number(it.quantity || it.qty || it.count || it.num || 0)
          
          // 采购退货：视为入库，但数量为负数（减少库存）
          if (isPurchaseReturn) {
            isInbound = true
            // 如果数量是正数，转为负数
            if (qty > 0) qty = -qty
          }
          
          // 销售退货：视为出库，但数量为负数（增加库存）
          if (isSalesReturn) {
            isOutbound = true
            // 如果数量是正数，转为负数
            if (qty > 0) qty = -qty
          }
          
          // ========== 成本价提取规则 ==========
          // 以下两种情况使用不含税价：
          // 1. 发票已开具 + 发票类型为专票
          // 2. 发票已开具 + 发票类型为普票 + 税率为免税 + 加计扣除为开启
          // 其他所有情况，使用含税价
          
          const invoiceIssued = rec.invoiceIssued
          const invoiceType = rec.invoiceType
          const taxRate = it.taxRate
          const allowDeduction = it.allowDeduction
          
          const unitPriceEx = Number(it.unitPriceEx || it.unitPriceWithoutTax || 0)
          const unitPriceInc = Number(it.unitPriceInc || it.unitPrice || it.unitPriceTaxIncluded || 0)
          
          let costPrice = 0
          
          // 调试：打印原始值
          console.log('原始值检查:', {
            invoiceIssued,
            typeof_invoiceIssued: typeof invoiceIssued,
            invoiceType,
            taxRate,
            allowDeduction,
            typeof_allowDeduction: typeof allowDeduction,
            unitPriceEx,
            unitPriceInc
          })
          
          // 直接使用 === 判断
          const isInvoiceIssued = invoiceIssued === true
          const isSpecialInvoice = invoiceType === '专票'
          const isGeneralInvoice = invoiceType === '普票'
          const isTaxFree = taxRate === '免税'
          const isDeductionEnabled = allowDeduction === true
          
          const condition1 = isInvoiceIssued && isSpecialInvoice
          const condition2 = isInvoiceIssued && isGeneralInvoice && isTaxFree && isDeductionEnabled
          
          console.log('判断结果:', {
            isInvoiceIssued,
            isSpecialInvoice,
            isGeneralInvoice,
            isTaxFree,
            isDeductionEnabled,
            condition1: condition1 ? '✓ 专票条件满足' : '✗ 专票条件不满足',
            condition2: condition2 ? '✓ 普票加计扣除条件满足' : '✗ 普票加计扣除条件不满足',
            shouldUseUnitPriceEx: condition1 || condition2
          })
          
          if (condition1 || condition2) {
            // 满足专票条件 或 普票加计扣除条件：使用不含税价
            costPrice = unitPriceEx > 0 ? unitPriceEx : unitPriceInc
            console.log('✓ 使用不含税价:', costPrice, condition1 ? '(专票)' : '(普票加计扣除)')
          } else {
            // 其他所有情况：使用含税价
            costPrice = unitPriceInc > 0 ? unitPriceInc : unitPriceEx
            console.log('✗ 使用含税价:', costPrice)
          }
          
          // 调试日志
          console.log('=== 入库单成本价计算详情 ===')
          console.log('单号:', rec.voucherNo || rec.orderNo)
          console.log('产品:', productName, productCode)
          console.log('发票状态:', {
            invoiceIssued,
            invoiceType,
            taxRate,
            allowDeduction
          })
          console.log('价格:', { unitPriceEx, unitPriceInc })
          console.log('成本价:', costPrice)
          
          const entryAmount = Number((qty * costPrice).toFixed(2))
          
          let remark = rec.remark || rec.note || ''
          
          // 采购退货：在备注中添加原始入库单号
          if (isPurchaseReturn && rec.originalVoucherNo) {
            const origInboundNo = rec.originalVoucherNo
            remark = remark ? `${remark} | 原入库单：${origInboundNo}` : `原入库单：${origInboundNo}`
          }
          
          // 销售退货：在备注中添加原始出库单号
          if (isSalesReturn && rec.originalOrderNo) {
            const origOutboundNo = rec.originalOrderNo
            remark = remark ? `${remark} | 原出库单：${origOutboundNo}` : `原出库单：${origOutboundNo}`
          }
          
          const record = {
            productCode,
            productName,
            productId,
            voucherNo: rec.voucherNo || rec.orderNo || rec.number || rec.no || '',
            voucherDate: recDateStr,
            quantity: qty,
            unitPriceInc,
            unitPriceEx,
            costPrice,
            amount: entryAmount,
            invoiceIssued,
            invoiceType,
            taxRate,
            allowDeduction,
            supplierName: rec.supplierName || rec.supplier || '',
            customerName: rec.customerName || rec.customer || '',
            remark,
            isReturn: rec.isReturn || rec.type === 'return' || false,
            originalOrderNo: rec.originalOrderNo || '',
            warehouseId: rec.warehouseId || rec.fromWarehouseId || rec.toWarehouseId || null
          }
          
          if (isInbound) {
            periodInboundRecords.push(record)
            count++
          } else if (isOutbound) {
            periodOutboundRecords.push(record)
            count++
          }
        }
      }
      
      if (count > 0) {
        console.log(`  → 在期间内找到 ${count} 个产品项`)
      }
    } catch (e) {
      // 忽略解析错误
      console.warn(`解析 ${key} 失败:`, e)
    }
  }

console.log(`=== 成本结算数据获取结果 ===`)
console.log(`会计期间：${startDate} 至 ${endDate}`)
console.log(`期间开始：${periodStart.toISOString()}`)
console.log(`期间结束：${periodEnd.toISOString()}`)
console.log(`本期入库记录总数：${periodInboundRecords.length}`)
console.log(`本期出库记录总数：${periodOutboundRecords.length}`)

// 打印示例数据
if (periodInboundRecords.length > 0) {
  console.log('=== 入库记录示例 ===')
  console.log(JSON.stringify(periodInboundRecords[0], null, 2))
}
if (periodOutboundRecords.length > 0) {
  console.log('=== 出库记录示例 ===')
  console.log(JSON.stringify(periodOutboundRecords[0], null, 2))
}

// 为每个产品和每个仓库计算成本结算
const settlements: any[] = []

// 获取用户选择的仓库（如果有）
const selectedWarehouseId = queryForm.warehouse ? Number(queryForm.warehouse) : null

// 遍历仓库（如果选择了仓库，只遍历选中的仓库）
const warehousesToProcess = selectedWarehouseId 
  ? warehouses.value.filter(w => Number(w.id) === selectedWarehouseId)
  : warehouses.value

warehousesToProcess.forEach((warehouse: any) => {
  const warehouseId = warehouse.id
  
  products.forEach((product: any) => {
    // ========== 1. 期初数据（来自上期期末）==========
    // 使用最新的上期结算数据（已经按结束日期倒序排序）
    const previousRecord = previousSettlements.length > 0 ? 
      previousSettlements.find((s: any) => 
        (s.productCode === product.code || s.productId === product.id) && 
        (s.warehouseId === warehouseId || s.warehouse === warehouseId)
      ) : null
    const openingQty = previousRecord ? Number(previousRecord.closingQty || 0) : 0
    const openingCost = previousRecord ? Number(previousRecord.closingCost || 0) : 0
    
    if (previousRecord) {
      console.log(`产品 ${product.code} ${product.name} 期初数据来自 ${previousRecord.periodRange[1]}: 数量=${openingQty}, 成本=${openingCost}`)
    } else {
      console.log(`⚠️ 产品 ${product.code} ${product.name} 在仓库 ${warehouse.name} 未找到期初数据，期初将为 0`)
      console.log('所有 previousSettlements:', previousSettlements.map(s => ({
        productCode: s.productCode,
        productId: s.productId,
        warehouseId: s.warehouseId,
        warehouse: s.warehouse,
        closingQty: s.closingQty
      })))
    }
    
    // ========== 2. 本期入库数据（当前会计期间，指定仓库）==========
    const inboundRecords = periodInboundRecords.filter((rec: any) => {
      const matchProduct = rec.productCode === product.code || rec.productId === product.id
      const matchWarehouse = rec.warehouseId === warehouseId
      return matchProduct && matchWarehouse
    })
    
    // ========== 3. 本期出库数据（当前会计期间，指定仓库）==========
    const outboundRecords = periodOutboundRecords.filter((rec: any) => {
      const matchProduct = rec.productCode === product.code || rec.productId === product.id
      const matchWarehouse = rec.warehouseId === warehouseId
      return matchProduct && matchWarehouse
    })
    
    // ========== 4. 计算本期入库数量和成本==========
    let inboundQty = 0
    let inboundCost = 0
    
    inboundRecords.forEach((rec: any) => {
      const quantity = Number(rec.quantity || 0)
      // 使用成本价字段（已根据发票类型和税率正确计算）
      const costPrice = Number(rec.costPrice || rec.unitPriceEx || rec.unitPriceInc || 0)
      const totalAmount = quantity * costPrice
      
      inboundQty += quantity
      inboundCost += totalAmount
    })
    
    // 如果期初、入库、出库都没有数据，跳过
    if (openingQty === 0 && inboundQty === 0 && outboundRecords.length === 0) {
      return
    }
    
    // ========== 5. 计算加权平均单价==========
    // 加权平均单价 = (期初成本 + 本期入库成本) / (期初数量 + 本期入库数量)
    const totalAvailableQty = openingQty + inboundQty
    const totalAvailableCost = openingCost + inboundCost
    const avgPrice = totalAvailableQty > 0 ? totalAvailableCost / totalAvailableQty : 0
    
    // ========== 6. 计算本期出库成本==========
    let outboundQty = 0
    let outboundCost = 0
    
    outboundRecords.forEach((rec: any) => {
      const quantity = Number(rec.quantity || 0)
      outboundQty += quantity
      outboundCost += quantity * avgPrice
    })
    
    // ========== 7. 期末结存==========
    // 期末数量 = 期初数量 + 本期入库数量 - 本期出库数量
    const closingQty = totalAvailableQty - outboundQty
    // 期末成本 = 期末数量 × 加权平均单价
    const closingCost = closingQty * avgPrice
    
    settlements.push({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      specification: product.specification || '',
      unit: product.unit || '',
      warehouseId: warehouseId,
      warehouseName: warehouse.name,
      periodRange: [startDate, endDate],
      // 期初数据
      openingQty,
      openingCost,
      // 本期入库
      inboundQty,
      inboundCost,
      // 本期出库
      outboundQty,
      outboundCost,
      // 加权平均
      avgPrice,
      // 期末结存
      closingQty,
      closingCost
    })
  })
})
  
  // 保存到 localStorage
  const existingSettlements = JSON.parse(localStorage.getItem('cost_settlements') || '[]')
  const filteredSettlements = existingSettlements.filter((s: any) => {
    const periodStartStr = s.periodRange ? s.periodRange[0] : s.period
    return periodStartStr !== startDate
  })
  filteredSettlements.push(...settlements)
  localStorage.setItem('cost_settlements', JSON.stringify(filteredSettlements))
  
  allSettlementData.value = settlements
  settlementList.value = settlements
}

// 加载明细数据（财务账簿规则）
const loadDetailData = (row: any) => {
  ledgerEntries.value = []
  
  // 获取期间范围
  const periodStart = row.periodRange && row.periodRange.length === 2 
    ? new Date(row.periodRange[0]) 
    : new Date('1970-01-01')
  const periodEnd = row.periodRange && row.periodRange.length === 2
    ? new Date(row.periodRange[1])
    : new Date('2099-12-31')
  periodEnd.setDate(periodEnd.getDate() + 1) // 包含结束日期当天
  
  const productCode = String(row.productCode || '').trim()
  const productId = row.productId || null
  const warehouseId = row.warehouseId || null
  
  // 获取期初数据（上个月月末结存）
  const openingQty = Number(row.openingQty || 0)
  const openingCost = Number(row.openingCost || 0)
  const openingPrice = openingQty > 0 ? openingCost / openingQty : 0
  
  // 获取期初日期（期间开始日期的前一天）
  const openingDate = new Date(periodStart)
  openingDate.setDate(openingDate.getDate() - 1)
  const openingDateStr = openingDate.toISOString().slice(0, 10)
  
  // 按月份分组存储数据
  const monthlyData = new Map()
  
  // 全局存储：调拨单成本价映射（key: 调拨单号, value: 成本价）
  const transferCostPriceMap = new Map()
  
  // 先处理库存调拨数据（单独处理，因为调拨单同时影响两个仓库）
  try {
    const transferRaw = localStorage.getItem('inventory_transfers')
    if (transferRaw) {
      const transfers = JSON.parse(transferRaw)
      if (Array.isArray(transfers)) {
        for (const rec of transfers) {
          // 获取调拨单日期
          const recDateStr = rec.transferDate || rec.voucherDate || rec.orderDate || rec.date || rec.createdAt || ''
          if (!recDateStr) continue
          
          const recDate = new Date(recDateStr)
          const inRange = recDate >= periodStart && recDate < periodEnd
          
          if (!inRange) continue
          
          const fromWarehouseId = rec.fromWarehouseId || null
          const toWarehouseId = rec.toWarehouseId || null
          const fromWarehouseName = String(rec.fromWarehouseName || '').trim()
          const toWarehouseName = String(rec.toWarehouseName || '').trim()
          const originalRemark = rec.remark || rec.note || ''
          
          // 获取 items 数组
          const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
          if (!Array.isArray(items)) continue
          
          // 遍历每个产品项
          for (const it of items) {
            const itCode = String(it.productCode || it.code || it.sku || '').trim()
            const itId = it.productId || it.id || null
            
            const match = (itId && productId && itId === productId) || (itCode && productCode && itCode === productCode)
            if (!match) continue
            
            const quantity = Number(it.quantity || it.qty || it.count || it.num || 0)
            
            // 调拨单使用产品成本价作为成本价（优先使用unitPriceEx）
            const costPrice = Number(it.unitPriceEx || it.costPrice || it.unitPrice || it.price || 0)
            
            // 处理调出仓库的记录
            if (fromWarehouseId != null && warehouseId != null && Number(fromWarehouseId) === Number(warehouseId)) {
              let remark = originalRemark
              const counter = `调拨至${toWarehouseName}`
              remark = remark ? `${remark} | ${counter}` : counter
              
              const docNo = rec.transferNo || rec.voucherNo || rec.orderNo || rec.number || rec.no || ''
              const dateStr = recDateStr.slice(0, 10)
              
              const monthKey = dateStr.slice(0, 7)
              
              if (!monthlyData.has(monthKey)) {
                monthlyData.set(monthKey, [])
              }
              
              const timestamp = rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp || 
                              (dateStr ? `${dateStr}_${docNo}` : docNo)
              
              const entry = {
                date: dateStr,
                type: '调拨出库',
                docNo,
                inboundQty: 0,
                inboundUnitPrice: 0,
                inboundAmount: 0,
                outboundQty: quantity,
                outboundUnitPrice: 0, // 先不设置成本价，等第二步正式处理时计算
                outboundAmount: 0, // 先不设置金额，等第二步正式处理时计算
                counter,
                remark,
                monthKey,
                unitPriceInc: costPrice,
                unitPriceEx: costPrice,
                _timestamp: timestamp
              }
              
              monthlyData.get(monthKey)!.push(entry)
            }
            
            // 处理调入仓库的记录
            if (toWarehouseId != null && warehouseId != null && Number(toWarehouseId) === Number(warehouseId)) {
              let remark = originalRemark
              const counter = `从${fromWarehouseName}调拨`
              remark = remark ? `${remark} | ${counter}` : counter
              
              const docNo = rec.transferNo || rec.voucherNo || rec.orderNo || rec.number || rec.no || ''
              const dateStr = recDateStr.slice(0, 10)
              
              const monthKey = dateStr.slice(0, 7)
              
              if (!monthlyData.has(monthKey)) {
                monthlyData.set(monthKey, [])
              }
              
              const timestamp = rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp || 
                              (dateStr ? `${dateStr}_${docNo}` : docNo)
              
              const entry = {
                date: dateStr,
                type: '调拨入库',
                docNo,
                inboundQty: quantity,
                inboundUnitPrice: costPrice, // 从调拨单获取成本价
                inboundAmount: Number((quantity * costPrice).toFixed(2)), // 从调拨单获取成本价计算金额
                outboundQty: 0,
                outboundUnitPrice: 0,
                outboundAmount: 0,
                counter,
                remark,
                monthKey,
                unitPriceInc: costPrice,
                unitPriceEx: costPrice,
                _timestamp: timestamp
              }
              
              monthlyData.get(monthKey)!.push(entry)
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('解析库存调拨数据失败:', e)
  }
  
  // 遍历 localStorage 获取所有出入库记录
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    
    const raw = localStorage.getItem(key)
    if (!raw) continue
    
    try {
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) continue
      
      // 判断是入库还是出库（与库存明细页面保持一致）
      const inboundKeys = ['inbound_records', 'purchaseInbounds', 'inbounds', 'purchase_inbounds']
      const outboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'sales_outbounds', 'salesOutbounds', 'delivery_records']
      const purchaseReturnsKeys = ['purchaseReturns', 'purchase_returns']
      const salesReturnsKeys = ['salesReturns', 'sales_returns']
      
      let isInbound = false
      let isOutbound = false
      let isPurchaseReturn = false
      let isSalesReturn = false
      
      if (inboundKeys.some(k => key.includes(k))) {
        isInbound = true
      } else if (outboundKeys.some(k => key.includes(k))) {
        isOutbound = true
      } else if (purchaseReturnsKeys.some(k => key.includes(k))) {
        isPurchaseReturn = true
      } else if (salesReturnsKeys.some(k => key.includes(k)) || key.toLowerCase().includes('return')) {
        isSalesReturn = true
      } else {
        continue
      }
      
      // 遍历每条记录
      for (const rec of arr) {
        const recDateStr = rec.voucherDate || rec.orderDate || rec.date || rec.createdAt || ''
        if (!recDateStr) continue
        
        const recDate = new Date(recDateStr)
        const inRange = recDate >= periodStart && recDate < periodEnd
        
        if (!inRange) continue
        
        // 筛选仓库 - 使用 Number() 转换确保类型一致
        const recWarehouseId = rec.warehouseId || rec.fromWarehouseId || rec.toWarehouseId || null
        const warehouseMatch = recWarehouseId != null && warehouseId != null && Number(recWarehouseId) === Number(warehouseId)
        if (!warehouseMatch) continue
        
        const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
        if (!Array.isArray(items)) continue
        
        // 遍历每个产品项
        for (const it of items) {
          const itCode = String(it.productCode || it.code || it.sku || '').trim()
          const itId = it.productId || it.id || null
          
          const match = (itId && productId && itId === productId) || (itCode && productCode && itCode === productCode)
          if (!match) continue
          
          // 调试日志：显示匹配到的产品原始数据
          console.log('===== 匹配到的入库单产品数据 =====')
          console.log('单号:', rec.voucherNo || rec.orderNo)
          console.log('产品:', it.productName || it.name, itCode)
          console.log('原始数据:', JSON.stringify(it, null, 2))
          console.log('入库单原始数据:', JSON.stringify({
            invoiceIssued: rec.invoiceIssued,
            invoice_status: rec.invoice_status,
            invoiceStatus: rec.invoiceStatus,
            invoiceType: rec.invoiceType,
            invoice_type: rec.invoice_type,
            invoiceTypeName: rec.invoiceTypeName
          }, null, 2))
          
          let quantity = Number(it.quantity || it.qty || it.count || it.num || 0)
          
          // 采购退货：视为入库，但数量为负数
          if (isPurchaseReturn) {
            isInbound = true
            quantity = -quantity
          }
          
          // 销售退货：视为出库，但数量为负数
          if (isSalesReturn) {
            isOutbound = true
            quantity = -quantity
          }
          const unitPriceInc = Number(it.unitPriceInc || it.unitPrice || it.unitPriceTaxIncluded || it.priceWithTax || it.price || 0)
          const unitPriceEx = Number(it.unitPriceEx || it.unitPriceWithoutTax || it.priceWithoutTax || 0)
          
          // ========== 成本价提取规则 ==========
          // 以下两种情况使用不含税价：
          // 1. 发票已开具 + 发票类型为专票
          // 2. 发票已开具 + 发票类型为普票 + 税率为免税 + 加计扣除为开启
          // 其他所有情况，使用含税价
          
          const invoiceIssued = rec.invoiceIssued
          const invoiceType = rec.invoiceType
          const taxRate = it.taxRate
          const allowDeduction = it.allowDeduction
          
          let inboundCostPrice = 0
          
          // 调试：打印原始值
          console.log('库存结余 - 原始值检查:', {
            invoiceIssued,
            typeof_invoiceIssued: typeof invoiceIssued,
            invoiceType,
            taxRate,
            allowDeduction,
            typeof_allowDeduction: typeof allowDeduction,
            unitPriceEx,
            unitPriceInc
          })
          
          // 直接使用 === 判断
          const isInvoiceIssued = invoiceIssued === true
          const isSpecialInvoice = invoiceType === '专票'
          const isGeneralInvoice = invoiceType === '普票'
          const isTaxFree = taxRate === '免税'
          const isDeductionEnabled = allowDeduction === true
          
          const condition1 = isInvoiceIssued && isSpecialInvoice
          const condition2 = isInvoiceIssued && isGeneralInvoice && isTaxFree && isDeductionEnabled
          
          console.log('库存结余 - 判断结果:', {
            isInvoiceIssued,
            isSpecialInvoice,
            isGeneralInvoice,
            isTaxFree,
            isDeductionEnabled,
            condition1: condition1 ? '✓ 专票条件满足' : '✗ 专票条件不满足',
            condition2: condition2 ? '✓ 普票加计扣除条件满足' : '✗ 普票加计扣除条件不满足',
            shouldUseUnitPriceEx: condition1 || condition2
          })
          
          if (condition1 || condition2) {
            // 满足专票条件 或 普票加计扣除条件：使用不含税价
            inboundCostPrice = unitPriceEx > 0 ? unitPriceEx : unitPriceInc
            console.log('库存结余 - ✓ 使用不含税价:', inboundCostPrice, condition1 ? '(专票)' : '(普票加计扣除)')
          } else {
            // 其他所有情况：使用含税价
            inboundCostPrice = unitPriceInc > 0 ? unitPriceInc : unitPriceEx
            console.log('库存结余 - ✗ 使用含税价:', inboundCostPrice)
          }
          console.log('========================')
          
          const counter = rec.counterName || rec.supplierName || rec.customerName || rec.companyName || ''
          const docNo = rec.voucherNo || rec.orderNo || rec.number || rec.no || ''
          const dateStr = recDateStr.slice(0, 10)
          
          // 获取月份键（YYYY-MM）
          const monthKey = dateStr.slice(0, 7)
          
          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, [])
          }
          
          // 获取时间戳
          const timestamp = rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp || 
                          (dateStr ? `${dateStr}_${docNo}` : docNo)

          // 推断单据类型
          let typeLabel = key
          const currentInboundKeys = ['inbound_records', 'purchaseInbounds', 'inbounds', 'purchase_inbounds']
          const currentOutboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'sales_outbounds', 'salesOutbounds', 'delivery_records']
          
          if (currentInboundKeys.includes(key) || key.toLowerCase().includes('inbound')) { 
            typeLabel = '入库'
          }
          else if (currentOutboundKeys.includes(key) || (key.toLowerCase().includes('outbound') && !key.toLowerCase().includes('return')) || key.toLowerCase().includes('delivery')) { 
            typeLabel = '出库'
          }
          else if (isPurchaseReturn) { 
            typeLabel = '采购退货'
          }
          else if (isSalesReturn) { 
            typeLabel = '销售退货'
          }

          let remark = rec.remark || rec.note || ''
          
          // 采购退货：在备注中添加原始入库单号
          if (isPurchaseReturn && rec.originalVoucherNo) {
            const origInboundNo = rec.originalVoucherNo
            remark = remark ? `${remark} | 原入库单：${origInboundNo}` : `原入库单：${origInboundNo}`
          }
          
          // 销售退货：在备注中添加原始出库单号
          if (isSalesReturn && rec.originalOrderNo) {
            const origOutboundNo = rec.originalOrderNo
            remark = remark ? `${remark} | 原出库单：${origOutboundNo}` : `原出库单：${origOutboundNo}`
          }

          const entry = {
            date: dateStr,
            type: typeLabel,  // 单据类型
            docNo,
            inboundQty: 0,
            inboundUnitPrice: 0,
            inboundAmount: 0,
            outboundQty: 0,
            outboundUnitPrice: 0,
            outboundAmount: 0,
            counter,
            remark,
            originalOrderNo: rec.originalOrderNo || '',
            monthKey,
            unitPriceInc,
            unitPriceEx,
            _timestamp: timestamp
          }
          
          if (isInbound) {
            entry.inboundQty = quantity
            entry.inboundUnitPrice = inboundCostPrice
            entry.inboundAmount = Number((quantity * inboundCostPrice).toFixed(2))
          } else if (isOutbound) {
            entry.outboundQty = quantity
            // 出库成本价将在后续处理时从上一行库存结余获取
            entry.outboundUnitPrice = 0
            entry.outboundAmount = 0
          }
          
          monthlyData.get(monthKey)!.push(entry)
        }
      }
    } catch (e) {
      // 忽略解析错误
    }
  }
  
  // 按月份排序
  const sortedMonths = Array.from(monthlyData.keys()).sort()
  
  // 构建最终的明细账（财务账簿格式）
  let runningQty = openingQty
  let runningCost = openingCost
  let yearlyInboundQty = 0
  let yearlyInboundAmount = 0
  let yearlyOutboundQty = 0
  let yearlyOutboundAmount = 0
  
  // 第一步：收集所有出库单成本价（先完整处理一遍，建立映射）
  const outboundCostPriceMap = new Map() // key: 出库单号, value: 成本价
  const inboundCostPriceMap = new Map() // key: 入库单号, value: 成本价 (用于采购退货)
  
  // 先临时处理一遍，建立出库单号到成本价的映射
  let tempRunningQty = openingQty
  let tempRunningCost = openingCost
  
  sortedMonths.forEach((monthKey) => {
    const entries = monthlyData.get(monthKey)!
    // 先按同样的方式排序
    entries.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      
      let timeA = 0
      let timeB = 0
      
      if (a._timestamp) {
        const tA = new Date(a._timestamp).getTime()
        if (!isNaN(tA)) timeA = tA
      }
      if (b._timestamp) {
        const tB = new Date(b._timestamp).getTime()
        if (!isNaN(tB)) timeB = tB
      }
      
      if (timeA > 0 && timeB > 0) {
        return timeA - timeB
      }
      
      if (timeA > 0) return -1
      if (timeB > 0) return 1
      
      const docNoA = String(a.docNo || '')
      const docNoB = String(b.docNo || '')
      
      if (docNoA !== docNoB) {
        return docNoA.localeCompare(docNoB)
      }
      
      if (a.inboundQty > 0 && b.outboundQty > 0) return -1
      if (a.outboundQty > 0 && b.inboundQty > 0) return 1
      
      return 0
    })
    
    entries.forEach(entry => {
      if (entry.inboundQty !== 0) {
        tempRunningQty += entry.inboundQty
        tempRunningCost += entry.inboundAmount
        
        // 为入库单建立成本价映射（用于采购退货）
        const docNo = String(entry.docNo || '')
        if (docNo) {
          const inboundCostPrice = entry.inboundUnitPrice || (entry.inboundAmount / entry.inboundQty) || 0
          inboundCostPriceMap.set(docNo, inboundCostPrice)
          console.log(`入库单 ${docNo} 成本价映射:`, inboundCostPrice)
        }
      }
      
      if (entry.outboundQty !== 0) {
        const previousCostPrice = tempRunningQty > 0 ? tempRunningCost / tempRunningQty : 0
        const docNo = String(entry.docNo || '')
        if (docNo) {
          outboundCostPriceMap.set(docNo, previousCostPrice)
        }
        tempRunningQty -= entry.outboundQty
        tempRunningCost -= entry.outboundQty * previousCostPrice
      }
    })
  })
  
  console.log('出库单号成本价映射:', Array.from(outboundCostPriceMap.entries()))
  console.log('入库单号成本价映射:', Array.from(inboundCostPriceMap.entries()))
  
  // 添加第一个月的期初数据
  if (sortedMonths.length > 0) {
    const firstMonth = sortedMonths[0]
    const openingEntry = {
      rowType: 'carryover' as const,
      date: openingDateStr,
      type: '期初',  // 单据类型
      docNo: '',
      inboundQty: openingQty,
      inboundUnitPrice: openingPrice,
      inboundAmount: openingCost,
      outboundQty: 0,
      outboundUnitPrice: 0,
      outboundAmount: 0,
      counter: '',
      remark: '',
      runningQty: openingQty,
      runningAmount: openingCost,
      costPrice: openingPrice,
      monthKey: firstMonth
    }
    ledgerEntries.value.push(openingEntry)
  }
  
  // 第二步：正式处理数据，销售退货使用原始出库单成本价
  // 逐月处理
  sortedMonths.forEach((monthKey) => {
    const entries = monthlyData.get(monthKey)!
    
    // 按日期和时间戳排序
    entries.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      
      // 日期相同的话，按时间戳排序
      let timeA = 0
      let timeB = 0
      
      if (a._timestamp) {
        const tA = new Date(a._timestamp).getTime()
        if (!isNaN(tA)) timeA = tA
      }
      if (b._timestamp) {
        const tB = new Date(b._timestamp).getTime()
        if (!isNaN(tB)) timeB = tB
      }
      
      if (timeA > 0 && timeB > 0) {
        return timeA - timeB
      }
      
      if (timeA > 0) return -1
      if (timeB > 0) return 1
      
      // 如果时间戳无效，按单号排序
      const docNoA = String(a.docNo || '')
      const docNoB = String(b.docNo || '')
      
      if (docNoA !== docNoB) {
        return docNoA.localeCompare(docNoB)
      }
      
      // 最后按类型排序：入库在前，出库在后
      if (a.inboundQty > 0 && b.outboundQty > 0) return -1
      if (a.outboundQty > 0 && b.inboundQty > 0) return 1
      
      return 0
    })
    
    // 本月合计
    let monthlyInboundQty = 0
    let monthlyInboundAmount = 0
    let monthlyOutboundQty = 0
    let monthlyOutboundAmount = 0
    
    // 处理当月每条记录
    entries.forEach(entry => {
      if (entry.inboundQty !== 0) {
        // 判断是否是调拨入库
        const isTransferInbound = entry.type === '调拨入库'
        
        // 判断是否是采购退货（有 originalVoucherNo 字段或者数量为负）
        const isPurchaseReturnEntry = entry.originalVoucherNo || entry.inboundQty < 0
        
        if (isTransferInbound) {
          // 调拨入库：保持第一步已经设置好的成本价和金额
          console.log(`调拨入库 ${entry.docNo} 保持成本价:`, entry.inboundUnitPrice, '金额:', entry.inboundAmount)
        } else if (isPurchaseReturnEntry && entry.originalVoucherNo) {
          // 采购退货：使用原始入库单的成本价
          const origInboundNo = String(entry.originalVoucherNo || '')
          if (inboundCostPriceMap.has(origInboundNo)) {
            const costPriceToUse = inboundCostPriceMap.get(origInboundNo)!
            entry.inboundUnitPrice = costPriceToUse
            entry.inboundAmount = entry.inboundQty * costPriceToUse
            console.log(`采购退货单 ${entry.docNo} 使用原入库单 ${origInboundNo} 的成本价:`, costPriceToUse)
          } else {
            // 如果找不到原入库单，使用默认成本价逻辑
            entry.inboundUnitPrice = entry.inboundUnitPrice || (entry.unitPriceInc > 0 ? entry.unitPriceInc : entry.unitPriceEx)
            entry.inboundAmount = entry.inboundQty * entry.inboundUnitPrice
            console.warn(`⚠️ 采购退货单 ${entry.docNo} 找不到原入库单 ${origInboundNo}，使用默认成本价:`, entry.inboundUnitPrice)
          }
        } else {
          // 正常入库：更新库存数量和成本
          entry.inboundUnitPrice = entry.inboundUnitPrice || (entry.unitPriceInc > 0 ? entry.unitPriceInc : entry.unitPriceEx)
          entry.inboundAmount = entry.inboundQty * entry.inboundUnitPrice
        }
        
        runningQty += entry.inboundQty
        runningCost += entry.inboundAmount
        monthlyInboundQty += entry.inboundQty
        monthlyInboundAmount += entry.inboundAmount
        yearlyInboundQty += entry.inboundQty
        yearlyInboundAmount += entry.inboundAmount
      }
      
      if (entry.outboundQty !== 0) {
        // 判断是否是调拨单
        const isTransferOutbound = entry.type === '调拨出库'
        const isTransferInbound = entry.type === '调拨入库'
        
        // 判断是否是销售退货（有 originalOrderNo 字段或者数量为负）
        const isSalesReturnEntry = entry.originalOrderNo || entry.outboundQty < 0
        
        let costPriceToUse = 0
        
        if (isSalesReturnEntry && entry.originalOrderNo) {
          // 销售退货：使用原始出库单的成本价
          const origOutboundNo = String(entry.originalOrderNo || '')
          if (outboundCostPriceMap.has(origOutboundNo)) {
            costPriceToUse = outboundCostPriceMap.get(origOutboundNo)!
            console.log(`销售退货单 ${entry.docNo} 使用原出库单 ${origOutboundNo} 的成本价:`, costPriceToUse)
          } else {
            // 如果找不到原出库单，降级使用当前库存结余成本价
            costPriceToUse = runningQty > 0 ? runningCost / runningQty : 0
            console.warn(`⚠️ 销售退货单 ${entry.docNo} 找不到原出库单 ${origOutboundNo}，使用当前库存成本价:`, costPriceToUse)
          }
        } else {
          // 正常出库或调拨出库：成本价从上一行库存结余获取
          costPriceToUse = runningQty > 0 ? runningCost / runningQty : 0
          if (isTransferOutbound) {
            console.log(`调拨出库 ${entry.docNo} 使用调出仓库库存成本价:`, costPriceToUse)
          }
        }
        
        entry.outboundUnitPrice = costPriceToUse
        entry.outboundAmount = entry.outboundQty * costPriceToUse
        
        // 检查库存是否充足（仅对正常出库）
        if (entry.outboundQty > 0) {
          const availableQty = runningQty
          if (entry.outboundQty > availableQty) {
            console.warn(`⚠️ 警告：出库数量 (${entry.outboundQty}) 超过可用库存 (${availableQty})，将产生负库存！`)
            console.warn(`   单据号：${entry.docNo}, 日期：${entry.date}`)
          }
        }
        
        // 更新库存数量和成本
        // 正常出库：减少库存；销售退货（负数出库）：增加库存
        runningQty -= entry.outboundQty
        runningCost -= entry.outboundAmount
        monthlyOutboundQty += entry.outboundQty
        monthlyOutboundAmount += entry.outboundAmount
        yearlyOutboundQty += entry.outboundQty
        yearlyOutboundAmount += entry.outboundAmount
      }
      
      // 计算当前行的库存结余成本价
      const costPrice = runningQty > 0 ? runningCost / runningQty : 0
      entry.runningQty = runningQty
      entry.runningAmount = runningCost
      entry.costPrice = costPrice
      
      ledgerEntries.value.push(entry)
    })
    
    // 添加本月合计行
    const monthlyEntry = {
      rowType: 'monthly' as const,
      date: '[本月合计]',
      type: '',  // 单据类型留空
      docNo: '',
      inboundQty: monthlyInboundQty,
      inboundUnitPrice: monthlyInboundQty > 0 ? monthlyInboundAmount / monthlyInboundQty : 0,
      inboundAmount: monthlyInboundAmount,
      outboundQty: monthlyOutboundQty,
      outboundUnitPrice: monthlyOutboundQty > 0 ? monthlyOutboundAmount / monthlyOutboundQty : 0,
      outboundAmount: monthlyOutboundAmount,
      counter: '',
      remark: '',
      runningQty,
      runningAmount: runningCost,
      costPrice: runningQty > 0 ? runningCost / runningQty : 0,
      monthKey
    }
    ledgerEntries.value.push(monthlyEntry)
    
    // 添加本年累计行（每个月都添加）
    const yearlyEntry = {
      rowType: 'yearly' as const,
      date: '[本年累计]',
      type: '',  // 单据类型留空
      docNo: '',
      inboundQty: yearlyInboundQty,
      inboundUnitPrice: yearlyInboundQty > 0 ? yearlyInboundAmount / yearlyInboundQty : 0,
      inboundAmount: yearlyInboundAmount,
      outboundQty: yearlyOutboundQty,
      outboundUnitPrice: yearlyOutboundQty > 0 ? yearlyOutboundAmount / yearlyOutboundQty : 0,
      outboundAmount: yearlyOutboundAmount,
      counter: '',
      remark: '',
      runningQty: 0,  // 本年累计不显示库存结余
      runningAmount: 0,
      costPrice: 0,
      monthKey
    }
    ledgerEntries.value.push(yearlyEntry)
  })
  
  console.log('明细数据加载完成，共', ledgerEntries.value.length, '条记录')
  
  // ========== 优化：即使本月没有业务，也要显示上月结转 ==========
  // 如果 ledgerEntries 为空（本月没有业务），但期初有数据，添加上月结转行
  if (ledgerEntries.value.length === 0 && (openingQty > 0 || openingCost > 0)) {
    console.log('本月没有业务，但期初有数据，添加上月结转行')
    
    const firstMonth = sortedMonths.length > 0 ? sortedMonths[0] : periodStart.toISOString().slice(0, 7)
    
    const openingEntry = {
      rowType: 'carryover' as const,
      date: openingDateStr,
      type: '期初',
      docNo: '-',
      inboundQty: null,  // 上月结转不显示入库数据
      inboundUnitPrice: null,
      inboundAmount: null,
      outboundQty: null,  // 上月结转不显示出库数据
      outboundUnitPrice: null,
      outboundAmount: null,
      counter: '-',
      remark: '-',
      runningQty: openingQty,  // 直接在库存结余列显示
      runningAmount: openingCost,
      costPrice: openingPrice,
      monthKey: firstMonth
    }
    
    ledgerEntries.value.push(openingEntry)
    
    // 添加本月合计行（显示 0）
    const monthlyEntry = {
      rowType: 'monthly' as const,
      date: '[本月合计]',
      type: '',
      docNo: '',
      inboundQty: 0,
      inboundUnitPrice: 0,
      inboundAmount: 0,
      outboundQty: 0,
      outboundUnitPrice: 0,
      outboundAmount: 0,
      counter: '',
      remark: '',
      runningQty: openingQty,
      runningAmount: openingCost,
      costPrice: openingPrice,
      monthKey: firstMonth
    }
    ledgerEntries.value.push(monthlyEntry)
    
    console.log('已添加上月结转和本月合计行')
  }
}

// 页面加载时自动加载数据
onMounted(() => {
  console.log('成本结算模块已加载')
  loadWarehouses()
  // 如果有会计期间，自动加载数据
  if (queryForm.periodRange && queryForm.periodRange.length === 2) {
    loadSettlementData()
  }
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
  margin-bottom: 20px;
}

.query-form {
  display: flex;
  flex-wrap: wrap;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.summary-bar {
  display: flex;
  justify-content: flex-end;
  gap: 40px;
  margin-top: 20px;
  padding: 15px 20px;
  background: #f5f7fa;
  border-radius: 4px;
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
  font-weight: 600;
  color: #303133;
}

/* ==================== 遮罩层 ==================== */
.settlement-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* ==================== 弹窗主体 ==================== */
.settlement-detail-dialog {
  position: relative;
  width: 90%;
  max-width: 1600px;
  height: 85vh;
  min-height: 600px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ==================== ① 头部固定区 ==================== */
.settlement-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.settlement-detail-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.settlement-detail-close {
  font-size: 18px;
  color: #909399;
  cursor: pointer;
  transition: color 0.3s;
}

.settlement-detail-close:hover {
  color: #606266;
}

/* ==================== 弹窗主体内容区 ==================== */
.settlement-detail-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

/* ==================== ② 商品基础信息固定区 ==================== */
.settlement-detail-info {
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

/* ==================== ③ 明细表格滚动区 ==================== */
.settlement-detail-table-wrapper {
  flex: 1;
  overflow: hidden;
  padding: 0;
  background: #fff;
}

/* 滚动条样式（与 Element Plus 统一） */
:deep(.el-table__body-wrapper::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #c0c4cc;
  border-radius: 4px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb:hover) {
  background: #a8abb2;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-track) {
  background: #f5f7fa;
}

/* 财务账簿特殊行样式 */
:deep(.el-table) .el-table__row {
  transition: background-color 0.2s;
}

:deep(.el-table) .el-table__row.carryover-row {
  background-color: #f0f0f0 !important;
  font-weight: bold;
}

:deep(.el-table) .el-table__row.opening-row {
  background-color: #e6f7ff !important;
}

:deep(.el-table) .el-table__row.monthly-row {
  background-color: #f0f0f0 !important;
  font-weight: bold;
}

:deep(.el-table) .el-table__row.yearly-row {
  background-color: #fff1f0 !important;
  font-weight: bold;
}

:deep(.el-table) .el-table__row.carryover-row .cell {
  color: #606266;
  font-weight: bold;
}

:deep(.el-table) .el-table__row.opening-row .cell {
  color: #409eff;
}

:deep(.el-table) .el-table__row.monthly-row .cell {
  color: #606266;
  font-weight: bold;
}

:deep(.el-table) .el-table__row.yearly-row .cell {
  color: #f56c6c;
}

/* ==================== 底部关闭按钮固定区 ==================== */
.settlement-detail-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
}

/* 入库列样式 */
:deep(.inbound-col) {
  background-color: #f0f9eb;
}

:deep(.inbound-col .cell) {
  color: #67c23a;
}

/* 入库列在特殊行中不显示背景色 */
:deep(.carryover-row .inbound-col),
:deep(.monthly-row .inbound-col),
:deep(.yearly-row .inbound-col) {
  background-color: transparent !important;
}

/* 出库列样式 */
:deep(.outbound-col) {
  background-color: #fef0f0;
}

:deep(.outbound-col .cell) {
  color: #f56c6c;
}

/* 出库列在特殊行中不显示背景色 */
:deep(.carryover-row .outbound-col),
:deep(.monthly-row .outbound-col),
:deep(.yearly-row .outbound-col) {
  background-color: transparent !important;
}

/* 库存结余列样式 */
:deep(.stock-col) {
  background-color: #ecf5ff;
}

:deep(.stock-col .cell) {
  color: #409eff;
  font-weight: 500;
}

/* 库存结余列在特殊行中不显示背景色 */
:deep(.carryover-row .stock-col),
:deep(.monthly-row .stock-col),
:deep(.yearly-row .stock-col) {
  background-color: transparent !important;
}

/* 调试信息框 */
.debug-info-box {
  margin-top: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}

.debug-info-box h4 {
  margin: 0 0 12px 0;
  color: #303133;
  font-size: 14px;
}

.debug-item {
  margin-bottom: 12px;
  padding: 12px;
  background: #fff;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  font-size: 13px;
}

.debug-item strong {
  color: #606266;
  margin-right: 8px;
}

.bill-item {
  padding: 8px;
  margin-bottom: 8px;
  background: #f0f9eb;
  border-radius: 4px;
  font-size: 12px;
  border-left: 3px solid #67c23a;
}

.bill-item > div {
  margin-bottom: 4px;
  word-break: break-all;
}

.bill-item:last-child {
  margin-bottom: 0;
}
</style>
