/**
 * 前端数据库访问工具类
 * 通过 IPC 访问 Electron 主进程的数据库
 */

/**
 * 产品
 */
export interface Product {
  id: number
  code: string
  name: string
  spec?: string
  unit?: string
  status?: number
}

/**
 * 仓库
 */
export interface Warehouse {
  id: number
  name: string
  status?: number
}

/**
 * 采购入库单
 */
export interface PurchaseInbound {
  id?: number
  bill_no: string
  bill_date: string
  warehouse_id: number
  supplier?: string
  items: Array<{
    product_id: string
    qty: number
    price: number
    amount: number
  }>
  status?: number
}

/**
 * 销售出库单
 */
export interface SalesOutbound {
  id?: number
  bill_no: string
  bill_date: string
  warehouse_id: number
  customer?: string
  items: Array<{
    product_id: string
    qty: number
    price: number
    amount: number
  }>
  status?: number
}

/**
 * 库存调拨单
 */
export interface InventoryTransfer {
  id?: number
  transfer_no: string
  transfer_date: string
  from_warehouse_id: number
  to_warehouse_id: number
  from_warehouse_name?: string
  to_warehouse_name?: string
  remark?: string
  status?: string
  items?: Array<{
    id?: number
    transfer_id?: number
    product_id: string
    product_name?: string
    quantity: number
    cost?: number
    amount?: number
  }>
}

/**
 * 成本结算数据
 */
export interface CostSettlement {
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
}

/**
 * 数据库访问类
 */
class DatabaseIPC {
  // ==================== 基础数据 ====================

  /**
   * 获取所有产品
   */
  async getProducts(): Promise<Product[]> {
    try {
      const result = await window.electron!.invoke!('db:products-list')
      console.log('getProducts 结果:', result)
      return result
    } catch (error) {
      console.error('获取产品列表失败:', error)
      return []
    }
  }

  /**
   * 获取所有仓库
   */
  async getWarehouses(): Promise<Warehouse[]> {
    try {
      const result = await window.electron!.invoke!('db:warehouses-list')
      console.log('getWarehouses 结果:', result)
      return result
    } catch (error) {
      console.error('获取仓库列表失败:', error)
      return []
    }
  }

  // ==================== 采购入库 ====================

  /**
   * 获取采购入库列表
   */
  async getPurchaseInbounds(
    page = 1,
    pageSize = 10000,
    where?: string,
    params?: any[]
  ): Promise<{ list: PurchaseInbound[]; total: number }> {
    try {
      return await window.electron!.invoke!('purchase-list', page, pageSize, where, params)
    } catch (error) {
      console.error('获取采购入库列表失败:', error)
      return { list: [], total: 0 }
    }
  }

  // ==================== 销售出库 ====================

  /**
   * 获取销售出库列表
   */
  async getSalesOutbounds(
    page = 1,
    pageSize = 10000,
    where?: string,
    params?: any[]
  ): Promise<{ list: SalesOutbound[]; total: number }> {
    try {
      return await window.electron!.invoke!('outbound-list', page, pageSize, where, params)
    } catch (error) {
      console.error('获取销售出库列表失败:', error)
      return { list: [], total: 0 }
    }
  }

  // ==================== 库存调拨 ====================

  /**
   * 获取库存调拨列表
   */
  async getTransfers(
    page = 1,
    pageSize = 10000,
    where?: string,
    params?: any[]
  ): Promise<{ data: InventoryTransfer[]; total: number }> {
    try {
      return await window.electron!.invoke!('transfer-list', page, pageSize, where, params)
    } catch (error) {
      console.error('获取调拨列表失败:', error)
      return { data: [], total: 0 }
    }
  }

  // ==================== 成本结算 ====================

  /**
   * 获取成本结算数据
   */
  async getCostSettlement(
    productCode: string,
    warehouseId: number,
    year: number,
    month: number
  ): Promise<CostSettlement | null> {
    try {
      return await window.electron!.invoke!('cost:get-settlement', {
        productCode,
        warehouseId,
        year,
        month
      })
    } catch (error) {
      console.error('获取成本结算数据失败:', error)
      return null
    }
  }

  /**
   * 获取指定期间的所有成本结算数据
   */
  async getCostSettlements(
    year: number,
    month: number,
    productCode?: string,
    warehouseId?: number
  ): Promise<CostSettlement[]> {
    try {
      return await window.electron!.invoke!('cost:get-settlements', {
        year,
        month,
        productCode,
        warehouseId
      })
    } catch (error) {
      console.error('获取成本结算列表失败:', error)
      return []
    }
  }

  /**
   * 保存成本结算数据
   */
  async saveCostSettlement(settlement: CostSettlement): Promise<void> {
    try {
      return await window.electron!.invoke!('cost:save-settlement', settlement)
    } catch (error) {
      console.error('保存成本结算数据失败:', error)
    }
  }

  /**
   * 批量保存成本结算数据
   */
  async saveCostSettlements(settlements: CostSettlement[]): Promise<void> {
    try {
      return await window.electron!.invoke!('cost:save-settlements', settlements)
    } catch (error) {
      console.error('批量保存成本结算数据失败:', error)
    }
  }

