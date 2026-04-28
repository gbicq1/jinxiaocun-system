<template>
  <div class="dashboard">
    <div class="dashboard-content">
      <div class="page-header">
        <div class="header-left">
          <div class="header-indicator"></div>
          <h2 class="header-title">经营概览</h2>
        </div>
        <div class="header-right">
          <span class="header-time">{{ currentTime }}</span>
        </div>
      </div>

      <div class="kpi-row">
        <div class="kpi-card kpi-sales">
          <div class="kpi-icon"><el-icon :size="28"><TrendCharts /></el-icon></div>
          <div class="kpi-body">
            <div class="kpi-label">本月销售额</div>
            <div class="kpi-value">{{ fmtMoney(stats.monthSalesAmount) }}</div>
          </div>
          <div class="kpi-sub">
            <div class="kpi-sub-item"><span class="sub-label">成本</span><span class="sub-val">{{ fmtMoney(stats.monthCostAmount) }}</span></div>
            <div class="kpi-sub-item"><span class="sub-label">利润</span><span class="sub-val profit">{{ fmtMoney(stats.monthProfitAmount) }}</span></div>
          </div>
        </div>

        <div class="kpi-card kpi-receipt">
          <div class="kpi-icon"><el-icon :size="28"><Coin /></el-icon></div>
          <div class="kpi-body">
            <div class="kpi-label">本月收款</div>
            <div class="kpi-value">{{ fmtMoney(stats.monthReceiptAmount) }}</div>
          </div>
          <div class="kpi-sub">
            <div class="kpi-sub-item"><span class="sub-label">付款</span><span class="sub-val">{{ fmtMoney(stats.monthPaymentAmount) }}</span></div>
            <div class="kpi-sub-item"><span class="sub-label">净收</span><span class="sub-val" :class="(stats.monthReceiptAmount - stats.monthPaymentAmount) >= 0 ? 'profit' : 'loss'">{{ fmtMoney(stats.monthReceiptAmount - stats.monthPaymentAmount) }}</span></div>
          </div>
        </div>

        <div class="kpi-card kpi-receivable">
          <div class="kpi-icon"><el-icon :size="28"><Wallet /></el-icon></div>
          <div class="kpi-body">
            <div class="kpi-label">应收款项</div>
            <div class="kpi-value">{{ fmtMoney(stats.receivableAmount) }}</div>
          </div>
          <div class="kpi-sub">
            <div class="kpi-sub-item"><span class="sub-label">应付</span><span class="sub-val">{{ fmtMoney(stats.payableAmount) }}</span></div>
          </div>
        </div>

        <div class="kpi-card kpi-stock">
          <div class="kpi-icon"><el-icon :size="28"><Box /></el-icon></div>
          <div class="kpi-body">
            <div class="kpi-label">库存总值</div>
            <div class="kpi-value">{{ fmtMoney(stats.stockValue) }}</div>
          </div>
          <div class="kpi-sub">
            <div class="kpi-sub-item"><span class="sub-label">数量</span><span class="sub-val">{{ stats.stockQuantity }}</span></div>
            <div class="kpi-sub-item" v-if="stats.warningCount > 0"><span class="sub-label">预警</span><span class="sub-val loss">{{ stats.warningCount }}</span></div>
          </div>
        </div>
      </div>

      <div class="data-row-grid">
        <div class="data-panel panel-outbound">
          <div class="panel-header">
            <el-icon :size="18" color="#fff"><Sell /></el-icon>
            <span class="panel-title">近期销售出库</span>
            <el-button type="primary" link class="panel-link" @click="$router.push('/sales/outbound')">查看全部 →</el-button>
          </div>
          <div class="panel-list-header">
            <span class="col-no">单号</span>
            <span class="col-name">客户</span>
            <span class="col-date">日期</span>
            <span class="col-amount">金额</span>
          </div>
          <div class="panel-list" v-if="recentOutbounds.length > 0">
            <div class="list-item" v-for="(row, idx) in recentOutbounds" :key="idx">
              <span class="col-no" :title="row.voucherNo">{{ row.voucherNo }}</span>
              <span class="col-name">{{ row.customerName || '-' }}</span>
              <span class="col-date">{{ formatDate(row.voucherDate) }}</span>
              <span class="col-amount">{{ fmtMoney(row.totalAmount) }}</span>
            </div>
          </div>
          <div class="panel-empty" v-else><span>暂无出库记录</span></div>
        </div>

        <div class="data-panel panel-payment">
          <div class="panel-header">
            <el-icon :size="18" color="#fff"><Coin /></el-icon>
            <span class="panel-title">近期收款/付款</span>
          </div>
          <div class="panel-list-header">
            <span class="col-type">类型</span>
            <span class="col-name-pay">对象</span>
            <span class="col-date">日期</span>
            <span class="col-amount-pay">金额</span>
            <span class="col-balance">余额</span>
          </div>
          <div class="panel-list" v-if="recentPayments.length > 0">
            <div class="list-item" v-for="(row, idx) in recentPayments" :key="idx">
              <span class="col-type" :class="row.type === '收款' ? 'type-in' : 'type-out'">{{ row.type }}</span>
              <span class="col-name-pay">{{ row.name }}</span>
              <span class="col-date">{{ row.date }}</span>
              <span class="col-amount-pay">{{ fmtMoney(row.amount) }}</span>
              <span class="col-balance" :class="row.balance >= 0 ? 'balance-positive' : 'balance-negative'">{{ fmtMoney(row.balance) }}</span>
            </div>
          </div>
          <div class="panel-empty" v-else><span>暂无收付款记录</span></div>
        </div>
      </div>

      <div class="data-row-grid" style="margin-top: 16px;">
        <div class="data-panel panel-inventory">
          <div class="panel-header">
            <el-icon :size="18" color="#fff"><Box /></el-icon>
            <span class="panel-title">库存数量</span>
            <el-button type="primary" link class="panel-link" @click="$router.push('/inventory/stock')">查看全部 →</el-button>
          </div>
          <div class="panel-list-header">
            <span class="col-code-inv">编码</span>
            <span class="col-name-inv">产品名称</span>
            <span class="col-spec-inv">规格</span>
            <span class="col-unit-inv">单位</span>
            <span class="col-wh-inv">仓库</span>
            <span class="col-qty">数量</span>
            <span class="col-cost">成本价</span>
          </div>
          <div class="panel-list" v-if="stockList.length > 0">
            <div class="list-item" v-for="(row, idx) in stockList" :key="idx">
              <span class="col-code-inv">{{ row.code }}</span>
              <span class="col-name-inv">{{ row.name }}</span>
              <span class="col-spec-inv">{{ row.spec }}</span>
              <span class="col-unit-inv">{{ row.unit }}</span>
              <span class="col-wh-inv">{{ row.warehouse }}</span>
              <span class="col-qty">{{ row.quantity }}</span>
              <span class="col-cost">{{ fmtMoney(row.costPrice) }}</span>
            </div>
          </div>
          <div class="panel-empty" v-else><span>暂无库存数据</span></div>
        </div>

        <div class="data-panel panel-warning">
          <div class="panel-header">
            <el-icon :size="18" color="#fff"><WarningFilled /></el-icon>
            <span class="panel-title">库存预警</span>
            <el-button type="primary" link class="panel-link" @click="$router.push('/inventory/stock')">查看全部 →</el-button>
          </div>
          <div class="panel-list-header">
            <span class="col-code-inv">编码</span>
            <span class="col-name-inv">产品名称</span>
            <span class="col-spec-inv">规格</span>
            <span class="col-unit-inv">单位</span>
            <span class="col-wh-inv">仓库</span>
            <span class="col-qty-warn">当前库存</span>
            <span class="col-warn-line">预警线</span>
          </div>
          <div class="panel-list" v-if="stockWarnings.length > 0">
            <div class="list-item" v-for="(row, idx) in stockWarnings" :key="idx">
              <span class="col-code-inv">{{ row.code }}</span>
              <span class="col-name-inv">{{ row.name }}</span>
              <span class="col-spec-inv">{{ row.spec }}</span>
              <span class="col-unit-inv">{{ row.unit }}</span>
              <span class="col-wh-inv">{{ row.warehouse }}</span>
              <span class="col-qty-warn">{{ row.quantity }}</span>
              <span class="col-warn-line">{{ row.warningQuantity }}</span>
            </div>
          </div>
          <div class="panel-empty" v-else><span>库存充足，暂无预警</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, onActivated } from 'vue'
