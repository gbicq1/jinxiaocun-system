/**
 * 成本连续性结算测试工具
 * 用于验证连续性结算逻辑的正确性
 */

/**
 * 测试场景 1：系统启动时自动初始化
 */
export const testAutoInitialize = async () => {
  console.log('\n========== 测试场景 1：系统启动时自动初始化 ==========')
  
  try {
    const result = await (window as any).electron?.invoke?.('cost:auto-initialize')
    console.log('测试结果:', result)
    
    if (result && result.success) {
      console.log('✅ 测试通过：系统启动自动初始化成功')
      console.log('   结算月份:', result.settledMonths)
      console.log('   消息:', result.message)
    } else {
      console.warn('⚠️ 测试警告:', result?.message)
    }
  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

/**
 * 测试场景 2：新增当前月份单据
 */
export const testNewCurrentMonthDocument = async () => {
  console.log('\n========== 测试场景 2：新增当前月份单据 ==========')
  
  const today = new Date().toISOString().slice(0, 10)
  
  try {
    const result = await (window as any).electron?.invoke?.('cost:auto-settle-on-new', {
      documentDate: today,
      productCode: '01',
      warehouseId: 1
    })
    
    console.log('测试结果:', result)
    
    if (result && result.success) {
      console.log('✅ 测试通过：新增当前月份单据自动结算成功')
      console.log('   消息:', result.message)
    } else {
      console.warn('⚠️ 测试警告:', result?.message)
    }
  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

/**
 * 测试场景 3：新增历史月份单据（触发重算）
 */
export const testNewHistoricalDocument = async () => {
  console.log('\n========== 测试场景 3：新增历史月份单据 ==========')
  
  // 假设当前是 2026-03，测试新增 2026-01 的单据
  const historicalDate = '2026-01-15'
  
  try {
    const result = await (window as any).electron?.invoke?.('cost:auto-settle-on-new', {
      documentDate: historicalDate,
      productCode: '01',
      warehouseId: 1
    })
    
    console.log('测试结果:', result)
    
    if (result && result.success) {
      console.log('✅ 测试通过：新增历史单据触发重算成功')
      console.log('   消息:', result.message)
    } else {
      console.warn('⚠️ 测试警告:', result?.message)
    }
  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

/**
 * 测试场景 4：验证成本价连续性
 */
export const testCostContinuity = async () => {
  console.log('\n========== 测试场景 4：验证成本价连续性 ==========')
  
  try {
    // 获取 2026-02 的结算数据
    const febData = await (window as any).electron?.invoke?.('cost:get-settlement', {
      productCode: '01',
      warehouseId: 1,
      year: 2026,
      month: 2
    })
    
    // 获取 2026-03 的结算数据
    const marData = await (window as any).electron?.invoke?.('cost:get-settlement', {
      productCode: '01',
      warehouseId: 1,
      year: 2026,
      month: 3
    })
    
    console.log('2026-02 结算数据:', febData)
    console.log('2026-03 结算数据:', marData)
    
    if (febData && marData) {
      // 验证 3 月的期初是否等于 2 月的期末
      const febClosingQty = febData.closing_qty
      const febClosingCost = febData.closing_cost
      const marOpeningQty = marData.opening_qty
      const marOpeningCost = marData.opening_cost
      
      if (febClosingQty === marOpeningQty && febClosingCost === marOpeningCost) {
        console.log('✅ 测试通过：成本价连续性验证成功')
        console.log(`   2 月期末：数量=${febClosingQty}, 成本=${febClosingCost}`)
        console.log(`   3 月期初：数量=${marOpeningQty}, 成本=${marOpeningCost}`)
      } else {
        console.error('❌ 测试失败：成本价连续性不匹配')
        console.log(`   2 月期末：数量=${febClosingQty}, 成本=${febClosingCost}`)
        console.log(`   3 月期初：数量=${marOpeningQty}, 成本=${marOpeningCost}`)
      }
    } else {
      console.warn('⚠️ 测试警告：没有足够的结算数据')
    }
  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

/**
 * 运行所有测试
 */
export const runAllTests = async () => {
  console.log('\n\n')
  console.log('========================================')
  console.log('  成本连续性结算测试套件')
  console.log('========================================')
  console.log('\n')
  
  await testAutoInitialize()
  await testNewCurrentMonthDocument()
  await testNewHistoricalDocument()
  await testCostContinuity()
  
  console.log('\n\n')
  console.log('========================================')
  console.log('  测试完成')
  console.log('========================================')
}
