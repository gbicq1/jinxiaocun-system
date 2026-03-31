/**
 * 成本结算计算服务（前端版本）
 * 使用数据库 IPC 访问，不使用 localStorage
 */

import { db } from './db-ipc'

interface ProductWarehouseCombo {
  productCode: string
  productName: string
  warehouseId: number
  warehouseName: string
}

interface InboundRecord {
  date: string
  productCode: string
  warehouseId: number
  qty: number
  amount: number
}

interface OutboundRecord {
  date: string
  productCode: string
  warehouseId: number
  qty: number
  cost: number
  amount: number
}

/**
 * 成本结算计算服务
 */
export class CostCalculationService {
  /**
   * 获取所有产品和仓库组合
   */
  async getAllProductWarehouseCombinations(): Promise<ProductWarehouseCombo[]> {
    const combinations: ProductWarehouseCombo[] = []

    try {
      // 从数据库获取所有产品
      const products = await db.getProducts()
      if (!products || products.length === 0) return combinations

      // 从数据库获取所有仓库
      const warehouses = await db.getWarehouses()
      if (!warehouses || warehouses.length === 0) return combinations

      // 获取所有有业务往来的产品仓库组合
      const usedCombinations = new Set<string>()

      // 查询采购入库单
      const purchaseData = await db.getPurchaseInbounds(1, 100000)
      const purchaseInbounds = purchaseData.list || []

      for (const rec of purchaseInbounds) {
        const warehouseId = rec.warehouse_id
        if (!warehouseId) continue

        const items = rec.items || []
        for (const item of items) {
          const productCode = item.product_id || item.productId || item.productCode
          if (!productCode) continue

          const key = `${productCode}_${warehouseId}`
          usedCombinations.add(key)
        }
      }

      // 查询销售出库单
      const outboundData = await db.getSalesOutbounds(1, 100000)
      const salesOutbounds = outboundData.list || []

      for (const rec of salesOutbounds) {
        const warehouseId = rec.warehouse_id
        if (!warehouseId) continue

        const items = rec.items || []
        for (const item of items) {
          const productCode = item.product_id || item.productId || item.productCode
          if (!productCode) continue

          const key = `${productCode}_${warehouseId}`
          usedCombinations.add(key)
        }
      }

      // 查询库存调拨单
      const transferData = await db.getTransfers(1, 100000)
      const transfers = transferData.list || []

      for (const rec of transfers) {
        // 调出仓库
        if (rec.from_warehouse_id) {
          const items = rec.items || []
          for (const item of items) {
            const productCode = item.product_id || item.productId || item.productCode
            if (productCode) {
              const key = `${productCode}_${rec.from_warehouse_id}`
              usedCombinations.add(key)
            }
          }
        }

        // 调入仓库
        if (rec.to_warehouse_id) {
          const items = rec.items || []
          for (const item of items) {
            const productCode = item.product_id || item.productId || item.productCode
            if (productCode) {
              const key = `${productCode}_${rec.to_warehouse_id}`
              usedCombinations.add(key)
            }
          }
        }
      }

      // 构建组合（返回所有组合，不只是有业务的）
      for (const product of products) {
        for (const warehouse of warehouses) {
          combinations.push({
            productCode: String(product.code),
            productName: product.name,
            warehouseId: warehouse.id,
            warehouseName: warehouse.name
          })
        }
      }
    } catch (error) {
      console.error('获取产品仓库组合失败:', error)
    }

    return combinations
  }

  /**
   * 获取入库数据
   */
  async getInboundData(
    productCode: string,
    warehouseId: number,
    startDate: string,
    endDate: string
  ): Promise<InboundRecord[]> {
    try {
      const data = await db.getPurchaseInbounds(1, 100000)
      const records = data.list || []

      const result: InboundRecord[] = []

      for (const rec of records) {
        if (rec.warehouse_id !== warehouseId) continue

        const recDate = new Date(rec.bill_date)
        const start = new Date(startDate)
        const end = new Date(endDate)

        if (recDate < start || recDate > end) continue

        const items = rec.items || []
        for (const item of items) {
          const itemProductCode = item.product_id || item.productId || item.productCode
          if (String(itemProductCode) !== String(productCode)) continue

          result.push({
            date: rec.bill_date,
            productCode: String(productCode),
            warehouseId,
            qty: item.qty || 0,
            amount: item.amount || 0
          })
        }
      }

      return result
    } catch (error) {
      console.error('获取入库数据失败:', error)
      return []
    }
  }

