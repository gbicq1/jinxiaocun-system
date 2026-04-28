<template>
  <div class="finance-reports">
    <div class="report-sidebar">
      <div class="sidebar-header">
        <el-icon :size="20" color="#fff"><DataAnalysis /></el-icon>
        <span>报表中心</span>
      </div>
      <div class="sidebar-menu">
        <div
          v-for="item in reportMenuItems"
          :key="item.key"
          class="menu-item"
          :class="{ active: currentReport === item.key }"
          @click="handleSelect(item.key)"
        >
          <div class="menu-icon" :style="{ backgroundColor: item.bgColor }">
            <el-icon :size="16" color="#fff"><component :is="item.icon" /></el-icon>
          </div>
          <span class="menu-label">{{ item.label }}</span>
          <div v-if="currentReport === item.key" class="menu-arrow">
            <el-icon :size="12"><ArrowRight /></el-icon>
          </div>
        </div>
      </div>
    </div>

    <div class="report-main">
      <div class="main-header">
        <div class="header-left">
          <div class="title-icon" :style="{ background: currentReportColor }">
            <el-icon :size="18" color="#fff"><component :is="currentReportIcon" /></el-icon>
          </div>
          <div class="title-group">
            <h2 class="report-title">{{ reportTitle }}</h2>
            <span class="report-desc">{{ reportDesc }}</span>
          </div>
        </div>
        <div class="header-right">
          <div class="date-presets">
            <el-button
              v-for="preset in datePresets"
              :key="preset.key"
              :type="activePreset === preset.key ? 'primary' : 'default'"
              size="small"
              round
              @click="applyPreset(preset.key)"
            >{{ preset.label }}</el-button>
          </div>
          <el-date-picker
            v-model="queryForm.dateRange"
            type="daterange"
            range-separator="~"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 240px"
            size="default"
          />
          <el-button type="primary" @click="handleQuery" :loading="loading" round>
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="handleReset" round>
            <el-icon><RefreshRight /></el-icon>
            重置
          </el-button>
          <el-button type="success" @click="handleExport" :disabled="reportData.length === 0" round>
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </div>
      </div>

      <div class="main-body">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner">
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
          </div>
          <p>正在加载数据...</p>
          <span>请稍候，正在为您计算报表数据</span>
        </div>

        <div v-else-if="reportData.length === 0" class="empty-state">
          <div class="empty-illustration">
            <div class="empty-chart">
              <div class="chart-bar" style="--h: 40%"></div>
              <div class="chart-bar" style="--h: 65%"></div>
              <div class="chart-bar" style="--h: 30%"></div>
              <div class="chart-bar" style="--h: 80%"></div>
              <div class="chart-bar" style="--h: 55%"></div>
            </div>
          </div>
          <p>暂无报表数据</p>
          <span>请选择日期范围后点击查询，或尝试切换其他时间范围</span>
        </div>

        <template v-else>
          <div v-if="currentReport === 'sales-daily'">
            <div class="stat-cards" v-if="dailySummary">
              <div class="stat-card" style="--accent: #409eff; --accent-light: #ecf5ff">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><Document /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ dailySummary.orderCount }}</div>
                  <div class="stat-label">订单总数</div>
                </div>
              </div>
              <div class="stat-card" style="--accent: #67c23a; --accent-light: #f0f9eb">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><Coin /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ fmtMoney(dailySummary.totalAmount) }}</div>
                  <div class="stat-label">销售总额</div>
                </div>
              </div>
              <div class="stat-card" style="--accent: #909399; --accent-light: #f4f4f5">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><DataAnalysis /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ fmtMoney(dailySummary.costAmount) }}</div>
                  <div class="stat-label">出库成本</div>
                </div>
              </div>
              <div class="stat-card" style="--accent: #e6a23c; --accent-light: #fdf6ec">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><Coin /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ fmtMoney(dailySummary.paidAmount) }}</div>
                  <div class="stat-label">已收款</div>
                </div>
              </div>
              <div class="stat-card" :style="{ '--accent': dailySummary.profit >= 0 ? '#67c23a' : '#f56c6c', '--accent-light': dailySummary.profit >= 0 ? '#f0f9eb' : '#fef0f0' }">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><TrendCharts /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value" :class="dailySummary.profit >= 0 ? 'text-profit' : 'text-loss'">{{ fmtMoney(dailySummary.profit) }}</div>
                  <div class="stat-label">利润</div>
                </div>
              </div>
              <div class="stat-card" :style="{ '--accent': dailySummary.profitRate >= 0 ? '#67c23a' : '#f56c6c', '--accent-light': dailySummary.profitRate >= 0 ? '#f0f9eb' : '#fef0f0' }">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><TrendCharts /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value" :class="dailySummary.profitRate >= 0 ? 'text-profit' : 'text-loss'">{{ dailySummary.profitRate }}%</div>
                  <div class="stat-label">利润率</div>
                </div>
              </div>
            </div>

            <div class="chart-section" v-if="reportData.length > 1">
              <div class="section-header">
                <span class="section-title">销售趋势</span>
                <span class="section-sub">近{{ reportData.length }}日</span>
              </div>
              <div class="mini-chart">
                <div class="chart-area">
                  <div class="chart-y-axis">
                    <span>{{ fmtCompact(chartMaxValue) }}</span>
                    <span>{{ fmtCompact(chartMaxValue / 2) }}</span>
                    <span>0</span>
                  </div>
                  <div class="chart-bars">
                    <div
                      v-for="(row, idx) in reportData.slice(-20)"
                      :key="idx"
                      class="chart-bar-group"
                    >
                      <el-tooltip :content="`${row.date}：¥${row.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`" placement="top">
                        <div class="bar-wrapper">
                          <div class="bar bar-sales" :style="{ height: Math.max(2, row.totalAmount / chartMaxValue * 140) + 'px' }"></div>
                          <div class="bar bar-cost" :style="{ height: Math.max(2, row.costAmount / chartMaxValue * 140) + 'px' }"></div>
                        </div>
                      </el-tooltip>
                      <span class="bar-label">{{ row.date.slice(5) }}</span>
                    </div>
                  </div>
                </div>
                <div class="chart-legend">
                  <span class="legend-item"><i class="legend-dot" style="background: #409eff"></i>销售额</span>
                  <span class="legend-item"><i class="legend-dot" style="background: #909399"></i>成本</span>
                </div>
              </div>
            </div>

            <div class="report-table-wrapper">
              <div class="table-header-bar">
                <span class="table-title">销售日报明细</span>
                <span class="table-count">共 {{ reportData.length }} 条记录</span>
              </div>
              <el-table :data="reportData" style="width: 100%" border show-summary :summary-method="getDailySummary" stripe :header-cell-style="tableHeaderStyle">
                <el-table-column prop="date" label="日期" width="120" fixed />
                <el-table-column prop="orderCount" label="订单数" width="80" align="center" />
                <el-table-column prop="totalAmount" label="销售总额" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text">¥{{ row.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="costAmount" label="出库成本" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text cost">¥{{ row.costAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="paidAmount" label="已收款" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text received">¥{{ row.paidAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="grossProfit" label="毛利润" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text" :class="row.grossProfit >= 0 ? 'profit' : 'loss'">¥{{ row.grossProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="grossProfitRate" label="毛利率" width="100" align="center">
                  <template #default="{ row }">
                    <div class="rate-cell">
                      <div class="rate-bar-bg">
                        <div class="rate-bar-fill" :style="{ width: Math.min(Math.abs(row.grossProfitRate), 100) + '%', background: row.grossProfitRate >= 0 ? '#67c23a' : '#f56c6c' }"></div>
                      </div>
                      <span :class="row.grossProfitRate >= 0 ? 'text-profit' : 'text-loss'">{{ row.grossProfitRate }}%</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="profit" label="利润" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text" :class="row.profit >= 0 ? 'profit' : 'loss'">¥{{ row.profit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="profitRate" label="利润率" width="100" align="center">
                  <template #default="{ row }">
                    <div class="rate-cell">
                      <div class="rate-bar-bg">
                        <div class="rate-bar-fill" :style="{ width: Math.min(Math.abs(row.profitRate), 100) + '%', background: row.profitRate >= 0 ? '#67c23a' : '#f56c6c' }"></div>
                      </div>
                      <span :class="row.profitRate >= 0 ? 'text-profit' : 'text-loss'">{{ row.profitRate }}%</span>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>

          <div v-if="currentReport === 'sales-monthly'">
            <div class="stat-cards" v-if="monthlySummary">
              <div class="stat-card" style="--accent: #67c23a; --accent-light: #f0f9eb">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><Calendar /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ monthlySummary.orderCount }}</div>
                  <div class="stat-label">订单总数</div>
                </div>
              </div>
              <div class="stat-card" style="--accent: #409eff; --accent-light: #ecf5ff">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><Coin /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ fmtMoney(monthlySummary.totalAmount) }}</div>
                  <div class="stat-label">销售总额</div>
                </div>
              </div>
              <div class="stat-card" style="--accent: #909399; --accent-light: #f4f4f5">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><DataAnalysis /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ fmtMoney(monthlySummary.costAmount) }}</div>
                  <div class="stat-label">出库成本</div>
                </div>
              </div>
              <div class="stat-card" :style="{ '--accent': monthlySummary.profit >= 0 ? '#67c23a' : '#f56c6c', '--accent-light': monthlySummary.profit >= 0 ? '#f0f9eb' : '#fef0f0' }">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><TrendCharts /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value" :class="monthlySummary.profit >= 0 ? 'text-profit' : 'text-loss'">{{ fmtMoney(monthlySummary.profit) }}</div>
                  <div class="stat-label">利润</div>
                </div>
              </div>
              <div class="stat-card" :style="{ '--accent': monthlySummary.profitRate >= 0 ? '#67c23a' : '#f56c6c', '--accent-light': monthlySummary.profitRate >= 0 ? '#f0f9eb' : '#fef0f0' }">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><TrendCharts /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value" :class="monthlySummary.profitRate >= 0 ? 'text-profit' : 'text-loss'">{{ monthlySummary.profitRate }}%</div>
                  <div class="stat-label">利润率</div>
                </div>
              </div>
            </div>

            <div class="chart-section" v-if="reportData.length > 1">
              <div class="section-header">
                <span class="section-title">月度趋势</span>
                <span class="section-sub">近{{ reportData.length }}月</span>
              </div>
              <div class="mini-chart">
                <div class="chart-area">
                  <div class="chart-y-axis">
                    <span>{{ fmtCompact(chartMaxValue) }}</span>
                    <span>{{ fmtCompact(chartMaxValue / 2) }}</span>
                    <span>0</span>
                  </div>
                  <div class="chart-bars">
                    <div
                      v-for="(row, idx) in reportData"
                      :key="idx"
                      class="chart-bar-group"
                    >
                      <el-tooltip :content="`${row.month}：¥${row.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`" placement="top">
                        <div class="bar-wrapper">
                          <div class="bar bar-sales" :style="{ height: Math.max(2, row.totalAmount / chartMaxValue * 140) + 'px' }"></div>
                          <div class="bar bar-cost" :style="{ height: Math.max(2, row.costAmount / chartMaxValue * 140) + 'px' }"></div>
                        </div>
                      </el-tooltip>
                      <span class="bar-label">{{ row.month }}</span>
                    </div>
                  </div>
                </div>
                <div class="chart-legend">
                  <span class="legend-item"><i class="legend-dot" style="background: #409eff"></i>销售额</span>
                  <span class="legend-item"><i class="legend-dot" style="background: #909399"></i>成本</span>
                </div>
              </div>
            </div>

            <div class="report-table-wrapper">
              <div class="table-header-bar">
                <span class="table-title">销售月报明细</span>
                <span class="table-count">共 {{ reportData.length }} 条记录</span>
              </div>
              <el-table :data="reportData" style="width: 100%" border show-summary :summary-method="getMonthlySummary" stripe :header-cell-style="tableHeaderStyle">
                <el-table-column prop="month" label="月份" width="100" fixed />
                <el-table-column prop="orderCount" label="订单数" width="80" align="center" />
                <el-table-column prop="totalAmount" label="销售总额" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text">¥{{ row.totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="costAmount" label="出库成本" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text cost">¥{{ row.costAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="grossProfit" label="毛利润" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text" :class="row.grossProfit >= 0 ? 'profit' : 'loss'">¥{{ row.grossProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="grossProfitRate" label="毛利率" width="100" align="center">
                  <template #default="{ row }">
                    <div class="rate-cell">
                      <div class="rate-bar-bg">
                        <div class="rate-bar-fill" :style="{ width: Math.min(Math.abs(row.grossProfitRate), 100) + '%', background: row.grossProfitRate >= 0 ? '#67c23a' : '#f56c6c' }"></div>
                      </div>
                      <span :class="row.grossProfitRate >= 0 ? 'text-profit' : 'text-loss'">{{ row.grossProfitRate }}%</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="profit" label="利润" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text" :class="row.profit >= 0 ? 'profit' : 'loss'">¥{{ row.profit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="profitRate" label="利润率" width="100" align="center">
                  <template #default="{ row }">
                    <div class="rate-cell">
                      <div class="rate-bar-bg">
                        <div class="rate-bar-fill" :style="{ width: Math.min(Math.abs(row.profitRate), 100) + '%', background: row.profitRate >= 0 ? '#67c23a' : '#f56c6c' }"></div>
                      </div>
                      <span :class="row.profitRate >= 0 ? 'text-profit' : 'text-loss'">{{ row.profitRate }}%</span>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>

          <div v-if="currentReport === 'product-rank'">
            <div class="stat-cards" v-if="rankSummary">
              <div class="stat-card" style="--accent: #e6a23c; --accent-light: #fdf6ec">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><TrendCharts /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ rankSummary.totalQty }}</div>
                  <div class="stat-label">总销量</div>
                </div>
              </div>
              <div class="stat-card" style="--accent: #409eff; --accent-light: #ecf5ff">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><Coin /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ fmtMoney(rankSummary.totalSales) }}</div>
                  <div class="stat-label">销售总额</div>
                </div>
              </div>
              <div class="stat-card" :style="{ '--accent': rankSummary.totalProfit >= 0 ? '#67c23a' : '#f56c6c', '--accent-light': rankSummary.totalProfit >= 0 ? '#f0f9eb' : '#fef0f0' }">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><TrendCharts /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value" :class="rankSummary.totalProfit >= 0 ? 'text-profit' : 'text-loss'">{{ fmtMoney(rankSummary.totalProfit) }}</div>
                  <div class="stat-label">总利润</div>
                </div>
              </div>
              <div class="stat-card" :style="{ '--accent': rankSummary.avgProfitRate >= 0 ? '#67c23a' : '#f56c6c', '--accent-light': rankSummary.avgProfitRate >= 0 ? '#f0f9eb' : '#fef0f0' }">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><TrendCharts /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value" :class="rankSummary.avgProfitRate >= 0 ? 'text-profit' : 'text-loss'">{{ rankSummary.avgProfitRate }}%</div>
                  <div class="stat-label">平均利润率</div>
                </div>
              </div>
            </div>

            <div class="top-products-section" v-if="reportData.length > 0">
              <div class="section-header">
                <span class="section-title">TOP 商品</span>
                <span class="section-sub">销售额前5名</span>
              </div>
              <div class="top-products-grid">
                <div
                  v-for="(product, idx) in reportData.slice(0, 5)"
                  :key="idx"
                  class="top-product-card"
                  :class="'top-rank-' + idx"
                >
                  <div class="top-rank-badge">{{ idx + 1 }}</div>
                  <div class="top-product-info">
                    <div class="top-product-name">{{ product.productName }}</div>
                    <div class="top-product-code">{{ product.productCode }}</div>
                  </div>
                  <div class="top-product-stats">
                    <div class="top-amount">{{ fmtMoney(product.salesAmount) }}</div>
                    <div class="top-qty">销量 {{ product.salesQuantity }}</div>
                  </div>
                  <div class="top-profit-bar">
                    <div class="top-profit-fill" :style="{ width: Math.min(Math.abs(product.profitRate), 100) + '%', background: product.profitRate >= 0 ? 'linear-gradient(90deg, #67c23a, #95d475)' : 'linear-gradient(90deg, #f56c6c, #fab6b6)' }"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="report-table-wrapper">
              <div class="table-header-bar">
                <span class="table-title">畅销商品排行明细</span>
                <span class="table-count">共 {{ reportData.length }} 条记录</span>
              </div>
              <el-table :data="reportData" style="width: 100%" border stripe :header-cell-style="tableHeaderStyle">
                <el-table-column label="排名" width="70" align="center">
                  <template #default="{ $index }">
                    <span class="rank-badge" :class="'rank-' + ($index < 3 ? $index : 'other')">{{ $index + 1 }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="productCode" label="商品编码" width="120" />
                <el-table-column prop="productName" label="商品名称" min-width="180" />
                <el-table-column prop="category" label="分类" width="100" />
                <el-table-column prop="salesQuantity" label="销售数量" width="100" align="center" />
                <el-table-column prop="salesAmount" label="销售金额" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text">¥{{ row.salesAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="costAmount" label="成本金额" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text cost">¥{{ row.costAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="grossProfit" label="毛利润" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text" :class="row.grossProfit >= 0 ? 'profit' : 'loss'">¥{{ row.grossProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="grossProfitRate" label="毛利率" width="100" align="center">
                  <template #default="{ row }">
                    <div class="rate-cell">
                      <div class="rate-bar-bg">
                        <div class="rate-bar-fill" :style="{ width: Math.min(Math.abs(row.grossProfitRate), 100) + '%', background: row.grossProfitRate >= 0 ? '#67c23a' : '#f56c6c' }"></div>
                      </div>
                      <span :class="row.grossProfitRate >= 0 ? 'text-profit' : 'text-loss'">{{ row.grossProfitRate }}%</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="profit" label="利润" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text" :class="row.profit >= 0 ? 'profit' : 'loss'">¥{{ row.profit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="profitRate" label="利润率" width="100" align="center">
                  <template #default="{ row }">
                    <div class="rate-cell">
                      <div class="rate-bar-bg">
                        <div class="rate-bar-fill" :style="{ width: Math.min(Math.abs(row.profitRate), 100) + '%', background: row.profitRate >= 0 ? '#67c23a' : '#f56c6c' }"></div>
                      </div>
                      <span :class="row.profitRate >= 0 ? 'text-profit' : 'text-loss'">{{ row.profitRate }}%</span>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>

          <div v-if="currentReport === 'profit-analysis'">
            <div class="stat-cards" v-if="profitAnalysisSummary">
              <div class="stat-card" style="--accent: #409eff; --accent-light: #ecf5ff">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><Coin /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ fmtMoney(profitAnalysisSummary.totalSales) }}</div>
                  <div class="stat-label">销售收入</div>
                </div>
              </div>
              <div class="stat-card" style="--accent: #909399; --accent-light: #f4f4f5">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><DataAnalysis /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ fmtMoney(profitAnalysisSummary.totalCost) }}</div>
                  <div class="stat-label">销售成本</div>
                </div>
              </div>
              <div class="stat-card" :style="{ '--accent': profitAnalysisSummary.totalProfit >= 0 ? '#67c23a' : '#f56c6c', '--accent-light': profitAnalysisSummary.totalProfit >= 0 ? '#f0f9eb' : '#fef0f0' }">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><TrendCharts /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value" :class="profitAnalysisSummary.totalProfit >= 0 ? 'text-profit' : 'text-loss'">{{ fmtMoney(profitAnalysisSummary.totalProfit) }}</div>
                  <div class="stat-label">总利润</div>
                </div>
              </div>
              <div class="stat-card" :style="{ '--accent': profitAnalysisSummary.avgProfitRate >= 0 ? '#67c23a' : '#f56c6c', '--accent-light': profitAnalysisSummary.avgProfitRate >= 0 ? '#f0f9eb' : '#fef0f0' }">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><TrendCharts /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value" :class="profitAnalysisSummary.avgProfitRate >= 0 ? 'text-profit' : 'text-loss'">{{ profitAnalysisSummary.avgProfitRate }}%</div>
                  <div class="stat-label">平均利润率</div>
                </div>
              </div>
            </div>

            <div class="profit-distribution" v-if="reportData.length > 0">
              <div class="section-header">
                <span class="section-title">分类利润分布</span>
                <span class="section-sub">各分类销售占比</span>
              </div>
              <div class="distribution-bars">
                <div
                  v-for="(row, idx) in reportData"
                  :key="idx"
                  class="dist-row"
                >
                  <div class="dist-label">{{ row.category }}</div>
                  <div class="dist-bar-area">
                    <div class="dist-bar-track">
                      <div class="dist-bar-fill" :style="{ width: row.salesProportion + '%', background: distColors[idx % distColors.length] }"></div>
                    </div>
                  </div>
                  <div class="dist-values">
                    <span class="dist-amount">{{ fmtMoney(row.salesAmount) }}</span>
                    <span class="dist-rate" :class="row.profitRate >= 0 ? 'text-profit' : 'text-loss'">{{ row.profitRate }}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="report-table-wrapper">
              <div class="table-header-bar">
                <span class="table-title">利润分析明细</span>
                <span class="table-count">共 {{ reportData.length }} 条记录</span>
              </div>
              <el-table :data="reportData" style="width: 100%" border stripe :header-cell-style="tableHeaderStyle">
                <el-table-column prop="category" label="分类" width="150" />
                <el-table-column prop="salesAmount" label="销售收入" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text">¥{{ row.salesAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="costAmount" label="销售成本" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text cost">¥{{ row.costAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="grossProfit" label="毛利润" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text" :class="row.grossProfit >= 0 ? 'profit' : 'loss'">¥{{ row.grossProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="grossProfitRate" label="毛利率" width="100" align="center">
                  <template #default="{ row }">
                    <div class="rate-cell">
                      <div class="rate-bar-bg">
                        <div class="rate-bar-fill" :style="{ width: Math.min(Math.abs(row.grossProfitRate), 100) + '%', background: row.grossProfitRate >= 0 ? '#67c23a' : '#f56c6c' }"></div>
                      </div>
                      <span :class="row.grossProfitRate >= 0 ? 'text-profit' : 'text-loss'">{{ row.grossProfitRate }}%</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="profit" label="利润" width="130" align="right">
                  <template #default="{ row }">
                    <span class="amount-text" :class="row.profit >= 0 ? 'profit' : 'loss'">¥{{ row.profit.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="profitRate" label="利润率" width="100" align="center">
                  <template #default="{ row }">
                    <div class="rate-cell">
                      <div class="rate-bar-bg">
                        <div class="rate-bar-fill" :style="{ width: Math.min(Math.abs(row.profitRate), 100) + '%', background: row.profitRate >= 0 ? '#67c23a' : '#f56c6c' }"></div>
                      </div>
                      <span :class="row.profitRate >= 0 ? 'text-profit' : 'text-loss'">{{ row.profitRate }}%</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="salesProportion" label="销售占比" width="120" align="center">
                  <template #default="{ row }">
                    <div class="proportion-cell">
                      <div class="proportion-bar">
                        <div class="proportion-fill" :style="{ width: Math.min(row.salesProportion, 100) + '%' }"></div>
                      </div>
                      <span>{{ row.salesProportion }}%</span>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>

          <div v-if="currentReport === 'inventory-turnover'">
            <div class="stat-cards" v-if="turnoverSummary">
              <div class="stat-card" style="--accent: #67c23a; --accent-light: #f0f9eb">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><Coin /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ turnoverSummary.totalInbound }}</div>
                  <div class="stat-label">总入库</div>
                </div>
              </div>
              <div class="stat-card" style="--accent: #f56c6c; --accent-light: #fef0f0">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><Coin /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ turnoverSummary.totalOutbound }}</div>
                  <div class="stat-label">总出库</div>
                </div>
              </div>
              <div class="stat-card" style="--accent: #409eff; --accent-light: #ecf5ff">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><DataAnalysis /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ turnoverSummary.totalEndStock }}</div>
                  <div class="stat-label">期末库存</div>
                </div>
              </div>
              <div class="stat-card" style="--accent: #e6a23c; --accent-light: #fdf6ec">
                <div class="card-accent"></div>
                <div class="stat-icon"><el-icon :size="20"><TrendCharts /></el-icon></div>
                <div class="stat-info">
                  <div class="stat-value">{{ turnoverSummary.avgTurnover }}</div>
                  <div class="stat-label">平均周转率</div>
                </div>
              </div>
            </div>

            <div class="turnover-section" v-if="reportData.length > 0">
              <div class="section-header">
                <span class="section-title">库存分布概览</span>
                <span class="section-sub">TOP {{ Math.min(reportData.length, 8) }} 商品</span>
              </div>
              <div class="turnover-grid">
                <div
                  v-for="(row, idx) in reportData.slice(0, 8)"
                  :key="idx"
                  class="turnover-card"
                >
                  <div class="turnover-card-header">
                    <div>
                      <div class="turnover-card-name">{{ row.productName }}</div>
                      <div class="turnover-card-code">{{ row.productCode }}</div>
                    </div>
                    <div
                      class="turnover-rate-badge"
                      :style="{
                        background: row.turnoverRate >= 1 ? '#f0f9eb' : row.turnoverRate >= 0.5 ? '#fdf6ec' : '#fef0f0',
                        color: row.turnoverRate >= 1 ? '#67c23a' : row.turnoverRate >= 0.5 ? '#e6a23c' : '#f56c6c'
                      }"
                    >{{ row.turnoverRate }}次</div>
                  </div>
                  <div class="turnover-card-chart">
                    <div class="turnover-chart-col">
                      <div class="turnover-bar-area">
                        <div class="turnover-bar turnover-bar-in" :style="{ height: Math.max(4, (row.inboundQty / Math.max(row.inboundQty, row.outboundQty, row.endStock, 1)) * 50) + 'px' }"></div>
                      </div>
                      <div class="turnover-stat-item"><i class="turnover-stat-dot" style="background: #67c23a"></i>入库 {{ row.inboundQty }}</div>
                    </div>
                    <div class="turnover-chart-col">
                      <div class="turnover-bar-area">
                        <div class="turnover-bar turnover-bar-out" :style="{ height: Math.max(4, (row.outboundQty / Math.max(row.inboundQty, row.outboundQty, row.endStock, 1)) * 50) + 'px' }"></div>
                      </div>
                      <div class="turnover-stat-item"><i class="turnover-stat-dot" style="background: #f56c6c"></i>出库 {{ row.outboundQty }}</div>
                    </div>
                    <div class="turnover-chart-col">
                      <div class="turnover-bar-area">
                        <div class="turnover-bar turnover-bar-stock" :style="{ height: Math.max(4, (row.endStock / Math.max(row.inboundQty, row.outboundQty, row.endStock, 1)) * 50) + 'px' }"></div>
                      </div>
                      <div class="turnover-stat-item"><i class="turnover-stat-dot" style="background: #409eff"></i>库存 {{ row.endStock }}</div>
                    </div>
                  </div>
                  <div class="turnover-card-footer">
                    <span class="turnover-days">周转天数</span>
                    <span class="turnover-days-value">{{ row.turnoverDays }}天</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="report-table-wrapper">
              <div class="table-header-bar">
                <span class="table-title">库存周转分析明细</span>
                <span class="table-count">共 {{ reportData.length }} 条记录</span>
              </div>
              <el-table :data="reportData" style="width: 100%" border stripe :header-cell-style="tableHeaderStyle">
                <el-table-column prop="productCode" label="商品编码" width="120" />
                <el-table-column prop="productName" label="商品名称" width="200" />
                <el-table-column prop="category" label="分类" width="90" />
                <el-table-column prop="beginStock" label="期初库存" width="100" align="center" />
                <el-table-column prop="inboundQty" label="入库数量" width="100" align="center">
                  <template #default="{ row }">
                    <span class="qty-in">{{ row.inboundQty }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="outboundQty" label="出库数量" width="100" align="center">
                  <template #default="{ row }">
                    <span class="qty-out">{{ row.outboundQty }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="endStock" label="期末库存" width="100" align="center" />
                <el-table-column prop="turnoverRate" label="周转率" width="90" align="center">
                  <template #default="{ row }">
                    <span class="turnover-value">{{ row.turnoverRate }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="turnoverDays" label="周转天数" width="100" align="center">
                  <template #default="{ row }">
                    <span>{{ row.turnoverDays }}天</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onActivated } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Calendar, TrendCharts, Coin, DataAnalysis, Download, Loading, Search, RefreshRight, ArrowRight } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import { db } from '@/utils/db-ipc'

const currentReport = ref('sales-daily')
const loading = ref(false)
const activePreset = ref('year')

const reportMenuItems = [
  { key: 'sales-daily', label: '销售日报', icon: Document, bgColor: '#409eff' },
  { key: 'sales-monthly', label: '销售月报', icon: Calendar, bgColor: '#67c23a' },
  { key: 'product-rank', label: '畅销排行', icon: TrendCharts, bgColor: '#e6a23c' },
  { key: 'profit-analysis', label: '利润分析', icon: Coin, bgColor: '#f56c6c' },
  { key: 'inventory-turnover', label: '库存周转', icon: DataAnalysis, bgColor: '#909399' }
]

const reportTitleMap: Record<string, string> = {
  'sales-daily': '销售日报',
  'sales-monthly': '销售月报',
  'product-rank': '畅销商品排行',
  'profit-analysis': '利润分析',
  'inventory-turnover': '库存周转分析'
}

const reportDescMap: Record<string, string> = {
  'sales-daily': '按日汇总销售数据，掌握每日经营状况',
  'sales-monthly': '按月汇总销售数据，分析月度经营趋势',
  'product-rank': '按销售额排序，发现最畅销的商品',
  'profit-analysis': '按分类分析利润构成，优化经营策略',
  'inventory-turnover': '分析库存周转效率，优化库存管理'
}

const reportColorMap: Record<string, string> = {
  'sales-daily': '#409eff',
  'sales-monthly': '#67c23a',
  'product-rank': '#e6a23c',
  'profit-analysis': '#f56c6c',
  'inventory-turnover': '#909399'
}

const reportIconMap: Record<string, any> = {
  'sales-daily': Document,
  'sales-monthly': Calendar,
  'product-rank': TrendCharts,
  'profit-analysis': Coin,
  'inventory-turnover': DataAnalysis
}

const reportTitle = computed(() => reportTitleMap[currentReport.value])
const reportDesc = computed(() => reportDescMap[currentReport.value])
const currentReportColor = computed(() => reportColorMap[currentReport.value])
const currentReportIcon = computed(() => reportIconMap[currentReport.value])

const datePresets = [
  { key: 'month', label: '本月' },
  { key: 'quarter', label: '本季' },
  { key: 'year', label: '本年' }
]

const queryForm = reactive({
  dateRange: [] as string[]
})

const reportData = ref<any[]>([])

const round2 = (n: number) => Math.round(n * 100) / 100

const distColors = [
  'linear-gradient(90deg, #409eff, #66b1ff)',
  'linear-gradient(90deg, #67c23a, #95d475)',
  'linear-gradient(90deg, #e6a23c, #eebe77)',
  'linear-gradient(90deg, #f56c6c, #fab6b6)',
  'linear-gradient(90deg, #909399, #c0c4cc)',
  'linear-gradient(90deg, #9b59b6, #c39bd3)',
  'linear-gradient(90deg, #1abc9c, #76d7c4)',
  'linear-gradient(90deg, #e74c3c, #f1948a)'
]

const fmtMoney = (n: number) => '¥' + round2(n).toLocaleString('zh-CN', { minimumFractionDigits: 2 })

const fmtCompact = (n: number) => {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return n.toFixed(0)
}

const tableHeaderStyle = {
  background: 'linear-gradient(180deg, #f8f9fb 0%, #f0f2f5 100%)',
  color: '#303133',
  fontWeight: '600',
  fontSize: '13px'
}

const chartMaxValue = computed(() => {
  if (!reportData.value.length) return 1
  const maxVal = Math.max(...reportData.value.map(r => r.totalAmount || 0))
  return maxVal > 0 ? maxVal * 1.2 : 1
})

const applyPreset = (key: string) => {
  activePreset.value = key
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const today = now.toLocaleDateString('sv-SE')

  if (key === 'month') {
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
    queryForm.dateRange = [start, today]
  } else if (key === 'quarter') {
    const quarterStartMonth = Math.floor(m / 3) * 3
    const start = `${y}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`
    queryForm.dateRange = [start, today]
  } else if (key === 'year') {
    queryForm.dateRange = [`${y}-01-01`, today]
  }
  handleQuery()
}

const dailySummary = computed(() => {
  const d = reportData.value
  if (!d.length) return null
  const totalAmount = d.reduce((s, r) => s + r.totalAmount, 0)
  const totalAmountEx = d.reduce((s, r) => s + (r.totalAmountEx || 0), 0)
  const totalTaxAmount = d.reduce((s, r) => s + (r.totalTaxAmount || 0), 0)
  const costAmount = d.reduce((s, r) => s + r.costAmount, 0)
  const paidAmount = d.reduce((s, r) => s + r.paidAmount, 0)
  const profit = d.reduce((s, r) => s + r.profit, 0)
  const orderCount = d.reduce((s, r) => s + r.orderCount, 0)
  const effectiveAmountEx = totalAmountEx > 0 ? totalAmountEx : (totalAmount - totalTaxAmount)
  const effectiveProfit = totalAmountEx > 0 ? profit : round2(effectiveAmountEx - costAmount)
  const profitRate = effectiveAmountEx !== 0 ? round2((effectiveProfit / Math.abs(effectiveAmountEx)) * 100) : 0
  return { totalAmount, costAmount, paidAmount, profit: effectiveProfit, profitRate, orderCount }
})

const monthlySummary = computed(() => {
  const d = reportData.value
  if (!d.length) return null
  const totalAmount = d.reduce((s, r) => s + r.totalAmount, 0)
  const totalAmountEx = d.reduce((s, r) => s + (r.totalAmountEx || 0), 0)
  const totalTaxAmount = d.reduce((s, r) => s + (r.totalTaxAmount || 0), 0)
  const costAmount = d.reduce((s, r) => s + r.costAmount, 0)
  const profit = d.reduce((s, r) => s + r.profit, 0)
  const orderCount = d.reduce((s, r) => s + r.orderCount, 0)
  const effectiveAmountEx = totalAmountEx > 0 ? totalAmountEx : (totalAmount - totalTaxAmount)
  const effectiveProfit = totalAmountEx > 0 ? profit : round2(effectiveAmountEx - costAmount)
  const profitRate = effectiveAmountEx !== 0 ? round2((effectiveProfit / Math.abs(effectiveAmountEx)) * 100) : 0
  return { totalAmount, costAmount, profit: effectiveProfit, profitRate, orderCount }
})

const rankSummary = computed(() => {
  const d = reportData.value
  if (!d.length) return null
  const totalSales = d.reduce((s, r) => s + r.salesAmount, 0)
  const totalSalesEx = d.reduce((s, r) => s + (r.salesAmountEx || 0), 0)
  const totalTaxAmount = d.reduce((s, r) => s + (r.totalTaxAmount || 0), 0)
  const totalCost = d.reduce((s, r) => s + r.costAmount, 0)
  const totalProfit = d.reduce((s, r) => s + r.profit, 0)
  const totalQty = d.reduce((s, r) => s + r.salesQuantity, 0)
  const effectiveSalesEx = totalSalesEx > 0 ? totalSalesEx : (totalSales - totalTaxAmount)
  const effectiveProfit = totalSalesEx > 0 ? totalProfit : round2(effectiveSalesEx - totalCost)
  const avgProfitRate = effectiveSalesEx !== 0 ? round2((effectiveProfit / Math.abs(effectiveSalesEx)) * 100) : 0
  return { totalSales, totalProfit: effectiveProfit, totalQty, avgProfitRate }
})

const profitAnalysisSummary = computed(() => {
  const d = reportData.value
  if (!d.length) return null
  const totalSales = d.reduce((s, r) => s + r.salesAmount, 0)
  const totalSalesEx = d.reduce((s, r) => s + (r.salesAmountEx || 0), 0)
  const totalTaxAmount = d.reduce((s, r) => s + (r.totalTaxAmount || 0), 0)
  const totalCost = d.reduce((s, r) => s + r.costAmount, 0)
  const totalProfit = d.reduce((s, r) => s + r.profit, 0)
  const effectiveSalesEx = totalSalesEx > 0 ? totalSalesEx : (totalSales - totalTaxAmount)
  const effectiveProfit = totalSalesEx > 0 ? totalProfit : round2(effectiveSalesEx - totalCost)
  const avgProfitRate = effectiveSalesEx !== 0 ? round2((effectiveProfit / Math.abs(effectiveSalesEx)) * 100) : 0
  return { totalSales, totalCost, totalProfit: effectiveProfit, avgProfitRate }
})

const turnoverSummary = computed(() => {
  const d = reportData.value
  if (!d.length) return null
  const totalInbound = d.reduce((s, r) => s + r.inboundQty, 0)
  const totalOutbound = d.reduce((s, r) => s + r.outboundQty, 0)
  const totalEndStock = d.reduce((s, r) => s + r.endStock, 0)
  const avgTurnover = d.length > 0 ? round2(d.reduce((s, r) => s + r.turnoverRate, 0) / d.length) : 0
  return { totalInbound, totalOutbound, totalEndStock, avgTurnover }
})

const handleSelect = (index: string) => {
  currentReport.value = index
  handleQuery()
}

const handleQuery = async () => {
  loading.value = true
  try {
    if (currentReport.value === 'sales-daily') {
      await loadDailyReport()
    } else if (currentReport.value === 'sales-monthly') {
      await loadMonthlyReport()
    } else if (currentReport.value === 'product-rank') {
      await loadProductRank()
    } else if (currentReport.value === 'profit-analysis') {
      await loadProfitAnalysis()
    } else if (currentReport.value === 'inventory-turnover') {
      await loadInventoryTurnover()
    }
  } catch (error) {
    console.error('加载报表失败:', error)
    ElMessage.error('加载数据失败')
    reportData.value = []
  } finally {
    loading.value = false
  }
}

const handleReset = () => {
  queryForm.dateRange = []
  activePreset.value = 'year'
  handleQuery()
}

const getStartDate = () => queryForm.dateRange?.[0] || ''
const getEndDate = () => queryForm.dateRange?.[1] || ''

const recalculateCostForMonths = async (startDate: string, endDate: string) => {
  const [startYear, startMonth] = startDate.split('-').map(Number)
  const [endYear, endMonth] = endDate.split('-').map(Number)
  let y = startYear, m = startMonth
  while (y < endYear || (y === endYear && m <= endMonth)) {
    try {
      await db.calculateCostWithoutLock({ year: y, month: m })
    } catch (e) {
      console.warn(`计算 ${y}年${m}月 成本失败:`, e)
    }
    m++
    if (m > 12) { m = 1; y++ }
  }
}

const loadDailyReport = async () => {
  let startDate = getStartDate()
  let endDate = getEndDate()
  if (!startDate || !endDate) {
    const now = new Date()
    const y = now.getFullYear()
    startDate = `${y}-01-01`
    endDate = now.toLocaleDateString('sv-SE')
  }

  await recalculateCostForMonths(startDate, endDate)

  const profitData = await db.getSalesProfitDailySummary({ startDate, endDate })

  const outbounds = await db.getOutboundList(1, 100000)
  const paidMap: Record<string, number> = {}
  for (const rec of (outbounds?.data || [])) {
    const recDate = (rec.voucherDate || rec.outbound_date || '').slice(0, 10)
    if (!recDate) continue
    if (recDate < startDate || recDate > endDate) continue
    if (!paidMap[recDate]) paidMap[recDate] = 0
    paidMap[recDate] += Number(rec.receivedAmount || rec.received_amount || 0)
  }

  reportData.value = (profitData || []).map((item: any) => {
    const totalAmount = round2(Number(item.total_sales_amount || 0))
    const totalAmountEx = round2(Number(item.total_sales_amount_ex || 0))
    const totalTaxAmount = round2(Number(item.total_tax_amount || 0))
    const costAmount = round2(Number(item.total_stock_cost_amount || 0))
    const effectiveAmountEx = totalAmountEx > 0 ? totalAmountEx : (totalAmount - totalTaxAmount)
    const grossProfit = round2(totalAmount - costAmount)
    const grossProfitRate = totalAmount !== 0 ? round2((grossProfit / Math.abs(totalAmount)) * 100) : 0
    const effectiveProfit = totalAmountEx > 0 ? round2(Number(item.total_profit_amount || 0)) : round2(effectiveAmountEx - costAmount)
    const profitRate = effectiveAmountEx !== 0 ? round2((effectiveProfit / Math.abs(effectiveAmountEx)) * 100) : 0
    return {
      date: item.date,
      orderCount: Number(item.outbound_count || 0),
      totalAmount,
      totalAmountEx,
      totalTaxAmount,
      costAmount,
      paidAmount: round2(paidMap[item.date] || 0),
      grossProfit,
      grossProfitRate,
      profit: effectiveProfit,
      profitRate
    }
  })
}

const getDailySummary = (param: any) => {
  const { columns } = param
  const sums: string[] = []
  columns.forEach((col: any, index: number) => {
    if (index === 0) { sums[index] = '合计'; return }
    const prop = col.property
    if (['orderCount', 'totalAmount', 'costAmount', 'paidAmount', 'grossProfit', 'profit'].includes(prop)) {
      const val = reportData.value.reduce((s, r) => s + (Number(r[prop]) || 0), 0)
      sums[index] = prop === 'orderCount' ? String(val) : '¥' + round2(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
    } else if (prop === 'grossProfitRate') {
      const totalAmount = reportData.value.reduce((s, r) => s + r.totalAmount, 0)
      const totalCost = reportData.value.reduce((s, r) => s + r.costAmount, 0)
      const totalGrossProfit = round2(totalAmount - totalCost)
      sums[index] = totalAmount > 0 ? round2((totalGrossProfit / totalAmount) * 100) + '%' : '0%'
    } else if (prop === 'profitRate') {
      const totalAmount = reportData.value.reduce((s, r) => s + r.totalAmount, 0)
      const totalAmountEx = reportData.value.reduce((s, r) => s + (r.totalAmountEx || 0), 0)
      const totalTaxAmount = reportData.value.reduce((s, r) => s + (r.totalTaxAmount || 0), 0)
      const totalProfit = reportData.value.reduce((s, r) => s + r.profit, 0)
      const effectiveAmountEx = totalAmountEx > 0 ? totalAmountEx : (totalAmount - totalTaxAmount)
      sums[index] = effectiveAmountEx > 0 ? round2((totalProfit / effectiveAmountEx) * 100) + '%' : '0%'
    } else {
      sums[index] = ''
    }
  })
  return sums
}

const loadMonthlyReport = async () => {
  let startDate = getStartDate()
  let endDate = getEndDate()
  if (!startDate || !endDate) {
    const now = new Date()
    const y = now.getFullYear()
    startDate = `${y}-01-01`
    endDate = now.toLocaleDateString('sv-SE')
  }

  await recalculateCostForMonths(startDate, endDate)

  const profitData = await db.getSalesProfitMonthlySummary({ startDate, endDate })

  reportData.value = (profitData || []).map((item: any) => {
    const totalAmount = round2(Number(item.total_sales_amount || 0))
    const totalAmountEx = round2(Number(item.total_sales_amount_ex || 0))
    const totalTaxAmount = round2(Number(item.total_tax_amount || 0))
    const costAmount = round2(Number(item.total_stock_cost_amount || 0))
    const effectiveAmountEx = totalAmountEx > 0 ? totalAmountEx : (totalAmount - totalTaxAmount)
    const grossProfit = round2(totalAmount - costAmount)
    const grossProfitRate = totalAmount !== 0 ? round2((grossProfit / Math.abs(totalAmount)) * 100) : 0
    const effectiveProfit = totalAmountEx > 0 ? round2(Number(item.total_profit_amount || 0)) : round2(effectiveAmountEx - costAmount)
    const profitRate = effectiveAmountEx !== 0 ? round2((effectiveProfit / Math.abs(effectiveAmountEx)) * 100) : 0
    return {
      month: item.month,
      orderCount: Number(item.outbound_count || 0),
      totalAmount,
      totalAmountEx,
      totalTaxAmount,
      costAmount,
      grossProfit,
      grossProfitRate,
      profit: effectiveProfit,
      profitRate
    }
  })
}

const getMonthlySummary = (param: any) => {
  const { columns } = param
  const sums: string[] = []
  columns.forEach((col: any, index: number) => {
    if (index === 0) { sums[index] = '合计'; return }
    const prop = col.property
    if (['orderCount', 'totalAmount', 'costAmount', 'grossProfit', 'profit'].includes(prop)) {
      const val = reportData.value.reduce((s, r) => s + (Number(r[prop]) || 0), 0)
      sums[index] = prop === 'orderCount' ? String(val) : '¥' + round2(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
    } else if (prop === 'grossProfitRate') {
      const totalAmount = reportData.value.reduce((s, r) => s + r.totalAmount, 0)
      const totalCost = reportData.value.reduce((s, r) => s + r.costAmount, 0)
      const totalGrossProfit = round2(totalAmount - totalCost)
      sums[index] = totalAmount > 0 ? round2((totalGrossProfit / totalAmount) * 100) + '%' : '0%'
    } else if (prop === 'profitRate') {
      const totalAmount = reportData.value.reduce((s, r) => s + r.totalAmount, 0)
      const totalAmountEx = reportData.value.reduce((s, r) => s + (r.totalAmountEx || 0), 0)
      const totalTaxAmount = reportData.value.reduce((s, r) => s + (r.totalTaxAmount || 0), 0)
      const totalProfit = reportData.value.reduce((s, r) => s + r.profit, 0)
      const effectiveAmountEx = totalAmountEx > 0 ? totalAmountEx : (totalAmount - totalTaxAmount)
      sums[index] = effectiveAmountEx > 0 ? round2((totalProfit / effectiveAmountEx) * 100) + '%' : '0%'
    } else {
      sums[index] = ''
    }
  })
  return sums
}

const loadProductRank = async () => {
  let startDate = getStartDate()
  let endDate = getEndDate()
  if (!startDate || !endDate) {
    const now = new Date()
    const y = now.getFullYear()
    startDate = `${y}-01-01`
    endDate = now.toLocaleDateString('sv-SE')
  }

  await recalculateCostForMonths(startDate, endDate)

  const profitData = await db.getSalesProfitByProduct({ startDate, endDate })
  const products = await db.getProducts()
  const productCategoryMap: Record<string, string> = {}
  for (const p of (products || [])) {
    productCategoryMap[p.code] = p.category || ''
  }

  reportData.value = (profitData || []).map((item: any) => {
    const salesAmount = round2(Number(item.total_sales_amount || 0))
    const salesAmountEx = round2(Number(item.total_sales_amount_ex || 0))
    const totalTaxAmount = round2(Number(item.total_tax_amount || 0))
    const costAmount = round2(Number(item.total_stock_cost_amount || 0))
    const effectiveAmountEx = salesAmountEx > 0 ? salesAmountEx : (salesAmount - totalTaxAmount)
    const grossProfit = round2(salesAmount - costAmount)
    const grossProfitRate = salesAmount !== 0 ? round2((grossProfit / Math.abs(salesAmount)) * 100) : 0
    const effectiveProfit = salesAmountEx > 0 ? round2(Number(item.total_profit_amount || 0)) : round2(effectiveAmountEx - costAmount)
    return {
      productCode: item.product_code || '',
      productName: item.product_name || '',
      category: productCategoryMap[item.product_code] || '',
      salesQuantity: round2(Number(item.total_qty || 0)),
      salesAmount,
      salesAmountEx,
      totalTaxAmount,
      costAmount,
      grossProfit,
      grossProfitRate,
      profit: effectiveProfit,
      profitRate: effectiveAmountEx !== 0 ? round2((effectiveProfit / Math.abs(effectiveAmountEx)) * 100) : 0
    }
  })
}

const loadProfitAnalysis = async () => {
  let startDate = getStartDate()
  let endDate = getEndDate()
  if (!startDate || !endDate) {
    const now = new Date()
    const y = now.getFullYear()
    startDate = `${y}-01-01`
    endDate = now.toLocaleDateString('sv-SE')
  }

  await recalculateCostForMonths(startDate, endDate)

  const profitData = await db.getSalesProfitByCategory({ startDate, endDate })
  const products = await db.getProducts()

  const allCategories = [...new Set((products || []).map((p: any) => p.category).filter(Boolean))]
  const categorySalesMap: Record<string, any> = {}
  for (const item of (profitData || [])) {
    categorySalesMap[item.category] = item
  }

  const totalSales = (profitData || []).reduce((s: number, r: any) => s + Number(r.total_sales_amount || 0), 0)

  const result: any[] = []
  for (const cat of allCategories) {
    const item = categorySalesMap[cat]
    const salesAmount = round2(Number(item?.total_sales_amount || 0))
    const salesAmountEx = round2(Number(item?.total_sales_amount_ex || 0))
    const totalTaxAmount = round2(Number(item?.total_tax_amount || 0))
    const costAmount = round2(Number(item?.total_stock_cost_amount || 0))
    const effectiveAmountEx = salesAmountEx > 0 ? salesAmountEx : (salesAmount - totalTaxAmount)
    const grossProfit = round2(salesAmount - costAmount)
    const grossProfitRate = salesAmount !== 0 ? round2((grossProfit / Math.abs(salesAmount)) * 100) : 0
    const effectiveProfit = salesAmountEx > 0 ? round2(Number(item?.total_profit_amount || 0)) : round2(effectiveAmountEx - costAmount)
    const profitRate = effectiveAmountEx !== 0 ? round2((effectiveProfit / Math.abs(effectiveAmountEx)) * 100) : 0
    const salesProportion = totalSales > 0 ? round2((Math.abs(salesAmount) / Math.abs(totalSales)) * 100) : 0
    result.push({ category: cat, salesAmount, salesAmountEx, totalTaxAmount, costAmount, grossProfit, grossProfitRate, profit: effectiveProfit, profitRate, salesProportion })
  }

  if (categorySalesMap['未分类']) {
    const item = categorySalesMap['未分类']
    const salesAmount = round2(Number(item.total_sales_amount || 0))
    const salesAmountEx = round2(Number(item.total_sales_amount_ex || 0))
    const totalTaxAmount = round2(Number(item.total_tax_amount || 0))
    const costAmount = round2(Number(item.total_stock_cost_amount || 0))
    const effectiveAmountEx = salesAmountEx > 0 ? salesAmountEx : (salesAmount - totalTaxAmount)
    const grossProfit = round2(salesAmount - costAmount)
    const grossProfitRate = salesAmount !== 0 ? round2((grossProfit / Math.abs(salesAmount)) * 100) : 0
    const effectiveProfit = salesAmountEx > 0 ? round2(Number(item.total_profit_amount || 0)) : round2(effectiveAmountEx - costAmount)
    const profitRate = effectiveAmountEx !== 0 ? round2((effectiveProfit / Math.abs(effectiveAmountEx)) * 100) : 0
    const salesProportion = totalSales > 0 ? round2((Math.abs(salesAmount) / Math.abs(totalSales)) * 100) : 0
    result.push({ category: '未分类', salesAmount, salesAmountEx, totalTaxAmount, costAmount, grossProfit, grossProfitRate, profit: effectiveProfit, profitRate, salesProportion })
  }

  result.sort((a, b) => b.salesAmount - a.salesAmount)
  reportData.value = result
}

const loadInventoryTurnover = async () => {
  const products = await db.getProducts()
  const outbounds = await db.getOutboundList(1, 100000)
  const inbounds = await db.getInboundList(1, 100000)
  const salesReturns = await db.getSalesReturns(1, 100000)
  const purchaseReturns = await db.getPurchaseReturns(1, 100000)
  const startDate = getStartDate()
  const endDate = getEndDate()

  const productSalesMap: Record<number, number> = {}
  const productInboundMap: Record<number, number> = {}

  for (const rec of (outbounds?.data || [])) {
    const recDate = (rec.voucherDate || rec.outbound_date || '').slice(0, 10)
    if (!recDate) continue
    if (startDate && recDate < startDate) continue
    if (endDate && recDate > endDate) continue
    for (const item of (rec.items || [])) {
      const pid = item.productId || item.product_id
      if (!pid) continue
      productSalesMap[pid] = (productSalesMap[pid] || 0) + Number(item.quantity || 0)
    }
  }

  for (const rec of (salesReturns?.data || [])) {
    const recDate = (rec.returnDate || rec.return_date || '').slice(0, 10)
    if (!recDate) continue
    if (startDate && recDate < startDate) continue
    if (endDate && recDate > endDate) continue
    for (const item of (rec.items || [])) {
      const pid = item.productId || item.product_id
      if (!pid) continue
      productSalesMap[pid] = (productSalesMap[pid] || 0) - Number(item.quantity || 0)
    }
  }

  for (const rec of (inbounds?.data || [])) {
    const recDate = (rec.voucherDate || rec.inbound_date || '').slice(0, 10)
    if (!recDate) continue
    if (startDate && recDate < startDate) continue
    if (endDate && recDate > endDate) continue
    for (const item of (rec.items || [])) {
      const pid = item.productId || item.product_id
      if (!pid) continue
      productInboundMap[pid] = (productInboundMap[pid] || 0) + Number(item.quantity || 0)
    }
  }

  for (const rec of (purchaseReturns?.data || [])) {
    const recDate = (rec.returnDate || rec.return_date || '').slice(0, 10)
    if (!recDate) continue
    if (startDate && recDate < startDate) continue
    if (endDate && recDate > endDate) continue
    for (const item of (rec.items || [])) {
      const pid = item.productId || item.product_id
      if (!pid) continue
      productInboundMap[pid] = (productInboundMap[pid] || 0) - Number(item.quantity || 0)
    }
  }

  const stocks = await db.getAllStocks(endDate || undefined)
  const stockMap: Record<number, number> = {}
  for (const s of (stocks || [])) {
    stockMap[s.productId] = (stockMap[s.productId] || 0) + (s.stockQuantity || 0)
  }

  const beginStockMap: Record<number, number> = {}
  if (startDate) {
    const beginStocks = await db.getAllStocks(startDate)
    for (const s of (beginStocks || [])) {
      beginStockMap[s.productId] = (beginStockMap[s.productId] || 0) + (s.stockQuantity || 0)
    }
  }

  const days = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 30

  reportData.value = (products || []).map((p: any) => {
    const pid = p.id
    const endStock = stockMap[pid] || 0
    const beginStock = startDate ? (beginStockMap[pid] ?? endStock) : 0
    const salesQty = productSalesMap[pid] || 0
    const inboundQty = productInboundMap[pid] || 0
    const avgStock = (beginStock + endStock) / 2
    const turnoverRate = avgStock > 0 ? round2(salesQty / avgStock) : 0
    const turnoverDays = salesQty > 0 ? round2(days / (salesQty / avgStock)) : 0

    return {
      productCode: p.code || '',
      productName: p.name || '',
      category: p.category || '',
      beginStock,
      inboundQty,
      outboundQty: salesQty,
      endStock,
      turnoverRate,
      turnoverDays
    }
  })
}

const handleExport = () => {
  if (reportData.value.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }

  try {
    const wb = XLSX.utils.book_new()
    const title = reportTitleMap[currentReport.value]

    let headers: string[] = []
    let rows: any[][] = []

    if (currentReport.value === 'sales-daily') {
      headers = ['日期', '订单数', '销售总额', '出库成本', '已收款', '利润', '利润率(%)']
      rows = reportData.value.map(r => [r.date, r.orderCount, r.totalAmount, r.costAmount, r.paidAmount, r.profit, r.profitRate])
    } else if (currentReport.value === 'sales-monthly') {
      headers = ['月份', '订单数', '销售总额', '出库成本', '利润', '利润率(%)']
      rows = reportData.value.map(r => [r.month, r.orderCount, r.totalAmount, r.costAmount, r.profit, r.profitRate])
    } else if (currentReport.value === 'product-rank') {
      headers = ['排名', '商品编码', '商品名称', '分类', '销售数量', '销售金额', '成本金额', '利润', '利润率(%)']
      rows = reportData.value.map((r, i) => [i + 1, r.productCode, r.productName, r.category, r.salesQuantity, r.salesAmount, r.costAmount, r.profit, r.profitRate])
    } else if (currentReport.value === 'profit-analysis') {
      headers = ['分类', '销售收入', '销售成本', '利润', '利润率(%)', '销售占比(%)']
      rows = reportData.value.map(r => [r.category, r.salesAmount, r.costAmount, r.profit, r.profitRate, r.salesProportion])
    } else if (currentReport.value === 'inventory-turnover') {
      headers = ['商品编码', '商品名称', '分类', '期初库存', '入库数量', '出库数量', '期末库存', '周转率', '周转天数']
      rows = reportData.value.map(r => [r.productCode, r.productName, r.category, r.beginStock, r.inboundQty, r.outboundQty, r.endStock, r.turnoverRate, r.turnoverDays])
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = headers.map(() => ({ wch: 14 }))
    XLSX.utils.book_append_sheet(wb, ws, title)

    const dateLabel = queryForm.dateRange?.[0] && queryForm.dateRange?.[1]
      ? `${queryForm.dateRange[0]}_${queryForm.dateRange[1]}`
      : new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `${title}_${dateLabel}.xlsx`)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  const now = new Date()
  const y = now.getFullYear()
  const today = now.toLocaleDateString('sv-SE')
  queryForm.dateRange = [`${y}-01-01`, today]
  activePreset.value = 'year'
  handleQuery()
})

onActivated(() => {
  handleQuery()
})
</script>

<style scoped lang="scss">
.finance-reports {
  display: flex;
  height: calc(100vh - 84px);
  background-color: #f0f2f5;
  overflow: hidden;
}

.report-sidebar {
  width: 210px;
  background: #fff;
  border-right: 1px solid #e8eaec;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
}

.sidebar-header {
  height: 60px;
  background: linear-gradient(135deg, #409eff, #337ecc);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
}

.sidebar-menu {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  transition: all 0.25s ease;
  border-left: 3px solid transparent;
  margin: 2px 0;
  position: relative;

  &:hover {
    background-color: #f5f7fa;

    .menu-icon {
      transform: scale(1.08);
    }
  }

  &.active {
    background: linear-gradient(90deg, #ecf5ff, #f5f7fa);
    border-left-color: #409eff;

    .menu-label {
      color: #409eff;
      font-weight: 600;
    }

    .menu-arrow {
      opacity: 1;
    }
  }
}

.menu-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.menu-label {
  font-size: 14px;
  color: #303133;
  transition: color 0.25s;
  flex: 1;
}

.menu-arrow {
  color: #409eff;
  opacity: 0;
  transition: opacity 0.2s;
}

.report-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.main-header {
  background: #fff;
  padding: 16px 24px;
  border-bottom: 1px solid #e8eaec;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  gap: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.title-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.report-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  line-height: 1.3;
}

.report-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.2;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.date-presets {
  display: flex;
  gap: 4px;
}

.main-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: #f0f2f5;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  border: 1px solid rgba(0, 0, 0, 0.03);

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  }
}

.card-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 4px;
  color: #303133;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  line-height: 1;
}

.text-profit {
  color: #67c23a !important;
}

.text-loss {
  color: #f56c6c !important;
}

.chart-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.section-sub {
  font-size: 13px;
  color: #909399;
}

.mini-chart {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chart-y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 160px;
  width: 48px;
  font-size: 11px;
  color: #909399;
  padding-right: 8px;
  text-align: right;
  flex-shrink: 0;
}

.chart-area {
  display: flex;
  align-items: stretch;
}

.chart-bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 160px;
}

.chart-bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.bar-wrapper {
  width: 100%;
  height: 140px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
}

.bar {
  flex: 1;
  border-radius: 3px 3px 0 0;
  min-width: 4px;
  transition: height 0.4s ease;
}

.bar-sales {
  background: linear-gradient(180deg, #409eff, #66b1ff);
}

.bar-cost {
  background: linear-gradient(180deg, #909399, #c0c4cc);
}

.bar-label {
  font-size: 11px;
  color: #909399;
  white-space: nowrap;
}

.chart-legend {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: #606266;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.report-table-wrapper {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.table-header-bar {
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f2f5;
  background: linear-gradient(180deg, #fafbfc, #f5f7fa);
}

.table-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.table-count {
  font-size: 13px;
  color: #909399;
}

.rate-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.rate-bar-bg {
  flex: 1;
  height: 6px;
  background: #f0f2f5;
  border-radius: 3px;
  overflow: hidden;
  min-width: 30px;
}

.rate-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.top-products-section {
  margin-bottom: 24px;
}

.top-products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.top-product-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.03);
  position: relative;
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  }
}

.top-rank-0 {
  border-top: 3px solid #ffb800;
}

.top-rank-1 {
  border-top: 3px solid #c0c0c0;
}

.top-rank-2 {
  border-top: 3px solid #cd7f32;
}

.top-rank-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.top-rank-0 .top-rank-badge {
  background: linear-gradient(135deg, #ffd700, #ffb800);
  box-shadow: 0 2px 6px rgba(255, 184, 0, 0.4);
}

.top-rank-1 .top-rank-badge {
  background: linear-gradient(135deg, #c0c0c0, #a8a8a8);
  box-shadow: 0 2px 6px rgba(168, 168, 168, 0.4);
}

.top-rank-2 .top-rank-badge {
  background: linear-gradient(135deg, #cd7f32, #b8690e);
  box-shadow: 0 2px 6px rgba(184, 105, 14, 0.4);
}

.top-product-info {
  margin-right: 36px;
  margin-bottom: 12px;
}

.top-product-name {
  font-weight: 600;
  margin-bottom: 4px;
  color: #303133;
  font-size: 14px;
}

.top-product-code {
  font-size: 12px;
  color: #909399;
}

.top-product-stats {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.top-amount {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}

.top-qty {
  font-size: 13px;
  color: #909399;
}

.top-profit-bar {
  height: 4px;
  background: #f0f2f5;
  border-radius: 2px;
  overflow: hidden;
}

.top-profit-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.profit-distribution {
  margin-bottom: 24px;
}

.distribution-bars {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.dist-row {
  display: flex;
  align-items: center;
  margin-bottom: 14px;

  &:last-child {
    margin-bottom: 0;
  }
}

.dist-label {
  width: 100px;
  font-size: 13px;
  color: #606266;
  flex-shrink: 0;
  font-weight: 500;
}

.dist-bar-area {
  flex: 1;
  padding: 0 16px;
}

.dist-bar-track {
  height: 10px;
  background: #f0f2f5;
  border-radius: 5px;
  overflow: hidden;
}

.dist-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.4s ease;
}

.dist-values {
  width: 180px;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  flex-shrink: 0;
}

.dist-amount {
  color: #303133;
  font-weight: 600;
}

.dist-rate {
  font-weight: 600;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 0;
  color: #909399;
  gap: 16px;

  p {
    margin: 0;
    font-size: 15px;
    color: #606266;
    font-weight: 500;
  }

  span {
    font-size: 13px;
    color: #c0c4cc;
  }
}

.loading-spinner {
  position: relative;
  width: 48px;
  height: 48px;
}

.spinner-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3px solid transparent;

  &:nth-child(1) {
    border-top-color: #409eff;
    animation: spin 1.2s linear infinite;
  }

  &:nth-child(2) {
    border-right-color: #67c23a;
    animation: spin 1.2s linear infinite reverse;
    width: 36px;
    height: 36px;
    top: 6px;
    left: 6px;
  }

  &:nth-child(3) {
    border-bottom-color: #e6a23c;
    animation: spin 0.8s linear infinite;
    width: 24px;
    height: 24px;
    top: 12px;
    left: 12px;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 0;
  color: #909399;
  gap: 12px;

  p {
    margin: 0;
    font-size: 16px;
    color: #606266;
    font-weight: 500;
  }

  span {
    font-size: 13px;
    color: #c0c4cc;
  }
}

.empty-illustration {
  margin-bottom: 8px;
}

.empty-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 60px;
  padding: 0 8px;
  opacity: 0.4;

  .chart-bar {
    width: 12px;
    height: var(--h);
    background: linear-gradient(180deg, #409eff, #66b1ff);
    border-radius: 3px 3px 0 0;
  }
}

.amount-text {
  font-weight: 500;
  font-variant-numeric: tabular-nums;

  &.cost {
    color: #909399;
  }

  &.received {
    color: #67c23a;
  }

  &.profit {
    color: #67c23a;
  }

  &.loss {
    color: #f56c6c;
  }
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  color: #fff;

  &.rank-0 {
    background: linear-gradient(135deg, #ffd700, #ffb800);
    box-shadow: 0 2px 6px rgba(255, 184, 0, 0.4);
  }

  &.rank-1 {
    background: linear-gradient(135deg, #c0c0c0, #a8a8a8);
    box-shadow: 0 2px 6px rgba(168, 168, 168, 0.4);
  }

  &.rank-2 {
    background: linear-gradient(135deg, #cd7f32, #b8690e);
    box-shadow: 0 2px 6px rgba(184, 105, 14, 0.4);
  }

  &.rank-other {
    background: #dcdfe6;
    color: #606266;
  }
}

.proportion-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.proportion-bar {
  flex: 1;
  height: 6px;
  background: #ebeef5;
  border-radius: 3px;
  overflow: hidden;
  min-width: 40px;
}

.proportion-fill {
  height: 100%;
  background: linear-gradient(90deg, #409eff, #66b1ff);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.qty-in {
  color: #67c23a;
  font-weight: 600;
}

.qty-out {
  color: #f56c6c;
  font-weight: 600;
}

.turnover-value {
  color: #409eff;
  font-weight: 600;
}

.turnover-section {
  margin-bottom: 24px;
}

.turnover-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.turnover-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: transform 0.25s ease, box-shadow 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  }
}

.turnover-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.turnover-card-name {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
  line-height: 1.3;
}

.turnover-card-code {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.turnover-rate-badge {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.turnover-card-chart {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.turnover-chart-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.turnover-bar-area {
  width: 100%;
  height: 50px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.turnover-bar {
  width: 24px;
  border-radius: 3px 3px 0 0;
  transition: height 0.3s ease;
}

.turnover-bar-in {
  background: linear-gradient(180deg, #67c23a, #95d475);
}

.turnover-bar-out {
  background: linear-gradient(180deg, #f56c6c, #fab6b6);
}

.turnover-bar-stock {
  background: linear-gradient(180deg, #409eff, #66b1ff);
}

.turnover-stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.turnover-stat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.turnover-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #f0f2f5;
}

.turnover-days {
  font-size: 13px;
  color: #606266;
}

.turnover-days-value {
  font-weight: 700;
  color: #409eff;
  font-size: 16px;
}

:deep(.el-table) {
  border-radius: 0 0 12px 12px;

  th.el-table__cell {
    background: linear-gradient(180deg, #fafbfc, #f5f7fa) !important;
    color: #303133;
    font-weight: 600;
    font-size: 14px;
    border-bottom: 2px solid #e8eaec;
  }

  td.el-table__cell {
    font-size: 14px;
    padding: 10px 0;
  }

  .el-table__row:hover > td {
    background-color: #f5f9ff !important;
  }

  .el-table__summary-wrapper {
    th, td {
      background-color: #fafbfc !important;
      font-weight: 600;
      font-size: 14px;
      border-top: 2px solid #e8eaec;
    }
  }
}
</style>
