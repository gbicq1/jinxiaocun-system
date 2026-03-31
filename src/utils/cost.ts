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
 * 从成本结算模块获取指定日期的最终成本价（直接提取本月合计行的成本价）
 * @param productId 产品 ID
 * @param warehouseId 仓库 ID
 * @param transferDate 调拨日期 (YYYY-MM-DD)
 * @returns 最终成本价（本月合计的加权平均单价）
 */
export const getCostFromSettlement = (productId: number | undefined, warehouseId: number | undefined, transferDate: string): number => {
  if (!productId || !warehouseId || !transferDate) return 0
  
  try {
    console.log('========== getCostFromSettlement 调试 ==========')
    console.log('输入参数:', { productId, warehouseId, transferDate, productIdType: typeof productId, warehouseIdType: typeof warehouseId })
    
    // 先找到匹配的成本结算汇总数据
    const settlementsRaw = localStorage.getItem('cost_settlements')
    const settlements = settlementsRaw ? JSON.parse(settlementsRaw) : []
    
    console.log('所有结算数据数量:', settlements.length)
    
    let matchingSettlement = null
    
    if (settlements.length > 0) {
      // 找到所有匹配的产品和仓库的结算
      const validSettlements = settlements
        .filter((s: any) => {
          if (!s.periodRange || s.periodRange.length !== 2) return false
          
          // 检查调拨日期是否在结算期间内
          const periodStart = new Date(s.periodRange[0])
          const periodEnd = new Date(s.periodRange[1])
          const transferDateObj = new Date(transferDate)
          
          const inPeriod = transferDateObj >= periodStart && transferDateObj <= periodEnd
          
          if (!inPeriod) {
            console.log('日期不在结算期间内:', { periodStart: s.periodRange[0], periodEnd: s.periodRange[1], transferDate })
            return false
          }
          
          // 产品ID匹配（同时支持字符串和数字）
          const productMatch = 
            (s.productId != null && (Number(s.productId) === Number(productId) || String(s.productId) === String(productId))) || 
            (s.productCode != null && (String(s.productCode) === String(productId) || Number(s.productCode) === Number(productId)))
          
          if (!productMatch) {
            console.log('产品不匹配:', { sProductId: s.productId, sProductCode: s.productCode, targetProductId: productId })
            return false
          }
          
          // 仓库ID匹配（同时支持字符串和数字）
          const warehouseMatch = 
            s.warehouseId != null && (Number(s.warehouseId) === Number(warehouseId) || String(s.warehouseId) === String(warehouseId))
          
          if (!warehouseMatch) {
            console.log('仓库不匹配:', { sWarehouseId: s.warehouseId, targetWarehouseId: warehouseId })
            return false
          }
          
          console.log('✅ 找到匹配的结算数据:', s)
          return true
        })
        .sort((a: any, b: any) => {
          const dateA = new Date(a.periodRange[1])
          const dateB = new Date(b.periodRange[1])
          return dateB.getTime() - dateA.getTime()
        })
      
      console.log('有效结算数据数量:', validSettlements.length)
      
      if (validSettlements.length > 0) {
        matchingSettlement = validSettlements[0]
        console.log('最新结算数据:', matchingSettlement)
      }
    }
    
    // 如果找到了成本结算数据
    if (matchingSettlement) {
      const periodEnd = new Date(matchingSettlement.periodRange[1])
      const transferDateObj = new Date(transferDate)
      
      // 如果调拨日期在期间结束日期之前（不是同一天），使用本月合计的加权平均单价
      // 如果调拨日期就是期间结束日期，需要计算当天的实时成本价
      if (transferDateObj.getTime() < periodEnd.getTime()) {
        // 调拨日期在期间中间，使用本月合计的加权平均单价
        if (matchingSettlement.avgPrice != null) {
          const result = Number(matchingSettlement.avgPrice.toFixed(2))
          console.log('✅ 调拨日期在期间中间，使用本月合计成本价:', result)
          return result
        }
      } else {
        // 调拨日期是期间结束日期，需要计算当天的实时成本价
        console.log('调拨日期是期间结束日期，需要计算实时成本价')
        // 继续执行下面的动态计算逻辑
      }
    }
    
    console.log('未找到已结算数据或需要计算实时成本价，动态计算调拨日期前的成本价')
    
    // 如果没有找到已结算数据，或者调拨日期是期间结束日期，动态计算调拨日期前的成本价
    return calculateCostBeforeDate(productId, warehouseId, transferDate)
  } catch (error) {
    console.error('从成本结算获取成本价失败:', error)
    // 回退到动态计算
    return calculateMonthlyCost(productId, warehouseId, transferDate)
  }
}

