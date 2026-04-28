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
      try { console.log(`=== 开始结算 ${year}年${month}月 ===`) } catch {}

      const isSettled = this.costDb.isSettled(year, month)
      try { console.log(`月份已结算状态：${isSettled}`) } catch {}

      if (isSettled) {
        try { console.log(`  ⚠️ 月份已结算，无法重复计算`) } catch {}
        return { 
          success: false, 
          count: 0, 
          error: `该期间（${year}年${month}月）已经进行成本结转，请勿重复操作。如需查看结转情况，请使用查询功能。`,
          alreadySettled: true
        }
      }

      // 如果是点击月份卡片（不锁定），确保前一个月已计算
      if (!lock) {
        this.ensurePreviousMonthCalculated(year, month)
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
        
        // 如果 lock 为 true，保存后锁定该月份
        if (lock) {
          this.costDb.lockSettlement(year, month)
          console.log(`  ✓ 已锁定 ${year}年${month}月`)
        }
      }

      this.calculateAndSaveSalesCostSummary(year, month, lock)

      this.calculateAndSaveTransferCostSummary(year, month, lock)

      console.log(`✓ ${year}年${month}月 成本结算全部完成（含销售成本和调拨成本）`)
      
      return { success: true, count: settlements.length }
    } catch (error) {
      console.error(`结算 ${year}年${month}月 失败:`, error)
      return { success: false, count: 0, error: String(error) }
    }
  }

  /**
   * 确保前一个月已计算（用于不锁定模式）
   * 递归检查并计算从年度第一个月到当前月份的所有月份
   */
  private ensurePreviousMonthCalculated(year: number, month: number): void {
    let prevMonth = month - 1
    let prevYear = year

    if (prevMonth === 0) {
      prevMonth = 12
      prevYear = year - 1
    }
    
    const hasPreviousData = this.costDb.checkSettlementExists(prevYear, prevMonth)
    
    if (!hasPreviousData) {
      console.log(`  前一个月 (${prevYear}年${prevMonth}月) 未计算，先计算前一个月`)
      this.settleMonth(prevYear, prevMonth, false)
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
        AND pi.status != 'deleted'
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

    // 2. 采购退货（负数）- 按退货数量占原入库数量的比例计算成本
    // 当无法关联原入库单时，使用退货单自身的价格字段作为回退
    const purchaseReturnSql = `
      SELECT
        pri.quantity,
        pri.unit_price as return_unit_price,
        pri.unit_price_ex as return_unit_price_ex,
        pri.total_amount as return_total_amount,
        pri.total_amount_ex as return_total_amount_ex,
        pr.invoice_type as return_invoice_type,
        pr.invoice_issued as return_invoice_issued,
        pri.tax_rate as return_tax_rate,
        pri.allow_deduction as return_allow_deduction,
        CASE 
          WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.unit_price_ex
          WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.unit_price_ex
          ELSE ii.unit_price
        END as unit_price,
        ii.quantity as inbound_qty,
        CASE 
          WHEN (pi.invoice_type = '专票' OR pi.invoice_type = '专用发票') AND (pi.invoice_issued = 1 OR pi.invoice_issued = true) THEN ii.total_amount_ex
          WHEN (pi.invoice_issued = 1 OR pi.invoice_issued = true) AND (ii.tax_rate = 0 OR ii.tax_rate IS NULL OR ii.tax_rate = '0%') AND (ii.allow_deduction = 1 OR ii.allow_deduction = true) THEN ii.total_amount_ex
          ELSE ii.total_amount
        END as inbound_total_amount
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
        AND pr.status != 'deleted'
    `
    const purchaseReturnItems = this.mainDb.prepare(purchaseReturnSql).all(
      warehouseId, monthStart, monthEnd, productId
    ) as any[]
    console.log(`    采购退货记录数：${purchaseReturnItems.length}`)
    purchaseReturnItems.forEach(item => {
      const returnQty = Number(item.quantity || 0)
      const inboundQty = Number(item.inbound_qty || 0)
      const inboundTotalAmt = Number(item.inbound_total_amount || 0)

      let costAmt = 0
      if (inboundQty > 0 && inboundTotalAmt > 0) {
        costAmt = inboundTotalAmt * (returnQty / inboundQty)
      } else {
        const retIsSpecialInvoice = (item.return_invoice_type === '专票' || item.return_invoice_type === '专用发票')
        const retIsInvoiceIssued = item.return_invoice_issued === 1 || item.return_invoice_issued === true
        const retIsTaxExempt = (Number(item.return_tax_rate || 0) === 0)
        const retIsDeductionAllowed = item.return_allow_deduction === 1 || item.return_allow_deduction === true
        const useExPrice = (retIsSpecialInvoice && retIsInvoiceIssued) || (retIsInvoiceIssued && retIsTaxExempt && retIsDeductionAllowed)

        if (useExPrice) {
          const fallbackAmount = Number(item.return_total_amount_ex || 0)
          const fallbackPrice = Number(item.return_unit_price_ex || 0)
          if (fallbackAmount > 0) {
            costAmt = fallbackAmount * (returnQty / (Math.abs(returnQty) || 1))
          } else if (fallbackPrice > 0) {
            costAmt = Math.abs(returnQty) * fallbackPrice
          }
        } else {
          const fallbackAmount = Number(item.return_total_amount || 0)
          const fallbackPrice = Number(item.return_unit_price || 0)
          if (fallbackAmount > 0) {
            costAmt = fallbackAmount * (returnQty / (Math.abs(returnQty) || 1))
          } else if (fallbackPrice > 0) {
            costAmt = Math.abs(returnQty) * fallbackPrice
          }
        }
      }

      totalQty -= returnQty
      totalCost -= costAmt
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
        AND tr.status != 'deleted'
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
        AND so.status != 'deleted'
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
        AND sr.status != 'deleted'
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
        AND tr.status != 'deleted'
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
   * 计算并保存销售成本统计（只包括销售出库和销售退货，不包括调拨）
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

    console.log(`[销售成本统计] 开始计算 ${year}年${month}月 销售成本数据...`)

    // 0. 先删除当月的旧数据（重新计算）
    try {
      this.costDb.deleteSalesCostItemsByPeriod(year, month)
      console.log(`[销售成本统计] 已删除 ${year}年${month}月 的旧数据`)
    } catch (error) {
      console.error('[销售成本统计] 删除旧数据失败:', error)
    }

    // 1. 获取销售出库数据（正数）
    // 规则：直接提取数据库中的不含税价和含税价字段
    const salesOutbounds = this.mainDb.prepare(`
      SELECT 
        so.id as doc_id,
        so.outbound_no as doc_no,
        p.code as product_code,
        p.name as product_name,
        w.id as warehouse_id,
        w.name as warehouse_name,
        soi.quantity as qty,
        soi.unit_price_ex as unit_price_ex,
        soi.unit_price as unit_price_incl,
        soi.tax_rate as tax_rate,
        soi.tax_amount as tax_amount,
        soi.total_amount as amount,
        soi.total_amount_ex as amount_ex,
        so.outbound_date as date
      FROM sales_outbound_items soi
      JOIN sales_outbound so ON soi.outbound_id = so.id
      JOIN products p ON soi.product_id = p.id
      JOIN warehouses w ON so.warehouse_id = w.id
      WHERE so.outbound_date >= ? AND so.outbound_date < ?
        AND so.status != 'deleted'
    `).all(monthStart, monthEnd) as any[]

    console.log(`[销售成本统计] 销售出库数据共 ${salesOutbounds.length} 条`)
    console.log('[销售成本统计] 销售出库示例数据:', salesOutbounds[0])
    console.log('[销售成本统计] 出库数据详情:')
    salesOutbounds.forEach(item => {
      console.log(`  单号：${item.doc_no}`)
      console.log(`    数量：${item.qty}`)
      console.log(`    unit_price_ex (不含税单价): ${item.unit_price_ex}`)
      console.log(`    unit_price (含税单价): ${item.unit_price_incl}`)
      console.log(`    tax_rate: ${item.tax_rate}`)
      console.log(`    tax_amount: ${item.tax_amount}`)
      console.log(`    total_amount (含税金额): ${item.amount}`)
      console.log(`    total_amount_ex (不含税金额): ${item.amount_ex}`)
      console.log('---')
    })

    for (const item of salesOutbounds) {
      const avgCost = this.getAvgCostAtDate(item.product_code, item.warehouse_id, item.date)
      const costAmount = Number(item.qty || 0) * avgCost
      
      // 直接使用数据库字段，如果为 0 则从含税单价和税率反推
      let unitPriceEx = Number(item.unit_price_ex || 0)
      const unitPriceIncl = Number(item.unit_price_incl || 0)
      const taxRate = Number(item.tax_rate || 0)
      
      // 如果不含税单价为 0，从含税单价和税率反推
      if (unitPriceEx === 0 && unitPriceIncl > 0) {
        if (taxRate > 0) {
          unitPriceEx = unitPriceIncl / (1 + taxRate / 100)
        } else {
          unitPriceEx = unitPriceIncl  // 无税率时，不含税=含税
        }
      }
      
      // amount = 含税金额，amount_ex = 不含税金额
      let salesAmount = Number(item.amount || 0)
      let salesAmountEx = Number(item.amount_ex || 0)
      
      // 如果不含税金额为 0，从数量*不含税单价计算
      if (salesAmountEx === 0 && unitPriceEx > 0) {
        salesAmountEx = Number(item.qty || 0) * unitPriceEx
      }
      
      // 如果含税金额为 0，从数量*含税单价计算
      if (salesAmount === 0 && unitPriceIncl > 0) {
        salesAmount = Number(item.qty || 0) * unitPriceIncl
      }

      console.log(`[销售出库] ${item.doc_no}: qty=${item.qty}, unitPriceEx=${unitPriceEx}, unitPriceIncl=${unitPriceIncl}, taxRate=${taxRate}, amount=${salesAmount}, amount_ex=${salesAmountEx}`)

      this.costDb.saveSalesCostItem({
        doc_type: 'sales_outbound',
        doc_id: item.doc_id,
        doc_no: item.doc_no,
        product_code: item.product_code,
        product_name: item.product_name,
        warehouse_id: item.warehouse_id,
        warehouse_name: item.warehouse_name,
        quantity: item.qty,
        unit_price_ex: unitPriceEx,
        unit_price: unitPriceIncl,
        tax_amount: item.tax_amount,
        sales_amount_ex: salesAmountEx,
        sales_amount: salesAmount,
        cost_unit_price: avgCost,
        cost_amount: costAmount,
        profit_amount: salesAmountEx - costAmount,
        date: item.date,
        period_year: year,
        period_month: month,
        is_locked: lock ? 1 : 0
      })
    }

    // 2. 获取销售退货数据（负数，作为销售的抵减）
    // 规则：退货单价优先从对应的销售出库记录获取（通过 original_order_no 匹配），其次使用退货单自身字段
    const salesReturns = this.mainDb.prepare(`
      WITH return_outbound_prices AS (
        SELECT
          o.outbound_no,
          oi.product_id,
          oi.unit_price_ex,
          oi.unit_price,
          oi.tax_amount as outbound_tax_amount,
          oi.quantity as outbound_qty
        FROM sales_outbound_items oi
        JOIN sales_outbound o ON oi.outbound_id = o.id
        WHERE o.outbound_date >= ? AND o.outbound_date < ?
          AND o.status != 'deleted'
      )
      SELECT 
        sr.id as doc_id,
        sr.return_no as doc_no,
        p.code as product_code,
        p.name as product_name,
        w.id as warehouse_id,
        w.name as warehouse_name,
        sri.quantity as qty,
        COALESCE(rop.unit_price_ex, sri.unit_price_ex, sri.unit_price) as unit_price_ex,
        COALESCE(rop.unit_price, sri.unit_price, sri.unit_price_incl) as unit_price_incl,
        COALESCE(rop.unit_price_ex, sri.unit_price_ex, sri.unit_price) * sri.quantity as amount_ex,
        COALESCE(rop.unit_price, sri.unit_price, sri.unit_price_incl) * sri.quantity as amount,
        CASE
          WHEN rop.outbound_qty > 0 THEN rop.outbound_tax_amount * 1.0 * sri.quantity / rop.outbound_qty
          ELSE sri.tax_amount
        END as tax_amount,
        sr.return_date as date
      FROM sales_return_items sri
      JOIN sales_returns sr ON sri.return_id = sr.id
      JOIN products p ON sri.product_id = p.id
      JOIN warehouses w ON sr.warehouse_id = w.id
      LEFT JOIN return_outbound_prices rop ON rop.outbound_no = sr.original_order_no
        AND rop.product_id = sri.product_id
      WHERE sr.return_date >= ? AND sr.return_date < ?
        AND sr.status != 'deleted'
    `).all(monthStart, monthEnd, monthStart, monthEnd) as any[]

    console.log(`[销售成本统计] 销售退货数据共 ${salesReturns.length} 条`)
    console.log('[销售成本统计] 销售退货示例数据:', salesReturns[0])
    console.log('[销售成本统计] 退货数据详情:', JSON.stringify(salesReturns.map(item => ({
      doc_no: item.doc_no,
      unit_price_ex: item.unit_price_ex,
      unit_price_incl: item.unit_price_incl,
      amount_ex: item.amount_ex,
      amount: item.amount,
      tax_amount: item.tax_amount
    })), null, 2))

    for (const item of salesReturns) {
      const avgCost = this.getAvgCostAtDate(item.product_code, item.warehouse_id, item.date)
      // 销售退货：数量和金额为负数
      const negativeQty = -Math.abs(Number(item.qty || 0))
      const costAmount = negativeQty * avgCost
      // 直接使用数据库字段，金额取负数
      const salesAmountEx = -Math.abs(Number(item.amount_ex || 0))
      const salesAmount = -Math.abs(Number(item.amount || 0))
      // 使用数据库的不含税单价和含税单价
      const unitPriceEx = Number(item.unit_price_ex || 0)
      const unitPriceIncl = Number(item.unit_price_incl || 0)
      
      console.log(`[销售退货] ${item.doc_no}: qty=${item.qty}, unitPriceEx=${unitPriceEx}, unitPriceIncl=${unitPriceIncl}, amount_ex=${item.amount_ex}, amount=${item.amount}, salesAmountEx=${salesAmountEx}`)

      this.costDb.saveSalesCostItem({
        doc_type: 'sales_return',
        doc_id: item.doc_id,
        doc_no: item.doc_no,
        product_code: item.product_code,
        product_name: item.product_name,
        warehouse_id: item.warehouse_id,
        warehouse_name: item.warehouse_name,
        quantity: negativeQty,
        unit_price_ex: unitPriceEx,
        unit_price: unitPriceIncl,
        tax_amount: -Math.abs(Number(item.tax_amount || 0)),
        sales_amount_ex: salesAmountEx,
        sales_amount: salesAmount,
        cost_unit_price: avgCost,
        cost_amount: costAmount,
        profit_amount: salesAmountEx - costAmount,
        date: item.date,
        period_year: year,
        period_month: month,
        is_locked: lock ? 1 : 0
      })
    }

    console.log(`[销售成本统计] ${year}年${month}月 销售成本计算完成`)
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

    // 0. 先删除当月的旧数据（重新计算）
    try {
      this.costDb.deleteTransferCostItemsByPeriod(year, month)
      console.log(`[调拨成本统计] 已删除 ${year}年${month}月 的旧数据`)
    } catch (error) {
      console.error('[调拨成本统计] 删除旧数据失败:', error)
    }

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
    console.log(`[getAvgCostAtDate] 查询成本: product=${productCode}, warehouse=${warehouseId}, date=${date}`)
    
    const year = parseInt(date.split('-')[0])
    const month = parseInt(date.split('-')[1])

    // ✅ 修复：直接使用 productCode（如 'p01'），而不是 productId
    const settlement = this.costDb.getSettlement(productCode, warehouseId, year, month)
    console.log(`[getAvgCostAtDate] 当月结算:`, settlement ? { avg_cost: settlement.avg_cost } : '未找到')
    
    if (settlement && settlement.avg_cost) {
      return settlement.avg_cost
    }

    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth === 0) {
      prevYear = year - 1
      prevMonth = 12
    }

    const prevSettlement = this.costDb.getSettlement(productCode, warehouseId, prevYear, prevMonth)
    console.log(`[getAvgCostAtDate] 上月结算:`, prevSettlement ? { avg_cost: prevSettlement.avg_cost } : '未找到')
    
    if (prevSettlement && prevSettlement.avg_cost) {
      return prevSettlement.avg_cost
    }

    console.warn(`[getAvgCostAtDate] 未找到 ${productCode} 在 ${date} 的成本数据`)
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
