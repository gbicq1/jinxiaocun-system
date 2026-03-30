<template>
  <div class="inventory-stock-page">
    <el-card>
      <div class="toolbar">
        <el-autocomplete
          v-model="searchQuery"
          :fetch-suggestions="querySearch"
          placeholder="搜索产品编码/名称"
          clearable
          style="width: 300px"
          @select="handleSelect"
          @clear="handleClear"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #default="{ item }">
            <div class="product-option">
              <span class="product-code">{{ item.value }}</span>
              <span class="product-name">{{ item.name }}</span>
            </div>
          </template>
        </el-autocomplete>
        <el-select
          v-model="selectedWarehouse"
          placeholder="仓库（全部）"
          clearable
          filterable
          style="width: 200px; margin-left: 10px;"
          @change="handleWarehouseFilter"
        >
          <el-option
            v-for="warehouse in warehouses"
            :key="warehouse.id"
            :label="warehouse.name"
            :value="warehouse.name"
          />
        </el-select>
        <el-button type="primary" @click="handleExport" style="margin-left: 10px;">
          <el-icon><Download /></el-icon>
          导出库存
        </el-button>
      </div>
      <el-table :data="stockList" style="width: 100%" :table-layout="'fixed'">
        <el-table-column prop="productCode" label="产品编码" width="120" />
        <el-table-column prop="productName" label="产品名称" width="220" />
        <el-table-column prop="specification" label="规格" width="160" />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="warehouseName" label="仓库" width="120" />
        <el-table-column prop="stockQuantity" label="库存数量" width="100">
          <template #default="{ row }">
            <el-tag :type="getStockType(row.stockQuantity, row.warningQuantity)">
              {{ row.stockQuantity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="warningQuantity" label="预警数量" width="100" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="costPrice" label="成本价" width="100">
          <template #default="{ row }">
            ¥{{ row.costPrice }}
          </template>
        </el-table-column>
        <el-table-column prop="totalValue" label="库存金额" width="120">
          <template #default="{ row }">
            ¥{{ (row.stockQuantity * row.costPrice).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleView(row)">明细</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <!-- 库存明细弹窗 -->
    <div v-if="dialogVisible" class="stock-detail-overlay" @click="handleOverlayClick">
      <div class="stock-detail-dialog" @click.stop>
        <!-- ① 头部固定区 -->
        <div class="stock-detail-header">
          <span class="stock-detail-title">库存明细</span>
          <el-icon class="stock-detail-close" @click="dialogVisible = false">
            <Close />
          </el-icon>
        </div>

        <div v-if="selectedRow" class="stock-detail-body">
          <!-- ② 明细表格滚动区 -->
          <div class="stock-detail-table-wrapper">
            <el-table 
              :data="ledgerEntries" 
              style="width: 100%; min-width: 900px" 
              :height="'100%'"
              :show-summary="false"
              element-loading-text="加载中..."
              border
            >
              <el-table-column prop="date" label="日期" width="120" min-width="100" fixed />
              <el-table-column prop="docNo" label="单号" width="170" min-width="140" fixed />
              <el-table-column prop="productName" label="产品名称" width="180" min-width="140" />
              <el-table-column prop="specification" label="规格" width="120" min-width="100" />
              <el-table-column prop="unit" label="单位" width="70" min-width="60" />
              
              <!-- 入库数据区域 -->
              <el-table-column label="入库数据" align="center">
                <el-table-column prop="inboundQty" label="数量" width="120" min-width="100" class-name="inbound-col">
                  <template #default="{ row }">
                    <span v-if="row.inboundQty > 0" style="color: #67c23a">{{ row.inboundQty }}</span>
                    <span v-else-if="row.inboundQty < 0" style="color: #f56c6c">{{ row.inboundQty }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>
              
              <!-- 出库数据区域 -->
              <el-table-column label="出库数据" align="center">
                <el-table-column prop="outboundQty" label="数量" width="120" min-width="100" class-name="outbound-col">
                  <template #default="{ row }">
                    <span v-if="row.outboundQty > 0" style="color: #f56c6c">{{ row.outboundQty }}</span>
                    <span v-else-if="row.outboundQty < 0" style="color: #67c23a">{{ row.outboundQty }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table-column>
              
              <!-- 库存信息区域 -->
              <el-table-column label="库存结余" align="center">
                <el-table-column prop="runningQty" label="库存数量" width="120" min-width="100" class-name="stock-col" />
              </el-table-column>
              
              <el-table-column prop="counter" label="往来单位" width="150" min-width="120" />
              <el-table-column prop="remark" label="备注" min-width="200" />
            </el-table>
          </div>
        </div>

        <!-- 底部关闭按钮固定区 -->
        <div class="stock-detail-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Search, Download, Close } from '@element-plus/icons-vue'
import exportToCsv from '../../utils/exportCsv'
import { getRealTimeStock } from '@/utils/stock'

const searchQuery = ref('')
const selectedWarehouse = ref('')
const warehouses = ref<any[]>([])
const products = ref<any[]>([])  // 产品列表用于搜索建议
const stockList = ref<any[]>([])
const allStock = ref<any[]>([])
const dialogVisible = ref(false)
// 打开明细弹窗时禁止页面滚动，避免弹窗随着页面上下移动
watch(dialogVisible, (v) => {
  try { document.body.style.overflow = v ? 'hidden' : '' } catch {}
})
const selectedRow = ref<any>(null)
const ledgerEntries = ref<any[]>([])

const handleSearch = () => {
  const q = (searchQuery.value || '').toLowerCase()
  const warehouse = selectedWarehouse.value
  
  if (!q && !warehouse) {
    stockList.value = allStock.value.slice()
    return
  }
  
  stockList.value = allStock.value.filter(item => {
    const matchText = !q || 
      (item.productCode || '').toLowerCase().includes(q)
      || (item.productName || '').toLowerCase().includes(q)
      || (String(item.specification || '').toLowerCase().includes(q))
    
    const matchWarehouse = !warehouse || item.warehouseName === warehouse
    
    return matchText && matchWarehouse
  })
}

const handleWarehouseFilter = () => {
  handleSearch()
}

// 加载仓库列表
const loadWarehouses = () => {
  try {
    const saved = localStorage.getItem('warehouses')
    if (saved) {
      warehouses.value = JSON.parse(saved)
      console.log('加载仓库列表成功，共', warehouses.value.length, '个仓库')
    } else {
      // 如果没有仓库数据，使用默认值
      warehouses.value = [{ id: 1, name: '默认仓库' }]
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error)
    warehouses.value = [{ id: 1, name: '默认仓库' }]
  }
}

// 从 localStorage 加载仓库列表（用于库存计算）
const loadWarehousesFromStorage = () => {
  try {
    const saved = localStorage.getItem('warehouses')
    if (saved) {
      return JSON.parse(saved)
    } else {
      return [{ id: 1, name: '默认仓库' }]
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error)
    return [{ id: 1, name: '默认仓库' }]
  }
}

// 加载产品列表（用于搜索建议）
const loadProducts = () => {
  try {
    const savedProducts = localStorage.getItem('products')
    if (savedProducts) {
      const allProducts = JSON.parse(savedProducts)
      products.value = allProducts
        .filter((p: any) => (p.status as any) === 1 || (p.status as any) === true)
        .map((p: any) => ({
          value: p.code || p.productCode || '',
          label: `${p.code || p.productCode || ''} - ${p.name || p.productName || ''}`,
          code: p.code || p.productCode || '',
          name: p.name || p.productName || '',
          id: p.id
        }))
      console.log('加载产品列表成功，共', products.value.length, '个产品')
    } else {
      products.value = []
    }
  } catch (error) {
    console.error('加载产品列表失败:', error)
    products.value = []
  }
}

// 搜索建议
const querySearch = (queryString: string, cb: (suggestions: any[]) => void) => {
  const results = queryString
    ? products.value.filter(createFilter(queryString))
    : products.value
  
  cb(results.map(p => ({
    value: p.code,
    label: p.label,
    code: p.code,
    name: p.name
  })))
}

// 搜索过滤器
const createFilter = (queryString: string) => {
  return (restaurant: any) => {
    return (
      restaurant.value.toLowerCase().indexOf(queryString.toLowerCase()) === 0 ||
      restaurant.name.toLowerCase().includes(queryString.toLowerCase())
    )
  }
}

// 选择产品
const handleSelect = (item: any) => {
  console.log('选择的产品:', item)
  handleSearch()
}

// 清空搜索
const handleClear = () => {
  console.log('清空搜索')
  searchQuery.value = ''
  handleSearch()
}

const handleExport = () => {
  const columns = [
    { label: '产品编码', key: 'productCode' },
    { label: '产品名称', key: 'productName' },
    { label: '规格', key: 'specification' },
    { label: '分类', key: 'category' },
    { label: '仓库', key: 'warehouseName' },
    { label: '库存数量', key: 'stockQuantity' },
    { label: '单位', key: 'unit' },
    { label: '成本价', key: 'costPrice' }
  ]
  exportToCsv('stock.csv', columns, stockList.value)
}

const handleView = (row: any) => {
  selectedRow.value = row
  // 构建明细账并展示
  loadLedger(row)
  dialogVisible.value = true
}

const handleOverlayClick = () => {
  dialogVisible.value = false
}

const loadLedger = (row: any) => {
  ledgerEntries.value = []
  if (!row) return
  const code = String(row.productCode || '').trim()
  const name = String(row.productName || '').trim()
  const targetWarehouse = String(row.warehouseName || '').trim()

  // 临时存储所有明细记录
  const tempEntries: any[] = []

  // 先处理库存调拨数据（单独处理，因为调拨单同时影响两个仓库）
  try {
    const transferRaw = localStorage.getItem('inventory_transfers')
    if (transferRaw) {
      const transfers = JSON.parse(transferRaw)
      if (Array.isArray(transfers)) {
        for (const rec of transfers) {
          const fromWarehouse = String(rec.fromWarehouseName || '').trim()
          const toWarehouse = String(rec.toWarehouseName || '').trim()
          
          const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
          if (!Array.isArray(items)) continue
          
          for (const it of items) {
            const itCode = String(it.productCode || it.code || it.sku || '').trim()
            const itName = String(it.productName || it.name || '').trim()
            const itId = it.productId || it.id || null
            const match = (itId && row.productId && itId === row.productId) || (itCode && code && itCode === code) || (itName && name && itName === name)
            if (!match) continue

            const qty = Number(it.quantity || it.qty || it.count || it.num || 0)
            const docNo = rec.transferNo || ''
            const date = rec.transferDate || rec.date || rec.createdAt || ''
            const remark = rec.remark || rec.note || ''
            
            const timestamp = rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp || 
                            (date ? `${date}_${docNo}` : docNo)

            const unitPriceInc = Number(it.unitPriceInc || it.unitPriceTaxIncluded || it.priceWithTax || it.unitPrice || it.unitPriceEx || it.price || 0)
            const entryAmount = Number((qty * unitPriceInc).toFixed(2))

            // 判断当前仓库是调出还是调入
            if (fromWarehouse === targetWarehouse) {
              // 调出仓库：作为出库处理
              tempEntries.push({
                productCode: itCode,
                productName: itName,
                warehouseName: targetWarehouse,
                specification: selectedRow.specification || selectedRow.spec || '-',
                unit: selectedRow.unit || '-',
                date,
                type: '调拨出库',
                docNo,
                inboundQty: 0,
                inboundUnitPrice: 0,
                inboundAmount: 0,
                outboundQty: qty,
                outboundUnitPrice: unitPriceInc,
                outboundAmount: entryAmount,
                counter: `调入:${toWarehouse}`,
                remark,
                _sortDate: date,
                _timestamp: timestamp
              })
            }
            
            if (toWarehouse === targetWarehouse) {
              // 调入仓库：作为入库处理
              tempEntries.push({
                productCode: itCode,
                productName: itName,
                warehouseName: targetWarehouse,
                specification: selectedRow.specification || selectedRow.spec || '-',
                unit: selectedRow.unit || '-',
                date,
                type: '调拨入库',
                docNo,
                inboundQty: qty,
                inboundUnitPrice: unitPriceInc,
                inboundAmount: entryAmount,
                outboundQty: 0,
                outboundUnitPrice: 0,
                outboundAmount: 0,
                counter: `调出:${fromWarehouse}`,
                remark,
                _sortDate: date,
                _timestamp: timestamp
              })
            }
          }
        }
      }
    }
  } catch {
    // ignore parsing errors
  }

  // 遍历 localStorage 中可能的数组，查找包含 items 的记录
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    if (key === 'inventory_transfers') continue // 调拨单已单独处理，跳过
    const raw = localStorage.getItem(key)
    if (!raw) continue
    try {
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) continue
      for (const rec of arr) {
        // 检查记录的仓库是否匹配
        const recWarehouseName = String(rec.warehouseName || '').trim()
        // 如果记录有仓库信息，必须匹配目标仓库
        if (recWarehouseName && recWarehouseName !== targetWarehouse) {
          continue
        }
        
        const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
        if (!Array.isArray(items)) continue
        for (const it of items) {
          const itCode = String(it.productCode || it.code || it.sku || '').trim()
          const itName = String(it.productName || it.name || '').trim()
          const itId = it.productId || it.id || null
          const match = (itId && row.productId && itId === row.productId) || (itCode && code && itCode === code) || (itName && name && itName === name)
          if (!match) continue

          // 推断单据类型
          let typeLabel = key
          let isInbound = false
          let isOutbound = false
          let isPurchaseReturn = false  // 采购退货（负数入库）
          let isSalesReturn = false     // 销售退货（负数出库）
          
          const inboundKeys = ['purchaseInbounds','inbound_records','inbounds','purchase_inbounds']
          const outboundKeys = ['outbound_records','outbounds','sales_outbounds','salesOutbounds','delivery_records']
          const purchaseReturnsKeys = ['purchaseReturns','purchase_returns']
          const salesReturnsKeys = ['salesReturns','sales_returns']
          
          if (inboundKeys.includes(key) || (key.toLowerCase().includes('inbound') && !key.toLowerCase().includes('return'))) { 
            typeLabel = '入库'
            isInbound = true 
          }
          else if (outboundKeys.includes(key) || (key.toLowerCase().includes('outbound') && !key.toLowerCase().includes('return')) || key.toLowerCase().includes('delivery')) { 
            typeLabel = '出库'
            isOutbound = true 
          }
          else if (purchaseReturnsKeys.includes(key) || (key.toLowerCase().includes('return') && key.toLowerCase().includes('purchase'))) { 
            typeLabel = '采购退货'
            isPurchaseReturn = true // 采购退货 = 负数入库（减少库存）
          }
          else if (salesReturnsKeys.includes(key) || (key.toLowerCase().includes('return') && key.toLowerCase().includes('sales'))) { 
            typeLabel = '销售退货'
            isSalesReturn = true // 销售退货 = 负数出库（增加库存）
          }
          else if (key.toLowerCase().includes('order')) { 
            typeLabel = '订单'
          }

          const qty = Number(it.quantity || it.qty || it.count || it.num || 0)
          const docNo = rec.voucherNo || rec.orderNo || rec.number || rec.no || ''
          const date = rec.voucherDate || rec.orderDate || rec.date || rec.createdAt || ''
          const counter = rec.supplierName || rec.supplier || rec.customerName || rec.customer || ''
          const remark = rec.remark || rec.note || ''
          
          // 获取精确时间戳：优先使用创建时间（包含时分秒），否则使用日期 + 单号模拟
          const timestamp = rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp || 
                           (date ? `${date}_${docNo}` : docNo)

          // 直接读取含税单价
          const unitPriceInc = Number(it.unitPriceInc || it.unitPriceTaxIncluded || it.priceWithTax || it.unitPrice || it.price || 0)
          const entryAmount = Number((qty * unitPriceInc).toFixed(2))

          // 根据单据类型分别存储入库和出库数据
          if (isInbound) {
            // 正常入库：正数
            tempEntries.push({
              productCode: itCode,
              productName: itName,
              warehouseName: selectedRow.warehouseName || '默认仓库',
              specification: selectedRow.specification || selectedRow.spec || '-',
              unit: selectedRow.unit || '-',
              date,
              type: typeLabel,
              docNo,
              inboundQty: qty,
              inboundUnitPrice: unitPriceInc,
              inboundAmount: entryAmount,
              outboundQty: 0,
              outboundUnitPrice: 0,
              outboundAmount: 0,
              counter,
              remark,
              _sortDate: date,
              _timestamp: timestamp
            })
          } else if (isOutbound) {
            // 正常出库：正数
            tempEntries.push({
              productCode: itCode,
              productName: itName,
              warehouseName: selectedRow.warehouseName || '默认仓库',
              specification: selectedRow.specification || selectedRow.spec || '-',
              unit: selectedRow.unit || '-',
              date,
              type: typeLabel,
              docNo,
              inboundQty: 0,
              inboundUnitPrice: 0,
              inboundAmount: 0,
              outboundQty: qty,
              outboundUnitPrice: unitPriceInc,
              outboundAmount: entryAmount,
              counter,
              remark,
              _sortDate: date,
              _timestamp: timestamp
            })
          } else if (isPurchaseReturn) {
            // 采购退货：负数入库（减少库存）
            tempEntries.push({
              productCode: itCode,
              productName: itName,
              warehouseName: selectedRow.warehouseName || '默认仓库',
              specification: selectedRow.specification || selectedRow.spec || '-',
              unit: selectedRow.unit || '-',
              date,
              type: typeLabel,
              docNo,
              inboundQty: -qty,  // 负数
              inboundUnitPrice: unitPriceInc,
              inboundAmount: -entryAmount,  // 负数
              outboundQty: 0,
              outboundUnitPrice: 0,
              outboundAmount: 0,
              counter,
              remark,
              _sortDate: date,
              _timestamp: timestamp
            })
          } else if (isSalesReturn) {
            // 销售退货：负数出库（增加库存）
            tempEntries.push({
              productCode: itCode,
              productName: itName,
              warehouseName: selectedRow.warehouseName || '默认仓库',
              specification: selectedRow.specification || selectedRow.spec || '-',
              unit: selectedRow.unit || '-',
              date,
              type: typeLabel,
              docNo,
              inboundQty: 0,
              inboundUnitPrice: 0,
              inboundAmount: 0,
              outboundQty: -qty,  // 负数
              outboundUnitPrice: unitPriceInc,
              outboundAmount: -entryAmount,  // 负数
              counter,
              remark,
              _sortDate: date,
              _timestamp: timestamp
            })
          }
        }
      }
    } catch {
      // ignore parsing errors
    }
  }
  
  // 按日期和时间戳正序排序
  tempEntries.sort((a, b) => {
    // 先按日期排序
    const dateA = new Date(a._sortDate || a.date || '1970-01-01').getTime()
    const dateB = new Date(b._sortDate || b.date || '1970-01-01').getTime()
    
    if (dateA !== dateB) {
      return dateA - dateB
    }
    
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
    
    // 最后按类型排序作为兜底
    const typeOrder = ['调拨入库', '入库', '销售退货', '调拨出库', '出库', '采购退货']
    const typeA = typeOrder.indexOf(a.type)
    const typeB = typeOrder.indexOf(b.type)
    
    if (typeA !== -1 && typeB !== -1) {
      return typeA - typeB
    }
    
    return 0
  })

  // 计算初始库存（尝试从 localStorage 中查找初始库存记录）
  let openingQty = 0
  let openingAmount = 0
  try {
    const openingKeys = ['stock_initial','initial_stock','opening_stock']
    for (const k of openingKeys) {
      const raw = localStorage.getItem(k)
      if (!raw) continue
      try {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) {
          const found = arr.find((r: any) => {
            const productMatch = String(r.productCode || r.code || r.productCode) === String(row.productCode)
            const warehouseMatch = !r.warehouseName || String(r.warehouseName).trim() === targetWarehouse
            return productMatch && warehouseMatch
          })
          if (found) {
            openingQty = Number(found.quantity || found.qty || 0)
            openingAmount = Number(found.amount || found.total || 0)
            break
          }
        }
      } catch { }
    }
  } catch { }

  // 逐条计算运行数量与运行金额，并计算成本价
  let runningQty = openingQty
  let runningAmount = openingAmount
  let lastCost = runningQty ? runningAmount / runningQty : 0
  
  ledgerEntries.value = tempEntries.map((en: any) => {
    // 处理入库（包括正数入库和负数入库）
    if (en.inboundQty !== 0) {
      runningQty = Number((runningQty + en.inboundQty).toFixed(4))
      runningAmount = Number((runningAmount + en.inboundAmount).toFixed(2))
    }
    // 处理出库（包括正数出库和负数出库）
    if (en.outboundQty !== 0) {
      // 出库时减少总成本（按当前成本价计算）
      // 负数出库（销售退货）会增加库存和总成本
      const outboundCost = lastCost * en.outboundQty
      runningQty = Number((runningQty - en.outboundQty).toFixed(4))
      runningAmount = Number((runningAmount - outboundCost).toFixed(2))
    }
    
    // 计算当前成本价（加权平均）
    const costPrice = runningQty > 0 ? Number((runningAmount / runningQty).toFixed(2)) : lastCost
    lastCost = costPrice || lastCost
    
    return { ...en, runningQty, runningAmount, costPrice }
  })
}

const getStockType = (stock: number, warning: number) => {
  if (stock <= 0) return 'danger'
  if (stock <= warning) return 'warning'
  return 'success'
}

// 从出入库交易记录中计算库存
const calculateStockFromTransactions = (productList: any[]) => {
  const stockMap = new Map<string, any>()
  
  // 获取所有仓库
  const warehousesList = loadWarehousesFromStorage()
  
  // 为每个产品的每个仓库生成库存记录
  productList.forEach(p => {
    warehousesList.forEach(wh => {
      const key = `${p.productCode}_${wh.name}`
      stockMap.set(key, {
        ...p,
        warehouseName: wh.name,
        warehouseId: wh.id,
        stockQuantity: 0,
        costPrice: 0,
        totalValue: 0,
        _totalCost: 0, // 总成本
        _totalQty: 0   // 总数量
      })
    })
  })
  
  // 先处理库存调拨数据（单独处理，因为调拨单同时影响两个仓库）
  try {
    const transferRaw = localStorage.getItem('inventory_transfers')
    if (transferRaw) {
      const transfers = JSON.parse(transferRaw)
      if (Array.isArray(transfers)) {
        for (const rec of transfers) {
          const fromWarehouseId = rec.fromWarehouseId
          const fromWarehouseName = rec.fromWarehouseName
          const toWarehouseId = rec.toWarehouseId
          const toWarehouseName = rec.toWarehouseName
          
          const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
          if (!Array.isArray(items)) continue
          
          for (const it of items) {
            const itCode = String(it.productCode || it.code || it.sku || '').trim()
            const itName = String(it.productName || it.name || '').trim()
            const itId = it.productId || it.id || null
            const qty = Number(it.quantity || it.qty || it.count || it.num || 0)
            const unitPrice = Number(it.unitPriceEx || it.unitPrice || it.unitPriceInc || it.price || it.unit_price || 0)
            const amount = qty * unitPrice
            
            // 匹配产品和仓库
            for (const [mapKey, stock] of stockMap.entries()) {
              // 匹配产品
              const match = (itId && stock.productId && itId === stock.productId) || 
                           (itCode && stock.productCode && itCode === stock.productCode) || 
                           (itName && stock.productName && itName === stock.productName)
              
              if (!match) continue
              
              // 调出仓库：减少库存
              const fromWarehouseMatch = (fromWarehouseId != null && Number(stock.warehouseId) === Number(fromWarehouseId)) || 
                                        (fromWarehouseName && stock.warehouseName === fromWarehouseName)
              
              if (fromWarehouseMatch) {
                stock._totalQty -= qty
                const outboundCost = stock.costPrice * qty
                stock._totalCost -= outboundCost
                stock.stockQuantity = Number(stock._totalQty)
                if (stock._totalQty > 0) {
                  stock.costPrice = Number((stock._totalCost / stock._totalQty).toFixed(2))
                }
                stock.totalValue = Number((stock.stockQuantity * stock.costPrice).toFixed(2))
              }
              
              // 调入仓库：增加库存
              const toWarehouseMatch = (toWarehouseId != null && Number(stock.warehouseId) === Number(toWarehouseId)) || 
                                      (toWarehouseName && stock.warehouseName === toWarehouseName)
              
              if (toWarehouseMatch) {
                stock._totalQty += qty
                stock._totalCost += amount
                stock.stockQuantity = Number(stock._totalQty)
                stock.costPrice = stock._totalQty > 0 ? Number((stock._totalCost / stock._totalQty).toFixed(2)) : 0
                stock.totalValue = Number((stock.stockQuantity * stock.costPrice).toFixed(2))
              }
            }
          }
        }
      }
    }
  } catch {
    // ignore parsing errors
  }
  
  // 遍历 localStorage 中所有可能的出入库记录
  const inboundKeys = ['purchase_inbound_records', 'purchaseInbounds', 'inbound_records', 'inbounds', 'purchase_inbounds']
  const outboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'sales_outbounds', 'salesOutbounds', 'delivery_records']
  const purchaseReturnsKeys = ['purchaseReturns', 'purchase_returns', 'purchase_return_records']
  const salesReturnsKeys = ['salesReturns', 'sales_returns', 'sales_return_records']
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    if (key === 'inventory_transfers') continue // 调拨单已单独处理，跳过
    
    // 判断单据类型
    let isInbound = false
    let isOutbound = false
    let isPurchaseReturn = false  // 采购退货 = 负数入库
    let isSalesReturn = false     // 销售退货 = 负数出库
    
    if (inboundKeys.some(k => key.includes(k))) {
      isInbound = true
    } else if (outboundKeys.some(k => key.includes(k))) {
      isOutbound = true
    } else if (purchaseReturnsKeys.some(k => key.includes(k))) {
      isPurchaseReturn = true
    } else if (salesReturnsKeys.some(k => key.includes(k))) {
      isSalesReturn = true
    } else {
      continue
    }
    
    const raw = localStorage.getItem(key)
    if (!raw) continue
    
    try {
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) continue
      
      for (const rec of arr) {
        const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
        if (!Array.isArray(items)) continue
        
        // 获取单据的仓库 ID
        const recWarehouseId = rec.warehouseId
        const recWarehouseName = rec.warehouseName
        
        for (const it of items) {
          const itCode = String(it.productCode || it.code || it.sku || '').trim()
          const itName = String(it.productName || it.name || '').trim()
          const itId = it.productId || it.id || null
    
          // 匹配产品和仓库
          for (const [mapKey, stock] of stockMap.entries()) {
            // 检查仓库是否匹配 - 使用 Number() 转换确保类型一致
            const warehouseMatch = (recWarehouseId != null && Number(stock.warehouseId) === Number(recWarehouseId)) || 
                                  (recWarehouseName && stock.warehouseName === recWarehouseName)
            
            if (!warehouseMatch) continue
            
            // 匹配产品
            const match = (itId && stock.productId && itId === stock.productId) || 
                         (itCode && stock.productCode && itCode === stock.productCode) || 
                         (itName && stock.productName && itName === stock.productName)
            
            if (!match) continue
            
            const qty = Number(it.quantity || it.qty || it.count || it.num || 0)
            const unitPrice = Number(it.unitPrice || it.unitPriceInc || it.price || it.unit_price || 0)
            const amount = qty * unitPrice
            
            if (isInbound) {
              // 正常入库：增加库存
              stock._totalQty += qty
              stock._totalCost += amount
              stock.stockQuantity = Number(stock._totalQty)
              stock.costPrice = stock._totalQty > 0 ? Number((stock._totalCost / stock._totalQty).toFixed(2)) : 0
              stock.totalValue = Number((stock.stockQuantity * stock.costPrice).toFixed(2))
            } else if (isOutbound) {
              // 正常出库：减少库存
              stock._totalQty -= qty
              const outboundCost = stock.costPrice * qty
              stock._totalCost -= outboundCost
              stock.stockQuantity = Number(stock._totalQty)
              if (stock._totalQty > 0) {
                stock.costPrice = Number((stock._totalCost / stock._totalQty).toFixed(2))
              }
              stock.totalValue = Number((stock.stockQuantity * stock.costPrice).toFixed(2))
            } else if (isPurchaseReturn) {
              // 采购退货：负数入库（减少库存）
              stock._totalQty -= qty
              stock._totalCost -= amount
              stock.stockQuantity = Number(stock._totalQty)
              stock.costPrice = stock._totalQty > 0 ? Number((stock._totalCost / stock._totalQty).toFixed(2)) : 0
              stock.totalValue = Number((stock.stockQuantity * stock.costPrice).toFixed(2))
            } else if (isSalesReturn) {
              // 销售退货：负数出库（增加库存）
              stock._totalQty += qty
              stock._totalCost += amount
              stock.stockQuantity = Number(stock._totalQty)
              stock.costPrice = stock._totalQty > 0 ? Number((stock._totalCost / stock._totalQty).toFixed(2)) : 0
              stock.totalValue = Number((stock.stockQuantity * stock.costPrice).toFixed(2))
            }
          }
        }
      }
    } catch (e) {
      console.error(`解析 ${key} 失败:`, e)
    }
  }
  
  // 转换为数组并清理内部字段
  return Array.from(stockMap.values()).map(s => {
    const { _totalCost, _totalQty, ...rest } = s
    return rest
  })
}