/**
 * 动态计算指定日期所在月份的成本价（模拟本月合计行）
 * 正确逻辑：期初数据 + 入库数据 - 出库数据 = 库存结余数据
 * @param productId 产品 ID
 * @param warehouseId 仓库 ID
 * @param targetDateStr 目标日期 (YYYY-MM-DD)
 * @returns 本月合计的成本价
 */
const calculateMonthlyCost = (productId: number | undefined, warehouseId: number | undefined, targetDateStr: string): number => {
  if (!productId || !warehouseId || !targetDateStr) return 0
  
  try {
    const targetDate = new Date(targetDateStr)
    
    // 计算调拨日期所在月份的第一天和最后一天
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999)
    
    console.log('========== calculateMonthlyCost 调试 ==========')
    console.log('输入参数:', { productId, warehouseId, targetDateStr })
    console.log('调拨日期所在月份:', { monthStart: monthStart.toISOString().slice(0, 10), monthEnd: monthEnd.toISOString().slice(0, 10) })
    
    // 先获取期初数据（上月期末）
    let openingQty = 0
    let openingCost = 0
    
    // 获取所有结算数据，找到上期期末数据
    const settlementsRaw = localStorage.getItem('cost_settlements')
    const settlements = settlementsRaw ? JSON.parse(settlementsRaw) : []
    
    // 计算上期最后一天
    const previousMonthEnd = new Date(monthStart)
    previousMonthEnd.setDate(previousMonthEnd.getDate() - 1)
    const previousMonthEndStr = previousMonthEnd.toISOString().slice(0, 10)
    
    console.log('上期最后一天:', previousMonthEndStr)
    
    // 查找上期期末结算数据
    const previousSettlement = settlements.find((s: any) => {
      if (!s.periodRange || s.periodRange.length !== 2) return false
      const periodEnd = s.periodRange[1]
      return periodEnd === previousMonthEndStr && 
             ((s.productId != null && (Number(s.productId) === Number(productId) || String(s.productId) === String(productId))) || 
              (s.productCode != null && (String(s.productCode) === String(productId) || Number(s.productCode) === Number(productId)))) && 
             s.warehouseId != null && (Number(s.warehouseId) === Number(warehouseId) || String(s.warehouseId) === String(warehouseId))
    })
    
    if (previousSettlement) {
      openingQty = Number(previousSettlement.closingQty || 0)
      openingCost = Number(previousSettlement.closingCost || 0)
      console.log('✅ 找到上期期末数据:', { openingQty, openingCost })
    } else {
      console.log('未找到上期期末数据，期初为0')
    }
    
    // 收集本月所有出入库记录（用于后续处理）
    const monthRecords: any[] = []
    
    // 扫描所有 localStorage 键
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        
        const arr = JSON.parse(raw)
        if (!Array.isArray(arr)) continue
        
        // 判断单据类型
        const isPurchaseReturn = key.includes('return') && (key.includes('purchase') || key.includes('inbound'))
        const isSalesReturn = key.includes('return') && (key.includes('sales') || key.includes('outbound'))
        const isInboundKey = key.includes('inbound') || key.includes('purchase') && !key.includes('return')
        const isOutboundKey = key.includes('outbound') || key.includes('sales') && !key.includes('return')
        const isTransferKey = key.includes('transfer')
        
        if (!isInboundKey && !isOutboundKey && !isTransferKey && !isPurchaseReturn && !isSalesReturn) {
          continue
        }
        
        arr.forEach((rec: any) => {
          // 获取单据日期
          const recDateStr = rec.voucherDate || rec.orderDate || rec.date || rec.createdAt || rec.transferDate || ''
          if (!recDateStr) return
          
          const recDate = new Date(recDateStr)
          if (recDate < monthStart || recDate > monthEnd) return
          
          // 获取单据明细
          const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
          if (!Array.isArray(items)) return
          
          // 判断是入库还是出库
          let recWarehouseId = null
          let isInbound = false
          let isOutbound = false
          let isTransferOut = false
          let isTransferIn = false
          
          if (isTransferKey) {
            // 调拨单
            recWarehouseId = rec.fromWarehouseId || rec.toWarehouseId
            isTransferOut = Number(rec.fromWarehouseId) === Number(warehouseId)
            isTransferIn = Number(rec.toWarehouseId) === Number(warehouseId)
          } else if (isInboundKey || isSalesReturn) {
            // 入库单或销售退货（销售退货当作入库处理）
            recWarehouseId = rec.warehouseId
            isInbound = Number(recWarehouseId) === Number(warehouseId)
          } else if (isOutboundKey || isPurchaseReturn) {
            // 出库单或采购退货（采购退货当作出库处理）
            recWarehouseId = rec.warehouseId
            isOutbound = Number(recWarehouseId) === Number(warehouseId)
          }
          
          if (!isInbound && !isOutbound && !isTransferOut && !isTransferIn) return
          
          items.forEach((it: any) => {
            const itId = it.productId || it.id || null
            if (itId !== productId) return
            
            let quantity = Number(it.quantity || 0)
            if (quantity <= 0) return
            
            // 优先使用不含税单价
            const costPrice = Number(it.unitPriceEx || it.costPrice || it.unitPrice || it.price || 0)
            const amount = Number(it.totalAmountEx || it.totalAmount || it.amount || (quantity * costPrice))
            
            // 添加到记录列表
            monthRecords.push({
              date: recDate,
              isInbound: isInbound || isTransferIn,
              isOutbound: isOutbound || isTransferOut,
              quantity,
              costPrice,
              amount,
              _timestamp: rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp
            })
          })
        })
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    // 按日期和时间戳排序记录
    monthRecords.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime()
      if (dateCompare !== 0) return dateCompare
      
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
      
      if (timeA > 0 && timeB > 0) return timeA - timeB
      if (timeA > 0) return -1
      if (timeB > 0) return 1
      
      return 0
    })
    
    console.log('本月记录数量:', monthRecords.length)
    
    // ========== 正确的计算逻辑：期初 + 入库 - 出库 = 库存结余 ==========
    
    // 初始化库存和成本
    let runningQty = openingQty
    let runningCost = openingCost
    
    console.log('期初数据:', { openingQty, openingCost })
    
    // 遍历本月所有记录，按顺序处理
    monthRecords.forEach((rec, index) => {
      if (rec.isInbound) {
        // 入库：增加库存和成本
        runningQty += rec.quantity
        runningCost += rec.amount
        console.log(`记录${index + 1} 入库: +${rec.quantity}, +${rec.amount}, 当前库存:${runningQty}, 当前成本:${runningCost}`)
      } else if (rec.isOutbound) {
        // 出库：使用加权平均单价计算出库成本
        const avgPrice = runningQty > 0 ? runningCost / runningQty : 0
        const outboundCost = rec.quantity * avgPrice
        
        runningQty -= rec.quantity
        runningCost -= outboundCost
        
        console.log(`记录${index + 1} 出库: -${rec.quantity}, -${outboundCost.toFixed(2)}, 单价:${avgPrice.toFixed(2)}, 当前库存:${runningQty}, 当前成本:${runningCost}`)
      }
    })
    
    // 计算本月合计的加权平均单价（库存结余成本价）
    const avgPrice = runningQty > 0 ? runningCost / runningQty : 0
    const result = Number(avgPrice.toFixed(2))
    
    console.log('✅ 本月合计成本价计算完成')
    console.log('计算明细:')
    console.log('  期初数据:', { qty: openingQty, cost: openingCost })
    console.log('  期末库存结余:', { qty: runningQty, cost: runningCost })
    console.log('  本月合计成本价:', result)
    
    return result
  } catch (error) {
    console.error('动态计算本月合计成本价失败:', error)
    return 0
  }
}

