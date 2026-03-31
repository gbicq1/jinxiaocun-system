/**
 * 成本价获取工具（数据库版本）
 * 优先从数据库读取已结算的成本数据，如果没有则动态计算
 */

/**
 * 从数据库获取成本价
 */
export const getCostFromDatabase = async (
  productCode: string | number,
  warehouseId: number | string,
  targetDate: string
): Promise<number> => {
  try {
    const target = new Date(targetDate)
    const year = target.getFullYear()
    const month = target.getMonth() + 1

    console.log('========== getCostFromDatabase 调试 ==========')
    console.log('目标日期:', targetDate, '所属期间:', `${year}年${month}月`)

    // 1. 优先获取当月单月期间的结算数据（最精确）
    const currentSettled = await (window as any).electron?.invoke?.(
      'cost:get-settlement',
      {
        productCode: String(productCode),
        warehouseId: Number(warehouseId),
        year,
        month
      }
    )

    if (currentSettled && currentSettled.closing_qty > 0) {
      const cost = currentSettled.avg_cost || (currentSettled.closing_cost / currentSettled.closing_qty)
      console.log('✅ 从当月数据库获取成本价:', cost, '期间:', `${year}-${month}`)
      return Number(cost.toFixed(2))
    }

    // 2. 如果当月没有，尝试获取已锁定的当月数据
    const lockedSettled = await (window as any).electron?.invoke?.(
      'cost:get-locked-settlement',
      {
        productCode: String(productCode),
        warehouseId: Number(warehouseId),
        year,
        month
      }
    )

    if (lockedSettled && lockedSettled.closing_qty > 0) {
      console.log('✅ 从数据库获取已锁定成本价:', lockedSettled.avg_cost, '期间:', `${year}-${month}`)
      return Number(lockedSettled.avg_cost)
    }

    // 3. 如果当月未结算，尝试获取上月期末
    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth === 0) {
      prevYear = year - 1
      prevMonth = 12
    }

    const prevSettled = await (window as any).electron?.invoke?.(
      'cost:get-locked-settlement',
      {
        productCode: String(productCode),
        warehouseId: Number(warehouseId),
        year: prevYear,
        month: prevMonth
      }
    )

    if (prevSettled && prevSettled.closing_qty > 0) {
      const cost = prevSettled.closing_cost / prevSettled.closing_qty
      console.log('✅ 从上月数据库获取成本价:', cost, '期间:', `${prevYear}-${prevMonth}`)
      return Number(cost.toFixed(2))
    }

    // 4. 如果数据库没有，尝试从 localStorage 获取（兼容旧数据）
    const settlementsRaw = localStorage.getItem('cost_settlements')
    if (settlementsRaw) {
      const settlements = JSON.parse(settlementsRaw)
      
      // 查找匹配的记录（兼容 productId 和 productCode）
      const matchingSettlement = settlements.find((s: any) => {
        if (!s.periodRange || s.periodRange.length !== 2) return false
        
        const periodEnd = new Date(s.periodRange[1])
        const settlementYear = periodEnd.getFullYear()
        const settlementMonth = periodEnd.getMonth() + 1
        
        // 匹配期间
        if (settlementYear !== year || settlementMonth !== month) return false
        
        // 匹配产品（兼容多种 ID 格式）
        const productMatch = 
          String(s.productCode) === String(productCode) ||
          String(s.productId) === String(productCode) ||
          String(s.productCode) === String(productCode).padStart(3, '0') || // '01' -> '001'
          String(s.productId) === String(productCode).padStart(3, '0')
        
        // 匹配仓库
        const warehouseMatch = String(s.warehouseId) === String(warehouseId)
        
        return productMatch && warehouseMatch
      })
      
      if (matchingSettlement && matchingSettlement.avgPrice > 0) {
        console.log('✅ 从 localStorage 获取成本价:', matchingSettlement.avgPrice)
        return Number(matchingSettlement.avgPrice.toFixed(2))
      }
    }

    console.log('⚠️ 数据库中没有结算数据，使用动态计算')
    return 0
  } catch (error) {
    console.error('从数据库获取成本价失败:', error)
    return 0
  }
}