const loadStock = () => {
  // 尝试读取产品列表
  const savedProducts = localStorage.getItem('products')
  const products = savedProducts ? JSON.parse(savedProducts) : [
    { id: 1, code: 'P001', name: '测试产品 A', unit: '个', costPrice: 10, specification: '规格 A' },
    { id: 2, code: 'P002', name: '测试产品 B', unit: '个', costPrice: 20, specification: '规格 B' }
  ]

  // 基于产品生成库存数据并计算
  const initialStock = products.map((p: any) => ({
    productCode: p.code,
    productName: p.name,
    specification: p.specification || p.spec || p.model || '',
    category: p.category || '-',
    warehouseName: '默认仓库',
    unit: p.unit || '-',
    warningQuantity: 0,
    productId: p.id
  }))
  
  allStock.value = calculateStockFromTransactions(initialStock)
  stockList.value = allStock.value.slice()
}

onMounted(() => {
  loadWarehouses()
  loadProducts()
  loadStock()
})
</script>

<style scoped>
.inventory-stock-page { 
  padding: 20px; 
}

.toolbar { 
  margin-bottom: 20px; 
}

/* 产品搜索下拉选项样式 */
.product-option {
  display: flex;
  align-items: center;
  gap: 12px;
}

.product-code {
  font-weight: 600;
  color: #409eff;
  min-width: 60px;
}