/**
 * 动态计算指定日期前的最后一笔业务的库存结余成本价
 * @param productId 产品 ID
 * @param warehouseId 仓库 ID
 * @param targetDateStr 目标日期 (YYYY-MM-DD)
 * @returns 成本价
 */
const calculateCostBeforeDate = (productId: number | undefined, warehouseId: number | undefined, targetDateStr: string): number => {
  if (!productId || !warehouseId || !targetDateStr) return 0
  
  try {
    const targetDate = new Date(targetDateStr)
    targetDate.setHours(23, 59, 59, 999) // 包含目标日期当天的所有业务
    
    console.log('========== calculateCostBeforeDate 调试 ==========')
    console.log('输入参数:', { productId, warehouseId, targetDateStr })
    console.log('目标日期:', targetDate.toISOString())
    
    // 初始化库存和成本
    let runningQty = 0
    let runningCost = 0
    
    // 获取所有出入库记录
    const allRecords: any[] = []
    
    // 扫描所有 localStorage 键
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        
        const arr = JSON.parse(raw)
        if (!Array.isArray(arr)) continue
        
        console.log('扫描 localStorage 键:', key)
        
        // 判断单据类型
        const isPurchaseReturn = key.includes('return') && (key.includes('purchase') || key.includes('inbound'))
        const isSalesReturn = key.includes('return') && (key.includes('sales') || key.includes('outbound'))
        const isInboundKey = key.includes('inbound') || key.includes('purchase') && !key.includes('return')
        const isOutboundKey = key.includes('outbound') || key.includes('sales') && !key.includes('return')
        const isTransferKey = key.includes('transfer')
        
        if (!isInboundKey && !isOutboundKey && !isTransferKey && !isPurchaseReturn && !isSalesReturn) {
          console.log('  → 跳过，不是入库/出库/调拨/退货单据')
          continue
        }
        
        console.log('  → 找到', arr.length, '条记录')
        
        arr.forEach((rec: any, recIndex: number) => {
          // 获取单据日期
          const recDateStr = rec.voucherDate || rec.orderDate || rec.date || rec.createdAt || rec.transferDate || ''
          if (!recDateStr) {
            console.log('    → 记录', recIndex, '没有日期，跳过')
            return
          }
          
          const recDate = new Date(recDateStr)
          if (recDate > targetDate) {
            console.log('    → 记录', recIndex, '日期', recDateStr, '超过目标日期，跳过')
            return
          }
          
          // 获取单据明细
          const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
          if (!Array.isArray(items)) {
            console.log('    → 记录', recIndex, '没有明细，跳过')
            return
          }
          
          console.log('    → 记录', recIndex, '日期', recDateStr, '有', items.length, '条明细')
          
          // 判断是入库还是出库
          let recWarehouseId = null
          let isInbound = false
          let isOutbound = false
          let isTransferOut = false
          let isTransferIn = false
          
          if (isTransferKey) {
            // 调拨单
            recWarehouseId = rec.fromWarehouseId || rec.toWarehouseId
            isTransferOut = Number(rec.fromWarehouseId) === Number(warehouseId)
            isTransferIn = Number(rec.toWarehouseId) === Number(warehouseId)
            console.log('      → 调拨单，fromWarehouseId:', rec.fromWarehouseId, 'toWarehouseId:', rec.toWarehouseId)
            console.log('      → isTransferOut:', isTransferOut, 'isTransferIn:', isTransferIn)
          } else if (isInboundKey || isSalesReturn) {
            // 入库单或销售退货（销售退货当作入库处理）
            recWarehouseId = rec.warehouseId
            isInbound = Number(recWarehouseId) === Number(warehouseId)
            console.log('      →', isSalesReturn ? '销售退货' : '入库单', 'warehouseId:', recWarehouseId, 'isInbound:', isInbound)
          } else if (isOutboundKey || isPurchaseReturn) {
            // 出库单或采购退货（采购退货当作出库处理）
            recWarehouseId = rec.warehouseId
            isOutbound = Number(recWarehouseId) === Number(warehouseId)
            console.log('      →', isPurchaseReturn ? '采购退货' : '出库单', 'warehouseId:', recWarehouseId, 'isOutbound:', isOutbound)
          }
          
          if (!isInbound && !isOutbound && !isTransferOut && !isTransferIn) {
            console.log('      → 仓库不匹配，跳过')
            return
          }
          
          items.forEach((it: any, itIndex: number) => {
            const itId = it.productId || it.id || null
            console.log('        → 明细', itIndex, '产品ID:', itId, '目标产品ID:', productId)
            
            if (itId !== productId) {
              console.log('        → 产品不匹配，跳过')
              return
            }
            
            let quantity = Number(it.quantity || 0)
            if (quantity <= 0) {
              console.log('        → 数量为0，跳过')
              return
            }
            
            // 优先使用不含税单价
            const costPrice = Number(it.unitPriceEx || it.costPrice || it.unitPrice || it.price || 0)
            const amount = Number(it.totalAmountEx || it.totalAmount || it.amount || (quantity * costPrice))
            
            console.log('        → ✅ 添加记录！数量:', quantity, '成本价:', costPrice, '金额:', amount, '类型:', 
              isSalesReturn ? '销售退货' : isPurchaseReturn ? '采购退货' : isTransferIn ? '调拨入库' : isTransferOut ? '调拨出库' : isInbound ? '入库' : '出库')
            
            // 添加到记录列表
            allRecords.push({
              date: recDate,
              isInbound: isInbound || isTransferIn,
              isOutbound: isOutbound || isTransferOut,
              quantity,
              costPrice,
              amount,
              rec,
              _timestamp: rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp
            })
          })
        })
      } catch (e) {
        console.warn('解析键', key, '失败:', e)
      }
    }
    
    console.log('=== 最终找到记录数量:', allRecords.length)
    
    if (allRecords.length === 0) {
      console.log('没有找到任何记录，返回0')
      return 0
    }
    
    // 按日期和时间戳排序（精确排序）
    allRecords.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime()
      if (dateCompare !== 0) return dateCompare
      
      // 如果日期相同，按时间戳排序
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
      
      if (timeA > 0 && timeB > 0) return timeA - timeB
      if (timeA > 0) return -1
      if (timeB > 0) return 1
      
      return 0
    })
    
    console.log('=== 排序后的记录 ===')
    allRecords.forEach((r, i) => {
      console.log(`${i + 1}. ${r.date.toISOString().slice(0, 10)} ${r.isInbound ? '入库/退货' : '出库/退货'} 数量:${r.quantity} 价格:${r.costPrice}`)
    })
    
    // 计算库存和成本
    allRecords.forEach((r, i) => {
      if (r.isInbound) {
        // 入库（包括销售退货）
        runningQty += r.quantity
        runningCost += r.amount
        console.log(`入库/销售退货 ${i + 1}: runningQty=${runningQty}, runningCost=${runningCost}`)
      } else if (r.isOutbound) {
        // 出库（包括采购退货），使用当前库存结余的成本价
        const costPrice = runningQty > 0 ? runningCost / runningQty : 0
        runningQty -= r.quantity
        runningCost -= r.quantity * costPrice
        console.log(`出库/采购退货 ${i + 1}: runningQty=${runningQty}, runningCost=${runningCost}, costPrice=${costPrice}`)
      }
    })
    
    // 计算最终成本价
    const finalCostPrice = runningQty > 0 ? runningCost / runningQty : 0
    const result = Number(finalCostPrice.toFixed(2))
    
    console.log('=== 最终计算结果 ===')
    console.log('runningQty:', runningQty)
    console.log('runningCost:', runningCost)
    console.log('finalCostPrice:', finalCostPrice)
    console.log('返回结果:', result)
    
    return result
  } catch (error) {
    console.error('动态计算成本价失败:', error)
    // 回退到加权平均成本
    return getWeightedAverageCost(productId, warehouseId)
  }
}

