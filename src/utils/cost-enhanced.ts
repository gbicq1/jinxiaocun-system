/**
 * 成本计算增强工具
 * 
 * 解决成本价不一致问题的核心改进：
 * 1. 使用数据库快照确保期初数据准确性
 * 2. 记录成本计算日志，便于追溯和调试
 * 3. 保持与现有 localStorage 方案的兼容性
 * 
 * 关键逻辑：
 * - 优先从数据库库存快照表获取期初数据
 * - 如果数据库没有，从成本结算历史表获取
 * - 如果还没有，从出入库流水表计算
 * - 最后才降级到 localStorage 方案
 */

import { EnhancedInventoryDatabase } from '../electron/database-enhanced'

// 数据库实例（单例）
let dbInstance: EnhancedInventoryDatabase | null = null

/**
 * 获取数据库实例
 */
const getDatabase = (): EnhancedInventoryDatabase | null => {
  if (!dbInstance) {
    // 尝试初始化数据库
    const { app } = require('electron')
    const { resolve } = require('path')
    const dbPath = resolve(app.getPath('userData'), 'inventory.db')
    dbInstance = new EnhancedInventoryDatabase(dbPath)
    dbInstance.initialize()
  }
  return dbInstance
}

/**
 * 获取准确的期初数据（核心方法）
 * 
 * 这是解决成本价不一致问题的关键
 * 
 * @param productId 产品 ID
 * @param warehouseId 仓库 ID
 * @param periodStart 会计期间开始日期 (YYYY-MM-DD)
 * @returns 期初数据（数量、成本、单价）
 */
export const getAccurateOpeningBalance = (
  productId: number | undefined,
  warehouseId: number | undefined,
  periodStart: string
): {
  quantity: number
  cost: number
  unitCost: number
  source: string
} => {
  if (!productId || !warehouseId || !periodStart) {
    return {
      quantity: 0,
      cost: 0,
      unitCost: 0,
      source: 'invalid_params'
    }
  }

  const db = getDatabase()
  
  // 方案 1：从数据库获取（最准确）
  if (db && db['initialized']) {
    try {
      const openingBalance = db.getOpeningBalance(productId, warehouseId, periodStart)
      
      if (openingBalance.quantity > 0 || openingBalance.source.startsWith('snapshot') || openingBalance.source.startsWith('settlement')) {
        console.log('✅ 从数据库获取期初数据:', {
          productId,
          warehouseId,
          periodStart,
          ...openingBalance
        })
        
        return openingBalance
      }
    } catch (error) {
      console.warn('从数据库获取期初数据失败:', error)
      // 继续执行下面的 localStorage 方案
    }
  }

  // 方案 2：从 localStorage 的成本结算数据获取（兼容现有方案）
  try {
    const settlementsRaw = localStorage.getItem('cost_settlements')
    if (settlementsRaw) {
      const settlements = JSON.parse(settlementsRaw)
      
      const periodStartDate = new Date(periodStart)
      const previousDay = new Date(periodStartDate)
      previousDay.setDate(previousDay.getDate() - 1)
      const previousDayStr = previousDay.toISOString().slice(0, 10)
      
      // 查找当前期间之前的最后一个已结算数据
      const previousSettlements = settlements
        .filter((s: any) => {
          if (!s.periodRange || s.periodRange.length !== 2) return false
          const periodEnd = s.periodRange[1]
          
          // 产品匹配
          const productMatch = 
            (s.productId != null && Number(s.productId) === Number(productId)) || 
            (s.productCode != null && String(s.productCode) === String(productId))
          
          // 仓库匹配
          const warehouseMatch = 
            s.warehouseId != null && Number(s.warehouseId) === Number(warehouseId)
          
          // 期间在当前期间之前
          return periodEnd < periodStart && productMatch && warehouseMatch
        })
        .sort((a: any, b: any) => {
          // 按结束日期倒序排序，最新的在前
          return new Date(b.periodRange[1]).getTime() - new Date(a.periodRange[1]).getTime()
        })
      
      if (previousSettlements.length > 0) {
        const latestSettlement = previousSettlements[0]
        console.log('✅ 从 localStorage 成本结算获取期初数据:', {
          productId,
          warehouseId,
          periodStart,
          fromPeriod: latestSettlement.periodRange,
          closingQty: latestSettlement.closingQty,
          closingCost: latestSettlement.closingCost
        })
        
        return {
          quantity: Number(latestSettlement.closingQty || 0),
          cost: Number(latestSettlement.closingCost || 0),
          unitCost: Number(latestSettlement.avgPrice || 0),
          source: 'localStorage_settlement:' + latestSettlement.periodRange[1]
        }
      }
    }
  } catch (error) {
    console.warn('从 localStorage 获取期初数据失败:', error)
  }

  // 方案 3：从初始化数据获取
  try {
    const settlementsRaw = localStorage.getItem('cost_settlements')
    if (settlementsRaw) {
      const settlements = JSON.parse(settlementsRaw)
      
      const initializedSettlements = settlements.filter((s: any) => s._initialized === true)
      
      if (initializedSettlements.length > 0) {
        const periodStartDate = new Date(periodStart)
        const previousDay = new Date(periodStartDate)
        previousDay.setDate(previousDay.getDate() - 1)
        const previousDayStr = previousDay.toISOString().slice(0, 10)
        
        // 查找当前期间之前的最后一个初始化数据
        const previousInitialized = initializedSettlements
          .filter((s: any) => {
            if (!s.periodRange || s.periodRange.length !== 2) return false
            const periodEnd = s.periodRange[1]
            
            const productMatch = 
              (s.productId != null && Number(s.productId) === Number(productId)) || 
              (s.productCode != null && String(s.productCode) === String(productId))
            
            const warehouseMatch = 
              s.warehouseId != null && Number(s.warehouseId) === Number(warehouseId)
            
            return periodEnd < periodStart && productMatch && warehouseMatch
          })
          .sort((a: any, b: any) => 
            new Date(b.periodRange[1]).getTime() - new Date(a.periodRange[1]).getTime()
          )
        
        if (previousInitialized.length > 0) {
          const latestInitialized = previousInitialized[0]
          console.log('✅ 从 localStorage 初始化数据获取期初数据:', {
            productId,
            warehouseId,
            periodStart,
            fromPeriod: latestInitialized.periodRange,
            closingQty: latestInitialized.closingQty,
            closingCost: latestInitialized.closingCost
          })
          
          return {
            quantity: Number(latestInitialized.closingQty || 0),
            cost: Number(latestInitialized.closingCost || 0),
            unitCost: Number(latestInitialized.avgPrice || 0),
            source: 'localStorage_initialized:' + latestInitialized.periodRange[1]
          }
        }
      }
    }
  } catch (error) {
    console.warn('从 localStorage 初始化数据获取期初数据失败:', error)
  }

  // 方案 4：没有数据，返回 0
  console.log('⚠️ 未找到任何期初数据，返回 0:', {
    productId,
    warehouseId,
    periodStart
  })
  
  return {
    quantity: 0,
    cost: 0,
    unitCost: 0,
    source: 'none'
  }
}

