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
  bill_no: string
  bill_date: string
  from_warehouse_id: number
  to_warehouse_id: number
  items: Array<{
    product_id: string
    qty: number
  }>
  status?: number
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
    return window.electron?.ipcRenderer?.invoke?.('db:products-list') || []
  }

  /**
   * 获取所有仓库
   */
  async getWarehouses(): Promise<Warehouse[]> {
    return window.electron?.ipcRenderer?.invoke?.('db:warehouses-list') || []
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
    return window.electron?.ipcRenderer?.invoke?.('purchase-list', page, pageSize, where, params) || { list: [], total: 0 }
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
    return window.electron?.ipcRenderer?.invoke?.('outbound-list', page, pageSize, where, params) || { list: [], total: 0 }
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
  ): Promise<{ list: InventoryTransfer[]; total: number }> {
    return window.electron?.ipcRenderer?.invoke?.('transfer-list', page, pageSize, where, params) || { list: [], total: 0 }
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
    return window.electron?.ipcRenderer?.invoke?.('cost:get-settlement', {
      productCode,
      warehouseId,
      year,
      month
    })
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
    return window.electron?.ipcRenderer?.invoke?.('cost:get-settlements', {
      year,
      month,
      productCode,
      warehouseId
    })
  }

  /**
   * 保存成本结算数据
   */
  async saveCostSettlement(settlement: CostSettlement): Promise<void> {
    return window.electron?.ipcRenderer?.invoke?.('cost:save-settlement', settlement)
  }

  /**
   * 批量保存成本结算数据
   */
  async saveCostSettlements(settlements: CostSettlement[]): Promise<void> {
    return window.electron?.ipcRenderer?.invoke?.('cost:save-settlements', settlements)
  }

  /**
   * 检查月份是否已结算
   */
  async isCostSettled(year: number, month: number): Promise<boolean> {
    return window.electron?.ipcRenderer?.invoke?.('cost:is-settled', { year, month }) || false
  }

  /**
   * 获取已结算期间列表
   */
  async getSettledPeriods(): Promise<Array<{ year: number; month: number }>> {
    return window.electron?.ipcRenderer?.invoke?.('cost:get-settled-periods') || []
  }

  /**
   * 获取最新已结算期间
   */
  async getLatestSettledPeriod(): Promise<{ year: number; month: number } | null> {
    return window.electron?.ipcRenderer?.invoke?.('cost:get-latest-settled-period')
  }

  /**
   * 解锁月份
   */
  async unlockCostMonth(year: number, month: number): Promise<void> {
    return window.electron?.ipcRenderer?.invoke?.('cost:unlock-month', { year, month })
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
    return window.electron?.ipcRenderer?.invoke?.('cost:get-snapshot', {
      productCode,
      warehouseId,
      date
    })
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
    return window.electron?.ipcRenderer?.invoke?.('cost:get-month-end-snapshot', {
      productCode,
      warehouseId,
      year,
      month
    })
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
    return window.electron?.ipcRenderer?.invoke?.('cost:save-snapshot', {
      product_code: productCode,
      product_name: productName,
      warehouse_id: warehouseId,
      warehouse_name: warehouseName,
      snapshot_date: date,
      quantity,
      cost
    })
  }
}

export const db = new DatabaseIPC()
