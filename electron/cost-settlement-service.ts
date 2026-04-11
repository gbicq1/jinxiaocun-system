/**
 * 月度成本自动结转服务
 * 负责计算和保存每月的成本结算数据
 * 所有数据从数据库读取，不使用 localStorage
 */

import { CostSettlementDatabase } from './database-cost'
import Database from 'better-sqlite3'

/**
 * 库存单据类型
 */
interface InventoryRecord {
  date: string
  type: 'inbound' | 'outbound'
  productCode: string
  warehouseId: number
  qty: number
  amount: number
}

/**
 * 月度成本结转服务
 */
export class MonthlyCostSettlementService {
  private costDb: CostSettlementDatabase
  private mainDb: Database.Database

  constructor(costDb: CostSettlementDatabase, mainDb: Database.Database) {
    this.costDb = costDb
    this.mainDb = mainDb
  }

  /**
   * 计算并结转指定月份的成本
   */
  settleMonth(year: number, month: number, lock: boolean = true): { 
    success: boolean
    count: number
    error?: string
    alreadySettled?: boolean
  } {
    try {
      console.log(`=== 开始结算 ${year}年${month}月 ===`)

      const isSettled = this.costDb.isSettled(year, month)
      console.log(`月份已结算状态：${isSettled}`)
      
      if (isSettled) {
        console.log(`  ⚠️ 月份已结算，无法重复计算`)
        return { 
          success: false, 
          count: 0, 
          error: `该期间（${year}年${month}月）已经进行成本结转，请勿重复操作。如需查看结转情况，请使用查询功能。`,
          alreadySettled: true
        }
      }

      const productWarehouseCombinations = this.getAllProductWarehouseCombinations()
      console.log(`产品仓库组合数量：${productWarehouseCombinations.length}`)
      productWarehouseCombinations.forEach(c => console.log(`  - ${c.productCode}(${c.productName}) @ ${c.warehouseId}(${c.warehouseName})`))

      const settlements: Array<{
        product_code: string
        product_name: string
        warehouse_id: number
        warehouse_name: string
        period_year: number
        period_month: number
        opening_qty: number
        opening_cost: number
        inbound_qty: number
        inbound_cost: number
        outbound_qty: number
        outbound_cost: number
        closing_qty: number
        closing_cost: number
        avg_cost: number
        is_locked: number
      }> = []

      for (const combo of productWarehouseCombinations) {
        const settlement = this.calculateSettlement(
          combo.productCode,
          combo.productName,
          combo.warehouseId,
          combo.warehouseName,
          year,
          month
        )
        if (settlement) {
          settlements.push({
            ...settlement,
            is_locked: lock ? 1 : 0
          })
        }
      }
      console.log(`最终 settlements 数量：${settlements.length}`)

      if (settlements.length > 0) {
        this.costDb.saveSettlements(settlements)
      }

      this.calculateAndSaveSalesCostSummary(year, month, lock)

      this.calculateAndSaveTransferCostSummary(year, month, lock)

      return { success: true, count: settlements.length }
    } catch (error) {
      console.error(`结算 ${year}年${month}月 失败:`, error)
      return { success: false, count: 0, error: String(error) }
    }
  }

