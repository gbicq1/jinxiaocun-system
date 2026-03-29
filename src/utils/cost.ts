/**
 * 计算产品的加权平均成本
 * @param productId 产品 ID
 * @param warehouseId 仓库 ID
 * @returns 加权平均单价
 */
export const getWeightedAverageCost = (productId: number | undefined, warehouseId: number | undefined): number => {
  if (!productId || !warehouseId) return 0
  
  try {
    // 获取所有入库记录
    const inboundKeys = ['purchase_inbound_records', 'purchaseInbounds', 'inbound_records', 'inbounds', 'purchase_inbounds']
    const inboundRecords: any[] = []
    
    for (const key of inboundKeys) {
      const raw = localStorage.getItem(key)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) {
          inboundRecords.push(...arr)
        }
      }
    }
    
    // 获取所有出库记录
    const outboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'sales_outbounds', 'salesOutbounds', 'delivery_records']
    const outboundRecords: any[] = []
    
    for (const key of outboundKeys) {
      const raw = localStorage.getItem(key)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) {
          outboundRecords.push(...arr)
        }
      }
    }
    
    // 获取所有调拨记录
    const transferRaw = localStorage.getItem('inventory_transfers')
    const transferRecords = transferRaw ? JSON.parse(transferRaw) : []
    
    // 筛选当前产品和仓库的入库记录
    const productInboundRecords = inboundRecords.filter((rec: any) => {
      const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
      if (!Array.isArray(items)) return false
      
      const recWarehouseId = rec.warehouseId
      const warehouseMatch = (recWarehouseId && recWarehouseId === warehouseId)
      
      if (!warehouseMatch) return false
      
      return items.some((it: any) => {
        const itId = it.productId || it.id || null
        return (itId && itId === productId)
      })
    })
    
    // 计算期初数量和成本（所有入库记录的累计）
    let openingQty = 0
    let openingCost = 0
    
    productInboundRecords.forEach((rec: any) => {
      const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
      const recWarehouseId = rec.warehouseId
      
      for (const it of items) {
        const itId = it.productId || it.id || null
        if (itId !== productId) continue
        
        const qty = Number(it.quantity || 0)
        // 优先使用不含税单价
        const unitPrice = Number(it.unitPriceEx || it.unitPrice || it.costPrice || 0)
        const amount = Number(it.totalAmountEx || it.totalAmount || it.amount || (qty * unitPrice))
        
        openingQty += qty
        openingCost += amount
      }
    })
    
    // 计算本期出库数量
    let outboundQty = 0
    const productOutboundRecords = outboundRecords.filter((rec: any) => {
      const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
      if (!Array.isArray(items)) return false
      
      const recWarehouseId = rec.warehouseId
      const warehouseMatch = (recWarehouseId && recWarehouseId === warehouseId)
      
      if (!warehouseMatch) return false
      
      return items.some((it: any) => {
        const itId = it.productId || it.id || null
        return (itId && itId === productId)
      })
    })
    
    productOutboundRecords.forEach((rec: any) => {
      const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
      for (const it of items) {
        const itId = it.productId || it.id || null
        if (itId === productId) {
          outboundQty += Number(it.quantity || 0)
        }
      }
    })
    
    // 计算当前库存数量
    const currentQty = openingQty - outboundQty
    
    // 如果当前库存为 0，返回 0
    if (currentQty <= 0) return 0
    
    // 计算加权平均单价
    // 加权平均单价 = 总成本 / 总数量
    const weightedAvgPrice = openingCost / currentQty
    
    return Number(weightedAvgPrice.toFixed(2))
  } catch (error) {
    console.error('计算加权平均成本失败:', error)
    return 0
  }
}

/**
 * 获取产品的库存成本信息
 * @param productId 产品 ID
 * @param warehouseId 仓库 ID
 * @returns 包含数量、成本等信息的对象
 */