/**
 * 新增单据时自动触发成本结算
 * 在保存单据到 localStorage 后立即调用
 */
export const triggerAutoSettlement = async (
  documentDate: string,
  productCode?: string,
  warehouseId?: number
): Promise<void> => {
  try {
    console.log('========== 触发自动成本结算 ==========')
    console.log('单据日期:', documentDate)
    if (productCode && warehouseId) {
      console.log('产品:', productCode, '仓库:', warehouseId)
    }

    // 异步调用，不阻塞主流程
    // 使用 setTimeout 确保 localStorage 已经保存完成
    setTimeout(async () => {
      try {
        const result = await (window as any).electron?.invoke?.(
          'cost:auto-settle-on-new',
          {
            documentDate,
            productCode,
            warehouseId
          }
        )

        if (result && result.success) {
          console.log('✅ 自动结算成功:', result.message)
        } else {
          console.log('ℹ️ 自动结算提示:', result?.message || '无需操作')
        }
      } catch (error) {
        console.warn('⚠️ 自动结算失败:', error)
      }
    }, 100)
  } catch (error) {
    console.error('触发自动结算失败:', error)
  }
}

/**
 * 从 localStorage 动态计算成本价（后备方案）
 */
export const getCostFromSettlement = (
  productId: number | undefined,
  warehouseId: number | undefined,
  transferDate: string
): number => {
  if (!productId || !warehouseId || !transferDate) return 0

  try {
    const targetDate = new Date(transferDate)
    const year = targetDate.getFullYear()
    const month = targetDate.getMonth() + 1

    console.log('========== getCostFromSettlement 调试 ==========')
    console.log('调拨日期:', transferDate, '所属月份:', `${year}-${month}`)

    // 1. 先获取上月结转的库存结余作为期初数据
    const openingData = getOpeningInventory(year, month, productId, warehouseId)

    console.log('期初数据:', openingData)

    // 2. 获取当月所有库存单据
    const monthRecords = getAllInventoryRecordsForMonth(year, month, productId, warehouseId)

    console.log('当月业务记录数量:', monthRecords.length)

    // 3. 如果没有期初也没有当月业务，尝试获取上月数据
    if (openingData.qty === 0 && openingData.amount === 0 && monthRecords.length === 0) {
      console.log('⚠️ 当月没有业务且无期初，尝试获取上月数据')
      const lastMonthEnd = new Date(year, month - 1, 0)
      return getCostFromSettlement(productId, warehouseId, lastMonthEnd.toISOString().slice(0, 10))
    }

    // 4. 从期初数据开始，逐笔计算当月业务（只计算到调拨日期为止）
    let runningQty = openingData.qty
    let runningAmount = openingData.amount

    // 按日期排序当月业务
    monthRecords.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateA - dateB
    })

    // 5. 只计算调拨日期之前的业务
    const targetTime = targetDate.getTime()
    for (const rec of monthRecords) {
      const recTime = new Date(rec.date).getTime()
      
      // 只处理调拨日期之前的业务（包含当天早于调拨时间的业务）
      if (recTime > targetTime) {
        console.log('跳过调拨日期之后的业务:', rec)
        continue
      }
      
      if (rec.type === 'inbound') {
        // 入库：增加数量和金额
        runningQty += rec.qty
        runningAmount += rec.amount
      } else if (rec.type === 'outbound') {
        // 出库：减少数量，按当前成本价减少金额
        const currentCostPrice = runningQty > 0 ? runningAmount / runningQty : 0
        runningQty -= rec.qty
        runningAmount -= rec.qty * currentCostPrice
      }
    }

    // 6. 返回最后一笔业务后的成本价
    const finalCostPrice = runningQty > 0 ? runningAmount / runningQty : 0

    if (finalCostPrice > 0) {
      const result = Number(finalCostPrice.toFixed(2))
      console.log('✅ 最后一笔业务后的库存结余成本价:', result, '产品:', productId, '仓库:', warehouseId)
      console.log('期末库存:', runningQty, '期末成本:', runningAmount)
      return result
    }

    console.log('⚠️ 期末库存为 0')
    return 0

  } catch (error) {
    console.error('从成本结算获取成本价失败:', error)
    return 0
  }
}

