<template>
  <div class="finance-reports">
    <el-row :gutter="20">
      <!-- 左侧：报表选择 -->
      <el-col :span="6">
        <el-card>
          <template #header>
            <span>📊 报表列表</span>
          </template>
          <el-menu
            :default-active="currentReport"
            class="report-menu"
            @select="handleSelect"
          >
            <el-menu-item index="sales-daily">
              <el-icon><Document /></el-icon>
              <span>销售日报</span>
            </el-menu-item>
            <el-menu-item index="sales-monthly">
              <el-icon><Calendar /></el-icon>
              <span>销售月报</span>
            </el-menu-item>
            <el-menu-item index="product-rank">
              <el-icon><TrendCharts /></el-icon>
              <span>畅销排行</span>
            </el-menu-item>
            <el-menu-item index="profit-analysis">
              <el-icon><Coin /></el-icon>
              <span>利润分析</span>
            </el-menu-item>
            <el-menu-item index="inventory-turnover">
              <el-icon><DataAnalysis /></el-icon>
              <span>库存周转</span>
            </el-menu-item>
          </el-menu>
        </el-card>
      </el-col>

      <!-- 右侧：报表内容 -->
      <el-col :span="18">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ reportTitle }}</span>
              <el-button type="primary" @click="handleExport">
                <el-icon><Download /></el-icon>
                导出 Excel
              </el-button>
            </div>
          </template>

          <!-- 查询条件 -->
          <el-form :inline="true" :model="queryForm" class="query-form">
            <el-form-item label="日期范围">
              <el-date-picker
                v-model="queryForm.dateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                style="width: 240px"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleQuery">查询</el-button>
              <el-button @click="handleReset">重置</el-button>
            </el-form-item>
          </el-form>

          <!-- 销售日报 -->
          <div v-if="currentReport === 'sales-daily'">
            <el-table :data="reportData" style="width: 100%" border>
              <el-table-column prop="date" label="日期" width="120" />
              <el-table-column prop="orderCount" label="订单数" width="100" />
              <el-table-column prop="totalAmount" label="销售总额" width="120">
                <template #default="{ row }">
                  ¥{{ row.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
              <el-table-column prop="paidAmount" label="已收款" width="120">
                <template #default="{ row }">
                  ¥{{ row.paidAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
              <el-table-column prop="unpaidAmount" label="未收款" width="120">
                <template #default="{ row }">
                  ¥{{ row.unpaidAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
              <el-table-column prop="profit" label="毛利润" width="120">
                <template #default="{ row }">
                  ¥{{ row.profit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
              <el-table-column prop="profitRate" label="利润率" width="80">
                <template #default="{ row }">
                  {{ row.profitRate }}%
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 销售月报 -->
          <div v-if="currentReport === 'sales-monthly'">
            <el-table :data="reportData" style="width: 100%" border>
              <el-table-column prop="month" label="月份" width="120" />
              <el-table-column prop="orderCount" label="订单数" width="100" />
              <el-table-column prop="totalAmount" label="销售总额" width="120">
                <template #default="{ row }">
                  ¥{{ row.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
              <el-table-column prop="costAmount" label="成本总额" width="120">
                <template #default="{ row }">
                  ¥{{ row.costAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
              <el-table-column prop="profit" label="毛利润" width="120">
                <template #default="{ row }">
                  ¥{{ row.profit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
              <el-table-column prop="profitRate" label="利润率" width="80">
                <template #default="{ row }">
                  {{ row.profitRate }}%
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 畅销排行 -->
          <div v-if="currentReport === 'product-rank'">
            <el-table :data="reportData" style="width: 100%" border>
              <el-table-column type="index" label="排名" width="80" />
              <el-table-column prop="productCode" label="商品编码" width="120" />
              <el-table-column prop="productName" label="商品名称" min-width="200" />
              <el-table-column prop="category" label="分类" width="100" />
              <el-table-column prop="salesQuantity" label="销售数量" width="100" />
              <el-table-column prop="salesAmount" label="销售金额" width="120">
                <template #default="{ row }">
                  ¥{{ row.salesAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
              <el-table-column prop="profit" label="利润" width="120">
                <template #default="{ row }">
                  ¥{{ row.profit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 利润分析 -->
          <div v-if="currentReport === 'profit-analysis'">
            <el-table :data="reportData" style="width: 100%" border>
              <el-table-column prop="category" label="分类" width="150" />
              <el-table-column prop="salesAmount" label="销售收入" width="120">
                <template #default="{ row }">
                  ¥{{ row.salesAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
              <el-table-column prop="costAmount" label="销售成本" width="120">
                <template #default="{ row }">
                  ¥{{ row.costAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
              <el-table-column prop="profit" label="毛利润" width="120">
                <template #default="{ row }">
                  ¥{{ row.profit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
                </template>
              </el-table-column>
              <el-table-column prop="profitRate" label="毛利率" width="80">
                <template #default="{ row }">
                  {{ row.profitRate }}%
                </template>
              </el-table-column>
              <el-table-column prop="salesProportion" label="销售占比" width="80">
                <template #default="{ row }">
                  {{ row.salesProportion }}%
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 库存周转 -->
          <div v-if="currentReport === 'inventory-turnover'">
            <el-table :data="reportData" style="width: 100%" border>
              <el-table-column prop="productCode" label="商品编码" width="120" />
              <el-table-column prop="productName" label="商品名称" min-width="200" />
              <el-table-column prop="category" label="分类" width="100" />
              <el-table-column prop="beginStock" label="期初库存" width="100" />
              <el-table-column prop="endStock" label="期末库存" width="100" />
              <el-table-column prop="salesQuantity" label="销售数量" width="100" />
              <el-table-column prop="turnoverRate" label="周转率" width="80">
                <template #default="{ row }">
                  {{ row.turnoverRate }}%
                </template>
              </el-table-column>
              <el-table-column prop="turnoverDays" label="周转天数" width="80">
                <template #default="{ row }">
                  {{ row.turnoverDays }}天
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Calendar, TrendCharts, Coin, DataAnalysis, Download } from '@element-plus/icons-vue'
import exportToCsv from '@/utils/exportCsv'

// 当前报表
const currentReport = ref('sales-daily')

// 报表标题
const reportTitleMap: Record<string, string> = {
  'sales-daily': '销售日报',
  'sales-monthly': '销售月报',
  'product-rank': '畅销商品排行',
  'profit-analysis': '利润分析',
  'inventory-turnover': '库存周转分析'
}

const reportTitle = computed(() => reportTitleMap[currentReport.value])

// 查询条件
const queryForm = reactive({
  dateRange: [] as string[]
})

// 报表数据
const reportData = ref<any[]>([])

// 切换报表
const handleSelect = (index: string) => {
  currentReport.value = index
  handleQuery()
}

// 查询
const handleQuery = () => {
  console.log('查询报表:', currentReport.value, queryForm.dateRange)
  
  // 模拟数据（实际应该从数据库查询）
  if (currentReport.value === 'sales-daily') {
    reportData.value = generateDailyReport()
  } else if (currentReport.value === 'sales-monthly') {
    reportData.value = generateMonthlyReport()
  } else if (currentReport.value === 'product-rank') {
    reportData.value = generateProductRank()
  } else if (currentReport.value === 'profit-analysis') {
    reportData.value = generateProfitAnalysis()
  } else if (currentReport.value === 'inventory-turnover') {
    reportData.value = generateInventoryTurnover()
  }
}

// 重置
const handleReset = () => {
  queryForm.dateRange = []
  handleQuery()
}

// 导出
const handleExport = () => {
  const filename = `${reportTitleMap[currentReport.value]}_${new Date().getTime()}.csv`
  exportToCsv(reportData.value, filename)
  ElMessage.success('导出成功')
}

// 生成模拟数据
const generateDailyReport = () => {
  const data = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const totalAmount = Math.random() * 10000 + 5000
    const costAmount = totalAmount * 0.7
    const profit = totalAmount - costAmount
    const profitRate = ((profit / totalAmount) * 100).toFixed(2)
    
    data.push({
      date: dateStr,
      orderCount: Math.floor(Math.random() * 50) + 10,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      paidAmount: parseFloat((totalAmount * 0.8).toFixed(2)),
      unpaidAmount: parseFloat((totalAmount * 0.2).toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      profitRate: parseFloat(profitRate)
    })
  }
  return data
}

const generateMonthlyReport = () => {
  const data = []
  const currentMonth = new Date().getMonth()
  for (let i = 5; i >= 0; i--) {
    const month = new Date(new Date().getFullYear(), currentMonth - i, 1)
    const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
    const totalAmount = Math.random() * 100000 + 50000
    const costAmount = totalAmount * 0.7
    const profit = totalAmount - costAmount
    const profitRate = ((profit / totalAmount) * 100).toFixed(2)
    
    data.push({
      month: monthStr,
      orderCount: Math.floor(Math.random() * 500) + 100,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      costAmount: parseFloat(costAmount.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      profitRate: parseFloat(profitRate)
    })
  }
  return data
}

const generateProductRank = () => {
  const products = [
    { code: 'P001', name: '商品 A', category: '食品' },
    { code: 'P002', name: '商品 B', category: '日用品' },
    { code: 'P003', name: '商品 C', category: '饮料' },
    { code: 'P004', name: '商品 D', category: '零食' },
    { code: 'P005', name: '商品 E', category: '食品' }
  ]
  
  return products.map((p, index) => {
    const salesQuantity = Math.floor(Math.random() * 1000) + 100
    const salesAmount = salesQuantity * (Math.random() * 50 + 10)
    const cost = salesAmount * 0.7
    const profit = salesAmount - cost
    
    return {
      productCode: p.code,
      productName: p.name,
      category: p.category,
      salesQuantity,
      salesAmount: parseFloat(salesAmount.toFixed(2)),
      profit: parseFloat(profit.toFixed(2))
    }
  }).sort((a, b) => b.salesAmount - a.salesAmount)
}

const generateProfitAnalysis = () => {
  const categories = ['食品', '日用品', '饮料', '零食', '其他']
  const totalSales = categories.reduce((sum, cat) => {
    return sum + (Math.random() * 50000 + 10000)
  }, 0)
  
  return categories.map(cat => {
    const salesAmount = Math.random() * 50000 + 10000
    const costAmount = salesAmount * 0.7
    const profit = salesAmount - costAmount
    const profitRate = ((profit / salesAmount) * 100).toFixed(2)
    const salesProportion = ((salesAmount / totalSales) * 100).toFixed(2)
    
    return {
      category: cat,
      salesAmount: parseFloat(salesAmount.toFixed(2)),
      costAmount: parseFloat(costAmount.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      profitRate: parseFloat(profitRate),
      salesProportion: parseFloat(salesProportion)
    }
  })
}

const generateInventoryTurnover = () => {
  const products = [
    { code: 'P001', name: '商品 A', category: '食品' },
    { code: 'P002', name: '商品 B', category: '日用品' },
    { code: 'P003', name: '商品 C', category: '饮料' }
  ]
  
  return products.map(p => {
    const beginStock = Math.floor(Math.random() * 500) + 100
    const endStock = Math.floor(Math.random() * 300) + 50
    const salesQuantity = Math.floor(Math.random() * 400) + 100
    const avgStock = (beginStock + endStock) / 2
    const turnoverRate = ((salesQuantity / avgStock) * 100).toFixed(2)
    const turnoverDays = (30 / (salesQuantity / avgStock)).toFixed(1)
    
    return {
      productCode: p.code,
      productName: p.name,
      category: p.category,
      beginStock,
      endStock,
      salesQuantity,
      turnoverRate: parseFloat(turnoverRate),
      turnoverDays: parseFloat(turnoverDays)
    }
  })
}

// 初始化
onMounted(() => {
  handleQuery()
})
</script>

<style scoped lang="scss">
.finance-reports {
  padding: 20px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    span {
      font-size: 16px;
      font-weight: bold;
    }
  }
  
  .report-menu {
    border-right: none;
  }
  
  .query-form {
    margin-bottom: 20px;
  }
}
</style>
