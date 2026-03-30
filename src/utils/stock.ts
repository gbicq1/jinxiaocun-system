/**
 * 库存计算工具函数
 * 用于从出入库交易记录中计算实时库存
 */

// 从 localStorage 加载仓库列表
export const loadWarehousesFromStorage = () => {
  try {
    const saved = localStorage.getItem('warehouses')
    if (saved) {
      return JSON.parse(saved).filter((w: any) => w.status === 1)
    }
  } catch (error) {
    console.error('加载仓库列表失败:', error)
  }
  return []
}

// 从 localStorage 加载产品列表
export const loadProductsFromStorage = () => {
  try {
    const saved = localStorage.getItem('products')
    if (saved) {
      return JSON.parse(saved).filter((p: any) => p.status === 1)
    }
  } catch (error) {
    console.error('加载产品列表失败:', error)
  }
  return []
}

/**
 * 获取指定产品在指定仓库的实时库存
 * @param productId 产品 ID
 * @param warehouseId 仓库 ID
 * @returns 实时库存数量
 */
export const getRealTimeStock = (productId: number | undefined, warehouseId: number | undefined): number => {
  if (!productId || !warehouseId) return 0
  
  let stock = 0
  
  // 获取所有入库单（尝试多个可能的键名）
  const inboundKeys = ['purchase_inbound_records', 'purchaseInbounds', 'inbound_records', 'inbounds', 'purchase_inbounds']
  const outboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'sales_outbounds', 'salesOutbounds', 'delivery_records']
  const purchaseReturnsKeys = ['purchaseReturns', 'purchase_returns', 'purchase_return_records']
  const salesReturnsKeys = ['salesReturns', 'sales_returns', 'sales_return_records']
  const transferKeys = ['inventory_transfers']
  
  // 收集所有单据
  const allTransactions: any[] = []
  
  // 遍历 localStorage 中所有可能的出入库记录
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    
    // 判断单据类型
    let type: 'inbound' | 'outbound' | 'purchaseReturn' | 'salesReturn' | 'transferOut' | 'transferIn' | null = null
    
    if (inboundKeys.some(k => key.includes(k))) {
      type = 'inbound'
    } else if (outboundKeys.some(k => key.includes(k))) {
      type = 'outbound'
    } else if (purchaseReturnsKeys.some(k => key.includes(k))) {
      type = 'purchaseReturn'
    } else if (salesReturnsKeys.some(k => key.includes(k))) {
      type = 'salesReturn'
    } else if (transferKeys.some(k => key.includes(k))) {
      // 调拨单特殊处理，既可以是调出也可以是调入
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
        
        // 获取单据的日期和时间戳
        const recDate = rec.voucherDate || rec.orderDate || rec.date || rec.transferDate || '1970-01-01'
        const recTimestamp = rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp || recDate
        
        // 如果是调拨单
        if (transferKeys.some(k => key.includes(k))) {
          const recFromWarehouseId = rec.fromWarehouseId
          const recToWarehouseId = rec.toWarehouseId
          
          for (const it of items) {
            const itCode = String(it.productCode || it.code || it.sku || '').trim()
            const itName = String(it.productName || it.name || '').trim()
            const itId = it.productId || it.id || null
            
            // 匹配产品
            const match = (itId && itId === productId) || 
                         (itCode && String(itCode) === String(productId)) || 
                         (itName && itName === String(productId))
            
            if (!match) continue
            
            const qty = Number(it.quantity || it.qty || it.count || it.num || 0)
            
            // 调出仓库：减少库存
            if (recFromWarehouseId === warehouseId) {
              allTransactions.push({
                type: 'transferOut',
                date: recDate,
                timestamp: recTimestamp,
                quantity: qty
              })
            }
            
            // 调入仓库：增加库存
            if (recToWarehouseId === warehouseId) {
              allTransactions.push({
                type: 'transferIn',
                date: recDate,
                timestamp: recTimestamp,
                quantity: qty
              })
            }
          }
        } else {
          // 获取单据的仓库 ID
          const recWarehouseId = rec.warehouseId
          const recWarehouseName = rec.warehouseName
          
          // 检查仓库是否匹配 - 使用 Number() 转换确保类型一致
          const warehouseMatch = (recWarehouseId != null && Number(recWarehouseId) === Number(warehouseId)) || 
                                (recWarehouseName && recWarehouseName === String(warehouseId))
          
          if (!warehouseMatch) continue
          
          for (const it of items) {
            const itCode = String(it.productCode || it.code || it.sku || '').trim()
            const itName = String(it.productName || it.name || '').trim()
            const itId = it.productId || it.id || null
            
            // 匹配产品
            const match = (itId && itId === productId) || 
                         (itCode && String(itCode) === String(productId)) || 
                         (itName && itName === String(productId))
            
            if (!match) continue
            
            const qty = Number(it.quantity || it.qty || it.count || it.num || 0)
            
            allTransactions.push({
              type,
              date: recDate,
              timestamp: recTimestamp,
              quantity: qty
            })
          }
        }
      }
    } catch (error) {
      console.error(`处理 ${key} 时出错:`, error)
    }
  }
  
  // 按日期和时间戳正序排序
  allTransactions.sort((a, b) => {
    const dateA = new Date(a.date || '1970-01-01').getTime()
    const dateB = new Date(b.date || '1970-01-01').getTime()
    if (dateA !== dateB) {
      return dateA - dateB
    }
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0
    return timeA - timeB
  })
  
  // 按顺序计算库存
  for (const tx of allTransactions) {
    if (tx.type === 'inbound' || tx.type === 'salesReturn' || tx.type === 'transferIn') {
      stock += tx.quantity
    } else if (tx.type === 'outbound' || tx.type === 'purchaseReturn' || tx.type === 'transferOut') {
      stock -= tx.quantity
    }
  }
  
  return stock
}