/**
 * 获取期初库存数据（上月结转）
 */
const getOpeningInventory = (
  year: number,
  month: number,
  productId: number | undefined,
  warehouseId: number | undefined
): { qty: number; amount: number } => {
  // 上月最后一天
  const lastMonthEnd = new Date(year, month - 1, 0)
  const lastMonthEndStr = lastMonthEnd.toISOString().slice(0, 10)
  const lastMonthYear = lastMonthEnd.getFullYear()
  const lastMonth = lastMonthEnd.getMonth() + 1

  console.log('上月最后一天:', lastMonthEndStr, '所属期间:', `${lastMonthYear}-${lastMonth}`)

  // 尝试从成本结算数据中获取上月期末数据
  const settlementsRaw = localStorage.getItem('cost_settlements')
  if (settlementsRaw) {
    const settlements = JSON.parse(settlementsRaw)

    console.log('总结算数据数量:', settlements.length)

    // 查找上月的结算数据
    const lastMonthSettlement = settlements.find((s: any) => {
      if (!s.periodRange || s.periodRange.length !== 2) return false

      const periodEnd = new Date(s.periodRange[1])
      const settlementYear = periodEnd.getFullYear()
      const settlementMonth = periodEnd.getMonth() + 1

      // 匹配上一年度和月份
      const sameYear = settlementYear === lastMonthYear
      const sameMonth = settlementMonth === lastMonth

      const productMatch =
        (s.productId != null && Number(s.productId) === Number(productId)) ||
        (s.productCode != null && String(s.productCode) === String(productId))

      const warehouseMatch = s.warehouseId != null && Number(s.warehouseId) === Number(warehouseId)

      return sameYear && sameMonth && productMatch && warehouseMatch
    })

    if (lastMonthSettlement) {
      const closingQty = Number(lastMonthSettlement.closingQty || 0)
      const closingCost = Number(lastMonthSettlement.closingCost || 0)

      console.log('✅ 从上月结算数据获取期初:', {
        qty: closingQty,
        amount: closingCost,
        unitCost: closingQty > 0 ? (closingCost / closingQty).toFixed(2) : 0,
        periodRange: lastMonthSettlement.periodRange,
        productCode: lastMonthSettlement.productCode,
        productId: lastMonthSettlement.productId,
        warehouseId: lastMonthSettlement.warehouseId
      })
      return { qty: closingQty, amount: closingCost }
    } else {
      console.log('⚠️ 未找到上月结算数据，期间:', `${lastMonthYear}-${lastMonth}`)
      console.log('查找条件:', {
        targetYear: lastMonthYear,
        targetMonth: lastMonth,
        productId,
        warehouseId
      })

      // 输出所有 2 月份的结算数据用于调试
      const febSettlements = settlements.filter((s: any) => {
        if (!s.periodRange || s.periodRange.length !== 2) return false
        const periodEnd = new Date(s.periodRange[1])
        return periodEnd.getFullYear() === lastMonthYear && periodEnd.getMonth() + 1 === lastMonth
      })
      console.log('找到的所有上月结算数据（不匹配产品和仓库）:', febSettlements.map((s: any) => ({
        productCode: s.productCode,
        productId: s.productId,
        warehouseId: s.warehouseId,
        closingQty: s.closingQty,
        closingCost: s.closingCost,
        periodRange: s.periodRange
      })))
    }
  } else {
    console.log('⚠️ cost_settlements 为空')
  }

  // 如果没有上月结算数据，尝试动态计算上月最后一天的库存
  console.log('⚠️ 未找到上月结算数据，尝试动态计算上月所有业务')

  // 递归获取上月（上上月期末作为期初）
  const openingOfLastMonth = getOpeningInventory(lastMonthYear, lastMonth, productId, warehouseId)

  console.log('上月期初数据:', openingOfLastMonth)

  // 获取上月所有业务记录
  const lastMonthRecords = getAllInventoryRecordsForMonth(lastMonthYear, lastMonth, productId, warehouseId)

  console.log('上月业务记录数量:', lastMonthRecords.length)

  if (lastMonthRecords.length === 0) {
    console.log('上月没有业务记录，返回上月期初')
    return openingOfLastMonth
  }

  // 从上月期初开始，计算上月所有业务后的期末库存
  let runningQty = openingOfLastMonth.qty
  let runningAmount = openingOfLastMonth.amount

  lastMonthRecords.sort((a, b) => {
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()
    return dateA - dateB
  })

  for (const rec of lastMonthRecords) {
    if (rec.type === 'inbound') {
      runningQty += rec.qty
      runningAmount += rec.amount
    } else if (rec.type === 'outbound') {
      const currentCostPrice = runningQty > 0 ? runningAmount / runningQty : 0
      runningQty -= rec.qty
      runningAmount -= rec.qty * currentCostPrice
    }
  }

  console.log('✅ 动态计算上月期末:', { qty: runningQty, amount: runningAmount, unitCost: runningQty > 0 ? (runningAmount / runningQty).toFixed(2) : 0 })
  return { qty: runningQty, amount: runningAmount }
}