.product-name {
  color: #606266;
  flex: 1;
}

/* ==================== 遮罩层 ==================== */
.stock-detail-overlay {
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
.stock-detail-dialog {
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
.stock-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.stock-detail-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.stock-detail-close {
  font-size: 18px;
  color: #909399;
  cursor: pointer;
  transition: color 0.3s;
}

.stock-detail-close:hover {
  color: #606266;
}

/* ==================== 弹窗主体内容区 ==================== */
.stock-detail-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

/* ==================== ② 产品基础信息固定区 ==================== */
.stock-detail-info {
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

/* ==================== ③ 明细表格滚动区 ==================== */
.stock-detail-table-wrapper {
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

/* ==================== 表格列分组背景色 ==================== */
/* 入库数据区域 - 浅绿色背景 */
:deep(.el-table .inbound-col) {
  background-color: #f1f8e9 !important;
}

:deep(.el-table__header .inbound-col) {
  background-color: #dcedc8 !important;
  color: #388e3c !important;
  font-weight: 600;
}

/* 出库数据区域 - 浅红色背景 */
:deep(.el-table .outbound-col) {
  background-color: #ffebee !important;
}

:deep(.el-table__header .outbound-col) {
  background-color: #ffcdd2 !important;
  color: #c62828 !important;
  font-weight: 600;
}

/* 库存结余区域 - 浅蓝色背景 */
:deep(.el-table .stock-col) {
  background-color: #e3f2fd !important;
}

:deep(.el-table__header .stock-col) {
  background-color: #bbdefb !important;
  color: #1565c0 !important;
  font-weight: 600;
}

/* ==================== 底部关闭按钮固定区 ==================== */
.stock-detail-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
}
</style>
