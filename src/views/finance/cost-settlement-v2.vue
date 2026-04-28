<template>
  <div class="cost-settlement-page">
    <!-- 成本结算启用日期设置 -->
    <el-card shadow="never" style="margin-bottom: 20px;">
      <template #header>
        <div class="card-header">
          <span>成本结算设置</span>
        </div>
      </template>
      <el-form :inline="true" size="default">
        <el-form-item label="成本结算启用日期">
          <el-date-picker
            v-model="costStartDate"
            type="month"
            placeholder="选择启用月份"
            value-format="YYYY-MM"
            @change="handleCostStartDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSaveCostStartDate">保存设置</el-button>
        </el-form-item>
        <el-form-item>
          <el-tag type="info" v-if="costStartDate">
            当前启用月份：{{ costStartDate }}
          </el-tag>
          <el-tag type="warning" v-else>
            尚未设置启用月份
          </el-tag>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 年度成本结算状态总览 -->
    <el-card shadow="never" style="margin-bottom: 20px;">
      <template #header>
        <div class="card-header">
          <span>年度成本结算状态</span>
          <el-select
            v-model="currentYear"
            placeholder="选择年份"
            style="width: 120px; margin-left: 20px;"
            @change="handleYearChange"
          >
            <el-option
              v-for="year in yearOptions"
              :key="year"
              :label="`${year}年`"
              :value="year"
            />
          </el-select>
        </div>
      </template>
      <div class="month-status-grid">
        <div
          v-for="month in 12"
          :key="month"
          class="month-status-card"
          :class="[getMonthStatusClass(month), { 'month-selected': selectedMonth === month }]"
          @click="handleMonthClick(month)"
        >
          <div class="month-selected-indicator" v-if="selectedMonth === month">
            <el-icon :size="14"><Check /></el-icon>
          </div>
          <div class="month-number" :class="{ 'month-number-active': selectedMonth === month }">{{ String(month).padStart(2, '0') }}</div>
          <div class="month-label" :class="{ 'month-label-active': selectedMonth === month }">{{ month }}月</div>
          <div class="month-status">
            <el-tag
              :type="getMonthStatusType(month)"
              size="small"
              effect="plain"
            >
              {{ getMonthStatusText(month) }}
            </el-tag>
          </div>
          <div class="month-date" v-if="getMonthSettleDate(month)">
            {{ getMonthSettleDate(month) }}
          </div>
          <div class="month-bottom-bar" v-if="selectedMonth === month"></div>
        </div>
      </div>
    </el-card>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="query-form">
        <el-form :inline="true" :model="queryForm" size="default">
          <el-form-item label="起始日期" prop="startDate">
            <el-date-picker
              v-model="queryForm.startDate"
              type="date"
              placeholder="选择起始日期"
              value-format="YYYY-MM-DD"
              style="width: 160px"
            />
          </el-form-item>
          <el-form-item label="截止日期" prop="endDate">
            <el-date-picker
              v-model="queryForm.endDate"
              type="date"
              placeholder="选择截止日期"
              value-format="YYYY-MM-DD"
              style="width: 160px"
            />
          </el-form-item>
          <el-form-item label="产品" prop="productSearch">
            <el-input
              v-model="queryForm.productSearch"
              placeholder="搜索产品编码/名称"
              clearable
              style="width: 200px"
              :prefix-icon="Search"
            />
          </el-form-item>
          <el-form-item label="仓库" prop="warehouse">
            <el-select
              v-model="queryForm.warehouse"
              placeholder="请选择仓库"
              clearable
              style="width: 150px"
              :prefix-icon="OfficeBuilding"
            >
              <el-option
                v-for="warehouse in warehouses"
                :key="warehouse.id"
                :label="warehouse.name"
                :value="warehouse.id"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <div class="action-buttons">
        <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        <el-button
          type="success"
          :icon="Check"
          @click="handleCalculate"
          :disabled="!canSettleCurrentMonth"
        >
          开始计算
        </el-button>
        <el-button type="warning" :icon="RefreshLeft" @click="handleReverse" :disabled="!currentMonthHasData">
          反结算
        </el-button>
        <el-button type="info" :icon="Download" @click="handleExport">导出汇总</el-button>
        <el-button type="success" :icon="Download" @click="handleBatchExportDetail">导出明细账</el-button>
        <el-button :icon="Printer" @click="handlePrint">打印</el-button>
      </div>
    </div>

    <!-- 提示信息 -->
    <el-alert
      v-if="!canSettleCurrentMonth && queryForm.startDate && queryForm.endDate"
      title="无法结算"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 10px;"
    >
      <template #default>
        <div v-if="!costStartDate">
          请先设置成本结算启用日期
        </div>
        <div v-else-if="!previousMonthSettled && !isFirstMonth">
          前一个月未完成成本结算，无法结算当前月份。请先完成 {{ previousMonth }} 的结算。
        </div>
        <div v-else-if="isBeforeStartDate">
          该月份早于成本结算启用日期 {{ costStartDate }}，无需结算。
        </div>
      </template>
    </el-alert>

    <el-alert
      v-if="currentMonthSettled"
      title="当前月份已结算"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 10px;"
    >
      <template #default>
        当前月份已完成成本结算，如需修改请先进行反结算操作。
      </template>
    </el-alert>

    <!-- 表格切换标签 -->
    <div class="table-tabs" style="margin-bottom: 10px;">
      <div class="custom-tabs-wrapper">
        <div class="custom-tabs-nav">
          <div
            class="custom-tab-item"
            :class="{ 'custom-tab-active': activeTable === 'settlement' }"
            @click="switchTable('settlement')"
          >
            <el-icon :size="16" style="margin-right: 6px;"><Document /></el-icon>
            <span>成本结算汇总表</span>
          </div>
          <div
            class="custom-tab-item"
            :class="{ 'custom-tab-active': activeTable === 'sales' }"
            @click="switchTable('sales')"
          >
            <el-icon :size="16" style="margin-right: 6px;"><Sell /></el-icon>
            <span>销售成本结算表</span>
          </div>
          <div
            class="custom-tab-indicator"
            :style="{ left: activeTable === 'settlement' ? '0%' : '50%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- 成本结算汇总 -->
    <div class="print-area" id="printSettlement" v-show="activeTable === 'settlement'">
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span>成本结算汇总表</span>
            <span class="period-label">{{ queryForm.startDate && queryForm.endDate ? queryForm.startDate + ' 至 ' + queryForm.endDate : '' }}</span>
          </div>
        </template>
        <div class="table-scroll-wrapper" id="settlementTable">
          <el-table
            :data="settlementListWithSummary"
            stripe
            border
            style="width: 100%"
            :header-cell-style="{ backgroundColor: '#f5f7fa', color: '#606266' }"
            @row-dblclick="handleSettlementRowDblclick"
            :row-class-name="({ row }) => row._isSummary ? 'summary-row' : ''"
            :scrollbar-always-on="true"
          >
          <el-table-column type="index" label="序号" width="60" align="center" fixed="left">
            <template #default="{ row, $index }">{{ row._isSummary ? '' : $index + 1 }}</template>
          </el-table-column>
          <el-table-column prop="productCode" label="商品编码" width="120" min-width="100" fixed="left" />
          <el-table-column prop="productName" label="商品名称" min-width="180" show-overflow-tooltip fixed="left" />
          <el-table-column prop="specification" label="规格型号" width="120" min-width="100" />
          <el-table-column prop="unit" label="单位" width="80" min-width="60" />
          <el-table-column prop="warehouseName" label="仓库" width="120" min-width="100" />
          <el-table-column label="期初数据" align="center">
            <el-table-column prop="openingQty" label="数量" width="100" min-width="80" align="right" class-name="opening-col">
              <template #default="{ row }">{{ row._isSummary ? '' : formatNum(row.openingQty) }}</template>
            </el-table-column>
            <el-table-column prop="openingCost" label="成本(元)" width="120" min-width="100" align="right" class-name="opening-col">
              <template #default="{ row }">{{ row._isSummary ? '' : formatMoney(row.openingCost) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="本期入库" align="center">
            <el-table-column prop="inboundQty" label="数量" width="100" min-width="80" align="right" class-name="settlement-inbound-col">
              <template #default="{ row }">{{ formatNum(row.inboundQty) }}</template>
            </el-table-column>
            <el-table-column prop="inboundUnitPrice" label="单价(元)" width="110" min-width="90" align="right" class-name="settlement-inbound-col">
              <template #default="{ row }">{{ row._isSummary ? '' : formatMoney(row.inboundUnitPrice) }}</template>
            </el-table-column>
            <el-table-column prop="inboundTaxAmount" label="税额(元)" width="110" min-width="90" align="right" class-name="settlement-inbound-col">
              <template #default="{ row }">{{ row._isSummary ? formatMoney(row.inboundTaxAmount) : (row.inboundTaxAmount != null ? formatMoney(row.inboundTaxAmount) : '') }}</template>
            </el-table-column>
            <el-table-column prop="inboundCost" label="金额(元)" width="120" min-width="100" align="right" class-name="settlement-inbound-col">
              <template #default="{ row }">{{ formatMoney(row.inboundCost) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="本期出库" align="center">
            <el-table-column prop="outboundQty" label="数量" width="100" min-width="80" align="right" class-name="settlement-outbound-col">
              <template #default="{ row }">{{ formatNum(row.outboundQty) }}</template>
            </el-table-column>
            <el-table-column prop="outboundCost" label="金额(元)" width="120" min-width="100" align="right" class-name="settlement-outbound-col">
              <template #default="{ row }">{{ formatMoney(row.outboundCost) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="加权平均" align="center">
            <el-table-column prop="avgCost" label="单价(元)" width="120" min-width="100" align="right" class-name="settlement-avg-col">
              <template #default="{ row }">{{ row._isSummary ? '' : formatMoney(row.avgCost) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="期末结存" align="center">
            <el-table-column prop="closingQty" label="数量" width="100" min-width="80" align="right" class-name="settlement-closing-col">
              <template #default="{ row }">
                <span :class="{ 'negative-qty': row.closingQty < 0 }">{{ formatNum(row.closingQty) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="closingUnitPrice" label="单价(元)" width="110" min-width="90" align="right" class-name="settlement-closing-col">
              <template #default="{ row }">{{ row._isSummary ? '' : formatMoney(row.closingUnitPrice || row.avgCost) }}</template>
            </el-table-column>
            <el-table-column prop="closingCost" label="结余金额(元)" width="130" min-width="110" align="right" class-name="settlement-closing-col">
              <template #default="{ row }">{{ formatMoney(row.closingCost) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ row }">
              <el-button v-if="!row._isSummary" type="primary" size="small" link @click.stop="handleViewDetail(row)">明细</el-button>
            </template>
          </el-table-column>
        </el-table>
        </div>

        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-label">合计税额:</span>
            <span class="summary-value">¥{{ totalInboundTaxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">合计入库金额:</span>
            <span class="summary-value">¥{{ totalInboundCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">合计结存数量:</span>
            <span class="summary-value">{{ totalQty }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">合计结存成本:</span>
            <span class="summary-value">¥{{ totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 销售成本结算表 -->
    <div class="print-area" id="printSalesCost" v-show="activeTable === 'sales'">
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span>销售成本结算表</span>
            <span class="period-label">{{ queryForm.startDate && queryForm.endDate ? queryForm.startDate + ' 至 ' + queryForm.endDate : '' }}</span>
          </div>
        </template>
        <div class="table-scroll-wrapper" id="salesCostTable">
          <el-table
            :data="salesCostListWithSummary"
            stripe
            border
            style="width: 100%"
            :header-cell-style="{ backgroundColor: '#f5f7fa', color: '#606266' }"
            @row-dblclick="handleSalesCostRowDblclick"
            :row-class-name="({ row }) => row._isSummary ? 'summary-row' : ''"
            :scrollbar-always-on="true"
          >
          <el-table-column type="index" label="序号" width="60" align="center" fixed="left" />
          <el-table-column prop="productCode" label="商品编码" width="120" min-width="100" fixed="left" />
          <el-table-column prop="productName" label="商品名称" min-width="180" show-overflow-tooltip fixed="left" />
          <el-table-column prop="specification" label="规格型号" width="120" min-width="100" />
          <el-table-column prop="unit" label="单位" width="80" min-width="60" />
          <el-table-column prop="warehouseName" label="仓库" width="120" min-width="100" />
          <el-table-column label="销售数量" align="center">
            <el-table-column prop="salesQty" label="数量" width="100" min-width="80" align="right" class-name="salescost-qty-col">
              <template #default="{ row }">{{ formatNum(row.salesQty) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="销售金额" align="center">
            <el-table-column prop="salesUnitPriceEx" label="单价（不含税）" width="110" min-width="90" align="right" class-name="salescost-amount-col">
              <template #default="{ row }">{{ formatMoney(row.salesUnitPriceEx) }}</template>
            </el-table-column>
            <el-table-column prop="salesAmountEx" label="金额（不含税）" width="120" min-width="100" align="right" class-name="salescost-amount-col">
              <template #default="{ row }">{{ formatMoney(row.salesAmountEx) }}</template>
            </el-table-column>
            <el-table-column prop="salesTaxAmount" label="税额（元）" width="110" min-width="90" align="right" class-name="salescost-amount-col">
              <template #default="{ row }">{{ formatMoney(row.salesTaxAmount) }}</template>
            </el-table-column>
            <el-table-column prop="salesUnitPrice" label="单价（元）" width="110" min-width="90" align="right" class-name="salescost-amount-col">
              <template #default="{ row }">{{ formatMoney(row.salesUnitPrice) }}</template>
            </el-table-column>
            <el-table-column prop="salesAmount" label="金额（元）" width="120" min-width="100" align="right" class-name="salescost-amount-col">
              <template #default="{ row }">{{ formatMoney(row.salesAmount) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="销售成本" align="center">
            <el-table-column prop="salesCostUnitPrice" label="成本单价（元）" width="120" min-width="100" align="right" class-name="salescost-cost-col">
              <template #default="{ row }">{{ formatMoney(row.salesCostUnitPrice) }}</template>
            </el-table-column>
            <el-table-column prop="salesCost" label="成本（元）" width="120" min-width="100" align="right" class-name="salescost-cost-col">
              <template #default="{ row }">{{ formatMoney(row.salesCost) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="利润" align="center">
            <el-table-column prop="profit" label="利润 (元)" width="120" min-width="100" align="right" class-name="salescost-profit-col">
              <template #default="{ row }">{{ formatMoney(row.profit) }}</template>
            </el-table-column>
            <el-table-column prop="profitRate" label="利润率" width="90" min-width="80" align="right" class-name="salescost-profit-col">
              <template #default="{ row }">{{ formatPercent(row.profitRate) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column label="操作" align="center" width="120">
            <template #default="{ row }">
              <el-button
                v-if="!row._isSummary"
                type="primary"
                size="small"
                link
                @click="handleViewSalesCostDetail(row)"
              >
                查看明细
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        </div>

        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-label">合计销售数量:</span>
            <span class="summary-value">{{ totalSalesQty }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">合计销售金额:</span>
            <span class="summary-value">¥{{ totalSalesAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">合计销售金额（不含税）:</span>
            <span class="summary-value">¥{{ totalSalesAmountEx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">合计税额:</span>
            <span class="summary-value">¥{{ totalSalesTaxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">合计销售成本:</span>
            <span class="summary-value">¥{{ totalSalesCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">合计利润:</span>
            <span class="summary-value">¥{{ totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 成本结算明细弹窗 -->
    <div v-if="dialogVisible" class="settlement-detail-overlay" @click.self="handleOverlayClick">
      <div class="settlement-detail-dialog">
        <div class="settlement-detail-header">
          <div class="settlement-detail-title">成本结算明细 - {{ selectedRow?.productName }} <span v-if="queryForm.startDate && queryForm.endDate" style="font-size: 14px; color: #909399; margin-left: 8px;">({{ queryForm.startDate }} 至 {{ queryForm.endDate }})</span></div>
          <div class="settlement-detail-close" @click="handleOverlayClick">
            <Close />
          </div>
        </div>

        <div v-if="selectedRow" class="settlement-detail-body">
          <div class="settlement-detail-info">
            <el-descriptions :column="4" border size="default">
              <el-descriptions-item label="商品编码">{{ selectedRow.productCode }}</el-descriptions-item>
              <el-descriptions-item label="商品名称">{{ selectedRow.productName }}</el-descriptions-item>
              <el-descriptions-item label="规格型号">{{ selectedRow.specification || '-' }}</el-descriptions-item>
              <el-descriptions-item label="单位">{{ selectedRow.unit || '-' }}</el-descriptions-item>
              <el-descriptions-item label="仓库">{{ selectedRow.warehouseName }}</el-descriptions-item>
              <el-descriptions-item label="会计期间">{{ queryForm.startDate && queryForm.endDate ? queryForm.startDate + ' 至 ' + queryForm.endDate : '-' }}</el-descriptions-item>
              <el-descriptions-item label="期初数量">{{ formatNum(detailOpeningQty) }}</el-descriptions-item>
              <el-descriptions-item label="期初成本">{{ formatMoney(detailOpeningCost) }} 元</el-descriptions-item>
              <el-descriptions-item label="本期入库数量">{{ formatNum(detailInboundQty) }}</el-descriptions-item>
              <el-descriptions-item label="本期入库成本">{{ formatMoney(detailInboundAmount) }} 元</el-descriptions-item>
              <el-descriptions-item label="本期出库数量">{{ formatNum(detailOutboundQty) }}</el-descriptions-item>
              <el-descriptions-item label="本期出库成本">{{ formatMoney(detailOutboundAmount) }} 元</el-descriptions-item>
              <el-descriptions-item label="期末结存数量">
                <span :class="{ 'negative-qty': detailClosingQty < 0 }">{{ formatNum(detailClosingQty) }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="期末结存成本">{{ formatMoney(detailClosingCost) }} 元</el-descriptions-item>
              <el-descriptions-item label="加权平均单价">{{ formatMoney(detailAvgCost) }} 元</el-descriptions-item>
            </el-descriptions>
          </div>

          <div class="settlement-detail-table-wrapper">
            <el-table
              :data="ledgerEntries"
              style="width: 100%; min-width: 1200px"
              :height="'100%'"
              border
              :row-class-name="ledgerRowClassName"
              :header-cell-style="{ backgroundColor: '#f5f7fa', color: '#606266' }"
            >
              <el-table-column type="index" label="序号" width="50" align="center" />
              <el-table-column prop="date" label="日期" width="110" min-width="90" />
              <el-table-column prop="docNo" label="单号" width="200" min-width="170" show-overflow-tooltip />
              <el-table-column prop="type" label="类型" width="110" min-width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.type === 'opening' ? 'info' : row.type === 'monthly' || row.type === 'yearly' ? 'primary' : getDocTypeTagType(row.type)">
                    {{ row.type === 'opening' ? '期初' : row.type === 'monthly' ? '本月合计' : row.type === 'yearly' ? '本年累计' : getDocTypeName(row.type) }}
                  </el-tag>
                </template>
              </el-table-column>

              <el-table-column label="入库" align="center">
                <el-table-column prop="inboundQty" label="数量" width="90" min-width="70" align="right" class-name="ledger-inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.inboundQty !== 0" :class="{ 'text-inbound': row.inboundQty > 0, 'text-outbound': row.inboundQty < 0 }">{{ formatNum(row.inboundQty) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="inboundPrice" label="单价" width="90" min-width="70" align="right" class-name="ledger-inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.inboundQty !== 0">{{ formatMoney(row.inboundPrice) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="inboundTaxAmount" label="税额" width="100" min-width="80" align="right" class-name="ledger-inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.inboundQty !== 0 && row.inboundTaxAmount != null && row.inboundTaxAmount !== 0">{{ formatMoney(row.inboundTaxAmount) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="inboundAmount" label="金额" width="110" min-width="90" align="right" class-name="ledger-inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.inboundQty !== 0" :class="{ 'text-inbound': row.inboundAmount > 0, 'text-outbound': row.inboundAmount < 0 }">{{ formatMoney(row.inboundAmount) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <el-table-column label="出库" align="center">
                <el-table-column prop="outboundQty" label="数量" width="90" min-width="70" align="right" class-name="ledger-outbound-col">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty !== 0" :class="{ 'text-outbound': row.outboundQty > 0, 'text-inbound': row.outboundQty < 0 }">{{ formatNum(row.outboundQty) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="outboundPrice" label="单价" width="90" min-width="70" align="right" class-name="ledger-outbound-col">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty !== 0">{{ formatMoney(row.outboundPrice) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="outboundAmount" label="金额" width="110" min-width="90" align="right" class-name="ledger-outbound-col">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty !== 0" :class="{ 'text-outbound': row.outboundAmount > 0, 'text-inbound': row.outboundAmount < 0 }">{{ formatMoney(row.outboundAmount) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <el-table-column label="库存结余" align="center">
                <el-table-column prop="balanceQty" label="数量" width="100" min-width="80" align="right" class-name="ledger-balance-col">
                  <template #default="{ row }">
                    <span v-if="row.balanceQty !== null && row.balanceQty !== undefined" :class="{ 'negative-qty': row.balanceQty < 0 }">{{ formatNum(row.balanceQty) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="balanceUnitPrice" label="单价" width="90" min-width="70" align="right" class-name="ledger-balance-col">
                  <template #default="{ row }">
                    <span v-if="row.balanceUnitPrice !== null && row.balanceUnitPrice !== undefined">{{ formatMoney(row.balanceUnitPrice) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column label="结余金额" width="120" min-width="100" align="right" class-name="ledger-balance-col">
                  <template #default="{ row }">
                    <span v-if="row.balanceAmount !== null && row.balanceAmount !== undefined">{{ formatMoney(row.balanceAmount) }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>

              <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip>
                <template #default="{ row }">
                  <span>{{ row.remark || '-' }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <div class="settlement-detail-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="handlePrintDetail">打印明细</el-button>
        </div>
      </div>
    </div>

    <!-- 销售成本明细弹窗 -->
    <div v-if="salesCostDialogVisible" class="settlement-detail-overlay" @click.self="handleSalesCostOverlayClick">
      <div class="settlement-detail-dialog">
        <div class="settlement-detail-header">
          <div class="settlement-detail-title">销售成本明细 - {{ selectedSalesCostRow?.productName }}</div>
          <div class="settlement-detail-close" @click="handleSalesCostOverlayClick">
            <Close />
          </div>
        </div>

        <div v-if="selectedSalesCostRow" class="settlement-detail-body">
          <div class="settlement-detail-info">
            <el-descriptions :column="4" border size="default">
              <el-descriptions-item label="商品编码">{{ selectedSalesCostRow.productCode }}</el-descriptions-item>
              <el-descriptions-item label="商品名称">{{ selectedSalesCostRow.productName }}</el-descriptions-item>
              <el-descriptions-item label="规格型号">{{ selectedSalesCostRow.specification || '-' }}</el-descriptions-item>
              <el-descriptions-item label="单位">{{ selectedSalesCostRow.unit || '-' }}</el-descriptions-item>
              <el-descriptions-item label="仓库">{{ selectedSalesCostRow.warehouseName }}</el-descriptions-item>
              <el-descriptions-item label="会计期间">{{ queryForm.startDate && queryForm.endDate ? queryForm.startDate + ' 至 ' + queryForm.endDate : '-' }}</el-descriptions-item>
              <el-descriptions-item label="销售数量">{{ formatNum(selectedSalesCostRow.salesQty) }}</el-descriptions-item>
              <el-descriptions-item label="销售金额">{{ formatMoney(selectedSalesCostRow.salesAmount) }} 元</el-descriptions-item>
              <el-descriptions-item label="销售金额（不含税）">{{ detailSummary ? formatMoney(detailSummary.salesAmountEx) : '0.00' }} 元</el-descriptions-item>
              <el-descriptions-item label="销售成本">{{ formatMoney(selectedSalesCostRow.salesCost) }} 元</el-descriptions-item>
              <el-descriptions-item label="利润">
                <span :style="{ color: (detailSummary?.profitAmount || 0) >= 0 ? '#67c23a' : '#f56c6c' }">
                  {{ detailSummary ? formatMoney(detailSummary.profitAmount) : '0.00' }} 元
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="利润率">
                <span :style="{ color: (detailSummary?.profitRate || 0) >= 0 ? '#67c23a' : '#f56c6c' }">
                  {{ detailSummary ? formatPercent(detailSummary.profitRate) : '0.00%' }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="单据数量">{{ selectedSalesCostRow.docCount || 0 }} 笔</el-descriptions-item>
            </el-descriptions>
          </div>

          <div class="settlement-detail-table-wrapper">
            <div class="table-title">销售出库/退货明细</div>
            <el-table
              :data="salesCostDetailListWithSummary"
              style="width: 100%; min-width: 1200px"
              :height="'100%'"
              border
              :header-cell-style="{ backgroundColor: '#f5f7fa', color: '#606266' }"
              :row-class-name="salesCostDetailRowClassName"
            >
              <el-table-column type="index" label="序号" width="50" align="center">
                <template #default="{ row, $index }">
                  {{ row._isSummary ? '合计' : $index + 1 }}
                </template>
              </el-table-column>
              <el-table-column prop="date" label="日期" width="110" min-width="90" />
              <el-table-column prop="docNo" label="单号" width="200" min-width="170" show-overflow-tooltip />
              <el-table-column prop="docType" label="单据类型" width="120" min-width="100">
                <template #default="{ row }">
                  <template v-if="row._isSummary"></template>
                  <el-tag v-else size="small" :type="row.docType === 'sales_outbound' ? 'success' : 'warning'">
                    {{ row.docType === 'sales_outbound' ? '销售出库' : '销售退货' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="warehouseName" label="仓库" width="120" min-width="100" />
              <el-table-column label="数量" align="center">
                <el-table-column prop="quantity" label="数量" width="100" min-width="80" align="right" class-name="salesdetail-qty-col">
                  <template #default="{ row }">
                    <span :class="{ 'text-outbound': row.quantity > 0, 'text-inbound': row.quantity < 0, 'summary-cell': row._isSummary }">
                      {{ formatNum(row.quantity) }}
                    </span>
                  </template>
                </el-table-column>
              </el-table-column>
              <el-table-column label="销售金额" align="center">
                <el-table-column prop="unitPriceEx" label="单价（不含税）" width="110" min-width="90" align="right" class-name="salesdetail-amount-col">
                  <template #default="{ row }">
                    <span :class="{ 'summary-cell': row._isSummary }">{{ row._isSummary ? '' : formatMoney(row.unitPriceEx) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="salesAmountEx" label="金额（不含税）" width="120" min-width="100" align="right" class-name="salesdetail-amount-col">
                  <template #default="{ row }">
                    <span :class="{ 'text-outbound': row.salesAmountEx > 0, 'text-inbound': row.salesAmountEx < 0, 'summary-cell': row._isSummary }">
                      {{ formatMoney(row.salesAmountEx) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="taxAmount" label="税额" width="100" min-width="80" align="right" class-name="salesdetail-amount-col">
                  <template #default="{ row }">
                    <span :class="{ 'summary-cell': row._isSummary }">{{ formatMoney(row.taxAmount) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="unitPrice" label="单价（元）" width="100" min-width="80" align="right" class-name="salesdetail-amount-col">
                  <template #default="{ row }">
                    <span :class="{ 'summary-cell': row._isSummary }">{{ row._isSummary ? '' : formatMoney(row.unitPrice) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="salesAmount" label="金额（元）" width="110" min-width="90" align="right" class-name="salesdetail-amount-col">
                  <template #default="{ row }">
                    <span :class="{ 'text-outbound': row.salesAmount > 0, 'text-inbound': row.salesAmount < 0, 'summary-cell': row._isSummary }">
                      {{ formatMoney(row.salesAmount) }}
                    </span>
                  </template>
                </el-table-column>
              </el-table-column>
              <el-table-column label="销售成本" align="center">
                <el-table-column prop="costUnitPrice" label="成本单价（元）" width="110" min-width="90" align="right" class-name="salesdetail-cost-col">
                  <template #default="{ row }">
                    <span :class="{ 'summary-cell': row._isSummary }">{{ row._isSummary ? '' : formatMoney(row.costUnitPrice) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="costAmount" label="成本（元）" width="110" min-width="90" align="right" class-name="salesdetail-cost-col">
                  <template #default="{ row }">
                    <span :class="{ 'text-outbound': row.costAmount > 0, 'text-inbound': row.costAmount < 0, 'summary-cell': row._isSummary }">
                      {{ formatMoney(row.costAmount) }}
                    </span>
                  </template>
                </el-table-column>
              </el-table-column>
              <el-table-column label="利润" align="center">
                <el-table-column prop="profitAmount" label="利润" width="110" min-width="90" align="right" class-name="salesdetail-profit-col">
                  <template #default="{ row }">
                    <span :class="{ 'text-inbound': row.profitAmount > 0, 'text-outbound': row.profitAmount < 0, 'summary-cell': row._isSummary }">
                      {{ formatMoney(row.profitAmount) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="profitRate" label="利润率" width="90" min-width="80" align="right" class-name="salesdetail-profit-col">
                  <template #default="{ row }">
                    <span :class="{ 'summary-cell': row._isSummary }">{{ formatPercent(row.profitRate) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <div class="settlement-detail-footer">
          <el-button @click="handleSalesCostOverlayClick">关闭</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onActivated } from 'vue'
import { Search, RefreshLeft, Check, Download, Printer, Close, Refresh, Document, Sell } from '@element-plus/icons-vue'
import { OfficeBuilding } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import exportToCsv from '../../utils/exportCsv'
import * as XLSX from 'xlsx'
import { getCostSettlementList } from '@/api/cost'
import { db } from '@/utils/db-ipc'

// 成本结算启用日期
const costStartDate = ref<string>('')
const currentYear = ref<number>(new Date().getFullYear())
const yearOptions = ref<number[]>([])
const monthStatus = ref<Map<string, any>>(new Map())

// 生成最近 50 年的选项（当前年份前后各 25 年）
const now = new Date()
for (let i = now.getFullYear() - 25; i <= now.getFullYear() + 40; i++) {
  yearOptions.value.push(i)
}

const queryForm = reactive({
  startDate: '' as string,
  endDate: '' as string,
  productSearch: '',
  warehouse: ''
})

const warehouses = ref<any[]>([])
const settlementList = ref<any[]>([])
const salesCostList = ref<any[]>([])
const activeTable = ref<'settlement' | 'sales'>('settlement')
const selectedMonth = ref<number>(0)
const dialogVisible = ref(false)
const salesCostDialogVisible = ref(false)
const selectedRow = ref<any>(null)
const selectedSalesCostRow = ref<any>(null)
const ledgerEntries = ref<any[]>([])
const salesCostDetailList = ref<any[]>([])

const salesCostDetailListWithSummary = computed(() => {
  const list = salesCostDetailList.value
  if (list.length === 0) return []
  
  const quantitySum = list.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
  const salesAmountExSum = list.reduce((sum, row) => sum + (Number(row.salesAmountEx) || 0), 0)
  const taxAmountSum = list.reduce((sum, row) => sum + (Number(row.taxAmount) || 0), 0)
  const salesAmountSum = list.reduce((sum, row) => sum + (Number(row.salesAmount) || 0), 0)
  const costAmountSum = list.reduce((sum, row) => sum + (Number(row.costAmount) || 0), 0)
  const profitAmountSum = salesAmountExSum - costAmountSum
  const profitRate = salesAmountExSum !== 0 ? profitAmountSum / Math.abs(salesAmountExSum) : 0
  
  const summaryRow = {
    _isSummary: true,
    date: '',
    docNo: '',
    docType: '',
    warehouseName: '',
    quantity: quantitySum,
    unitPriceEx: 0,
    salesAmountEx: salesAmountExSum,
    taxAmount: taxAmountSum,
    unitPrice: 0,
    salesAmount: salesAmountSum,
    costUnitPrice: 0,
    costAmount: costAmountSum,
    profitAmount: profitAmountSum,
    profitRate: profitRate
  }
  
  return [...list, summaryRow]
})

const salesCostDetailRowClassName = ({ row }: { row: any }) => {
  return row._isSummary ? 'summary-row' : ''
}

const detailSummary = computed(() => {
  const list = salesCostDetailListWithSummary.value
  if (list.length === 0) return null
  return list[list.length - 1]
})

// 计算属性：当前月份是否已结算
const currentMonthSettled = computed(() => {
  if (!queryForm.startDate || !queryForm.endDate) return false
  
  const [year, month] = queryForm.startDate.split('-').map(Number)
  const key = `${year}-${month}`
  if (monthStatus.value.has(key)) {
    return monthStatus.value.get(key)?.settled || false
  }
  
  return settlementList.value.length > 0
})

const currentMonthHasData = ref(false)

const checkCurrentMonthHasData = async () => {
  if (!queryForm.startDate) {
    currentMonthHasData.value = false
    return
  }
  const [year, month] = queryForm.startDate.split('-').map(Number)
  try {
    currentMonthHasData.value = await db.hasCostSettlementData(year, month)
  } catch {
    currentMonthHasData.value = settlementList.value.length > 0
  }
}

// 计算属性：前一个月是否已结算
const previousMonthSettled = computed(() => {
  if (!queryForm.startDate || !costStartDate.value) return false
  
  const [year, month] = queryForm.startDate.split('-').map(Number)
  let prevMonth = month - 1
  let prevYear = year
  
  if (prevMonth === 0) {
    prevMonth = 12
    prevYear = year - 1
  }
  
  const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`
  if (prevMonthStr < costStartDate.value) return true
  
  const key = `${prevYear}-${prevMonth}`
  return monthStatus.value.has(key) && monthStatus.value.get(key)?.settled
})

// 计算属性：是否是启用后的第一个月
const isFirstMonth = computed(() => {
  if (!queryForm.startDate || !costStartDate.value) return false
  const startMonth = queryForm.startDate.substring(0, 7)
  return startMonth === costStartDate.value
})

const isBeforeStartDate = computed(() => {
  if (!queryForm.startDate || !costStartDate.value) return false
  const startMonth = queryForm.startDate.substring(0, 7)
  return startMonth < costStartDate.value
})

const canSettleCurrentMonth = computed(() => {
  if (!queryForm.startDate || !queryForm.endDate) return false
  if (!costStartDate.value) return false
  if (isBeforeStartDate.value) return false
  if (currentMonthSettled.value) return false
  if (!isFirstMonth.value && !previousMonthSettled.value) return false
  
  return true
})

// 前一个月的月份显示
const previousMonth = computed(() => {
  if (!queryForm.startDate) return ''
  const [year, month] = queryForm.startDate.split('-').map(Number)
  let prevMonth = month - 1
  let prevYear = year
  
  if (prevMonth === 0) {
    prevMonth = 12
    prevYear = year - 1
  }
  
  return `${prevYear}年${prevMonth}月`
})

const dateRangeShortcuts = [
  {
    text: '本月',
    value: () => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }
  },
  {
    text: '上月',
    value: () => {
      const now = new Date()
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      return `${prevYear}-${String(prevMonth).padStart(2, '0')}`
    }
  }
]

const totalQty = computed(() => settlementList.value.reduce((sum, row) => sum + (Number(row.closingQty) || 0), 0))
const totalCost = computed(() => settlementList.value.reduce((sum, row) => sum + (Number(row.closingCost) || 0), 0))
const totalInboundTaxAmount = computed(() => settlementList.value.reduce((sum, row) => sum + (Number(row.inboundTaxAmount) || 0), 0))
const totalInboundCost = computed(() => settlementList.value.reduce((sum, row) => sum + (Number(row.inboundCost) || 0) - (Number(row.transferInCost) || 0), 0))

const settlementListWithSummary = computed(() => {
  const list = [...settlementList.value]
  if (list.length === 0) return list
  list.push({
    _isSummary: true,
    productCode: '',
    productName: '合计',
    specification: '',
    unit: '',
    warehouseName: '',
    openingQty: settlementList.value.reduce((s, r) => s + (Number(r.openingQty) || 0), 0),
    openingCost: settlementList.value.reduce((s, r) => s + (Number(r.openingCost) || 0), 0),
    inboundQty: settlementList.value.reduce((s, r) => s + (Number(r.inboundQty) || 0), 0),
    inboundUnitPrice: 0,
    inboundTaxAmount: settlementList.value.reduce((s, r) => s + (Number(r.inboundTaxAmount) || 0), 0),
    inboundCost: settlementList.value.reduce((s, r) => s + (Number(r.inboundCost) || 0) - (Number(r.transferInCost) || 0), 0),
    outboundQty: settlementList.value.reduce((s, r) => s + (Number(r.outboundQty) || 0), 0),
    outboundCost: settlementList.value.reduce((s, r) => s + (Number(r.outboundCost) || 0), 0),
    avgCost: 0,
    closingQty: totalQty.value,
    closingUnitPrice: 0,
    closingCost: totalCost.value
  })
  return list
})

// 销售成本汇总表计算属性
const totalSalesQty = computed(() => salesCostList.value.reduce((sum, row) => sum + (Number(row.salesQty) || 0), 0))
const totalSalesAmount = computed(() => salesCostList.value.reduce((sum, row) => sum + (Number(row.salesAmount) || 0), 0))
const totalSalesAmountEx = computed(() => salesCostList.value.reduce((sum, row) => sum + (Number(row.salesAmountEx) || 0), 0))
const totalSalesTaxAmount = computed(() => salesCostList.value.reduce((sum, row) => sum + (Number(row.salesTaxAmount) || 0), 0))
const totalSalesCost = computed(() => salesCostList.value.reduce((sum, row) => sum + (Number(row.salesCost) || 0), 0))
const totalProfit = computed(() => totalSalesAmountEx.value - totalSalesCost.value)

const salesCostListWithSummary = computed(() => {
  const list = [...salesCostList.value]
  if (list.length === 0) return list
  list.push({
    _isSummary: true,
    productCode: '',
    productName: '合计',
    specification: '',
    unit: '',
    warehouseName: '',
    salesQty: totalSalesQty.value,
    salesUnitPriceEx: 0,
    salesAmountEx: totalSalesAmountEx.value,
    salesTaxAmount: totalSalesTaxAmount.value,
    salesUnitPrice: 0,
    salesAmount: totalSalesAmount.value,
    salesCostUnitPrice: 0,
    salesCost: totalSalesCost.value,
    profit: totalProfit.value,
    profitRate: totalSalesAmountEx.value !== 0 ? totalProfit.value / totalSalesAmountEx.value : 0
  })
  return list
})

// 从明细数据计算汇总信息
const detailOpeningQty = computed(() => {
  const opening = ledgerEntries.value.find(r => r.type === 'opening')
  return opening ? Number(opening.balanceQty || 0) : 0
})

const detailOpeningCost = computed(() => {
  const opening = ledgerEntries.value.find(r => r.type === 'opening')
  return opening ? Number(opening.balanceAmount || 0) : 0
})

const detailInboundQty = computed(() => {
  const monthlies = ledgerEntries.value.filter(r => r.type === 'monthly')
  return monthlies.reduce((sum, m) => sum + Number(m.inboundQty || 0), 0)
})

const detailInboundAmount = computed(() => {
  const monthlies = ledgerEntries.value.filter(r => r.type === 'monthly')
  return monthlies.reduce((sum, m) => sum + Number(m.inboundAmount || 0), 0)
})

const detailOutboundQty = computed(() => {
  const monthlies = ledgerEntries.value.filter(r => r.type === 'monthly')
  return monthlies.reduce((sum, m) => sum + Number(m.outboundQty || 0), 0)
})

const detailOutboundAmount = computed(() => {
  const monthlies = ledgerEntries.value.filter(r => r.type === 'monthly')
  return monthlies.reduce((sum, m) => sum + Number(m.outboundAmount || 0), 0)
})

const detailClosingQty = computed(() => {
  // 获取本月合计上一行的库存结余数量（最后一个业务单据的库存结余）
  const businessRecords = ledgerEntries.value.filter(r =>
    r.type !== 'opening' && r.type !== 'monthly' && r.type !== 'yearly'
  )
  const lastRecord = businessRecords[businessRecords.length - 1]
  return lastRecord ? Number(lastRecord.balanceQty || 0) : 0
})

const detailClosingCost = computed(() => {
  // 获取本月合计上一行的库存结余金额（最后一个业务单据的结余金额）
  const businessRecords = ledgerEntries.value.filter(r =>
    r.type !== 'opening' && r.type !== 'monthly' && r.type !== 'yearly'
  )
  const lastRecord = businessRecords[businessRecords.length - 1]
  return lastRecord ? Number(lastRecord.balanceAmount || 0) : 0
})

const detailAvgCost = computed(() => {
  const qty = detailClosingQty.value
  const cost = detailClosingCost.value
  return qty > 0 ? cost / qty : 0
})

function formatNum(val: any): string {
  const n = Number(val || 0)
  if (n === 0) return '0'
  return n.toFixed(n % 1 === 0 ? 0 : 2)
}

function formatMoney(val: any): string {
  const n = Number(val || 0)
  return n.toFixed(2)
}

function formatPercent(val: any): string {
  const n = Number(val || 0)
  return (n * 100).toFixed(2) + '%'
}

function getDocTypeName(type: string): string {
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

function getDocTypeTagType(type: string): string {
  const map: Record<string, string> = {
    purchase_inbound: 'success',
    sales_outbound: 'danger',
    purchase_return: 'warning',
    sales_return: 'info',
    transfer_in: 'warning',
    transfer_out: 'warning'
  }
  return map[type] || 'info'
}

function ledgerRowClassName({ row }: { row: any }): string {
  if (row.type === 'monthly') return 'ledger-summary-row'
  if (row.type === 'yearly') return 'ledger-yearly-row'
  if (row.type === 'opening') return 'ledger-opening-row'
  return ''
}

function getSettlementSummary(param: any) {
  const columns = param.columns
  const sums: string[] = []
  columns.forEach((col: any, index: number) => {
    if (index === 0) {
      sums[index] = '合计'
      return
    }
    const prop = col.property
    if (!prop || ['productCode', 'productName', 'specification', 'unit', 'warehouseName', 'inboundUnitPrice', 'avgCost', 'closingUnitPrice'].includes(prop)) {
      sums[index] = ''
      return
    }
    const values = settlementList.value.map(item => Number(item[prop] || 0))
    if (['openingQty', 'inboundQty', 'outboundQty', 'closingQty'].includes(prop)) {
      sums[index] = values.reduce((a, b) => a + b, 0).toFixed(0)
    } else {
      sums[index] = values.reduce((a, b) => a + b, 0).toFixed(2)
    }
  })
  return sums
}

function getSalesCostSummary(param: any) {
  const columns = param.columns
  const sums: string[] = []
  columns.forEach((col: any, index: number) => {
    if (index === 0) {
      sums[index] = '合计'
      return
    }
    const prop = col.property
    if (!prop || ['productCode', 'productName', 'specification', 'unit', 'warehouseName', 'salesUnitPrice', 'salesUnitPriceEx', 'salesCostUnitPrice', 'profitRate'].includes(prop)) {
      sums[index] = ''
      return
    }
    const values = salesCostList.value.map(item => Number(item[prop] || 0))
    if (['salesQty'].includes(prop)) {
      sums[index] = values.reduce((a, b) => a + b, 0).toFixed(0)
    } else {
      sums[index] = values.reduce((a, b) => a + b, 0).toFixed(2)
    }
  })
  return sums
}

const loadWarehouses = async () => {
  try {
    warehouses.value = await db.getWarehouses()
  } catch (error) {
    console.error('加载仓库列表失败:', error)
  }
}

const handleSearch = async () => {
  if (!queryForm.startDate || !queryForm.endDate) {
    ElMessage.warning('请选择查询日期范围')
    return
  }

  try {
    ElMessage.info('正在查询成本结算数据...')

    const settlementResult = await getCostSettlementList({
      startDate: queryForm.startDate,
      endDate: queryForm.endDate,
      productSearch: queryForm.productSearch,
      warehouseId: queryForm.warehouse
    })

    settlementList.value = settlementResult?.success ? (settlementResult.data || []) : []
    
    const [year, month] = queryForm.startDate.split('-').map(Number)
    const settled = await db.isCostSettled(year, month)
    const statusKey = `${year}-${month}`
    if (monthStatus.value.has(statusKey)) {
      monthStatus.value.get(statusKey)!.settled = settled
      monthStatus.value.get(statusKey)!.canSettle = !settled
    } else {
      monthStatus.value.set(statusKey, {
        settled,
        period: queryForm.startDate.substring(0, 7),
        year,
        month,
        canSettle: !settled
      })
    }
    
    console.log(`更新状态：settled=${settled}, data length=${settlementList.value.length}`)
    await checkCurrentMonthHasData()

    ElMessage.success(`查询成功，共 ${settlementList.value.length} 条记录`)
    
    if (activeTable.value === 'sales') {
      await loadSalesCostData()
    }
  } catch (error) {
    console.error('查询数据失败:', error)
    ElMessage.error('查询失败')
  }
}

const handleReset = () => {
  queryForm.startDate = ''
  queryForm.endDate = ''
  queryForm.productSearch = ''
  queryForm.warehouse = ''
  settlementList.value = []
  salesCostList.value = []
}

// 处理表格切换
const handleTableSwitch = () => {
  console.log('切换到表格:', activeTable.value)
  if (activeTable.value === 'sales' && queryForm.startDate && queryForm.endDate) {
    loadSalesCostData()
  }
}

const switchTable = (table: 'settlement' | 'sales') => {
  if (activeTable.value === table) return
  activeTable.value = table
  handleTableSwitch()
}

// 加载销售成本数据
const loadSalesCostData = async () => {
  if (!queryForm.startDate || !queryForm.endDate) {
    ElMessage.warning('请选择查询日期范围')
    return
  }

  try {
    const result = await db.getSalesCostSummary({
      startDate: queryForm.startDate,
      endDate: queryForm.endDate,
      productSearch: queryForm.productSearch,
      warehouseId: queryForm.warehouse
    })
    
    salesCostList.value = result?.success ? (result.data || []) : []
    console.log('销售成本数据加载完成:', salesCostList.value.length, '条记录')
  } catch (error) {
    console.error('加载销售成本数据失败:', error)
    ElMessage.error('加载销售成本数据失败')
  }
}

const handleCalculate = async () => {
  if (!queryForm.startDate || !queryForm.endDate) {
    ElMessage.warning('请选择查询日期范围')
    return
  }

  const [year, month] = queryForm.startDate.split('-').map(Number)

  try {
    // 在确认前，先检查是否已结算
    const isSettled = await db.isCostSettled(year, month)
    
    if (isSettled) {
      ElMessage.warning(`${year}年${month}月 已进行成本结转，请勿重复操作。如需查看结转情况，请使用查询功能。`)
      return
    }
    
    await ElMessageBox.confirm(
      `确定要对 ${year}年${month}月 进行成本结算吗？\n\n请确保期间内的所有单据已录入完成`,
      '开始计算',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )

    ElMessage.info('正在计算成本数据，请稍候...')
    const result = await db.initializeCostData({ year, month })

    if (result.success) {
      ElMessage.success(`结算完成，共处理 ${result.count || 0} 条记录`)
      
      // 强制等待一小段时间，确保数据库事务完成
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 重新加载月份状态
      console.log('重新加载月份状态...')
      await loadMonthStatus()
      await checkCurrentMonthHasData()
      
      // 重新查询
      console.log('重新查询数据...')
      await handleSearch()
    } else {
      ElMessage.error(result.message || '结算失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('结算失败:', error)
      ElMessage.error('结算失败')
    }
  }
}

const handleReverse = async () => {
  if (!queryForm.startDate || !queryForm.endDate) {
    ElMessage.warning('请选择查询日期范围')
    return
  }

  const [year, month] = queryForm.startDate.split('-').map(Number)

  try {
    await ElMessageBox.confirm(
      `确定要反结算 ${year}年${month}月 吗？\n\n反结算后将删除该月的锁定状态和统计数据，可以重新修改单据后再次结算。`,
      '反结算',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )

    const result = await db.reverseCostSettlement({ year, month })
    if (result.success) {
      console.log('反结算结果:', result)
      const msg = `反结算成功！${result.deletedCount !== undefined ? `删除了 ${result.deletedCount} 条记录，` : ''}${result.remainingCount !== undefined ? `剩余 ${result.remainingCount} 条记录` : ''}`
      ElMessage.success(result.message || msg)
      
      // 清空结算列表
      settlementList.value = []
      
      // 强制等待一小段时间，确保数据库事务完成
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 重新加载月份状态
      console.log('重新加载月份状态...')
      await loadMonthStatus()
      currentMonthHasData.value = false
      
      // 重新查询
      console.log('重新查询数据...')
      await handleSearch()
    } else {
      ElMessage.error(result.message || '反结算失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('反结算失败:', error)
      ElMessage.error('反结算失败')
    }
  }
}

const handleExport = async () => {
  if (!queryForm.startDate || !queryForm.endDate) {
    ElMessage.warning('请先选择查询日期范围')
    return
  }

  try {
    const wb = XLSX.utils.book_new()
    const dateLabel = `${queryForm.startDate}_${queryForm.endDate}`

    if (activeTable.value === 'settlement') {
      if (settlementList.value.length === 0) {
        ElMessage.warning('没有可导出的数据')
        return
      }
      const headers = [
        '产品编码', '产品名称', '规格', '单位', '仓库名称',
        '期初数量', '期初成本', '入库数量', '入库单价', '入库成本',
        '出库数量', '出库成本', '加权平均价', '结存数量', '结存单价', '结存成本'
      ]
      const rows = settlementList.value.map(item => [
        item.productCode, item.productName, item.specification, item.unit, item.warehouseName,
        item.openingQty, item.openingCost, item.inboundQty, item.inboundUnitPrice, item.inboundCost,
        item.outboundQty, item.outboundCost, item.avgPrice, item.closingQty, item.closingUnitPrice, item.closingCost
      ])
      const totalOpeningQty = settlementList.value.reduce((s, r) => s + (Number(r.openingQty) || 0), 0)
      const totalOpeningCost = settlementList.value.reduce((s, r) => s + (Number(r.openingCost) || 0), 0)
      const totalInboundQty = settlementList.value.reduce((s, r) => s + (Number(r.inboundQty) || 0), 0)
      const totalInboundCost = settlementList.value.reduce((s, r) => s + (Number(r.inboundCost) || 0) - (Number(r.transferInCost) || 0), 0)
      const totalOutboundQty = settlementList.value.reduce((s, r) => s + (Number(r.outboundQty) || 0), 0)
      const totalOutboundCost = settlementList.value.reduce((s, r) => s + (Number(r.outboundCost) || 0), 0)
      const totalClosingQty = settlementList.value.reduce((s, r) => s + (Number(r.closingQty) || 0), 0)
      const totalClosingCost = settlementList.value.reduce((s, r) => s + (Number(r.closingCost) || 0), 0)
      const totalRow = [
        '合计', '', '', '', '',
        totalOpeningQty, totalOpeningCost, totalInboundQty, '', totalInboundCost,
        totalOutboundQty, totalOutboundCost, '', totalClosingQty, '', totalClosingCost
      ]
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totalRow])
      ws['!cols'] = headers.map(() => ({ wch: 14 }))
      XLSX.utils.book_append_sheet(wb, ws, '成本结算汇总表')

    } else if (activeTable.value === 'sales') {
      if (salesCostList.value.length === 0) {
        ElMessage.warning('没有可导出的数据')
        return
      }
      const headers = [
        '产品编码', '产品名称', '规格型号', '单位', '仓库名称',
        '销售数量', '销售单价(不含税)', '销售金额(不含税)', '税额(元)', '销售单价(元)', '销售金额(元)',
        '成本单价(元)', '成本(元)', '毛利', '毛利率', '单据数'
      ]
      const rows = salesCostList.value.map(item => [
        item.productCode, item.productName, item.specification, item.unit, item.warehouseName,
        item.salesQty, item.salesUnitPriceEx, item.salesAmountEx, item.salesTaxAmount, item.salesUnitPrice, item.salesAmount,
        item.salesCostUnitPrice, item.salesCost, item.profit, item.profitRate, item.docCount
      ])
      const totalSalesQty = salesCostList.value.reduce((s, r) => s + (Number(r.salesQty) || 0), 0)
      const totalSalesAmountEx = salesCostList.value.reduce((s, r) => s + (Number(r.salesAmountEx) || 0), 0)
      const totalSalesTaxAmount = salesCostList.value.reduce((s, r) => s + (Number(r.salesTaxAmount) || 0), 0)
      const totalSalesAmount = salesCostList.value.reduce((s, r) => s + (Number(r.salesAmount) || 0), 0)
      const totalSalesCost = salesCostList.value.reduce((s, r) => s + (Number(r.salesCost) || 0), 0)
      const totalProfit = salesCostList.value.reduce((s, r) => s + (Number(r.profit) || 0), 0)
      const totalRow = [
        '合计', '', '', '', '',
        totalSalesQty, '', totalSalesAmountEx, totalSalesTaxAmount, '', totalSalesAmount,
        '', totalSalesCost, totalProfit, '', ''
      ]
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totalRow])
      ws['!cols'] = headers.map(() => ({ wch: 14 }))
      XLSX.utils.book_append_sheet(wb, ws, '销售成本结算表')
    }

    const filename = activeTable.value === 'settlement'
      ? `成本结算汇总_${dateLabel}.xlsx`
      : `销售成本结算_${dateLabel}.xlsx`
    XLSX.writeFile(wb, filename)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

const handleBatchExportDetail = async () => {
  if (!queryForm.startDate || !queryForm.endDate) {
    ElMessage.warning('请先选择查询日期范围')
    return
  }

  try {
    ElMessage.info('正在生成明细账，请稍候...')
    const wb = XLSX.utils.book_new()
    const dateLabel = `${queryForm.startDate}_${queryForm.endDate}`

    const sourceList = activeTable.value === 'settlement' ? settlementList.value : salesCostList.value
    if (sourceList.length === 0) {
      ElMessage.warning('没有可导出的数据')
      return
    }

    const warehouseMap = new Map<string, any[]>()
    for (const item of sourceList) {
      const whName = item.warehouseName || '未知仓库'
      if (!warehouseMap.has(whName)) {
        warehouseMap.set(whName, [])
      }
      warehouseMap.get(whName)!.push(item)
    }

    let sheetIndex = 0
    for (const [whName, items] of warehouseMap) {
      for (const item of items) {
        try {
          const result = await db.getProductDetailLedger({
            productCode: item.productCode,
            warehouseId: item.warehouseId,
            startDate: queryForm.startDate,
            endDate: queryForm.endDate
          })

          let ledgerData: any[] = []
          if (result && result.data && Array.isArray(result.data)) {
            ledgerData = result.data
          } else if (Array.isArray(result)) {
            ledgerData = result
          }

          if (ledgerData.length === 0) continue

          const headers = ['日期', '单号', '类型', '入库数量', '入库单价', '入库金额', '出库数量', '出库单价', '出库金额', '结存数量', '结存单价', '结存金额', '备注']
          const rows = ledgerData.map((r: any) => [
            r.date || '',
            r.docNo || '',
            r.type === 'opening' ? '期初' : r.type === 'monthly' ? '本月合计' : r.type === 'yearly' ? '本年累计' : getDocTypeName(r.type),
            r.inboundQty !== 0 ? r.inboundQty : '',
            r.inboundQty !== 0 ? r.inboundPrice : '',
            r.inboundQty !== 0 ? r.inboundAmount : '',
            r.outboundQty !== 0 ? r.outboundQty : '',
            r.outboundQty !== 0 ? r.outboundPrice : '',
            r.outboundQty !== 0 ? r.outboundAmount : '',
            r.balanceQty !== null && r.balanceQty !== undefined ? r.balanceQty : '',
            r.balanceUnitPrice !== null && r.balanceUnitPrice !== undefined ? r.balanceUnitPrice : '',
            r.balanceAmount !== null && r.balanceAmount !== undefined ? r.balanceAmount : '',
            r.remark || ''
          ])

          const ws = XLSX.utils.aoa_to_sheet([
            [`${whName} - ${item.productName || item.productCode} 明细账`],
            [`期间：${queryForm.startDate} 至 ${queryForm.endDate}`],
            [`规格型号：${item.specification || '-'}    单位：${item.unit || '-'}`],
            [],
            headers,
            ...rows
          ])
          ws['!cols'] = [
            { wch: 12 }, { wch: 20 }, { wch: 10 },
            { wch: 10 }, { wch: 10 }, { wch: 12 },
            { wch: 10 }, { wch: 10 }, { wch: 12 },
            { wch: 10 }, { wch: 10 }, { wch: 12 },
            { wch: 20 }
          ]
          ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } }
          ]

          let sheetName = `${whName}-${item.productName || item.productCode}`
          if (sheetName.length > 31) {
            sheetName = sheetName.substring(0, 28) + `_${++sheetIndex}`
          }
          sheetName = sheetName.replace(/[\\\/\?\*\[\]]/g, '_')

          XLSX.utils.book_append_sheet(wb, ws, sheetName)
          sheetIndex++
        } catch (err) {
          console.error(`导出 ${item.productName} 明细失败:`, err)
        }
      }
    }

    if (wb.SheetNames.length === 0) {
      ElMessage.warning('没有可导出的明细数据')
      return
    }

    const filename = activeTable.value === 'settlement'
      ? `成本结算明细账_${dateLabel}.xlsx`
      : `销售成本明细账_${dateLabel}.xlsx`
    XLSX.writeFile(wb, filename)
    ElMessage.success(`导出成功，共 ${wb.SheetNames.length} 个商品明细账`)
  } catch (error) {
    console.error('批量导出失败:', error)
    ElMessage.error('批量导出失败')
  }
}

const handlePrint = () => {
  const printContent = document.getElementById('printSettlement')?.innerHTML || ''
  const title = `成本结算汇总表 - ${queryForm.startDate && queryForm.endDate ? queryForm.startDate + ' 至 ' + queryForm.endDate : '全部'}`

  if (!printContent) {
    ElMessage.warning('没有可打印的数据')
    return
  }

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: "Microsoft YaHei", SimSun, sans-serif; padding: 20px; font-size: 12px; }
        h1 { text-align: center; font-size: 18px; margin-bottom: 10px; }
        .period-info { text-align: center; color: #666; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
        th { background-color: #f0f0f0; font-weight: bold; }
        td:nth-child(n+7):nth-child(-n+14), td:nth-child(n+16) { text-align: right; }
        .summary-bar { margin-top: 15px; display: flex; gap: 30px; justify-content: center; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="period-info">打印时间：${new Date().toLocaleString()}</div>
      ${printContent}
      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `)
  printWindow.document.close()
}

const handlePrintDetail = () => {
  const infoEl = document.querySelector('.settlement-detail-info')
  const tableEl = document.querySelector('.settlement-detail-table-wrapper')
  if (!infoEl || !tableEl) return

  const content = `
    <div style="margin-bottom: 15px;">${infoEl.innerHTML}</div>
    <div>${tableEl.innerHTML}</div>
  `

  const title = `成本结算明细账 - ${selectedRow.value?.productName || ''} (${queryForm.startDate && queryForm.endDate ? queryForm.startDate + ' 至 ' + queryForm.endDate : ''})`

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: "Microsoft YaHei", SimSun, sans-serif; padding: 15px; font-size: 12px; }
        h1 { text-align: center; font-size: 16px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        th, td { border: 1px solid #333; padding: 3px 5px; text-align: center; }
        th { background-color: #f0f0f0; font-weight: bold; }
        td:nth-child(n+5):nth-child(-n+10) { text-align: right; }
        td:last-child { text-align: left; }
        .el-descriptions { border: 1px solid #ddd; }
        .el-descriptions__body { display: table; width: 100%; table-layout: fixed; }
        .el-descriptions__table { display: table-row; }
        .el-descriptions__item { display: table-cell; border: 1px solid #eee; padding: 5px 8px; font-size: 11px; }
        .el-descriptions__label { background: #fafafa; font-weight: bold; width: 25%; }
        .el-descriptions__content { width: 25%; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div style="text-align:center;color:#666;margin-bottom:10px;font-size:11px;">打印时间：${new Date().toLocaleString()}</div>
      ${content}
      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `)
  printWindow.document.close()
}

const handleSettlementRowDblclick = (row: any) => {
  if (row._isSummary) return
  handleViewDetail(row)
}

const handleViewDetail = async (row: any) => {
  selectedRow.value = row
  dialogVisible.value = true
  ledgerEntries.value = []

  try {
    if (!queryForm.startDate || !queryForm.endDate) {
      ElMessage.warning('请先选择查询日期范围')
      return
    }

    console.log('请求明细账参数:', { productCode: row.productCode, warehouseId: row.warehouseId, startDate: queryForm.startDate, endDate: queryForm.endDate })
    
    const result = await db.getProductDetailLedger({
      productCode: row.productCode,
      warehouseId: row.warehouseId,
      startDate: queryForm.startDate,
      endDate: queryForm.endDate
    })

    console.log('获取明细账结果:', result)
    console.log('结果类型:', typeof result)
    console.log('结果是否为数组:', Array.isArray(result))
    console.log('结果是否有 data 属性:', result && result.data)
    
    // 处理返回数据
    if (result && result.data && Array.isArray(result.data)) {
      ledgerEntries.value = result.data
      console.log('明细账数据 (新格式):', result.data.length, '条')
    } else if (Array.isArray(result)) {
      ledgerEntries.value = result
      console.log('明细账数据 (旧格式):', result.length, '条')
    } else {
      ledgerEntries.value = []
      console.warn('明细账数据格式异常:', result)
      ElMessage.info('该期间暂无明细数据')
    }
  } catch (error) {
    console.error('加载明细账失败:', error)
    ElMessage.error('加载明细账失败')
    ledgerEntries.value = []
  }
}

const handleOverlayClick = () => {
  dialogVisible.value = false
}

const handleSalesCostOverlayClick = () => {
  salesCostDialogVisible.value = false
}

// 查看销售成本明细
const handleViewSalesCostDetail = async (row: any) => {
  selectedSalesCostRow.value = row
  salesCostDialogVisible.value = true
  
  await loadSalesCostDetailData(row)
}

const handleSalesCostRowDblclick = (row: any) => {
  if (row._isSummary) return
  handleViewSalesCostDetail(row)
}

// 加载销售成本明细数据
const loadSalesCostDetailData = async (row: any) => {
  try {
    const result = await db.getSalesCostDetail({
      startDate: queryForm.startDate,
      endDate: queryForm.endDate,
      productCode: row.productCode,
      warehouseId: row.warehouseId
    })
    
    console.log('[销售成本明细] 返回数据:', result)
    
    if (result && Array.isArray(result)) {
      salesCostDetailList.value = result.map(item => {
        // 获取不含税金额（优先使用数据库字段）
        let salesAmountEx = Number(item.sales_amount_ex || 0)
        
        // 如果 sales_amount_ex 为 0，尝试从 sales_amount - tax_amount 计算
        if (salesAmountEx === 0 && item.sales_amount !== 0) {
          const taxAmount = Number(item.tax_amount || 0)
          if (taxAmount !== 0) {
            salesAmountEx = Number(item.sales_amount || 0) - taxAmount
          }
        }
        
        // 如果还是 0，使用数量 × 单价（不含税）计算
        if (salesAmountEx === 0 && item.quantity !== 0) {
          let unitPriceEx = Number(item.unit_price_ex || 0)
          // 如果 unit_price_ex 为 0，使用 unit_price 作为不含税单价
          if (unitPriceEx === 0) {
            unitPriceEx = Number(item.unit_price || 0)
          }
          salesAmountEx = Number(item.quantity || 0) * unitPriceEx
        }
        
        // 获取含税金额（优先使用数据库字段，如果为 0 则计算）
        let salesAmount = Number(item.sales_amount || 0)
        if (salesAmount === 0 && item.quantity !== 0) {
          salesAmount = Number(item.quantity || 0) * Number(item.unit_price || 0)
        }
        
        // 获取不含税单价（优先使用数据库字段，如果为 0 则反推）
        let unitPriceEx = Number(item.unit_price_ex || 0)
        if (unitPriceEx === 0 && item.quantity !== 0 && salesAmountEx !== 0) {
          unitPriceEx = Math.abs(salesAmountEx / item.quantity)
        }
        // 如果还是 0，使用 unit_price 作为不含税单价
        if (unitPriceEx === 0) {
          unitPriceEx = Number(item.unit_price || 0)
        }
        
        // 获取含税单价（优先使用数据库字段，如果为 0 则反推）
        let unitPrice = Number(item.unit_price || 0)
        if (unitPrice === 0 && item.quantity !== 0 && salesAmount !== 0) {
          unitPrice = Math.abs(salesAmount / item.quantity)
        }
        
        // 计算利润：利润 = 金额（不含税） - 成本金额
        const costAmount = Number(item.cost_amount || 0)
        const profitAmount = salesAmountEx - costAmount
        const profitRate = salesAmountEx !== 0 ? profitAmount / Math.abs(salesAmountEx) : 0
        
        return {
          date: item.date,
          docNo: item.doc_no,
          docType: item.doc_type,
          warehouseName: item.warehouse_name,
          specification: item.specification || item.spec || '',
          unit: item.unit || '',
          quantity: Number(item.quantity || 0),
          unitPrice: unitPrice,
          unitPriceEx: unitPriceEx,
          taxAmount: Number(item.tax_amount || 0),
          salesAmount: salesAmount,
          salesAmountEx: salesAmountEx,
          costUnitPrice: Number(item.cost_unit_price || 0),
          costAmount: costAmount,
          profitAmount: profitAmount,
          profitRate: profitRate
        }
      })
      console.log('[销售成本明细] 格式化后数据:', salesCostDetailList.value)
    } else {
      salesCostDetailList.value = []
    }
  } catch (error) {
    console.error('加载销售成本明细失败:', error)
    ElMessage.error('加载销售成本明细失败')
    salesCostDetailList.value = []
  }
}

// ==================== 成本结算设置相关函数 ====================

// 加载成本结算启用日期
const loadCostStartDate = async () => {
  try {
    const settings = await db.getSystemSettings()
    costStartDate.value = settings?.costStartDate || ''
    console.log('加载成本结算启用日期:', costStartDate.value)
    // 加载月份状态
    if (costStartDate.value) {
      await loadMonthStatus()
    }
  } catch (error) {
    console.error('加载成本结算启用日期失败:', error)
  }
}

// 保存成本结算启用日期
const handleSaveCostStartDate = async () => {
  if (!costStartDate.value) {
    ElMessage.warning('请选择启用月份')
    return
  }

  try {
    await db.saveSystemSettings({ costStartDate: costStartDate.value })
    ElMessage.success('保存成功')
    await loadMonthStatus()
  } catch (error) {
    console.error('保存成本结算启用日期失败:', error)
    ElMessage.error('保存失败')
  }
}

// 处理启用日期变化
const handleCostStartDateChange = (val: string) => {
  console.log('启用日期变化:', val)
}

// 加载月份状态
const loadMonthStatus = async () => {
  if (!costStartDate.value) {
    monthStatus.value.clear()
    return
  }

  try {
    const [startYear, startMonth] = costStartDate.value.split('-').map(Number)
    
    // 清空状态
    monthStatus.value.clear()

    // 从启用年份的启用月份到当前年份的当前月份，逐月检查结算状态
    const now = new Date()
    const endYear = now.getFullYear()
    const endMonth = now.getMonth() + 1

    let y = startYear
    let m = startMonth
    let prevSettled = true

    while (y < endYear || (y === endYear && m <= endMonth)) {
      const periodStr = `${y}-${String(m).padStart(2, '0')}`
      
      try {
        const settled = await db.isCostSettled(y, m)
        
        const statusKey = `${y}-${m}`
        monthStatus.value.set(statusKey, {
          settled,
          period: periodStr,
          year: y,
          month: m,
          canSettle: prevSettled && !settled
        })

        if (y === currentYear.value) {
          console.log(`${periodStr} settled:`, settled)
        }

        prevSettled = settled
      } catch (err) {
        console.error(`查询 ${periodStr} 失败:`, err)
        const statusKey = `${y}-${m}`
        monthStatus.value.set(statusKey, {
          settled: false,
          period: periodStr,
          year: y,
          month: m,
          canSettle: prevSettled
        })
        prevSettled = false
      }
      
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }
    
    console.log('月份状态加载完成:', Object.fromEntries(monthStatus.value))
  } catch (error) {
    console.error('加载月份状态失败:', error)
  }
}

// 检查月份是否已结算
const checkMonthSettled = async (year: number, month: number): Promise<boolean> => {
  try {
    const result = await db.getCostSettlement({
      year,
      month,
      productCode: '',
      warehouseId: undefined
    })
    return result && result.data && result.data.length > 0
  } catch (error) {
    return false
  }
}

// 处理年份变化
const handleYearChange = () => {
  // 年份切换时，清空并重新加载月份状态
  console.log('年份切换:', currentYear.value)
  loadMonthStatus()
}

// 处理月份点击
const handleMonthClick = async (month: number) => {
  const key = `${currentYear.value}-${month}`
  const status = monthStatus.value.get(key)
  if (!status) return
  
  selectedMonth.value = month
  const [y, m] = status.period.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  queryForm.startDate = `${y}-${String(m).padStart(2, '0')}-01`
  queryForm.endDate = `${y}-${String(m).padStart(2, '0')}-${lastDay}`
  
  if (status.settled) {
    handleSearch()
    checkCurrentMonthHasData()
    return
  }
  
  // 如果待结算，先计算成本数据（不锁定）
  try {
    ElMessage.info(`正在计算 ${status.period} 成本数据...`)
    
    const result = await db.calculateCostWithoutLock({
      year: status.year,
      month: status.month
    })
    
    if (result?.success) {
      ElMessage.success(`成本计算完成，共处理 ${result.count || 0} 条记录`)
      // 计算完成后，查询并显示数据
      await handleSearch()
    } else {
      ElMessage.error(result?.message || '成本计算失败')
    }
  } catch (error: any) {
    console.error('月份点击计算成本失败:', error)
    ElMessage.error(error.message || '成本计算失败')
  }
}

// 获取月份状态样式
const getMonthStatusClass = (month: number) => {
  const key = `${currentYear.value}-${month}`
  const status = monthStatus.value.get(key)
  if (!status) return ''
  
  if (status.settled) return 'month-settled'
  if (status.canSettle) return 'month-can-settle'
  return 'month-cannot-settle'
}

// 获取月份状态标签类型
const getMonthStatusType = (month: number): 'success' | 'warning' | 'info' | 'danger' => {
  const key = `${currentYear.value}-${month}`
  const status = monthStatus.value.get(key)
  if (!status) return 'info'
  
  if (status.settled) return 'success'
  if (status.canSettle) return 'warning'
  return 'info'
}

// 获取月份状态文本
const getMonthStatusText = (month: number): string => {
  const key = `${currentYear.value}-${month}`
  const status = monthStatus.value.get(key)
  if (!status) return '未启用'
  
  if (status.settled) return '已结算'
  if (status.canSettle) return '待结算'
  return '未就绪'
}

// 获取月份结算日期
const getMonthSettleDate = (month: number): string => {
  const key = `${currentYear.value}-${month}`
  const status = monthStatus.value.get(key)
  if (!status || !status.settled) return ''
  
  // 这里可以从数据库获取实际结算时间
  return status.period
}

// 禁用日期
const disabledDate = (date: Date) => {
  if (!costStartDate.value) return false
  
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  return dateStr < costStartDate.value
}

onMounted(() => {
  loadWarehouses()
  loadCostStartDate()
})

// 页面激活时也重新加载（解决切换模块后数据不更新的问题）
onActivated(() => {
  loadCostStartDate()
})
</script>

<style scoped>
.cost-settlement-page {
  padding: 20px;
  background-color: #f0f2f5;
  min-height: calc(100vh - 84px);
}

.toolbar {
  background-color: #fff;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.query-form {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header span:first-child {
  font-weight: bold;
  font-size: 15px;
}

.period-label {
  color: #909399;
  font-size: 13px;
}

.summary-bar {
  margin-top: 16px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 8px;
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
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
  font-size: 18px;
  font-weight: bold;
  color: #409eff;
}

.text-inbound { color: #67c23a; font-weight: 500; }
.text-outbound { color: #f56c6c; font-weight: 500; }
.text-return { color: #e6a23c; font-weight: 500; }
.negative-qty { color: #f56c6c; font-weight: bold; }

:deep(.el-table .summary-row) {
  font-weight: 700;
  background-color: #fafafa !important;
}
:deep(.el-table .summary-row td) {
  background-color: #fafafa !important;
}
.summary-cell {
  font-weight: 700;
}

.table-scroll-wrapper {
  overflow: hidden;
}

.table-scroll-wrapper .el-table {
  overflow: hidden;
}

.print-area {
  background: #fff;
}

/* 详情弹窗 */
.settlement-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.settlement-detail-dialog {
  width: 98%;
  max-width: 1800px;
  height: 90vh;
  background-color: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settlement-detail-header {
  height: 50px;
  background-color: #409eff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}

.settlement-detail-title {
  font-size: 16px;
  font-weight: bold;
}

.settlement-detail-close {
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.3s;
}

.settlement-detail-close:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.settlement-detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.settlement-detail-info {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.settlement-detail-table-wrapper {
  flex: 1;
  overflow-y: auto;
  min-height: 300px;
}

.settlement-detail-footer {
  height: 54px;
  background-color: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
}

/* 月份状态网格 */
.month-status-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 12px;
  margin-top: 10px;
}

.month-status-card {
  background-color: #f5f7fa;
  border: 2px solid #e4e7ed;
  border-radius: 10px;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.month-status-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  border-color: #c0c4cc;
}

.month-status-card.month-settled {
  background-color: #f0f9ff;
  border-color: #67c23a;
}

.month-status-card.month-can-settle {
  background-color: #fff7e6;
  border-color: #e6a23c;
  animation: pulse 2s infinite;
}

.month-status-card.month-cannot-settle {
  background-color: #f5f7fa;
  border-color: #dcdfe6;
  opacity: 0.6;
  cursor: not-allowed;
}

.month-status-card.month-selected {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.4);
  border-color: #409eff;
  background: linear-gradient(135deg, #ecf5ff 0%, #d9ecff 100%);
  z-index: 1;
}

.month-status-card.month-settled.month-selected {
  background: linear-gradient(135deg, #e1f3d8 0%, #c2e7b0 100%);
  border-color: #409eff;
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.4);
}

.month-status-card.month-can-settle.month-selected {
  background: linear-gradient(135deg, #fdf6ec 0%, #faecd8 100%);
  border-color: #409eff;
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.4);
  animation: none;
}

.month-selected-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: #409eff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  animation: indicatorPop 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 6px rgba(64, 158, 255, 0.5);
}

.month-status-card.month-settled.month-selected .month-selected-indicator {
  background: #67c23a;
  box-shadow: 0 2px 6px rgba(103, 194, 58, 0.5);
}

.month-status-card.month-can-settle.month-selected .month-selected-indicator {
  background: #e6a23c;
  box-shadow: 0 2px 6px rgba(230, 162, 60, 0.5);
}

@keyframes indicatorPop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

.month-bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #409eff, #337ecc);
  border-radius: 0 0 8px 8px;
  animation: barSlide 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.month-status-card.month-settled.month-selected .month-bottom-bar {
  background: linear-gradient(90deg, #67c23a, #529b2e);
}

.month-status-card.month-can-settle.month-selected .month-bottom-bar {
  background: linear-gradient(90deg, #e6a23c, #cf8e24);
}

@keyframes barSlide {
  0% { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(230, 162, 60, 0.3);
  }
  50% {
    box-shadow: 0 2px 12px rgba(230, 162, 60, 0.6);
  }
}

.month-number {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
  transition: color 0.3s ease;
}

.month-number-active {
  color: #409eff;
}

.month-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
  transition: color 0.3s ease;
}

.month-label-active {
  color: #337ecc;
  font-weight: 600;
}

.month-status {
  margin-bottom: 4px;
}

.month-date {
  font-size: 10px;
  color: #67c23a;
  margin-top: 4px;
}
</style>

<style>
.custom-tabs-wrapper {
  display: flex;
  justify-content: flex-start;
}

.custom-tabs-nav {
  display: inline-flex;
  position: relative;
  background: #f0f2f5;
  border-radius: 10px;
  padding: 4px;
  gap: 0;
}

.custom-tab-item {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 32px;
  font-size: 15px;
  font-weight: 500;
  color: #606266;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  white-space: nowrap;
}

.custom-tab-item:hover {
  color: #409eff;
}

.custom-tab-item.custom-tab-active {
  color: #ffffff;
  font-weight: 600;
}

.custom-tab-indicator {
  position: absolute;
  top: 4px;
  left: 0;
  width: 50%;
  height: calc(100% - 8px);
  background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
  border-radius: 8px;
  box-shadow: 0 3px 10px rgba(64, 158, 255, 0.45);
  transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;
}

<style>
.ledger-summary-row {
  background-color: #ecf5ff !important;
  font-weight: bold;
}
.ledger-yearly-row {
  background-color: #f0f9eb !important;
  font-weight: bold;
}
.ledger-opening-row {
  background-color: #fafafa !important;
}

.el-table {
  border: 1px solid #909399 !important;
}
.el-table th.el-table__cell,
.el-table td.el-table__cell {
  border-right: 1px solid #c0c4cc !important;
  border-bottom: 1px solid #c0c4cc !important;
}
.el-table .el-table__header-wrapper th,
.el-table .el-table__fixed-header-wrapper th {
  border-bottom: 2px solid #909399 !important;
}
.el-table .el-table__inner-wrapper::before,
.el-table::before,
.el-table::after {
  display: none !important;
}

.el-table .opening-col {
  background-color: #ecf5ff !important;
}
.el-table__header .opening-col {
  background-color: #d9ecff !important;
  color: #1565c0 !important;
  font-weight: 700;
  border-left: 2px solid #409eff;
}

.el-table .settlement-inbound-col {
  background-color: #f0f9eb !important;
}
.el-table__header .settlement-inbound-col {
  background-color: #e1f3d8 !important;
  color: #2e7d32 !important;
  font-weight: 700;
  border-left: 2px solid #67c23a;
}

.el-table .settlement-outbound-col {
  background-color: #fef0f0 !important;
}
.el-table__header .settlement-outbound-col {
  background-color: #fde2e2 !important;
  color: #c62828 !important;
  font-weight: 700;
  border-left: 2px solid #f56c6c;
}

.el-table .settlement-avg-col {
  background-color: #f3e5f5 !important;
}
.el-table__header .settlement-avg-col {
  background-color: #e8daf0 !important;
  color: #6a1b9a !important;
  font-weight: 700;
  border-left: 2px solid #9c27b0;
}

.el-table .settlement-closing-col {
  background-color: #fff8e1 !important;
}
.el-table__header .settlement-closing-col {
  background-color: #ffecb3 !important;
  color: #e65100 !important;
  font-weight: 700;
  border-left: 2px solid #ffa726;
}

.el-table .salescost-qty-col {
  background-color: #ecf5ff !important;
}
.el-table__header .salescost-qty-col {
  background-color: #d9ecff !important;
  color: #1565c0 !important;
  font-weight: 700;
  border-left: 2px solid #409eff;
}

.el-table .salescost-amount-col {
  background-color: #f0f9eb !important;
}
.el-table__header .salescost-amount-col {
  background-color: #e1f3d8 !important;
  color: #2e7d32 !important;
  font-weight: 700;
  border-left: 2px solid #67c23a;
}

.el-table .salescost-cost-col {
  background-color: #fef0f0 !important;
}
.el-table__header .salescost-cost-col {
  background-color: #fde2e2 !important;
  color: #c62828 !important;
  font-weight: 700;
  border-left: 2px solid #f56c6c;
}

.el-table .salescost-profit-col {
  background-color: #f3e5f5 !important;
}
.el-table__header .salescost-profit-col {
  background-color: #e8daf0 !important;
  color: #6a1b9a !important;
  font-weight: 700;
  border-left: 2px solid #9c27b0;
}

.el-table .ledger-inbound-col {
  background-color: #f0f9eb !important;
}
.el-table__header .ledger-inbound-col {
  background-color: #e1f3d8 !important;
  color: #2e7d32 !important;
  font-weight: 700;
  border-left: 2px solid #67c23a;
}

.el-table .ledger-outbound-col {
  background-color: #fef0f0 !important;
}
.el-table__header .ledger-outbound-col {
  background-color: #fde2e2 !important;
  color: #c62828 !important;
  font-weight: 700;
  border-left: 2px solid #f56c6c;
}

.el-table .ledger-balance-col {
  background-color: #ecf5ff !important;
}
.el-table__header .ledger-balance-col {
  background-color: #d9ecff !important;
  color: #1565c0 !important;
  font-weight: 700;
  border-left: 2px solid #409eff;
}

.el-table .salesdetail-qty-col {
  background-color: #ecf5ff !important;
}
.el-table__header .salesdetail-qty-col {
  background-color: #d9ecff !important;
  color: #1565c0 !important;
  font-weight: 700;
  border-left: 2px solid #409eff;
}

.el-table .salesdetail-amount-col {
  background-color: #f0f9eb !important;
}
.el-table__header .salesdetail-amount-col {
  background-color: #e1f3d8 !important;
  color: #2e7d32 !important;
  font-weight: 700;
  border-left: 2px solid #67c23a;
}

.el-table .salesdetail-cost-col {
  background-color: #fef0f0 !important;
}
.el-table__header .salesdetail-cost-col {
  background-color: #fde2e2 !important;
  color: #c62828 !important;
  font-weight: 700;
  border-left: 2px solid #f56c6c;
}

.el-table .salesdetail-profit-col {
  background-color: #f3e5f5 !important;
}
.el-table__header .salesdetail-profit-col {
  background-color: #e8daf0 !important;
  color: #6a1b9a !important;
  font-weight: 700;
  border-left: 2px solid #9c27b0;
}

/* 统一滚动条样式 */
.el-table .el-scrollbar__bar.is-horizontal {
  height: 10px !important;
}
.el-table .el-scrollbar__thumb {
  background-color: #c0c4cc !important;
  border-radius: 5px !important;
}
.el-table .el-scrollbar__thumb:hover {
  background-color: #909399 !important;
}
</style>