/**
 * 获取指定月份的所有库存记录
 */
const getAllInventoryRecordsForMonth = (
  year: number,
  month: number,
  productId: number | undefined,
  warehouseId: number | undefined
): Array<{ date: string; type: 'inbound' | 'outbound'; qty: number; amount: number }> => {
  const records: Array<{ date: string; type: 'inbound' | 'outbound'; qty: number; amount: number }> = []
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)

  // 采购入库
  const inboundKeys = ['purchase_inbound_records', 'purchaseInbounds', 'inbound_records', 'inbounds']
  for (const key of inboundKeys) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) continue

    for (const rec of arr) {
      const recDate = new Date(rec.voucherDate || rec.date || rec.createdAt)
      if (recDate < monthStart || recDate > monthEnd) continue
      if (Number(rec.warehouseId) !== Number(warehouseId)) continue

      const items = rec.items || rec.products || rec.details
      if (!Array.isArray(items)) continue

      for (const it of items) {
        if (Number(it.productId) !== Number(productId)) continue
        const qty = Number(it.quantity || 0)
        const amount = Number(it.totalAmountEx || it.totalAmount || it.amount)
        records.push({
          date: rec.voucherDate || rec.date || rec.createdAt,
          type: 'inbound',
          qty,
          amount
        })
      }
    }
  }

  // 销售出库
  const outboundKeys = ['sales_outbound_records', 'outbound_records', 'outbounds', 'delivery_records']
  for (const key of outboundKeys) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) continue

    for (const rec of arr) {
      const recDate = new Date(rec.voucherDate || rec.date || rec.createdAt)
      if (recDate < monthStart || recDate > monthEnd) continue
      if (Number(rec.warehouseId) !== Number(warehouseId)) continue

      const items = rec.items || rec.products || rec.details
      if (!Array.isArray(items)) continue

      for (const it of items) {
        if (Number(it.productId) !== Number(productId)) continue
        const qty = Number(it.quantity || 0)
        records.push({
          date: rec.voucherDate || rec.date || rec.createdAt,
          type: 'outbound',
          qty,
          amount: 0  // 出库金额在计算时确定
        })
      }
    }
  }

  return records
}

/**
 * 统一的成本价获取接口
 * 优先从数据库获取，如果没有则动态计算
 */
export const getCostPrice = async (
  productCode: string | number,
  warehouseId: number | string,
  targetDate: string
): Promise<number> => {
  // 1. 尝试从数据库获取
  const dbCost = await getCostFromDatabase(productCode, warehouseId, targetDate)
  if (dbCost > 0) {
    return dbCost
  }

  // 2. 从 localStorage 动态计算
  const productIdNum = typeof productCode === 'string' ? parseInt(productCode) : productCode
  const warehouseIdNum = typeof warehouseId === 'string' ? parseInt(warehouseId) : warehouseId
  return getCostFromSettlement(productIdNum, warehouseIdNum, targetDate)
}