  /**
   * 计算单个产品仓库的月度成本结算
   */
  private calculateSettlement(
    productCode: string,
    productName: string,
    warehouseId: number,
    warehouseName: string,
    year: number,
    month: number
  ) {
    // 从产品编码获取产品 ID
    const product = this.mainDb.prepare('SELECT id FROM products WHERE code = ?').get(productCode) as any
    if (!product) {
      console.error(`  产品编码 ${productCode} 不存在`)
      return null
    }
    const productId = product.id
    
    console.log(`  计算产品 ${productCode}(${productName}) [ID:${productId}] @ 仓库 ${warehouseId}(${warehouseName}) ${year}年${month}月 的成本`)
    
    // 1. 获取上月期末数据（作为本期期初）
    const openingData = this.getOpeningData(productId, warehouseId, year, month)

    // 2. 获取本月入库数据
    const inboundData = this.getInboundData(productId, warehouseId, year, month)

    // 3. 获取本月出库数据
    const outboundData = this.getOutboundData(productId, warehouseId, year, month)

    // 4. 计算期初可用数量和成本
    const availableQty = openingData.qty + inboundData.qty
    const availableCost = openingData.cost + inboundData.cost

    // 5. 计算加权平均单价（移动加权平均）
    const avgCost = availableQty > 0 ? availableCost / availableQty : 0

    // 6. 计算出库成本（使用加权平均单价）
    const outboundCost = outboundData.qty * avgCost

    // 7. 计算期末结存
    const closingQty = availableQty - outboundData.qty
    const closingCost = availableCost - outboundCost

    return {
      product_code: productCode,
      product_name: productName,
      warehouse_id: warehouseId,
      warehouse_name: warehouseName,
      period_year: year,
      period_month: month,
      opening_qty: openingData.qty,
      opening_cost: openingData.cost,
      inbound_qty: inboundData.qty,
      inbound_cost: inboundData.cost,
      outbound_qty: outboundData.qty,
      outbound_cost: outboundCost,
      closing_qty: closingQty,
      closing_cost: closingCost,
      avg_cost: Number(avgCost.toFixed(2))
    }
  }

  /**
   * 获取期初数据（上月期末）
   */
  private getOpeningData(productId: number, warehouseId: number, year: number, month: number): { qty: number; cost: number } {
    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth === 0) {
      prevYear = year - 1
      prevMonth = 12
    }

    console.log(`  查询期初数据 - 产品 ${productId}, 仓库 ${warehouseId}, 上月 ${prevYear}-${prevMonth}`)

    const product = this.mainDb.prepare('SELECT code FROM products WHERE id = ?').get(productId) as any
    const productCode = product?.code || String(productId)

    const prevSettlement = this.costDb.getSettlement(productCode, warehouseId, prevYear, prevMonth)

    if (prevSettlement) {
      console.log(`    找到上月期末：qty=${prevSettlement.closing_qty}, cost=${prevSettlement.closing_cost}`)
      return {
        qty: prevSettlement.closing_qty || 0,
        cost: prevSettlement.closing_cost || 0
      }
    }

