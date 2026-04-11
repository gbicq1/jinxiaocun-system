<template>
  <div class="finance-reconciliation-page">
    <el-card>
      <div class="toolbar">
        <el-form :inline="true" :model="queryForm" class="query-form">
          <el-form-item label="对账类型">
            <el-select v-model="queryForm.partnerType" placeholder="请选择类型" style="width: 150px" @change="handlePartnerTypeChange">
              <el-option label="客户" value="customer" />
              <el-option label="供应商" value="supplier" />
            </el-select>
          </el-form-item>
          <el-form-item label="往来单位">
            <el-select v-model="queryForm.partnerId" placeholder="全部" clearable style="width: 200px" @change="handleQuery">
              <el-option
                v-for="item in partnerList"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="会计期间">
            <el-date-picker
              v-model="queryForm.periodRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 300px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleQuery">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
            <el-button @click="handleReset">
              <el-icon><RefreshLeft /></el-icon>
              重置
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-alert
        v-if="partnerList.length === 0"
        type="warning"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #title>
          <span>未找到{{ queryForm.partnerType === 'customer' ? '客户' : '供应商'}}数据，请先在"基础设置"中添加{{ queryForm.partnerType === 'customer' ? '客户' : '供应商'}}信息</span>
        </template>
      </el-alert>
      
      <el-table :data="balanceList" style="width: 100%" border v-loading="false">
        <el-table-column prop="name" label="往来单位" width="200" />
        <el-table-column prop="openingBalance" label="期初余额" width="140" align="right">
          <template #default="{ row }">
            <span :style="{ color: getBalanceColor(row.openingBalance) }">
              ¥{{ Math.abs(row.openingBalance).toLocaleString() }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="queryForm.partnerType === 'customer' ? '本期应收' : '本期应付'" width="140" align="right">
          <template #default="{ row }">
            <span :style="{ color: '#f56c6c' }">¥{{ row.currentReceivable.toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="queryForm.partnerType === 'customer' ? '本期已收' : '本期已付'" width="140" align="right">
          <template #default="{ row }">
            <span :style="{ color: '#67c23a' }">¥{{ row.currentPaid.toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="closingBalance" label="期末余额" width="140" align="right">
          <template #default="{ row }">
            <span :style="{ color: getBalanceColor(row.closingBalance) }">
              ¥{{ Math.abs(row.closingBalance).toLocaleString() }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleViewDetail(row)">明细</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <div v-if="detailVisible" class="detail-overlay" @click="handleOverlayClick">
      <div class="detail-dialog" @click.stop>
        <div class="detail-header">
          <span class="detail-title">收付款明细账 - {{ selectedPartner?.name }}</span>
          <el-icon class="detail-close" @click="detailVisible = false">
            <Close />
          </el-icon>
        </div>

        <div class="detail-summary" v-if="selectedPartner">
          <el-descriptions :column="5" border>
            <el-descriptions-item label="期初余额">
              <span :style="{ color: getBalanceColor(selectedPartner.openingBalance) }">
                ¥{{ Math.abs(selectedPartner.openingBalance).toLocaleString() }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item :label="queryForm.partnerType === 'customer' ? '本期应收' : '本期应付'">
              <span style="color: #f56c6c">¥{{ selectedPartner.currentReceivable.toLocaleString() }}</span>
            </el-descriptions-item>
            <el-descriptions-item :label="queryForm.partnerType === 'customer' ? '本期已收' : '本期已付'">
              <span style="color: #67c23a">¥{{ selectedPartner.currentPaid.toLocaleString() }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="期末余额">
              <span :style="{ color: getBalanceColor(selectedPartner.closingBalance) }">
                ¥{{ Math.abs(selectedPartner.closingBalance).toLocaleString() }}
              </span>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="detail-table-wrapper">
          <el-table :data="detailRecords" style="width: 100%" border show-summary :summary-method="getSummary">
            <el-table-column prop="date" label="日期" width="120" fixed />
            <el-table-column prop="docNo" label="单号" width="160" fixed />
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }">
                <el-tag :type="getTypeColor(row.type)">{{ row.type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="productName" label="商品名称" min-width="150" />
            <el-table-column prop="quantity" label="数量" width="90" align="right" />
            
            <el-table-column :label="queryForm.partnerType === 'customer' ? '应收款' : '应付款'" align="center">
              <el-table-column prop="receivableAmount" label="金额" width="130" align="right">
                <template #default="{ row }">
                  <span v-if="row.receivableAmount > 0" style="color: #f56c6c">
                    ¥{{ row.receivableAmount.toLocaleString() }}
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
            </el-table-column>
            
            <el-table-column :label="queryForm.partnerType === 'customer' ? '已收款' : '已付款'" align="center">
              <el-table-column prop="paidAmount" label="金额" width="130" align="right">
                <template #default="{ row }">
                  <span v-if="row.paidAmount > 0" style="color: #67c23a">
                    ¥{{ row.paidAmount.toLocaleString() }}
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
            </el-table-column>
            
            <el-table-column prop="balance" label="余额" width="140" align="right">
              <template #default="{ row }">
                <span :style="{ color: getBalanceColor(row.balance) }">
                  ¥{{ Math.abs(row.balance).toLocaleString() }}
                </span>
              </template>
            </el-table-column>
            
            <el-table-column prop="remark" label="备注" min-width="150" />
          </el-table>
        </div>

        <div class="detail-footer">
          <el-button @click="detailVisible = false">关闭</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, RefreshLeft, Close } from '@element-plus/icons-vue'

const round2 = (num: number) => Math.round(num * 100) / 100

interface QueryForm {
  partnerType: 'customer' | 'supplier' | ''
  partnerId: number | ''
  periodRange: string[]
}

interface BalanceItem {
  id: number
  name: string
  openingBalance: number
  currentReceivable: number
  currentPaid: number
  closingBalance: number
}

const queryForm = reactive<QueryForm>({
  partnerType: 'customer',
  partnerId: '',
  periodRange: []
})

const partnerList = ref<any[]>([])
const balanceList = ref<BalanceItem[]>([])
const detailVisible = ref(false)
const selectedPartner = ref<BalanceItem | null>(null)
const detailRecords = ref<any[]>([])

watch(detailVisible, (v) => {
  try { document.body.style.overflow = v ? 'hidden' : '' } catch {}
})

const handlePartnerTypeChange = () => {
  loadPartners()
  queryForm.partnerId = ''
  handleQuery()
}

const loadPartners = async () => {
  try {
    console.log('加载往来单位, 类型:', queryForm.partnerType)
    if (queryForm.partnerType === 'customer') {
      partnerList.value = await db.getCustomers()
      console.log('客户列表:', partnerList.value)
    } else if (queryForm.partnerType === 'supplier') {
      partnerList.value = await db.getSuppliers()
      console.log('供应商列表:', partnerList.value)
    } else {
      partnerList.value = []
    }
  } catch (error) {
    console.error('加载往来单位失败:', error)
    partnerList.value = []
  }
}

const handleQuery = () => {
  if (!queryForm.partnerType) {
    ElMessage.warning('请选择对账类型')
    return
  }
  calculateBalances()
}

const handleReset = () => {
  queryForm.partnerType = 'customer'
  queryForm.partnerId = ''
  queryForm.periodRange = []
  loadPartners()
  calculateBalances()
}

const calculateBalances = async () => {
  const startDate = queryForm.periodRange?.[0] || '1970-01-01'
  const endDate = queryForm.periodRange?.[1] || '2099-12-31'

  const results: BalanceItem[] = []

  for (const partner of partnerList.value) {
    if (queryForm.partnerId && queryForm.partnerId !== partner.id) {
      continue
    }

    let openingBalance = 0
    let currentReceivable = 0
    let currentPaid = 0

    try {
      if (queryForm.partnerType === 'customer') {
        const outbounds = await db.getOutboundList(1, 10000)
        const outboundList = outbounds?.data || []
        for (const rec of outboundList) {
          if (rec.customerId !== partner.id && rec.customerName !== partner.name) continue
          const recDate = rec.voucherDate || ''
          if (!recDate) continue
          const dateStr = recDate.slice(0, 10)
          const inPeriod = dateStr >= startDate && dateStr <= endDate
          const beforePeriod = dateStr < startDate

          const amount = round2(Number(rec.totalAmount || 0))
          if (beforePeriod) openingBalance = round2(openingBalance + amount)
          else if (inPeriod) currentReceivable = round2(currentReceivable + amount)

          const paidFromOutbound = round2(Number(rec.paidAmount || rec.paid || 0))
          if (beforePeriod) openingBalance = round2(openingBalance - paidFromOutbound)
          else if (inPeriod) currentPaid = round2(currentPaid + paidFromOutbound)
        }

        const receipts = await db.getReceiptList()
        for (const rec of receipts || []) {
          const recDate = rec.receiptDate || ''
          if (!recDate) continue
          const dateStr = recDate.slice(0, 10)
          if (rec.customerId !== partner.id && rec.customerName !== partner.name) continue
          const amount = round2(Number(rec.amount || 0))
          if (dateStr < startDate) openingBalance = round2(openingBalance - amount)
          else if (dateStr >= startDate && dateStr <= endDate) currentPaid = round2(currentPaid + amount)
        }
      } else {
        const inbounds = await db.getInboundList(1, 10000)
        const inboundList = inbounds?.data || []
        for (const rec of inboundList) {
          if (rec.supplierId !== partner.id && rec.supplierName !== partner.name) continue
          const recDate = rec.voucherDate || ''
          if (!recDate) continue
          const dateStr = recDate.slice(0, 10)
          const inPeriod = dateStr >= startDate && dateStr <= endDate
          const beforePeriod = dateStr < startDate

          const amount = round2(Number(rec.totalAmount || 0))
          if (beforePeriod) openingBalance = round2(openingBalance + amount)
          else if (inPeriod) currentReceivable = round2(currentReceivable + amount)

          const paidFromInbound = round2(Number(rec.paidAmount || rec.paid || 0))
          if (beforePeriod) openingBalance = round2(openingBalance - paidFromInbound)
          else if (inPeriod) currentPaid = round2(currentPaid + paidFromInbound)
        }

        const payments = await db.getPaymentList()
        for (const rec of payments || []) {
          const recDate = rec.paymentDate || ''
          if (!recDate) continue
          const dateStr = recDate.slice(0, 10)
          if (rec.supplierId !== partner.id && rec.supplierName !== partner.name) continue
          const amount = round2(Number(rec.amount || 0))
          if (dateStr < startDate) openingBalance = round2(openingBalance - amount)
          else if (dateStr >= startDate && dateStr <= endDate) currentPaid = round2(currentPaid + amount)
        }
      }
    } catch (error) {
      console.error('计算余额失败:', error)
    }

    const closingBalance = round2(openingBalance + currentReceivable - currentPaid)

    results.push({
      id: partner.id,
      name: partner.name,
      openingBalance,
      currentReceivable,
      currentPaid,
      closingBalance
    })
  }

  balanceList.value = results
}

const handleViewDetail = (row: BalanceItem) => {
  selectedPartner.value = row
  loadDetailRecords(row)
  detailVisible.value = true
}

const loadDetailRecords = async (partner: BalanceItem) => {
  const startDate = queryForm.periodRange?.[0] || '1970-01-01'
  const endDate = queryForm.periodRange?.[1] || '2099-12-31'
  const tempRecords: any[] = []

  try {
    if (queryForm.partnerType === 'customer') {
      const outbounds = await db.getOutboundList(1, 10000)
      for (const rec of (outbounds?.data || [])) {
        if (rec.customerId !== partner.id && rec.customerName !== partner.name) continue
        const recDate = rec.voucherDate || ''
        if (!recDate) continue
        const dateStr = recDate.slice(0, 10)
        if (dateStr < startDate || dateStr > endDate) continue

        let productName = ''
        let quantity = 0
        const items = rec.items || []
        items.forEach((item: any) => {
          productName = productName ? productName + '、' + (item.productName || '') : (item.productName || '')
          quantity += Number(item.quantity || 0)
        })

        tempRecords.push({
          date: dateStr,
          docNo: rec.voucherNo || '',
          type: '销售出库',
          productName,
          quantity,
          receivableAmount: round2(Number(rec.totalAmount || 0)),
          paidAmount: round2(Number(rec.paidAmount || rec.paid || 0)),
          remark: rec.remark || '',
          _timestamp: rec.createdAt || recDate
        })
      }

      const receipts = await db.getReceiptList()
      for (const rec of (receipts || [])) {
        if (rec.customerId !== partner.id && rec.customerName !== partner.name) continue
        const recDate = rec.receiptDate || ''
        if (!recDate) continue
        const dateStr = recDate.slice(0, 10)
        if (dateStr < startDate || dateStr > endDate) continue

        tempRecords.push({
          date: dateStr,
          docNo: rec.receiptNo || '',
          type: '收款单',
          productName: '',
          quantity: 0,
          receivableAmount: 0,
          paidAmount: round2(Number(rec.amount || 0)),
          remark: rec.remark || '',
          _timestamp: rec.createdAt || recDate
        })
      }
    } else {
      const inbounds = await db.getInboundList(1, 10000)
      for (const rec of (inbounds?.data || [])) {
        if (rec.supplierId !== partner.id && rec.supplierName !== partner.name) continue
        const recDate = rec.voucherDate || ''
        if (!recDate) continue
        const dateStr = recDate.slice(0, 10)
        if (dateStr < startDate || dateStr > endDate) continue

        let productName = ''
        let quantity = 0
        const items = rec.items || []
        items.forEach((item: any) => {
          productName = productName ? productName + '、' + (item.productName || '') : (item.productName || '')
          quantity += Number(item.quantity || 0)
        })

        tempRecords.push({
          date: dateStr,
          docNo: rec.voucherNo || '',
          type: '采购入库',
          productName,
          quantity,
          receivableAmount: round2(Number(rec.totalAmount || 0)),
          paidAmount: round2(Number(rec.paidAmount || rec.paid || 0)),
          remark: rec.remark || '',
          _timestamp: rec.createdAt || recDate
        })
      }

      const payments = await db.getPaymentList()
      for (const rec of (payments || [])) {
        if (rec.supplierId !== partner.id && rec.supplierName !== partner.name) continue
        const recDate = rec.paymentDate || ''
        if (!recDate) continue
        const dateStr = recDate.slice(0, 10)
        if (dateStr < startDate || dateStr > endDate) continue

        tempRecords.push({
          date: dateStr,
          docNo: rec.paymentNo || '',
          type: '付款单',
          productName: '',
          quantity: 0,
          receivableAmount: 0,
          paidAmount: round2(Number(rec.amount || 0)),
          remark: rec.remark || '',
          _timestamp: rec.createdAt || recDate
        })
      }
    }
  } catch (error) {
    console.error('加载明细记录失败:', error)
  }

  console.log('排序前记录:', tempRecords.map(r => ({ date: r.date, docNo: r.docNo, _timestamp: r._timestamp })))

  tempRecords.sort((a, b) => {
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()
    if (dateA !== dateB) {
      return dateA - dateB
    }
    const timeA = a._timestamp ? new Date(a._timestamp).getTime() : dateA
    const timeB = b._timestamp ? new Date(b._timestamp).getTime() : dateB
    return timeA - timeB
  })

  console.log('排序后记录:', tempRecords.map(r => ({ date: r.date, docNo: r.docNo, _timestamp: r._timestamp })))

  let balance = partner.openingBalance
  detailRecords.value = tempRecords.map((r: any) => {
    balance = round2(balance + r.receivableAmount - r.paidAmount)
    return { ...r, balance }
  })
}

const getBalanceColor = (balance: number) => {
  return balance >= 0 ? '#f56c6c' : '#67c23a'
}

const getTypeColor = (type: string) => {
  if (type.includes('出库') || type.includes('入库')) return 'primary'
  if (type.includes('退货')) return 'danger'
  if (type.includes('收款') || type.includes('付款')) return 'success'
  return 'info'
}

const getSummary = ({ columns, data }: any) => {
  return columns.map((column: any, index: number) => {
    if (index === 0) return '合计'
    if (column.property === 'receivableAmount') {
      const sum = data.reduce((sum: number, row: any) => sum + row.receivableAmount, 0)
      return `¥${sum.toLocaleString()}`
    }
    if (column.property === 'paidAmount') {
      const sum = data.reduce((sum: number, row: any) => sum + row.paidAmount, 0)
      return `¥${sum.toLocaleString()}`
    }
    if (column.property === 'balance' && data.length > 0) {
      const lastRow = data[data.length - 1]
      return `¥${Math.abs(lastRow.balance).toLocaleString()}`
    }
    return ''
  })
}

const handleOverlayClick = () => {
  detailVisible.value = false
}

onMounted(async () => {
  await loadPartners()
  await calculateBalances()
})
</script>

<style scoped>
.finance-reconciliation-page {
  padding: 20px;
}

.toolbar {
  margin-bottom: 20px;
}

.detail-overlay {
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

.detail-dialog {
  position: relative;
  width: 90%;
  max-width: 1400px;
  height: 85vh;
  min-height: 500px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.detail-close {
  font-size: 18px;
  color: #909399;
  cursor: pointer;
  transition: color 0.3s;
}

.detail-close:hover {
  color: #606266;
}

.detail-summary {
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.detail-table-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  background: #fff;
}

.detail-table-wrapper::-webkit-scrollbar {
  width: 8px;
}

.detail-table-wrapper::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.detail-table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #a8abb2;
}

.detail-table-wrapper::-webkit-scrollbar-track {
  background: #f5f7fa;
}

.detail-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
}
</style>