/**
 * 初始化成本计算：从系统启用时开始，为每个产品每个仓库计算历史库存结余
 * 用于软件启动时或首次使用时，建立完整的成本结算数据
 * @returns 生成的成本结算数据数组
 */
export const initializeCostCalculation = (): any[] => {
  console.log('========== 开始初始化成本计算 ==========')
  
  try {
    // 获取所有产品
    const products = JSON.parse(localStorage.getItem('products') || '[]')
    console.log('产品数量:', products.length)
    
    // 获取所有仓库
    const warehouses = JSON.parse(localStorage.getItem('warehouses') || '[]')
    console.log('仓库数量:', warehouses.length)
    
    if (products.length === 0 || warehouses.length === 0) {
      console.log('没有产品或仓库数据，跳过初始化')
      return []
    }
    
    // 收集所有出入库记录
    const allRecords: any[] = []
    
    // 扫描所有 localStorage 键
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        
        const arr = JSON.parse(raw)
        if (!Array.isArray(arr)) continue
        
        // 判断单据类型
        const isPurchaseReturn = key.includes('return') && (key.includes('purchase') || key.includes('inbound'))
        const isSalesReturn = key.includes('return') && (key.includes('sales') || key.includes('outbound'))
        const isInboundKey = key.includes('inbound') || (key.includes('purchase') && !key.includes('return'))
        const isOutboundKey = key.includes('outbound') || (key.includes('sales') && !key.includes('return'))
        const isTransferKey = key.includes('transfer')
        
        if (!isInboundKey && !isOutboundKey && !isTransferKey && !isPurchaseReturn && !isSalesReturn) {
          continue
        }
        
        arr.forEach((rec: any) => {
          // 获取单据日期
          const recDateStr = rec.voucherDate || rec.orderDate || rec.date || rec.createdAt || rec.transferDate || ''
          if (!recDateStr) return
          
          const recDate = new Date(recDateStr)
          
          // 获取单据明细
          const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
          if (!Array.isArray(items)) return
          
          // 获取调拨单信息
          const isTransferKey = key.includes('transfer')
          const fromWarehouseId = rec.fromWarehouseId
          const toWarehouseId = rec.toWarehouseId
          
          // 处理每条明细
          items.forEach((it: any) => {
            const itId = it.productId || it.id || null
            if (!itId) return
            
            // 获取数量，如果是负数则取绝对值
            let quantity = Number(it.quantity || 0)
            if (quantity === 0) return
            
            // 如果数量是负数，取绝对值（退货单可能记录为负数）
            const isNegativeQuantity = quantity < 0
            quantity = Math.abs(quantity)
            
            // 优先使用不含税单价
            const costPrice = Number(it.unitPriceEx || it.costPrice || it.unitPrice || it.price || 0)
            const amount = Number(it.totalAmountEx || it.totalAmount || it.amount || (quantity * costPrice))
            
            // 判断单据类型并添加记录
            const isPurchaseReturn = key.includes('return') && (key.includes('purchase') || key.includes('inbound'))
            const isSalesReturn = key.includes('return') && (key.includes('sales') || key.includes('outbound'))
            const isInboundKey = key.includes('inbound') || (key.includes('purchase') && !key.includes('return'))
            const isOutboundKey = key.includes('outbound') || (key.includes('sales') && !key.includes('return'))
            
            if (isTransferKey && fromWarehouseId && toWarehouseId) {
              // 调拨单：生成两条记录（调出和调入）
              
              // 1. 调出仓库：出库记录
              allRecords.push({
                productId: itId,
                productCode: it.productCode || it.code || it.sku || '',
                warehouseId: fromWarehouseId,
                date: recDate,
                dateStr: recDateStr.slice(0, 10),
                isInbound: false,
                isOutbound: true,
                isTransfer: true,
                quantity,
                costPrice,
                amount,
                _timestamp: rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp
              })
              
              // 2. 调入仓库：入库记录
              allRecords.push({
                productId: itId,
                productCode: it.productCode || it.code || it.sku || '',
                warehouseId: toWarehouseId,
                date: recDate,
                dateStr: recDateStr.slice(0, 10),
                isInbound: true,
                isOutbound: false,
                isTransfer: true,
                quantity,
                costPrice,
                amount,
                _timestamp: rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp
              })
            } else if (isInboundKey || isSalesReturn) {
              // 入库单或销售退货（销售退货当作入库处理）
              // 如果数量是负数，说明是负入库（实际是出库），需要反转处理
              const recWarehouseId = rec.warehouseId
              if (!recWarehouseId) return
              
              const actualIsInbound = isSalesReturn || (isInboundKey && !isNegativeQuantity)
              const actualIsOutbound = !actualIsInbound
              
              allRecords.push({
                productId: itId,
                productCode: it.productCode || it.code || it.sku || '',
                warehouseId: recWarehouseId,
                date: recDate,
                dateStr: recDateStr.slice(0, 10),
                isInbound: actualIsInbound,
                isOutbound: actualIsOutbound,
                isTransfer: false,
                quantity,
                costPrice,
                amount,
                _timestamp: rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp
              })
            } else if (isOutboundKey || isPurchaseReturn) {
              // 出库单或采购退货（采购退货当作出库处理）
              // 如果数量是负数，说明是负出库（实际是入库），需要反转处理
              const recWarehouseId = rec.warehouseId
              if (!recWarehouseId) return
              
              const actualIsOutbound = isPurchaseReturn || (isOutboundKey && !isNegativeQuantity)
              const actualIsInbound = !actualIsOutbound
              
              allRecords.push({
                productId: itId,
                productCode: it.productCode || it.code || it.sku || '',
                warehouseId: recWarehouseId,
                date: recDate,
                dateStr: recDateStr.slice(0, 10),
                isInbound: actualIsInbound,
                isOutbound: actualIsOutbound,
                isTransfer: false,
                quantity,
                costPrice,
                amount,
                _timestamp: rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp
              })
            }
          })
        })
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    console.log('收集到的出入库记录总数:', allRecords.length)
    
    if (allRecords.length === 0) {
      console.log('没有出入库记录，跳过初始化')
      return []
    }
    
    // 按日期排序
    allRecords.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime()
      if (dateCompare !== 0) return dateCompare
      
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
      
      if (timeA > 0 && timeB > 0) return timeA - timeB
      if (timeA > 0) return -1
      if (timeB > 0) return 1
      
      return 0
    })
    
    // 找到最早的日期
    const earliestDate = allRecords[0].date
    const latestDate = allRecords[allRecords.length - 1].date
    console.log('最早单据日期:', earliestDate.toISOString().slice(0, 10))
    console.log('最晚单据日期:', latestDate.toISOString().slice(0, 10))
    
    // 为每个产品每个仓库计算成本结算
    const settlements: any[] = []
    
    // 按月份分组
    const recordsByMonth = new Map<string, any[]>()
    allRecords.forEach((rec: any) => {
      const monthKey = rec.dateStr.slice(0, 7) // YYYY-MM
      if (!recordsByMonth.has(monthKey)) {
        recordsByMonth.set(monthKey, [])
      }
      recordsByMonth.get(monthKey)!.push(rec)
    })
    
    // 获取排序后的月份列表
    const sortedMonths = Array.from(recordsByMonth.keys()).sort()
    console.log('数据覆盖的月份:', sortedMonths)
    
    products.forEach((product: any) => {
      warehouses.forEach((warehouse: any) => {
        const productId = product.id
        const productCode = product.code
        const warehouseId = warehouse.id
        
        // 从 0 开始计算
        let runningQty = 0
        let runningCost = 0
        
        // 逐月计算
        sortedMonths.forEach((monthKey, index) => {
          const monthRecords = recordsByMonth.get(monthKey)!
            .filter((r: any) => 
              (r.productId === productId || r.productCode === productCode) && 
              r.warehouseId === warehouseId
            )
          
          if (monthRecords.length === 0) {
            return // 该月没有该产品的记录
          }
          
          // 计算该月的入库和出库
          const monthInboundQty = monthRecords
            .filter((r: any) => r.isInbound)
            .reduce((sum: number, r: any) => sum + r.quantity, 0)
          const monthInboundCost = monthRecords
            .filter((r: any) => r.isInbound)
            .reduce((sum: number, r: any) => sum + r.amount, 0)
          const monthOutboundQty = monthRecords
            .filter((r: any) => r.isOutbound)
            .reduce((sum: number, r: any) => sum + r.quantity, 0)
          
          // 处理该月的出入库记录
          monthRecords.forEach((rec: any) => {
            if (rec.isInbound) {
              runningQty += rec.quantity
              runningCost += rec.amount
            } else if (rec.isOutbound) {
              const avgPrice = runningQty > 0 ? runningCost / runningQty : 0
              const outboundCost = rec.quantity * avgPrice
              runningQty -= rec.quantity
              runningCost -= outboundCost
            }
          })
          
          // 如果该月有库存结余，生成结算数据
          if (runningQty > 0) {
            const avgPrice = runningCost / runningQty
            const monthEnd = new Date(monthKey + '-01')
            monthEnd.setMonth(monthEnd.getMonth() + 1)
            monthEnd.setDate(0) // 设置为月末
            
            settlements.push({
              productId: productId,
              productCode: productCode,
              productName: product.name,
              specification: product.specification || '',
              unit: product.unit || '',
              warehouseId: warehouseId,
              warehouseName: warehouse.name,
              periodRange: [monthKey + '-01', monthEnd.toISOString().slice(0, 10)],
              openingQty: index === 0 ? 0 : settlements.find((s: any) => 
                s.productId === productId && s.warehouseId === warehouseId
              )?.closingQty || 0,
              openingCost: index === 0 ? 0 : settlements.find((s: any) => 
                s.productId === productId && s.warehouseId === warehouseId
              )?.closingCost || 0,
              inboundQty: monthInboundQty,
              inboundCost: monthInboundCost,
              outboundQty: monthOutboundQty,
              outboundCost: monthOutboundQty * avgPrice,
              avgPrice: Number(avgPrice.toFixed(2)),
              closingQty: runningQty,
              closingCost: runningCost,
              _initialized: true // 标记为初始化数据
            })
            
            if (index === sortedMonths.length - 1) {
              console.log(`产品 ${productCode} ${product.name} 仓库 ${warehouse.name}: 库存=${runningQty}, 成本价=${avgPrice.toFixed(2)}`)
            }
          }
        })
      })
    })
    
    console.log('========== 初始化成本计算完成 ==========')
    console.log('生成的结算数据数量:', settlements.length)
    
    return settlements
  } catch (error) {
    console.error('初始化成本计算失败:', error)
    return []
  }
}
