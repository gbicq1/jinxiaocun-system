import { db } from '@/utils/db-ipc'

function normalizeCostParams(params: any): { year: number; month: number; productSearch?: string; warehouseId?: number } {
  let year: number, month: number

  const dateSource = params.periodRange || params.startDate
  if (dateSource) {
    const dateStr = Array.isArray(dateSource) ? dateSource[0] : String(dateSource)
    const parts = dateStr.split('-').map(Number)
    year = parts[0]
    month = parts[1]
  } else {
    const now = new Date()
    year = now.getFullYear()
    month = now.getMonth() + 1
  }

  return {
    year,
    month,
    productSearch: params.productSearch,
    warehouseId: params.warehouseId || params.warehouse
  }
}

/**
 * 获取成本结算数据
 */
export async function getCostSettlementList(params: any) {
  try {
    const normalizedParams = normalizeCostParams(params)
    console.log('成本结算 API 调用参数:', normalizedParams)
    
    // 直接使用 cost-settlement-query，参数更明确
    const result = await db.getCostSettlements(
      normalizedParams.year,
      normalizedParams.month,
      normalizedParams.productSearch,
      normalizedParams.warehouseId
    )
    
    console.log('成本结算 API 返回结果:', result)
    
    if (result && Array.isArray(result) && result.length > 0) {
      const formattedSettlements = result.map(item => ({
        productCode: item.product_code,
        productName: item.product_name,
        specification: item.specification || item.spec || '',
        unit: item.unit || '',
        warehouseId: item.warehouse_id,
        warehouseName: item.warehouse_name,
        openingQty: item.opening_qty || 0,
        openingCost: item.opening_cost || 0,
        inboundQty: item.inbound_qty || 0,
        inboundUnitPrice: item.inbound_unit_price || 0,
        inboundCost: item.inbound_cost || 0,
        outboundQty: item.outbound_qty || 0,
        outboundCost: item.outbound_cost || 0,
        avgCost: item.avg_cost || 0,
        avgPrice: item.avg_cost || 0,
        closingQty: item.closing_qty || 0,
        closingUnitPrice: item.closing_unit_price || 0,
        closingCost: item.closing_cost || 0
      }))
      console.log('格式化后的数据:', formattedSettlements.length, '条')
      return { success: true, data: formattedSettlements }
    }
    console.warn('无数据或结果不是数组:', result)
    return { success: false, message: '查询失败或无数据', data: [] }
  } catch (error) {
    console.error('获取成本结算列表失败:', error)
    return { success: false, message: '查询失败', data: [] }
  }
}

/**
 * 获取销售成本统计
 */
export async function getSalesCostSummary(params: any) {
  try {
    const normalizedParams = normalizeCostParams(params)
    const result = await db.getSalesCostSummary(normalizedParams)
    if (result && Array.isArray(result)) {
      const formattedSummary = result.map(item => ({
        productCode: item.product_code,
        productName: item.product_name,
        salesQty: item.sales_qty,
        salesReturnQty: item.sales_return_qty,
        netSalesQty: item.net_sales_qty,
        salesCost: item.sales_cost,
        salesReturnCost: item.sales_return_cost,
        netSalesCost: item.net_sales_cost,
        avgCost: item.avg_cost
      }))
      return { success: true, data: formattedSummary }
    }
    return { success: false, message: '查询失败或无数据', data: [] }
  } catch (error) {
    console.error('获取销售成本统计失败:', error)
    return { success: false, message: '查询失败', data: [] }
  }
}

/**
 * 获取调拨成本统计
 */
export async function getTransferCostSummary(params: any) {
  try {
    const normalizedParams = normalizeCostParams(params)
    const result = await db.getTransferCostSummary(normalizedParams)
    if (result && Array.isArray(result)) {
      const formattedSummary = result.map(item => ({
        productCode: item.product_code,
        productName: item.product_name,
        fromWarehouseName: item.from_warehouse_name,
        toWarehouseName: item.to_warehouse_name,
        transferOutQty: item.transfer_out_qty,
        transferInQty: item.transfer_in_qty,
        transferCost: item.transfer_cost
      }))
      return { success: true, data: formattedSummary }
    }
    return { success: false, message: '查询失败或无数据', data: [] }
  } catch (error) {
    console.error('获取调拨成本统计失败:', error)
    return { success: false, message: '查询失败', data: [] }
  }
}

