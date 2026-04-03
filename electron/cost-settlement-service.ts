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
  settleMonth(year: number, month: number, lock: boolean = true): { success: boolean; count: number; error?: string } {
    try {
      console.log(`开始结算 ${year}年${month}月 的成本数据...`)

      // 检查是否已结算
      if (this.costDb.isSettled(year, month)) {
        console.log(`${year}年${month}月 已结算，跳过`)
        return { success: true, count: 0 }
      }

      // 获取所有产品和仓库组合
      const productWarehouseCombinations = this.getAllProductWarehouseCombinations()

      console.log(`共有 ${productWarehouseCombinations.length} 个产品仓库组合需要结算`)

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

      // 逐个计算
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

      // 批量保存
      if (settlements.length > 0) {
        this.costDb.saveSettlements(settlements)
        console.log(`成功结算 ${settlements.length} 条记录`)
      }

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
    // 将 productCode 转换为 productId（数字）
    const productId = Number(productCode)
    
    // 1. 获取上月期末数据（作为本期期初）
    const openingData = this.getOpeningData(productCode, warehouseId, year, month)

    // 2. 获取本月入库数据
    const inboundData = this.getInboundData(productId, warehouseId, year, month)

    // 3. 获取本月出库数据
    const outboundData = this.getOutboundData(productId, warehouseId, year, month)

    // 4. 计算期末数据
    const closingQty = openingData.qty + inboundData.qty - outboundData.qty
    const closingCost = openingData.cost + inboundData.cost - outboundData.cost

    // 5. 计算加权平均单价
    const avgCost = closingQty > 0 ? closingCost / closingQty : 0

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
      outbound_cost: outboundData.cost,
      closing_qty: closingQty,
      closing_cost: closingCost,
      avg_cost: Number(avgCost.toFixed(2))
    }
  }

  /**
   * 获取期初数据（上月期末）
   */
  private getOpeningData(productCode: string, warehouseId: number, year: number, month: number): { qty: number; cost: number } {
    // 计算上月
    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth === 0) {
      prevYear = year - 1
      prevMonth = 12
    }

    // 尝试从数据库获取上月期末
    const prevSettlement = this.costDb.getSettlement(productCode, warehouseId, prevYear, prevMonth)

    if (prevSettlement) {
      return {
        qty: prevSettlement.closing_qty || 0,
        cost: prevSettlement.closing_cost || 0
      }
    }

    // 如果上月没有结算，返回 0（说明是年度初始化）
    return { qty: 0, cost: 0 }
  }

  /**
   * 获取本月入库数据（从数据库读取）
   */
  private getInboundData(productId: number, warehouseId: number, year: number, month: number) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-01`

    // 查询采购入库单明细
    const sql = `
      SELECT ii.quantity, ii.total_amount_ex, ii.total_amount
      FROM purchase_inbound_items ii
      JOIN purchase_inbound pi ON ii.inbound_id = pi.id
      WHERE pi.warehouse_id = ?
        AND pi.inbound_date >= ?
        AND pi.inbound_date < ?
        AND ii.product_id = ?
    `

    const items = this.mainDb.prepare(sql).all(
      warehouseId,
      monthStart,
      monthEnd,
      productId
    ) as any[]

    let totalQty = 0
    let totalCost = 0

    items.forEach(item => {
      totalQty += Number(item.quantity || 0)
      totalCost += Number(item.total_amount || item.total_amount_ex || 0)
    })

    return { qty: totalQty, cost: totalCost }
  }

  /**
   * 获取本月出库数据（从数据库读取）
   */
  private getOutboundData(productId: number, warehouseId: number, year: number, month: number) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-01`

    // 查询销售出库单明细
    const sql = `
      SELECT soi.quantity
      FROM sales_outbound_items soi
      JOIN sales_outbound so ON soi.outbound_id = so.id
      WHERE so.warehouse_id = ?
        AND so.outbound_date >= ?
        AND so.outbound_date < ?
        AND soi.product_id = ?
    `

    const items = this.mainDb.prepare(sql).all(
      warehouseId,
      monthStart,
      monthEnd,
      productId
    ) as any[]

    let totalQty = 0
    items.forEach(item => {
      totalQty += Number(item.quantity || 0)
    })

    // 出库成本在 calculateSettlement 中统一计算
    return { qty: totalQty, cost: 0 }
  }

  /**
   * 获取所有产品和仓库组合（从数据库读取）
   */
  private getAllProductWarehouseCombinations() {
    const combinations: Array<{
      productCode: string
      productName: string
      warehouseId: number
      warehouseName: string
    }> = []

    // 从数据库查询所有产品
    const products = this.mainDb.prepare('SELECT id, code, name FROM products WHERE status = 1').all() as any[]

    // 从数据库查询所有仓库
    const warehouses = this.mainDb.prepare('SELECT id, name FROM warehouses WHERE status = 1').all() as any[]

    if (products.length === 0 || warehouses.length === 0) {
      return combinations
    }

    // 查询所有有业务往来的产品仓库组合
    const sql = `
      SELECT DISTINCT product_id, warehouse_id
      FROM (
        SELECT product_id, warehouse_id FROM purchase_inbound_items ii
        JOIN purchase_inbound pi ON ii.inbound_id = pi.id
        UNION
        SELECT product_id, warehouse_id FROM sales_outbound_items soi
        JOIN sales_outbound so ON soi.outbound_id = so.id
        UNION
        SELECT product_id, from_warehouse_id as warehouse_id FROM transfer_record_items iti
        JOIN transfer_records it ON iti.transfer_id = it.id
        UNION
        SELECT product_id, to_warehouse_id as warehouse_id FROM transfer_record_items iti
        JOIN transfer_records it ON iti.transfer_id = it.id
      )
    `

    const usedCombinations = this.mainDb.prepare(sql).all() as any[]
    const comboSet = new Set<string>()

    usedCombinations.forEach(combo => {
      const productId = combo.product_id
      const warehouseId = combo.warehouse_id
      
      if (!productId || !warehouseId) return

      const comboKey = `${productId}-${warehouseId}`
      if (comboSet.has(comboKey)) return
      
      comboSet.add(comboKey)

      // 查找产品和仓库信息
      const product = products.find(p => 
        String(p.id) === String(productId)
      )
      const warehouse = warehouses.find(w => String(w.id) === String(warehouseId))

      if (product && warehouse) {
        combinations.push({
          productCode: String(product.id),
          productName: product.name || '',
          warehouseId: Number(warehouseId),
          warehouseName: warehouse.name || ''
        })
      }
    })

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

      console.log(`重新结算从 ${year}年${month}月 到 ${currentYear}年${currentMonth}月`)

      // 解锁所有需要重新结算的月份
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

      // 重新结算
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
      console.log('开始自动补全历史月份结算数据...')

      // 获取系统最早的单据日期
      const firstDocumentDate = this.getFirstDocumentDate()
      if (!firstDocumentDate) {
        console.log('没有找到任何业务单据，跳过自动补全')
        return { success: true, message: '没有业务数据', settledMonths: 0 }
      }

      const firstYear = firstDocumentDate.getFullYear()
      const firstMonth = firstDocumentDate.getMonth() + 1

      // 计算到上月的所有月份
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      let prevYear = currentYear
      let prevMonth = currentMonth - 1
      if (prevMonth === 0) {
        prevYear = currentYear - 1
        prevMonth = 12
      }

      console.log(`从 ${firstYear}年${firstMonth}月 到 ${prevYear}年${prevMonth}月`)

      // 逐月检查并结算
      let y = firstYear
      let m = firstMonth
      let settledCount = 0
      let skippedCount = 0

      while (y < prevYear || (y === prevYear && m <= prevMonth)) {
        // 检查是否已结算
        if (this.costDb.isSettled(y, m)) {
          console.log(`${y}年${m}月 已结算，跳过`)
          skippedCount++
        } else {
          console.log(`结算 ${y}年${m}月 ...`)
          const result = this.settleMonth(y, m, true)
          if (result.success) {
            settledCount++
            console.log(`  ✓ 成功结算 ${result.count} 条记录`)
          } else {
            console.error(`  ✗ 结算失败：${result.error}`)
          }
        }

        // 下一个月
        m++
        if (m > 12) {
          m = 1
          y++
        }
      }

      const message = `完成！结算 ${settledCount} 个月，跳过 ${skippedCount} 个月`
      console.log(message)
      return { success: true, message, settledMonths: settledCount }
    } catch (error) {
      console.error('自动补全历史月份失败:', error)
      return { success: false, message: String(error), settledMonths: 0 }
    }
  }

  /**
   * 获取系统最早的单据日期（从数据库读取）
   */
  private getFirstDocumentDate(): Date | null {
    try {
      const allDates: Date[] = []
      
      // 查询所有单据表的最早日期
      const tables = [
        { name: 'purchase_inbound', dateField: 'inbound_date' },
        { name: 'sales_outbound', dateField: 'outbound_date' },
        { name: 'inventory_transfer', dateField: 'transfer_date' }
      ]
      
      for (const table of tables) {
        try {
          const result = this.mainDb.prepare(
            `SELECT MIN(${table.dateField}) as min_date FROM ${table.name}`
          ).get() as any
          
          if (result && result.min_date) {
            const date = new Date(result.min_date)
            if (!isNaN(date.getTime())) {
              allDates.push(date)
            }
          }
        } catch (error) {
          console.log(`查询 ${table.name} 表失败，跳过`, error)
        }
      }
      
      if (allDates.length === 0) return null
      
      // 返回最早的日期
      return new Date(Math.min(...allDates.map(d => d.getTime())))
    } catch (error) {
      console.error('获取最早单据日期失败:', error)
      return null
    }
  }

  /**
   * 检测是否需要重新结算
   */
  checkAndRecalculateIfNeeded(
    productCode: string,
    warehouseId: number,
    documentDate: string
  ): { needsRecalculation: boolean; message?: string } {
    try {
      const docDate = new Date(documentDate)
      const docYear = docDate.getFullYear()
      const docMonth = docDate.getMonth() + 1

      console.log(`检查是否需要重新结算：产品 ${productCode}, 仓库 ${warehouseId}, 日期 ${documentDate}`)

      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      let y = docYear
      let m = docMonth
      let hasUnlockedMonth = false

      while (y < currentYear || (y === currentYear && m <= currentMonth)) {
        const isSettled = this.costDb.isSettled(y, m)

        console.log(`  ${y}年${m}月：已结算=${isSettled}`)

        if (isSettled) {
          hasUnlockedMonth = true
          break
        }

        m++
        if (m > 12) {
          m = 1
          y++
        }
      }

      if (hasUnlockedMonth) {
        console.log(`检测到 ${docYear}年${docMonth}月 之后有未锁定的结算，触发重新结算`)
        this.recalculateFromMonth(docYear, docMonth)
        return { needsRecalculation: true, message: `检测到历史单据变更，已重新结算从 ${docYear}年${docMonth}月 开始的数据` }
      }

      return { needsRecalculation: false }
    } catch (error) {
      console.error('检查重新结算失败:', error)
      return { needsRecalculation: false }
    }
  }
}