/**
 * 获取指定产品在指定仓库、指定日期和时间之前的库存（精确到时间戳）
 * @param productId 产品 ID
 * @param warehouseId 仓库 ID
 * @param beforeDate 截止日期（YYYY-MM-DD）
 * @param beforeTimestamp 截止时间戳（ISO 字符串或 Date 对象）
 * @param excludeDocId 要排除的单据 ID（用于编辑时）
 * @returns 截止时间前的库存数量
 */
export const getStockBeforeDateTime = (
  productId: number | undefined, 
  warehouseId: number | undefined, 
  beforeDate: string,
  beforeTimestamp?: string | Date,
  excludeDocId?: number | string
): number => {
  if (!productId || !warehouseId) return 0
  
  let stock = 0
  
  // 获取所有入库单（尝试多个可能的键名）
  const inboundKeys = ['purchase_inbound_records', 'purchaseInbounds', 'inbound_records', 'inbounds', 'purchase_inbounds']
  const outboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'sales_outbounds', 'salesOutbounds', 'delivery_records']
  const purchaseReturnsKeys = ['purchaseReturns', 'purchase_returns', 'purchase_return_records']
  const salesReturnsKeys = ['salesReturns', 'sales_returns', 'sales_return_records']
  const transferKeys = ['inventory_transfers']
  
  // 收集所有单据
  const allTransactions: any[] = []
  
  // 遍历 localStorage 中所有可能的出入库记录
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    
    // 判断单据类型
    let type: 'inbound' | 'outbound' | 'purchaseReturn' | 'salesReturn' | 'transferOut' | 'transferIn' | null = null
    
    if (inboundKeys.some(k => key.includes(k))) {
      type = 'inbound'
    } else if (outboundKeys.some(k => key.includes(k))) {
      type = 'outbound'
    } else if (purchaseReturnsKeys.some(k => key.includes(k))) {
      type = 'purchaseReturn'
    } else if (salesReturnsKeys.some(k => key.includes(k))) {
      type = 'salesReturn'
    } else if (transferKeys.some(k => key.includes(k))) {
      // 调拨单特殊处理
    } else {
      continue
    }
    
    const raw = localStorage.getItem(key)
    if (!raw) continue
    
    try {
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) continue
      
      for (const rec of arr) {
        // 排除指定的单据
        if (excludeDocId && rec.id === excludeDocId) continue
        
        const items = rec.items || rec.products || rec.details || rec.lines || rec.itemsList
        if (!Array.isArray(items)) continue
        
        // 获取单据的日期和时间戳
        const recDate = rec.voucherDate || rec.orderDate || rec.date || rec.transferDate || '1970-01-01'
        const recTimestamp = rec.createdAt || rec.createdTime || rec.createTime || rec.timestamp || recDate
        
        // 检查是否在截止时间之前
        const recDateTime = new Date(recTimestamp || recDate).getTime()
        const beforeDateTime = beforeTimestamp 
          ? new Date(beforeTimestamp).getTime() 
          : new Date(beforeDate + ' 23:59:59.999').getTime()
        
        // 如果单据日期晚于截止日期，跳过
        if (recDate > beforeDate) continue
        
        // 如果日期相同，但时间戳晚于截止时间，跳过
        if (recDate === beforeDate && recDateTime >= beforeDateTime) continue
        
        // 如果是调拨单
        if (transferKeys.some(k => key.includes(k))) {
          const recFromWarehouseId = rec.fromWarehouseId
          const recToWarehouseId = rec.toWarehouseId
          
          for (const it of items) {
            const itCode = String(it.productCode || it.code || it.sku || '').trim()
            const itName = String(it.productName || it.name || '').trim()
            const itId = it.productId || it.id || null
            
            // 匹配产品
            const match = (itId && itId === productId) || 
                         (itCode && String(itCode) === String(productId)) || 
                         (itName && itName === String(productId))
            
            if (!match) continue
            
            const qty = Number(it.quantity || it.qty || it.count || it.num || 0)
            
            // 调出仓库：减少库存
            if (recFromWarehouseId === warehouseId) {
              allTransactions.push({
                type: 'transferOut',
                date: recDate,
                timestamp: recTimestamp,
                quantity: qty
              })
            }
            
            // 调入仓库：增加库存
            if (recToWarehouseId === warehouseId) {
              allTransactions.push({
                type: 'transferIn',
                date: recDate,
                timestamp: recTimestamp,
                quantity: qty
              })
            }
          }
        } else {
          // 获取单据的仓库 ID
          const recWarehouseId = rec.warehouseId
          const recWarehouseName = rec.warehouseName
          
          // 检查仓库是否匹配 - 使用 Number() 转换确保类型一致
          const warehouseMatch = (recWarehouseId != null && Number(recWarehouseId) === Number(warehouseId)) || 
                                (recWarehouseName && recWarehouseName === String(warehouseId))
          
          if (!warehouseMatch) continue
          
          for (const it of items) {
            const itCode = String(it.productCode || it.code || it.sku || '').trim()
            const itName = String(it.productName || it.name || '').trim()
            const itId = it.productId || it.id || null
            
            // 匹配产品
            const match = (itId && itId === productId) || 
                         (itCode && String(itCode) === String(productId)) || 
                         (itName && itName === String(productId))
            
            if (!match) continue
            
            const qty = Number(it.quantity || it.qty || it.count || it.num || 0)
            
            allTransactions.push({
              type,
              date: recDate,
              timestamp: recTimestamp,
              quantity: qty
            })
          }
        }
      }
    } catch (error) {
      console.error(`处理 ${key} 时出错:`, error)
    }
  }
  
  // 按日期和时间戳正序排序
  allTransactions.sort((a, b) => {
    const dateA = new Date(a.date || '1970-01-01').getTime()
    const dateB = new Date(b.date || '1970-01-01').getTime()
    if (dateA !== dateB) {
      return dateA - dateB
    }
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0
    return timeA - timeB
  })
  
  // 从第一条记录开始，逐条计算库存变化
  for (const tx of allTransactions) {
    if (tx.type === 'inbound' || tx.type === 'salesReturn' || tx.type === 'transferIn') {
      stock += tx.quantity
    } else if (tx.type === 'outbound' || tx.type === 'purchaseReturn' || tx.type === 'transferOut') {
      stock -= tx.quantity
    }
  }
  
  return stock
}