import { db } from '@/utils/db-ipc'

const stats = reactive({
  warningCount: 0,
  receivableAmount: 0,
  payableAmount: 0,
  monthSalesAmount: 0,
  monthCostAmount: 0,
  monthProfitAmount: 0,
  monthReceiptAmount: 0,
  monthPaymentAmount: 0,
  stockValue: 0,
  stockQuantity: 0
})

const recentOutbounds = ref<any[]>([])
const recentPayments = ref<any[]>([])
const stockList = ref<any[]>([])
const stockWarnings = ref<any[]>([])
const currentTime = ref('')

const fmtMoney = (n: number) => '¥' + (n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatDate = (d: any) => {
  if (!d) return ''
  const s = String(d)
  return s.length > 10 ? s.slice(0, 10) : s
}

let timer: any = null

const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

const recalculateCostForMonths = async (startDate: string, endDate: string) => {
  try {
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
  } catch (e) {
    console.warn('成本计算失败:', e)
  }
}

const loadDashboard = async () => {
  try {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const nowStr = now.toLocaleDateString('sv-SE')

    await recalculateCostForMonths(monthStart, nowStr)

    const [outbounds, inbounds, stocks, receipts, payments] = await Promise.all([
      db.getOutboundList(1, 100000),
      db.getInboundList(1, 100000),
      db.getAllStocks(),
      db.getReceiptList(),
      db.getPaymentList()
    ])

    const outboundList = (outbounds?.data || outbounds || []) as any[]
    const inboundList = (inbounds?.data || inbounds || []) as any[]
    const stockData = (stocks || []) as any[]
    const receiptList = (receipts || []) as any[]
    const paymentList = (payments || []) as any[]

    const monthOutbounds = outboundList.filter((o: any) => (o.voucherDate || o.voucher_date || '') >= monthStart)

    try {
      const profitData = await db.getSalesProfitByProduct({ startDate: monthStart, endDate: nowStr })
      stats.monthSalesAmount = Math.round((profitData || []).reduce((s: number, r: any) => s + Number(r.total_sales_amount || 0), 0) * 100) / 100
      stats.monthCostAmount = Math.round((profitData || []).reduce((s: number, r: any) => s + Number(r.total_cost_amount || 0), 0) * 100) / 100
      stats.monthProfitAmount = Math.round((profitData || []).reduce((s: number, r: any) => s + Number(r.total_profit_amount || 0), 0) * 100) / 100
    } catch {
      stats.monthSalesAmount = monthOutbounds.reduce((s: number, o: any) => s + Number(o.totalAmount || o.total_amount || 0), 0)
      stats.monthCostAmount = monthOutbounds.reduce((s: number, o: any) => s + Number(o.costAmount || o.cost_amount || 0), 0)
      stats.monthProfitAmount = stats.monthSalesAmount - stats.monthCostAmount
    }

    const monthReceipts = receiptList.filter((r: any) => {
      const d = (r.receipt_date || r.receiptDate || '').toString().slice(0, 10)
      return d >= monthStart
    })
    const monthPayments = paymentList.filter((p: any) => {
      const d = (p.payment_date || p.paymentDate || '').toString().slice(0, 10)
      return d >= monthStart
    })
    stats.monthReceiptAmount = monthReceipts.reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
    stats.monthPaymentAmount = monthPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)

    let totalReceivable = 0
    let totalPayable = 0

    const kpiCustomerMap: Record<number, number> = {}
    const kpiSupplierMap: Record<number, number> = {}

    for (const o of outboundList) {
      const cId = Number(o.customerId || o.customer_id || 0)
      if (!cId) continue
      if (!kpiCustomerMap[cId]) kpiCustomerMap[cId] = 0
      // 销售出库单的totalAmount字段为含税金额（unit_price * quantity）
      const outboundAmount = Number(o.totalAmount || o.total_amount || 0)
      kpiCustomerMap[cId] += outboundAmount
      kpiCustomerMap[cId] -= Number(o.receivedAmount || o.received_amount || 0)
    }

    for (const r of receiptList) {
      const cId = Number(r.customer_id || r.customerId || 0)
      if (!cId) continue
      if (!kpiCustomerMap[cId]) kpiCustomerMap[cId] = 0
      kpiCustomerMap[cId] -= Number(r.amount || 0)
    }

    try {
      const salesReturns = await db.getSalesReturns(1, 100000)
      for (const sr of (salesReturns?.data || [])) {
        const cId = Number(sr.customer_id || sr.customerId || 0)
        if (!cId) continue
        if (!kpiCustomerMap[cId]) kpiCustomerMap[cId] = 0
        // 销售退货使用含税金额（total_incl）冲减应收款，注意数据库字段名是total_incl不是total_inc
        const returnAmount = Number(sr.total_incl || sr.totalInc || sr.total_amount || sr.totalAmount || 0)
        kpiCustomerMap[cId] -= returnAmount
      }
    } catch (e) {
      console.error('[Dashboard] 加载销售退货失败:', e)
    }

    for (const i of inboundList) {
      const sId = Number(i.supplierId || i.supplier_id || 0)
      if (!sId) continue
      if (!kpiSupplierMap[sId]) kpiSupplierMap[sId] = 0
      kpiSupplierMap[sId] += Number(i.totalAmount || i.total_amount || 0)
      kpiSupplierMap[sId] -= Number(i.paidAmount || i.paid_amount || 0)
    }

    for (const p of paymentList) {
      const sId = Number(p.supplier_id || p.supplierId || 0)
      if (!sId) continue
      if (!kpiSupplierMap[sId]) kpiSupplierMap[sId] = 0
      kpiSupplierMap[sId] -= Number(p.amount || 0)
    }

    try {
      const purchaseReturns = await db.getPurchaseReturns(1, 100000)
      for (const pr of (purchaseReturns?.data || [])) {
        const sId = Number(pr.supplier_id || pr.supplierId || 0)
        if (!sId) continue
        if (!kpiSupplierMap[sId]) kpiSupplierMap[sId] = 0
        kpiSupplierMap[sId] -= Number(pr.total_amount || pr.totalAmount || 0)
      }
    } catch {}

    for (const v of Object.values(kpiCustomerMap)) { totalReceivable += v }
    for (const v of Object.values(kpiSupplierMap)) { totalPayable += v }

    stats.receivableAmount = Math.round(totalReceivable * 100) / 100
    stats.payableAmount = Math.round(totalPayable * 100) / 100

    const productStockMap: Record<string, { code: string; name: string; spec: string; unit: string; warehouse: string; quantity: number; totalAmount: number; costPrice: number; warningQuantity: number }> = {}
    let totalStockValue = 0
    let totalStockQty = 0

    for (const s of stockData) {
      const pCode = s.productCode || s.product_code || ''
      const pName = s.productName || s.product_name || ''
      const pSpec = s.specification || s.spec || ''
      const pUnit = s.unit || ''
      const qty = Number(s.stockQuantity || 0)
      const cost = Number(s.costPrice || s.cost_price || 0)
      const amount = qty * cost
      const warnQty = Number(s.warningQuantity || s.warning_quantity || 0)

      totalStockValue += amount
      totalStockQty += qty

      const warehouseName = s.warehouseName || s.warehouse_name || '默认仓库'
      const uniqueKey = `${pCode}_${warehouseName}`

      if (!productStockMap[uniqueKey]) {
        productStockMap[uniqueKey] = { code: pCode, name: pName, spec: pSpec, unit: pUnit, warehouse: warehouseName, quantity: 0, totalAmount: 0, costPrice: 0, warningQuantity: warnQty }
      }
      productStockMap[uniqueKey].quantity += qty
      productStockMap[uniqueKey].totalAmount += amount
    }

    for (const p of Object.values(productStockMap)) {
      p.costPrice = p.quantity > 0 ? Number((p.totalAmount / p.quantity).toFixed(2)) : 0
    }
    console.log('[Dashboard] 库存原始数据条数:', stockData.length, '产品聚合数:', Object.keys(productStockMap).length, '前3条:', stockData.slice(0, 3))
    console.log('[Dashboard] 库存总值计算详情:', {
      totalStockValue,
      totalStockQty,
      sampleProducts: Object.values(productStockMap).slice(0, 3).map(p => ({
        code: p.code,
        name: p.name,
        quantity: p.quantity,
        costPrice: p.costPrice,
        totalAmount: p.totalAmount
      }))
    })
    stats.stockValue = totalStockValue
    stats.stockQuantity = totalStockQty

    const allProducts = Object.values(productStockMap)
    allProducts.sort((a, b) => b.quantity - a.quantity)
    stockList.value = allProducts.filter(p => p.quantity > 0).slice(0, 8)

    const warnings = allProducts.filter(p => p.warningQuantity > 0 && p.quantity < p.warningQuantity)
    console.log('[Dashboard] 库存预警数据:', { allProductsCount: allProducts.length, warningsCount: warnings.length, sampleWarnings: warnings.slice(0, 3) })
    stats.warningCount = warnings.length
    stockWarnings.value = warnings.slice(0, 8)

    recentOutbounds.value = outboundList
      .sort((a: any, b: any) => {
        const da = a.voucherDate || a.voucher_date || ''
        const db2 = b.voucherDate || b.voucher_date || ''
        return db2.localeCompare(da)
      })
      .slice(0, 8)

    // 合并销售退货单到近期销售列表（负金额表示退货）
    try {
      const salesReturns = await db.getSalesReturns(1, 100000)
      const returnItems = (salesReturns?.data || []).map((sr: any) => ({
        voucherNo: sr.return_no || sr.returnNo,
        voucherDate: sr.return_date || sr.returnDate,
        customerName: sr.customer_name || sr.customerName,
        totalAmount: -(Number(sr.total_incl || sr.totalInc || sr.total_amount || sr.totalAmount || 0)),
        type: 'sales_return'
      }))
      const outboundItems = outboundList.map((o: any) => ({
        voucherNo: o.voucherNo || o.outboundNo || o.outbound_no || o.voucher_no,
        voucherDate: o.voucherDate || o.voucher_date || o.outbound_date,
        customerName: o.customerName || o.customer_name,
        totalAmount: Number(o.totalAmount || o.total_amount || 0),
        type: 'sales_outbound'
      }))
      const combined = [...outboundItems, ...returnItems]
        .sort((a, b) => (b.voucherDate || '').localeCompare(a.voucherDate || ''))
        .slice(0, 8)
      recentOutbounds.value = combined
    } catch (e) {
      console.error('加载销售退货失败:', e)
    }

    const allPayments: any[] = []

    const customerClosingMap: Record<number, number> = {}
    const supplierClosingMap: Record<number, number> = {}
    const customerIdNameMap: Record<number, string> = {}
    const supplierIdNameMap: Record<number, string> = {}

    for (const o of outboundList) {
      const cId = Number(o.customerId || o.customer_id || 0)
      const cName = o.customerName || o.customer_name || ''
      if (!cId) continue
      customerIdNameMap[cId] = cName
      if (!customerClosingMap[cId]) customerClosingMap[cId] = 0
      customerClosingMap[cId] += Number(o.totalAmount || o.total_amount || 0)
      customerClosingMap[cId] -= Number(o.receivedAmount || o.received_amount || 0)
    }

    for (const r of receiptList) {
      const cId = Number(r.customer_id || r.customerId || 0)
      if (!cId) continue
      if (!customerClosingMap[cId]) customerClosingMap[cId] = 0
      customerClosingMap[cId] -= Number(r.amount || 0)
    }

    // 销售退货冲减客户应收款（使用含税金额total_incl）
    try {
      const salesReturnsForClosing = await db.getSalesReturns(1, 100000)
      for (const sr of (salesReturnsForClosing?.data || [])) {
        const cId = Number(sr.customer_id || sr.customerId || 0)
        if (!cId) continue
        if (!customerClosingMap[cId]) customerClosingMap[cId] = 0
        customerClosingMap[cId] -= Number(sr.total_incl || sr.totalInc || sr.total_amount || sr.totalAmount || 0)
      }
    } catch (e) {
      console.error('[Dashboard] 加载销售退货(余额计算)失败:', e)
    }

    for (const i of inboundList) {
      const sId = Number(i.supplierId || i.supplier_id || 0)
      const sName = i.supplierName || i.supplier_name || ''
      if (!sId) continue
      supplierIdNameMap[sId] = sName
      if (!supplierClosingMap[sId]) supplierClosingMap[sId] = 0
      supplierClosingMap[sId] += Number(i.totalAmount || i.total_amount || 0)
      supplierClosingMap[sId] -= Number(i.paidAmount || i.paid_amount || 0)
    }

    for (const p of paymentList) {
      const sId = Number(p.supplier_id || p.supplierId || 0)
      if (!sId) continue
      if (!supplierClosingMap[sId]) supplierClosingMap[sId] = 0
      supplierClosingMap[sId] -= Number(p.amount || 0)
    }

    try {
      const purchaseReturns = await db.getPurchaseReturns(1, 100000)
      for (const pr of (purchaseReturns?.data || [])) {
        const sId = Number(pr.supplier_id || pr.supplierId || 0)
        if (!sId) continue
        if (!supplierClosingMap[sId]) supplierClosingMap[sId] = 0
        supplierClosingMap[sId] -= Number(pr.total_amount || pr.totalAmount || 0)
      }
    } catch (e) { console.error('加载采购退货失败:', e) }

    for (const r of receiptList) {
      const cId = Number(r.customer_id || r.customerId || 0)
      const cName = customerIdNameMap[cId] || r.customer_name || r.customerName || '-'
      const receiptDate = (r.receipt_date || r.receiptDate || '').toString().slice(0, 10)
      allPayments.push({
        type: '收款',
        name: cName,
        amount: Number(r.amount || 0),
        date: receiptDate,
        balance: Math.round((customerClosingMap[cId] || 0) * 100) / 100
      })
    }

    for (const p of paymentList) {
      const sId = Number(p.supplier_id || p.supplierId || 0)
      const sName = supplierIdNameMap[sId] || p.supplier_name || p.supplierName || '-'
      const paymentDate = (p.payment_date || p.paymentDate || '').toString().slice(0, 10)
      allPayments.push({
        type: '付款',
        name: sName,
        amount: Number(p.amount || 0),
        date: paymentDate,
        balance: Math.round((supplierClosingMap[sId] || 0) * 100) / 100
      })
    }

    allPayments.sort((a, b) => b.date.localeCompare(a.date))
    recentPayments.value = allPayments.slice(0, 8)
  } catch (error) {
    console.error('加载首页数据失败:', error)
  }
}