  /**
   * 获取出库数据
   */
  async getOutboundData(
    productCode: string,
    warehouseId: number,
    startDate: string,
    endDate: string
  ): Promise<OutboundRecord[]> {
    try {
      const data = await db.getSalesOutbounds(1, 100000)
      const records = data.list || []

      const result: OutboundRecord[] = []

      for (const rec of records) {
        if (rec.warehouse_id !== warehouseId) continue

        const recDate = new Date(rec.bill_date)
        const start = new Date(startDate)
        const end = new Date(endDate)

        if (recDate < start || recDate > end) continue

        const items = rec.items || []
        for (const item of items) {
          const itemProductCode = item.product_id || item.productId || item.productCode
          if (String(itemProductCode) !== String(productCode)) continue

          // 计算成本价（使用移动加权平均）
          const qty = item.qty || 0
          const amount = item.amount || 0
          const cost = qty > 0 ? amount / qty : 0

          result.push({
            date: rec.bill_date,
            productCode: String(productCode),
            warehouseId,
            qty,
            cost,
            amount
          })
        }
      }

      return result
    } catch (error) {
      console.error('获取出库数据失败:', error)
      return []
    }
  }

  /**
   * 计算成本结算
   */
  async calculateSettlement(
    productCode: string,
    productName: string,
    warehouseId: number,
    warehouseName: string,
    year: number,
    month: number
  ): Promise<any> {
    // 计算期间
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    // 获取上月末快照
    let openingQty = 0
    let openingCost = 0

    if (month === 1) {
      // 如果是 1 月，获取上年 12 月的快照
      const lastYearSnapshot = await db.getMonthEndSnapshot(productCode, warehouseId, year - 1, 12)
      if (lastYearSnapshot) {
        openingQty = lastYearSnapshot.quantity
        openingCost = lastYearSnapshot.cost
      }
    } else {
      // 获取上月末快照
      const lastMonthSnapshot = await db.getMonthEndSnapshot(productCode, warehouseId, year, month - 1)
      if (lastMonthSnapshot) {
        openingQty = lastMonthSnapshot.quantity
        openingCost = lastMonthSnapshot.cost
      }
    }

    // 获取本期入库数据
    const inboundRecords = await this.getInboundData(productCode, warehouseId, startDate, endDate)
    const inboundQty = inboundRecords.reduce((sum, rec) => sum + rec.qty, 0)
    const inboundCost = inboundRecords.reduce((sum, rec) => sum + rec.amount, 0)

    // 获取本期出库数据
    const outboundRecords = await this.getOutboundData(productCode, warehouseId, startDate, endDate)
    const outboundQty = outboundRecords.reduce((sum, rec) => sum + rec.qty, 0)

    // 计算加权平均单价
    const totalQty = openingQty + inboundQty
    const totalCost = openingCost + inboundCost
    const avgCost = totalQty > 0 ? totalCost / totalQty : 0

    // 计算本期出库成本
    const outboundCost = outboundQty * avgCost

    // 计算期末结存
    const closingQty = openingQty + inboundQty - outboundQty
    const closingCost = closingQty * avgCost

    // 保存月末快照
    await db.saveSnapshot(
      productCode,
      productName,
      warehouseId,
      warehouseName,
      endDate,
      closingQty,
      closingCost
    )

    return {
      product_code: productCode,
      product_name: productName,
      warehouse_id: warehouseId,
      warehouse_name: warehouseName,
      period_year: year,
      period_month: month,
      opening_qty: openingQty,
      opening_cost: openingCost,
      inbound_qty: inboundQty,
      inbound_cost: inboundCost,
      outbound_qty: outboundQty,
      outbound_cost: outboundCost,
      closing_qty: closingQty,
      closing_cost: closingCost,
      avg_cost: avgCost,
      is_locked: 1
    }
  }

  /**
   * 结算指定月份
   */
  async settleMonth(year: number, month: number, lock: boolean = true): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      console.log(`\n📊 开始结算 ${year}年${month}月 的成本数据...`)

      // 获取所有产品仓库组合
      const combos = await this.getAllProductWarehouseCombinations()
      console.log(`共有 ${combos.length} 个产品仓库组合需要结算`)

      const settlements = []

      // 逐个计算
      for (const combo of combos) {
        try {
          const settlement = await this.calculateSettlement(
            combo.productCode,
            combo.productName,
            combo.warehouseId,
            combo.warehouseName,
            year,
            month
          )
          settlements.push(settlement)
        } catch (error) {
          console.error(`结算 ${combo.productCode} @ ${combo.warehouseName} 失败:`, error)
        }
      }

      // 批量保存
      if (settlements.length > 0) {
        await db.saveCostSettlements(settlements)
        console.log(`成功结算 ${settlements.length} 条记录`)
      }

      return { success: true, count: settlements.length }
    } catch (error) {
      console.error(`结算 ${year}年${month}月 失败:`, error)
      return { success: false, count: 0, error: String(error) }
    }
  }
}