/**
 * 获取出入库明细数据
 */
export async function getTransactionDetails(params: any) {
  try {
    const normalizedParams = normalizeCostParams(params)
    const result = await db.getTransactionDetails(normalizedParams)
    if (result && Array.isArray(result)) {
      const formattedDetails = result.map(item => ({
        docType: item.doc_type,
        docNo: item.doc_no,
        docDate: item.doc_date,
        counterName: item.counter_name || '-',
        warehouseName: item.warehouse_name,
        productCode: item.product_code,
        productName: item.product_name,
        inboundQty: item.inbound_qty,
        outboundQty: item.outbound_qty,
        unitPrice: item.unit_price,
        amount: item.amount
      }))
      return { success: true, data: formattedDetails }
    }
    return { success: false, message: '查询失败或无数据', data: [] }
  } catch (error) {
    console.error('获取出入库明细失败:', error)
    return { success: false, message: '查询失败', data: [] }
  }
}

/**
 * 初始化成本数据
 */
export async function initializeCostData() {
  try {
    const result = await db.initializeCostData({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
    if (result) {
      return { success: true, count: result.count, message: result.message }
    }
    return { success: false, message: '初始化失败' }
  } catch (error) {
    console.error('初始化成本数据失败:', error)
    return { success: false, message: '初始化失败' }
  }
}

/**
 * 反结算（单月）
 */
export async function reverseCostSettlement(params: any) {
  try {
    let year: number, month: number

    if (params.periodRange) {
      const [y, m] = params.periodRange.split('-').map(Number)
      year = y
      month = m
    } else if (params.startDate || params.month) {
      const monthStr = params.startDate || params.month
      if (!monthStr) {
        return { success: false, message: '请选择会计期间' }
      }
      const [y, m] = monthStr.split('-').map(Number)
      year = y
      month = m
    } else {
      return { success: false, message: '请选择会计期间' }
    }

    await db.unlockCostMonth(year, month)

    return { success: true, message: `${year}年${month}月反结算成功` }
  } catch (error: any) {
    console.error('反结算失败:', error)
    return { success: false, message: error.message || '反结算失败' }
  }
}

/**
 * 导出成本结算
 */
export async function exportCostSettlement(params: any) {
  // 导出功能由前端处理
  return getCostSettlementList(params)
}

/**
 * 获取成本明细
 */
export async function getCostDetail(params: any) {
  try {
    const result = await db.getTransactionDetails(params)
    if (result) {
      return { success: true, data: result }
    }
    return { success: false, message: '获取明细失败' }
  } catch (error) {
    console.error('获取成本明细失败:', error)
    return { success: false, message: '获取明细失败' }
  }
}

/**
 * 获取商品明细账（进销存明细）
 */
export async function getProductDetailLedger(params: any) {
  try {
    const result = await db.getProductDetailLedger(params)
    if (result.success) {
      const formattedLedger = result.data.map((item: any) => ({
        date: item.date,
        docType: item.docType,
        docNo: item.docNo,
        counterName: item.counterName,
        productCode: item.productCode,
        productName: item.productName,
        inboundQty: Number(item.inboundQty || 0),
        outboundQty: Number(item.outboundQty || 0),
        unitPrice: Number(item.unitPrice || 0),
        amount: Number(item.amount || 0),
        balanceQty: Number(item.balanceQty || 0),
        balanceAmount: Number(item.balanceAmount || 0),
        remark: item.remark || ''
      }))
      return { success: true, data: formattedLedger }
    }
    return { success: false, message: '获取明细账失败' }
  } catch (error) {
    console.error('获取商品明细账失败:', error)
    return { success: false, message: '获取明细账失败' }
  }
}