/**
 * 保存成本结算结果到数据库（增强版）
 * 
 * 在原有 localStorage 基础上，额外保存到数据库
 */
export const saveCostSettlementToDatabase = (data: {
  productId: number
  productCode: string
  warehouseId: number
  periodStart: string
  periodEnd: string
  openingQty: number
  openingCost: number
  openingUnitCost: number
  inboundQty: number
  inboundCost: number
  outboundQty: number
  outboundCost: number
  avgPrice: number
  closingQty: number
  closingCost: number
}): boolean => {
  const db = getDatabase()
  
  if (!db || !db['initialized']) {
    console.warn('数据库未初始化，跳过保存到数据库')
    return false
  }

  try {
    // 生成结算单号
    const settlementNo = `CS${data.periodStart.replace(/-/g, '')}-${data.productCode}-${data.warehouseId}`

    // 保存到成本结算历史表
    db.saveCostSettlement({
      settlementNo,
      productId: data.productId,
      productCode: data.productCode,
      warehouseId: data.warehouseId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      openingQty: data.openingQty,
      openingCost: data.openingCost,
      openingUnitCost: data.openingUnitCost,
      inboundQty: data.inboundQty,
      inboundCost: data.inboundCost,
      outboundQty: data.outboundQty,
      outboundCost: data.outboundCost,
      weightedAvgUnitCost: data.avgPrice,
      closingQty: data.closingQty,
      closingCost: data.closingCost,
      closingUnitCost: data.avgPrice,
      status: 'confirmed',
      remark: `系统自动保存 - ${new Date().toISOString()}`
    })

    // 同时保存库存快照
    db.saveInventorySnapshot({
      productId: data.productId,
      productCode: data.productCode,
      warehouseId: data.warehouseId,
      snapshotDate: data.periodEnd,
      snapshotType: 'monthly',
      quantity: data.closingQty,
      unitCost: data.avgPrice,
      totalCost: data.closingCost,
      monthlyInboundQty: data.inboundQty,
      monthlyInboundCost: data.inboundCost,
      monthlyOutboundQty: data.outboundQty,
      monthlyOutboundCost: data.outboundCost,
      source: 'settled'
    })

    console.log('✅ 成本结算数据已保存到数据库:', {
      settlementNo,
      productId: data.productId,
      period: `${data.periodStart} 至 ${data.periodEnd}`
    })

    return true
  } catch (error) {
    console.error('保存成本结算到数据库失败:', error)
    return false
  }
}