onMounted(() => {
  loadDashboard()
  updateTime()
  timer = setInterval(updateTime, 1000)
})

onActivated(() => {
  loadDashboard()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.dashboard {
  min-height: calc(100vh - 84px);
  overflow: auto;
  background: #f0f4f8;
}

.dashboard-content {
  padding: 20px 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-indicator {
  width: 4px;
  height: 24px;
  border-radius: 2px;
  background: linear-gradient(180deg, #0095ff, #10b981);
}

.header-title {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.header-time {
  font-size: 13px;
  color: #64748b;
  font-family: 'Courier New', monospace;
  background: #fff;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.kpi-card {
  border-radius: 12px;
  padding: 18px 20px;
  transition: transform 0.25s, box-shadow 0.25s;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.kpi-sales {
  background: linear-gradient(135deg, #e8f4fd, #d0e8fb);
  border: 1px solid #b8d8f5;
}
.kpi-sales .kpi-icon { background: rgba(0, 149, 255, 0.15); color: #0095ff; }
.kpi-sales .kpi-value { color: #0070cc; }
.kpi-sales .kpi-label { color: #3a7ab5; }
.kpi-sales .sub-label { color: #5a9ad0; }
.kpi-sales .sub-val { color: #2a6aaa; }
.kpi-sales .sub-val.profit { color: #0d7a3e; }

.kpi-receipt {
  background: linear-gradient(135deg, #e6f9f0, #ccf2e2);
  border: 1px solid #a8e6c8;
}
.kpi-receipt .kpi-icon { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.kpi-receipt .kpi-value { color: #059669; }
.kpi-receipt .kpi-label { color: #2d9a72; }
.kpi-receipt .sub-label { color: #5ab88a; }
.kpi-receipt .sub-val { color: #2a8a5a; }
.kpi-receipt .sub-val.profit { color: #0d7a3e; }
.kpi-receipt .sub-val.loss { color: #dc2626; }

.kpi-receivable {
  background: linear-gradient(135deg, #fef7e6, #fdeec5);
  border: 1px solid #f5d98a;
}
.kpi-receivable .kpi-icon { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.kpi-receivable .kpi-value { color: #d97706; }
.kpi-receivable .kpi-label { color: #b58a2a; }
.kpi-receivable .sub-label { color: #c9a04a; }
.kpi-receivable .sub-val { color: #9a7520; }

.kpi-stock {
  background: linear-gradient(135deg, #f0e8fd, #e0d4f8);
  border: 1px solid #cdb8f0;
}
.kpi-stock .kpi-icon { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
.kpi-stock .kpi-value { color: #7c3aed; }
.kpi-stock .kpi-label { color: #7a5ab5; }
.kpi-stock .sub-label { color: #9a7ad0; }
.kpi-stock .sub-val { color: #6a4aaa; }
.kpi-stock .sub-val.loss { color: #dc2626; }

.kpi-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpi-body {
  flex: 1;
  min-width: 0;
}

.kpi-label {
  font-size: 14px;
  margin-bottom: 4px;
}

.kpi-value {
  font-size: 26px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}

.kpi-sub {
  width: 100%;
  display: flex;
  gap: 16px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  margin-top: 2px;
}

.kpi-sub-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sub-label {
  font-size: 13px;
}

.sub-val {
  font-size: 14px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.sub-val.profit { color: #10b981; }
.sub-val.loss { color: #ef4444; }

.data-row-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.data-panel {
  border-radius: 12px;
  overflow: hidden;
}

.panel-outbound {
  background: #fff;
  border: 1px solid #d0e8fb;
  box-shadow: 0 2px 8px rgba(0, 149, 255, 0.06);
}
.panel-outbound .panel-header {
  background: linear-gradient(135deg, #0095ff, #00b4ff);
}

.panel-payment {
  background: #fff;
  border: 1px solid #a8e6c8;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.06);
}
.panel-payment .panel-header {
  background: linear-gradient(135deg, #10b981, #34d399);
}

.panel-inventory {
  background: #fff;
  border: 1px solid #cdb8f0;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.06);
}
.panel-inventory .panel-header {
  background: linear-gradient(135deg, #8b5cf6, #a78bfa);
}

.panel-warning {
  background: #fff;
  border: 1px solid #fca5a5;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.06);
}
.panel-warning .panel-header {
  background: linear-gradient(135deg, #ef4444, #f87171);
}

.panel-header {
  display: flex;
  align-items: center;
  padding: 12px 18px;
  gap: 8px;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  flex: 1;
}

.panel-link {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8) !important;
}

.panel-link:hover {
  color: #fff !important;
}

.panel-list-header {
  display: flex;
  align-items: center;
  padding: 8px 18px;
  gap: 8px;
  background: #f8fafc;
  border-bottom: 1px solid #e8ecf2;
  font-size: 13px;
  color: #94a3b8;
  font-weight: 500;
}

.panel-list {
  padding: 2px 0;
}

.list-item {
  display: flex;
  align-items: center;
  padding: 11px 18px;
  gap: 8px;
  transition: background 0.15s;
  border-bottom: 1px solid #f1f5f9;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:hover {
  background: #f8fafc;
}

.col-no, .col-code {
  flex: 0 0 auto;
  width: 200px;
  font-size: 14px;
  color: #64748b;
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-name {
  flex: 0 0 auto;
  width: 280px;
  font-size: 14px;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-name-inv {
  flex: 0 0 auto;
  width: 300px;
  font-size: 14px;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.col-date {
  flex: 0 0 auto;
  width: 95px;
  text-align: center;
  font-size: 14px;
  color: #94a3b8;
}

.col-amount {
  flex: 1 1 0%;
  text-align: right;
  font-size: 15px;
  color: #1e293b;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.col-name-pay {
  flex: 0 0 auto;
  width: 300px;
  font-size: 14px;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-amount-pay {
  flex: 0 0 auto;
  width: 150px;
  text-align: right;
  font-size: 15px;
  color: #1e293b;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.col-balance {
  flex: 1 1 0%;
  text-align: right;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.balance-positive {
  color: #10b981;
}

.balance-negative {
  color: #ef4444;
}

.col-type {
  flex: 0 0 auto;
  width: 90px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  padding: 3px 0;
  border-radius: 4px;
}

.type-in {
  background: #dcfce7;
  color: #16a34a;
}

.type-out {
  background: #fee2e2;
  color: #dc2626;
}

.col-spec {
  flex: 0 0 auto;
  width: 100px;
  font-size: 14px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-code-inv {
  flex: 0 0 auto;
  width: 80px;
  font-size: 14px;
  color: #64748b;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-spec-inv {
  flex: 0 0 auto;
  width: 100px;
  font-size: 14px;
  color: #64748b;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-unit {
  flex: 0 0 auto;
  width: 55px;
  text-align: center;
  font-size: 14px;
  color: #64748b;
}

.col-unit-inv {
  flex: 0 0 auto;
  width: 50px;
  font-size: 14px;
  color: #64748b;
  text-align: center;
}

.col-wh-inv {
  flex: 0 0 auto;
  width: 80px;
  font-size: 14px;
  color: #64748b;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-qty {
  flex: 0 0 auto;
  width: 100px;
  text-align: center;
  font-size: 15px;
  color: #1e293b;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.col-cost {
  flex: 1 1 0%;
  text-align: right;
  font-size: 14px;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.col-qty-warn {
  flex: 0 0 auto;
  width: 100px;
  text-align: center;
  font-size: 15px;
  color: #ef4444;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.col-warn-line {
  flex: 1 1 0%;
  text-align: right;
  font-size: 14px;
  color: #94a3b8;
}

.panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px 0;
}

.panel-empty span {
  font-size: 14px;
  color: #94a3b8;
}
</style>
