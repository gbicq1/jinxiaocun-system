/**
 * 成本结算自动检测工具
 * 用于在所有影响库存的单据保存时，自动检测并触发成本重新结算
 */

/**
 * 单据类型枚举
 */
export enum DocumentType {
  PURCHASE_INBOUND = 'purchase_inbound',      // 采购入库
  PURCHASE_RETURN = 'purchase_return',         // 采购退货
  SALES_OUTBOUND = 'sales_outbound',           // 销售出库
  SALES_RETURN = 'sales_return',               // 销售退货
  INVENTORY_TRANSFER = 'inventory_transfer',   // 库存调拨
  INVENTORY_INBOUND = 'inventory_inbound',     // 其他入库
  INVENTORY_OUTBOUND = 'inventory_outbound'    // 其他出库
}

/**
 * 单据项目接口
 */
export interface DocumentItem {
  productId?: string | number
  productCode?: string | number
  warehouseId?: string | number
  quantity?: number
  date?: string
  voucherDate?: string
  transferDate?: string
  countDate?: string
  adjustmentDate?: string
}

/**
 * 检测单据日期并触发成本重新结算
 * @param documentType 单据类型
 * @param items 单据明细（可能包含多个产品和仓库）
 * @param defaultDate 默认日期（如果 items 中没有日期）
 * @returns 是否需要重新结算
 */
export const checkAndRecalculateCost = async (
  documentType: DocumentType,
  items: DocumentItem[],
  defaultDate?: string
): Promise<{ needsRecalculation: boolean; message?: string }> => {
  try {
    const results: Array<{ needsRecalculation: boolean; message?: string }> = []

    for (const item of items) {
      // 1. 获取产品编码
      const productCode = String(item.productId || item.productCode || '')
      if (!productCode) continue

      // 2. 获取仓库 ID
      const warehouseId = Number(item.warehouseId || 0)
      if (!warehouseId) continue

      // 3. 获取单据日期
      const documentDate = item.date || item.voucherDate || item.transferDate || 
                          item.countDate || item.adjustmentDate || defaultDate
      if (!documentDate) continue

      // 4. 调用后端检测并触发重算
      const result = await (window as any).electron?.invoke?.(
        'cost:check-and-recalculate',
        {
          productCode,
          warehouseId,
          documentDate
        }
      )

      if (result && result.needsRecalculation) {
        results.push(result)
      }
    }

    // 5. 合并结果
    if (results.length > 0) {
      const messages = results.map(r => r.message).filter(Boolean)
      return {
        needsRecalculation: true,
        message: messages.join('\n')
      }
    }

    return { needsRecalculation: false }
  } catch (error) {
    console.error('检测成本重新结算失败:', error)
    return { needsRecalculation: false }
  }
}

/**
 * 显示成本重新结算提示
 * @param result 检测结果
 */
export const showCostRecalculationMessage = (result: { needsRecalculation: boolean; message?: string }) => {
  if (result.needsRecalculation && result.message) {
    // 使用 ElMessage 显示提示（需要确保已导入 ElMessage）
    const ElMessage = (window as any).ElMessage
    if (ElMessage) {
      ElMessage.info({
        message: result.message,
        duration: 3000,
        showClose: true
      })
    } else {
      console.log('成本重新结算提示:', result.message)
    }
  }
}

/**
 * 统一的单据保存后处理
 * 在所有影响库存的单据保存成功后调用
 */
export const handleDocumentSave = async (
  documentType: DocumentType,
  items: DocumentItem[],
  defaultDate?: string,
  showMessage: boolean = true
) => {
  const result = await checkAndRecalculateCost(documentType, items, defaultDate)
  
  if (showMessage && result.needsRecalculation) {
    showCostRecalculationMessage(result)
  }
  
  return result
}