/**
 * 获取指定产品在指定仓库、指定日期之前的库存（不包括该日期的单据）
 * @param productId 产品 ID
 * @param warehouseId 仓库 ID
 * @param beforeDate 截止日期（YYYY-MM-DD）
 * @param excludeDocId 要排除的单据 ID（用于编辑时）
 * @returns 截止日期前的库存数量
 * @deprecated 使用 getStockBeforeDateTime 替代，支持精确到时间戳
 */
export const getStockBeforeDate = (
  productId: number | undefined, 
  warehouseId: number | undefined, 
  beforeDate: string,
  excludeDocId?: number | string
): number => {
  return getStockBeforeDateTime(productId, warehouseId, beforeDate, undefined, excludeDocId)
}

/**
 * 获取库存计算明细（用于调试显示）
 * @param productId 产品 ID
 * @param warehouseId 仓库 ID
 * @returns 库存数量和明细列表
 */
export const getStockDetails = (productId: number | undefined, warehouseId: number | undefined) => {
  if (!productId || !warehouseId) return { stock: 0, details: [] }
  
  let stock = 0
  const details: string[] = []
  
  // 获取所有入库单
  const inboundKeys = ['purchase_inbound_records', 'purchaseInbounds', 'inbound_records', 'inbounds', 'purchase_inbounds']
  const outboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'sales_outbounds', 'salesOutbounds', 'delivery_records']
  const purchaseReturnsKeys = ['purchaseReturns', 'purchase_returns', 'purchase_return_records']
  const salesReturnsKeys = ['salesReturns', 'sales_returns', 'sales_return_records']
  
  // 遍历 localStorage 中所有可能的出入库记录
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    
    // 判断单据类型
    let isInbound = false
    let isOutbound = false
    let isPurchaseReturn = false
    let isSalesReturn = false
    
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
        
        // 检查仓库是否匹配 - 使用 Number() 转换确保类型一致
        const warehouseMatch = (recWarehouseId != null && Number(recWarehouseId) === Number(warehouseId)) || 
                              (recWarehouseName && recWarehouseName === String(warehouseId))
        
        if (!warehouseMatch) continue
        
        for (const it of items) {
          const itCode = String(it.productCode || it.code || it.sku || '').trim()
          const itName = String(it.productName || it.name || '').trim()
          const itId = it.productId || it.id || null
          
          // 匹配产品
          const match = (itId && itId === productId) || 
                       (itCode && String(itCode) === String(productId)) || 
                       (itName && itName === String(productId))
          
          if (!match) continue
          
          const qty = Number(it.quantity || it.qty || it.count || it.num || 0)
          const voucherNo = rec.voucherNo || rec.no || rec.voucher_no || ''
          
          if (isInbound) {
            stock += qty
            details.push(`入库单 ${voucherNo}: +${qty}`)
          } else if (isOutbound) {
            stock -= qty
            details.push(`出库单 ${voucherNo}: -${qty}`)
          } else if (isPurchaseReturn) {
            stock -= qty
            details.push(`采购退货 ${voucherNo}: -${qty}`)
          } else if (isSalesReturn) {
            stock += qty
            details.push(`销售退货 ${voucherNo}: +${qty}`)
          }
        }
      }
    } catch (error) {
      console.error(`处理 ${key} 时出错:`, error)
    }
  }
  
  return { stock, details }
}