    console.log(`    上月期末：qty=0, cost=0 (上月未结算)`)
    return { qty: 0, cost: 0 }
  }

  /**
   * 获取本月入库数据（从数据库读取）
   */
  private getInboundData(productId: number, warehouseId: number, year: number, month: number) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    let nextMonthYear = year
    let nextMonth = month + 1
    if (nextMonth > 12) {
      nextMonth = 1
      nextMonthYear = year + 1
    }
    const monthEnd = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`

    let totalQty = 0
    let totalCost = 0

    console.log(`  查询入库数据 - 产品 ${productId}, 仓库 ${warehouseId}, 期间 ${monthStart} ~ ${monthEnd}`)
    
    // 1. 采购入库（正数）
    const purchaseInboundSql = `
      SELECT
        ii.quantity,
        ii.total_amount_ex,
        ii.total_amount,
        ii.tax_rate,
        ii.allow_deduction,
        pi.invoice_type,
        pi.invoice_issued
      FROM purchase_inbound_items ii
      JOIN purchase_inbound pi ON ii.inbound_id = pi.id
      WHERE pi.warehouse_id = ?
        AND pi.inbound_date >= ?
        AND pi.inbound_date < ?
        AND ii.product_id = ?
    `
    const purchaseInboundItems = this.mainDb.prepare(purchaseInboundSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]
    console.log(`    采购入库记录数：${purchaseInboundItems.length}`)
    purchaseInboundItems.forEach(item => {
      totalQty += Number(item.quantity || 0)

      const isSpecialInvoice = (item.invoice_type === '专票' || item.invoice_type === '专用发票')
      const isInvoiceIssued = item.invoice_issued === 1 || item.invoice_issued === true
      const isTaxExempt = (Number(item.tax_rate || 0) === 0)
      const isDeductionAllowed = item.allow_deduction === 1 || item.allow_deduction === true

      let costAmount = 0
      if (isSpecialInvoice && isInvoiceIssued) {
        costAmount = Number(item.total_amount_ex || 0)
      } else if (isInvoiceIssued && isTaxExempt && isDeductionAllowed) {
        costAmount = Number(item.total_amount_ex || 0)
      } else {
        costAmount = Number(item.total_amount || 0)
      }

      totalCost += costAmount
    })

    // 2. 采购退货（负数）- 应用与采购入库完全相同的单价提取规则
    const purchaseReturnSql = `
      SELECT
        pri.quantity,
        CASE 
          WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.unit_price_ex
          WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.unit_price_ex
          ELSE ii.unit_price
        END as unit_price,
        CASE 
          WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.total_amount_ex
          WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.total_amount_ex
          ELSE ii.total_amount
        END as total_amount
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pri.return_id = pr.id
      LEFT JOIN purchase_inbound pi ON pr.original_inbound_no = pi.inbound_no
      LEFT JOIN purchase_inbound_items ii ON pi.id = ii.inbound_id AND pri.product_id = ii.product_id
        AND ii.id = (
          SELECT MIN(ii2.id) FROM purchase_inbound_items ii2
          WHERE ii2.inbound_id = pi.id AND ii2.product_id = pri.product_id
        )
      WHERE pr.warehouse_id = ?
        AND pr.return_date >= ?
        AND pr.return_date < ?
        AND pri.product_id = ?
    `
    const purchaseReturnItems = this.mainDb.prepare(purchaseReturnSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]
    purchaseReturnItems.forEach(item => {
      totalQty -= Number(item.quantity || 0)
      totalCost -= Number(item.total_amount || 0)
    })

    // 3. 调拨入库（正数）
    const transferInSql = `
      SELECT tri.quantity, tri.cost, tri.amount
      FROM transfer_record_items tri
      JOIN transfer_records tr ON tri.transfer_id = tr.id
      WHERE tr.to_warehouse_id = ?
        AND tr.transfer_date >= ?
        AND tr.transfer_date < ?
        AND tri.product_id = ?
    `
    const transferInItems = this.mainDb.prepare(transferInSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]
    transferInItems.forEach(item => {
      totalQty += Number(item.quantity || 0)
      totalCost += Number(item.amount || item.cost * item.quantity || 0)
    })

    console.log(`    入库结果：qty=${totalQty}, cost=${totalCost}`)
    return { qty: totalQty, cost: totalCost }
  }

  /**
   * 获取本月出库数据（从数据库读取）
   */
  private getOutboundData(productId: number, warehouseId: number, year: number, month: number) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    let nextMonthYear = year
    let nextMonth = month + 1
    if (nextMonth > 12) {
      nextMonth = 1
      nextMonthYear = year + 1
    }
    const monthEnd = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`

    let totalQty = 0

    console.log(`  查询出库数据 - 产品 ${productId}, 仓库 ${warehouseId}, 期间 ${monthStart} ~ ${monthEnd}`)

    // 1. 销售出库（正数）
    const salesOutboundSql = `
      SELECT soi.quantity
      FROM sales_outbound_items soi
      JOIN sales_outbound so ON soi.outbound_id = so.id
      WHERE so.warehouse_id = ?
        AND so.outbound_date >= ?
        AND so.outbound_date < ?
        AND soi.product_id = ?
    `
    const salesOutboundItems = this.mainDb.prepare(salesOutboundSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]
    console.log(`    销售出库记录数：${salesOutboundItems.length}`)
    salesOutboundItems.forEach(item => {
      totalQty += Number(item.quantity || 0)
    })

    // 2. 销售退货（负数）
    const salesReturnSql = `
      SELECT sri.quantity
      FROM sales_return_items sri
      JOIN sales_returns sr ON sri.return_id = sr.id
      WHERE sr.warehouse_id = ?
        AND sr.return_date >= ?
        AND sr.return_date < ?
        AND sri.product_id = ?
    `
    const salesReturnItems = this.mainDb.prepare(salesReturnSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]
    salesReturnItems.forEach(item => {
      totalQty -= Number(item.quantity || 0)
    })

    // 3. 调拨出库（正数）
    const transferOutSql = `
      SELECT tri.quantity
      FROM transfer_record_items tri
      JOIN transfer_records tr ON tri.transfer_id = tr.id
      WHERE tr.from_warehouse_id = ?
        AND tr.transfer_date >= ?
        AND tr.transfer_date < ?
        AND tri.product_id = ?
    `
    const transferOutItems = this.mainDb.prepare(transferOutSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]
    transferOutItems.forEach(item => {
      totalQty += Number(item.quantity || 0)
    })

    console.log(`    出库结果：qty=${totalQty}`)
    return { qty: totalQty, cost: 0 }
  }

  /**
   * 获取所有产品和仓库组合（从数据库读取）
   */
  private getAllProductWarehouseCombinations() {
    const combinations: Array<{
      productId: number
      productCode: string
      productName: string
      warehouseId: number
      warehouseName: string
    }> = []

    const products = this.mainDb.prepare('SELECT id, code, name FROM products WHERE status = 1').all() as any[]
    console.log(`查询到产品数量：${products.length}`)

    const warehouses = this.mainDb.prepare('SELECT id, name FROM warehouses WHERE status = 1').all() as any[]
    console.log(`查询到仓库数量：${warehouses.length}`)

    if (products.length === 0 || warehouses.length === 0) {
      return combinations
    }

    const sql = `
      SELECT DISTINCT product_id, warehouse_id
      FROM (
        SELECT product_id, warehouse_id FROM purchase_inbound_items ii
        JOIN purchase_inbound pi ON ii.inbound_id = pi.id
        UNION
        SELECT product_id, warehouse_id FROM sales_outbound_items soi
        JOIN sales_outbound so ON soi.outbound_id = so.id
        UNION
        SELECT product_id, warehouse_id FROM purchase_return_items pri
        JOIN purchase_returns pr ON pri.return_id = pr.id
        UNION
        SELECT product_id, warehouse_id FROM sales_return_items sri
        JOIN sales_returns sr ON sri.return_id = sr.id
        UNION
        SELECT product_id, from_warehouse_id as warehouse_id FROM transfer_record_items iti
        JOIN transfer_records it ON iti.transfer_id = it.id
        UNION
        SELECT product_id, to_warehouse_id as warehouse_id FROM transfer_record_items iti
        JOIN transfer_records it ON iti.transfer_id = it.id
      )
    `

    const usedCombinations = this.mainDb.prepare(sql).all() as any[]
    console.log('从单据表中查询到的产品仓库组合:', JSON.stringify(usedCombinations))
    
    const comboSet = new Set<string>()

    usedCombinations.forEach(combo => {
      const productId = Number(combo.product_id)
      const warehouseId = Number(combo.warehouse_id)
      
      if (!productId || !warehouseId) return

      const comboKey = `${productId}-${warehouseId}`
      if (comboSet.has(comboKey)) return
      
      comboSet.add(comboKey)

      // 确保 product_id 在 products 表中存在
      const product = this.mainDb.prepare('SELECT id, code, name FROM products WHERE id = ? AND status = 1').get(productId) as any
      const warehouse = this.mainDb.prepare('SELECT id, name FROM warehouses WHERE id = ? AND status = 1').get(warehouseId) as any

      if (product && warehouse) {
        combinations.push({
          productId: Number(productId),
          productCode: product.code,
          productName: product.name || '',
          warehouseId: Number(warehouseId),
          warehouseName: warehouse.name || ''
        })
      } else {
        console.log(`  ❌ 跳过无效的产品仓库组合：product_id=${productId} (不存在或已停用), warehouse_id=${warehouseId}`)
      }
    })

    console.log(`最终产品仓库组合数量：${combinations.length}`)
    return combinations
  }

  /**
   * 重新结算从指定月份到当前的所有月份
   */
  recalculateFromMonth(year: number, month: number): { success: boolean; message: string } {
    try {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      let y = year
      let m = month
      while (y < currentYear || (y === currentYear && m <= currentMonth)) {
        this.costDb.unlockSettlement(y, m)
        
        m++
        if (m > 12) {
          m = 1
          y++
        }
      }

      y = year
      m = month
      let totalCount = 0
      while (y < currentYear || (y === currentYear && m <= currentMonth)) {
        const result = this.settleMonth(y, m, true)
        if (!result.success) {
          return { success: false, message: `结算 ${y}年${m}月 失败：${result.error}` }
        }
        totalCount += result.count

        m++
        if (m > 12) {
          m = 1
          y++
        }
      }

      return { success: true, message: `成功重新结算 ${totalCount} 条记录` }
    } catch (error) {
      console.error('重新结算失败:', error)
      return { success: false, message: String(error) }
    }
  }

  /**
   * 自动补全所有历史月份的结算数据
   */
  autoCompleteHistory(): { success: boolean; message: string; settledMonths: number } {
    try {
      const firstDocumentDate = this.getFirstDocumentDate()
      if (!firstDocumentDate) {
        return { success: true, message: '没有业务数据', settledMonths: 0 }
      }

      const firstYear = firstDocumentDate.getFullYear()
      const firstMonth = firstDocumentDate.getMonth() + 1

      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      let prevYear = currentYear
      let prevMonth = currentMonth - 1
      if (prevMonth === 0) {
        prevYear = currentYear - 1
        prevMonth = 12
      }

      let y = firstYear
      let m = firstMonth
      let settledCount = 0
      let skippedCount = 0

      while (y < prevYear || (y === prevYear && m <= prevMonth)) {
        if (this.costDb.isSettled(y, m)) {
          skippedCount++
        } else {
          const result = this.settleMonth(y, m, true)
          if (result.success) {
            settledCount++
          } else {
            console.error(`  ✗ 结算失败：${result.error}`)
          }
        }

        m++
        if (m > 12) {
          m = 1
          y++
        }
      }

      const message = `完成！结算 ${settledCount} 个月，跳过 ${skippedCount} 个月`
      return { success: true, message, settledMonths: settledCount }
    } catch (error) {
      console.error('自动补全历史月份失败:', error)
      return { success: false, message: String(error), settledMonths: 0 }
    }
  }

  /**
   * 计算并保存销售成本统计
   */
  private calculateAndSaveSalesCostSummary(year: number, month: number, lock: boolean) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    let nextMonthYear = year
    let nextMonth = month + 1
    if (nextMonth > 12) {
      nextMonth = 1
      nextMonthYear = year + 1
    }
    const monthEnd = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`

    const salesOutbounds = this.mainDb.prepare(`
      SELECT 
        so.id as doc_id,
        so.outbound_no as doc_no,
        p.code as product_code,
        p.name as product_name,
        w.id as warehouse_id,
        w.name as warehouse_name,
        soi.quantity as qty,
        soi.unit_price as unit_price,
        soi.total_amount as amount,
        so.outbound_date as date
      FROM sales_outbound_items soi
      JOIN sales_outbound so ON soi.outbound_id = so.id
      JOIN products p ON soi.product_id = p.id
      JOIN warehouses w ON so.warehouse_id = w.id
      WHERE so.outbound_date >= ? AND so.outbound_date < ?
        AND so.status != 'deleted'
    `).all(monthStart, monthEnd) as any[]

    for (const item of salesOutbounds) {
      const avgCost = this.getAvgCostAtDate(item.product_code, item.warehouse_id, item.date)
      const costAmount = Number(item.qty || 0) * avgCost

      this.costDb.saveSalesCostItem({
        doc_type: 'sales_outbound',
        doc_id: item.doc_id,
        doc_no: item.doc_no,
        product_code: item.product_code,
        product_name: item.product_name,
        warehouse_id: item.warehouse_id,
        warehouse_name: item.warehouse_name,
        quantity: item.qty,
        unit_price: item.unit_price,
        sales_amount: item.amount,
        cost_unit_price: avgCost,
        cost_amount: costAmount,
        profit_amount: Number(item.amount || 0) - costAmount,
        date: item.date,
        period_year: year,
        period_month: month,
        is_locked: lock ? 1 : 0
      })
    }
  }

  /**
   * 计算并保存调拨成本统计
   */
  private calculateAndSaveTransferCostSummary(year: number, month: number, lock: boolean) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    let nextMonthYear = year
    let nextMonth = month + 1
    if (nextMonth > 12) {
      nextMonth = 1
      nextMonthYear = year + 1
    }
    const monthEnd = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`

    const transfers = this.mainDb.prepare(`
      SELECT 
        tr.id as doc_id,
        tr.transfer_no as doc_no,
        p.code as product_code,
        p.name as product_name,
        wf.id as from_warehouse_id,
        wf.name as from_warehouse_name,
        wt.id as to_warehouse_id,
        wt.name as to_warehouse_name,
        tri.quantity as qty,
        tri.cost as unit_cost,
        tri.amount as cost_amount,
        tr.transfer_date as date
      FROM transfer_record_items tri
      JOIN transfer_records tr ON tri.transfer_id = tr.id
      JOIN products p ON tri.product_id = p.id
      JOIN warehouses wf ON tr.from_warehouse_id = wf.id
      JOIN warehouses wt ON tr.to_warehouse_id = wt.id
      WHERE tr.transfer_date >= ? AND tr.transfer_date < ?
        AND tr.status != 'deleted'
    `).all(monthStart, monthEnd) as any[]

    for (const item of transfers) {
      this.costDb.saveTransferCostItem({
        doc_type: 'transfer',
        doc_id: item.doc_id,
        doc_no: item.doc_no,
        product_code: item.product_code,
        product_name: item.product_name,
        from_warehouse_id: item.from_warehouse_id,
        from_warehouse_name: item.from_warehouse_name,
        to_warehouse_id: item.to_warehouse_id,
        to_warehouse_name: item.to_warehouse_name,
        quantity: item.qty,
        unit_cost: item.unit_cost,
        cost_amount: item.cost_amount || (item.unit_cost * item.qty),
        date: item.date,
        period_year: year,
        period_month: month,
        is_locked: lock ? 1 : 0
      })
    }
  }

  /**
   * 获取指定日期的加权平均成本
   */
  getAvgCostAtDate(productCode: string, warehouseId: number, date: string): number {
    const product = this.mainDb.prepare('SELECT id FROM products WHERE code = ?').get(productCode) as any
    if (!product) return 0
    const productId = product.id

    const year = parseInt(date.split('-')[0])
    const month = parseInt(date.split('-')[1])

    const settlement = this.costDb.getSettlement(productId, warehouseId, year, month)
    if (settlement && settlement.avg_cost) {
      return settlement.avg_cost
    }

    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth === 0) {
      prevYear = year - 1
      prevMonth = 12
    }

    const prevSettlement = this.costDb.getSettlement(productId, warehouseId, prevYear, prevMonth)
    if (prevSettlement && prevSettlement.avg_cost) {
      return prevSettlement.avg_cost
    }

    return 0
  }

  /**
   * 获取系统最早的单据日期
   */
  private getFirstDocumentDate(): Date | null {
    const result = this.mainDb.prepare(`
      SELECT MIN(date) as min_date FROM (
        SELECT MIN(inbound_date) as date FROM purchase_inbound WHERE status != 'deleted'
        UNION ALL
        SELECT MIN(outbound_date) as date FROM sales_outbound WHERE status != 'deleted'
        UNION ALL
        SELECT MIN(return_date) as date FROM purchase_returns WHERE status != 'deleted'
        UNION ALL
        SELECT MIN(return_date) as date FROM sales_returns WHERE status != 'deleted'
        UNION ALL
        SELECT MIN(transfer_date) as date FROM transfer_records WHERE status != 'deleted'
      )
    `).get() as any

    if (result && result.min_date) {
      return new Date(result.min_date)
    }
    return null
  }
}