export const getInventoryCostInfo = (productId: number | undefined, warehouseId: number | undefined) => {
  if (!productId || !warehouseId) {
    return {
      quantity: 0,
      totalCost: 0,
      avgCost: 0
    }
  }
  
  try {
    // 获取所有入库记录
    const inboundKeys = ['purchase_inbound_records', 'purchaseInbounds', 'inbound_records', 'inbounds', 'purchase_inbounds']
    const inboundRecords: any[] = []
    
    for (const key of inboundKeys) {
      const raw = localStorage.getItem(key)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) {
          inboundRecords.push(...arr)
        }
      }
    }
    
    // 获取所有出库记录
    const outboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'sales_outbounds', 'salesOutbounds', 'delivery_records']
    const outboundRecords: any[] = []
    
    for (const key of outboundKeys) {
      const raw = localStorage.getItem(key)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) {
          outboundRecords.push(...arr)
        }
      }
    }
    
    // 计算库存数量和成本
    let quantity = 0
    let totalCost = 0
    
    // 处理入库
    inboundRecords.forEach((rec: any) => {
      const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
      if (!Array.isArray(items)) return
      
      const recWarehouseId = rec.warehouseId
      if (recWarehouseId !== warehouseId) return
      
      for (const it of items) {
        const itId = it.productId || it.id || null
        if (itId !== productId) continue
        
        const qty = Number(it.quantity || 0)
        const unitPrice = Number(it.unitPriceEx || it.unitPrice || it.costPrice || 0)
        const amount = Number(it.totalAmountEx || it.totalAmount || it.amount || (qty * unitPrice))
        
        quantity += qty
        totalCost += amount
      }
    })
    
    // 处理出库
    outboundRecords.forEach((rec: any) => {
      const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
      if (!Array.isArray(items)) return
      
      const recWarehouseId = rec.warehouseId
      if (recWarehouseId !== warehouseId) return
      
      for (const it of items) {
        const itId = it.productId || it.id || null
        if (itId !== productId) continue
        
        const qty = Number(it.quantity || 0)
        quantity -= qty
      }
    })
    
    // 计算平均成本
    const avgCost = quantity > 0 ? totalCost / quantity : 0
    
    return {
      quantity: Number(quantity.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      avgCost: Number(avgCost.toFixed(2))
    }
  } catch (error) {
    console.error('获取库存成本信息失败:', error)
    return {
      quantity: 0,
      totalCost: 0,
      avgCost: 0
    }
  }
}

/**
 * 从成本结算模块获取指定日期的最终成本价
 * @param productId 产品 ID
 * @param warehouseId 仓库 ID
 * @param transferDate 调拨日期 (YYYY-MM-DD)
 * @returns 最终成本价（加权平均单价）
 */
export const getCostFromSettlement = (productId: number | undefined, warehouseId: number | undefined, transferDate: string): number => {
  if (!productId || !warehouseId || !transferDate) return 0
  
  try {
    // 获取产品信息（用于获取产品编码）
    const productsRaw = localStorage.getItem('products')
    const products = productsRaw ? JSON.parse(productsRaw) : []
    const product = products.find((p: any) => p.id === productId)
    if (!product) return 0
    
    const productCode = product.code || product.productCode
    
    // 获取所有成本结算数据
    const settlementsRaw = localStorage.getItem('cost_settlements')
    const settlements = settlementsRaw ? JSON.parse(settlementsRaw) : []
    
    if (settlements.length === 0) return 0
    
    // 找到包含调拨日期的最近一期结算
    const targetDate = new Date(transferDate)
    let latestSettlement: any = null
    
    for (const settlement of settlements) {
      if (!settlement.periodRange || settlement.periodRange.length !== 2) continue
      
      const periodStart = new Date(settlement.periodRange[0])
      const periodEnd = new Date(settlement.periodRange[1])
      
      // 检查调拨日期是否在结算期间内
      if (targetDate >= periodStart && targetDate <= periodEnd) {
        // 匹配产品编码
        if (settlement.productCode === productCode || settlement.productId === productId) {
          latestSettlement = settlement
          break
        }
      }
    }
    
    // 如果没有找到包含该日期的结算，找该日期之前最近的结算
    if (!latestSettlement) {
      const validSettlements = settlements
        .filter((s: any) => {
          if (!s.periodRange || s.periodRange.length !== 2) return false
          if (s.productCode !== productCode && s.productId !== productId) return false
          const periodEnd = new Date(s.periodRange[1])
          return periodEnd <= targetDate
        })
        .sort((a: any, b: any) => {
          const dateA = new Date(a.periodRange[1])
          const dateB = new Date(b.periodRange[1])
          return dateB.getTime() - dateA.getTime()
        })
      
      if (validSettlements.length > 0) {
        latestSettlement = validSettlements[0]
      }
    }
    
    if (latestSettlement && latestSettlement.avgPrice) {
      return Number(latestSettlement.avgPrice.toFixed(2))
    }
    
    // 如果没有找到结算数据，回退到使用加权平均成本
    return getWeightedAverageCost(productId, warehouseId)
  } catch (error) {
    console.error('从成本结算获取成本价失败:', error)
    // 回退到使用加权平均成本
    return getWeightedAverageCost(productId, warehouseId)
  }
}