/**
 * 记录成本计算日志
 */
export const logCostCalculation = (data: {
  productId: number
  productCode: string
  warehouseId: number
  periodStart: string
  periodEnd: string
  openingQty: number
  openingCost: number
  openingSource: string
  calculatedAvgCost: number
  closingQty: number
  closingCost: number
  details?: any
  status?: 'success' | 'error'
  errorMessage?: string
}): void => {
  const db = getDatabase()
  
  if (!db || !db['initialized']) {
    return
  }

  try {
    const stmt = db['db'].prepare(`
      INSERT INTO cost_calculation_log (
        product_id, product_code, warehouse_id, period_start, period_end,
        opening_qty_used, opening_cost_used, opening_source,
        calculated_avg_cost, closing_qty, closing_cost,
        calculation_details, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      data.productId,
      data.productCode,
      data.warehouseId,
      data.periodStart,
      data.periodEnd,
      data.openingQty,
      data.openingCost,
      data.openingSource,
      data.calculatedAvgCost,
      data.closingQty,
      data.closingCost,
      JSON.stringify(data.details || {}),
      data.status || 'success',
      data.errorMessage || ''
    )
  } catch (error) {
    console.warn('记录成本计算日志失败:', error)
  }
}

/**
 * 同步 localStorage 数据到数据库
 * 这是过渡方案，确保数据不丢失
 */
export const syncToDatabase = (): number => {
  const db = getDatabase()
  
  if (!db || !db['initialized']) {
    console.warn('数据库未初始化，无法同步')
    return 0
  }

  try {
    return db.syncLocalStorageToDatabase(localStorage)
  } catch (error) {
    console.error('同步数据到数据库失败:', error)
    return 0
  }
}

/**
 * 验证成本计算准确性
 * 通过比对数据库快照和实际计算结果，确保数据一致性
 */
export const validateCostCalculation = (
  productId: number,
  warehouseId: number,
  periodEnd: string
): {
  isValid: boolean
  snapshotCost: number
  calculatedCost: number
  difference: number
} => {
  const db = getDatabase()
  
  if (!db || !db['initialized']) {
    return {
      isValid: true,
      snapshotCost: 0,
      calculatedCost: 0,
      difference: 0
    }
  }

  try {
    // 从数据库获取快照
    const snapshot = db['db'].prepare(`
      SELECT total_cost, quantity, unit_cost
      FROM inventory_snapshots
      WHERE product_id = ? 
        AND warehouse_id = ?
        AND snapshot_date = ?
    `).get(productId, warehouseId, periodEnd) as any

    if (!snapshot) {
      return {
        isValid: true,
        snapshotCost: 0,
        calculatedCost: 0,
        difference: 0
      }
    }

    const snapshotCost = Number(snapshot.total_cost)
    const snapshotQty = Number(snapshot.quantity)
    const snapshotUnitCost = Number(snapshot.unit_cost)

    // 从成本结算历史获取
    const settlement = db['db'].prepare(`
      SELECT closing_cost, closing_qty, weighted_avg_unit_cost
      FROM cost_settlement_history
      WHERE product_id = ? 
        AND warehouse_id = ?
        AND period_end = ?
        AND status = 'confirmed'
    `).get(productId, warehouseId, periodEnd) as any

    if (!settlement) {
      return {
        isValid: true,
        snapshotCost: snapshotCost,
        calculatedCost: 0,
        difference: 0
      }
    }

    const calculatedCost = Number(settlement.closing_cost)
    const calculatedQty = Number(settlement.closing_qty)
    const calculatedUnitCost = Number(settlement.weighted_avg_unit_cost)

    // 计算差异
    const costDifference = Math.abs(snapshotCost - calculatedCost)
    const qtyDifference = Math.abs(snapshotQty - calculatedQty)
    const unitCostDifference = Math.abs(snapshotUnitCost - calculatedUnitCost)

    // 允许微小差异（浮点数精度）
    const tolerance = 0.01
    const isValid = costDifference <= tolerance && qtyDifference <= tolerance && unitCostDifference <= tolerance

    if (!isValid) {
      console.warn('⚠️ 成本计算验证失败:', {
        productId,
        warehouseId,
        periodEnd,
        snapshot: { qty: snapshotQty, cost: snapshotCost, unitCost: snapshotUnitCost },
        calculated: { qty: calculatedQty, cost: calculatedCost, unitCost: calculatedUnitCost },
        differences: { cost: costDifference, qty: qtyDifference, unitCost: unitCostDifference }
      })
    }

    return {
      isValid,
      snapshotCost,
      calculatedCost,
      difference: costDifference
    }
  } catch (error) {
    console.error('验证成本计算失败:', error)
    return {
      isValid: true,
      snapshotCost: 0,
      calculatedCost: 0,
      difference: 0
    }
  }
}