  /**
   * 检查月份是否已结算
   */
  async isCostSettled(year: number, month: number): Promise<boolean> {
    try {
      return await window.electron!.invoke!('cost:is-settled', { year, month })
    } catch (error) {
      console.error('检查结算状态失败:', error)
      return false
    }
  }

  /**
   * 获取已结算期间列表
   */
  async getSettledPeriods(): Promise<Array<{ year: number; month: number }>> {
    try {
      return await window.electron!.invoke!('cost:get-settled-periods')
    } catch (error) {
      console.error('获取已结算期间列表失败:', error)
      return []
    }
  }

  /**
   * 获取最新已结算期间
   */
  async getLatestSettledPeriod(): Promise<{ year: number; month: number } | null> {
    try {
      return await window.electron!.invoke!('cost:get-latest-settled-period')
    } catch (error) {
      console.error('获取最新已结算期间失败:', error)
      return null
    }
  }

  /**
   * 解锁月份
   */
  async unlockCostMonth(year: number, month: number): Promise<void> {
    try {
      return await window.electron!.invoke!('cost:unlock-month', { year, month })
    } catch (error) {
      console.error('解锁月份失败:', error)
    }
  }

  // ==================== 库存快照 ====================

  /**
   * 获取库存快照
   */
  async getSnapshot(
    productCode: string,
    warehouseId: number,
    date: string
  ): Promise<{ quantity: number; cost: number } | null> {
    try {
      return await window.electron!.invoke!('cost:get-snapshot', {
        productCode,
        warehouseId,
        date
      })
    } catch (error) {
      console.error('获取库存快照失败:', error)
      return null
    }
  }

  /**
   * 获取月末快照
   */
  async getMonthEndSnapshot(
    productCode: string,
    warehouseId: number,
    year: number,
    month: number
  ): Promise<{ quantity: number; cost: number } | null> {
    try {
      return await window.electron!.invoke!('cost:get-month-end-snapshot', {
        productCode,
        warehouseId,
        year,
        month
      })
    } catch (error) {
      console.error('获取月末快照失败:', error)
      return null
    }
  }

  /**
   * 保存库存快照
   */
  async saveSnapshot(
    productCode: string,
    productName: string,
    warehouseId: number,
    warehouseName: string,
    date: string,
    quantity: number,
    cost: number
  ): Promise<void> {
    try {
      return await window.electron!.invoke!('cost:save-snapshot', {
        product_code: productCode,
        product_name: productName,
        warehouse_id: warehouseId,
        warehouse_name: warehouseName,
        snapshot_date: date,
        quantity,
        cost
      })
    } catch (error) {
      console.error('保存库存快照失败:', error)
    }
  }

  // ==================== 采购退货 ====================

  /**
   * 获取采购退货单列表
   */
  async getPurchaseReturns(page = 1, pageSize = 10): Promise<{ data: any[]; total: number }> {
    try {
      return await window.electron!.purchaseReturnList!(page, pageSize)
    } catch (error) {
      console.error('获取采购退货单列表失败:', error)
      return { data: [], total: 0 }
    }
  }

  /**
   * 保存采购退货单
   */
  async savePurchaseReturn(returnData: any): Promise<number> {
    try {
      return await window.electron!.purchaseReturnAdd!(returnData)
    } catch (error) {
      console.error('保存采购退货单失败:', error)
      throw error
    }
  }

  /**
   * 更新采购退货单
   */
  async updatePurchaseReturn(returnData: any): Promise<void> {
    try {
      return await window.electron!.purchaseReturnUpdate!(returnData)
    } catch (error) {
      console.error('更新采购退货单失败:', error)
      throw error
    }
  }

  /**
   * 删除采购退货单
   */
  async deletePurchaseReturn(id: number): Promise<void> {
    try {
      return await window.electron!.purchaseReturnDelete!(id)
    } catch (error) {
      console.error('删除采购退货单失败:', error)
      throw error
    }
  }

  // ==================== 销售退货 ====================

  /**
   * 获取销售退货单列表
   */
  async getSalesReturns(page = 1, pageSize = 10): Promise<{ data: any[]; total: number }> {
    try {
      return await window.electron!.salesReturnList!(page, pageSize)
    } catch (error) {
      console.error('获取销售退货单列表失败:', error)
      return { data: [], total: 0 }
    }
  }

  /**
   * 保存销售退货单
   */
  async saveSalesReturn(returnData: any): Promise<number> {
    try {
      return await window.electron!.salesReturnAdd!(returnData)
    } catch (error) {
      console.error('保存销售退货单失败:', error)
      throw error
    }
  }

  /**
   * 更新销售退货单
   */
  async updateSalesReturn(returnData: any): Promise<void> {
    try {
      return await window.electron!.salesReturnUpdate!(returnData)
    } catch (error) {
      console.error('更新销售退货单失败:', error)
      throw error
    }
  }

  /**
   * 删除销售退货单
   */
  async deleteSalesReturn(id: number): Promise<void> {
    try {
      return await window.electron!.salesReturnDelete!(id)
    } catch (error) {
      console.error('删除销售退货单失败:', error)
      throw error
    }
  }
}

export const db = new DatabaseIPC()
