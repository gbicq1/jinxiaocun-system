/**
 * 前端数据库访问工具类
 * 通过 IPC 访问 Electron 主进程的数据库
 * 
 * 修复说明：原版使用了错误的 IPC 调用方式（window.electron!.invoke!）
 * 现已修正为正确的直接调用方式（window.electron.xxx()）
 */

// 声明 window.electron 类型（避免 TypeScript 错误）
declare global {
  interface Window {
    electron: {
      // 数据库基本操作
      dbQuery: (tableOrSql: string, sqlOrParams?: any, params?: any[]) => Promise<any>
      dbInsert: (table: string, data: any) => Promise<number>
      dbUpdate: (table: string, data: any, where: string, whereParams?: any[]) => Promise<number>
      dbDelete: (table: string, where: string, whereParams?: any[]) => Promise<number>
      dbTransaction: (operations: any[]) => Promise<any>

      // 产品管理
      productList: (page?: number, pageSize?: number) => Promise<any>
      productAdd: (product: any) => Promise<number>
      productUpdate: (product: any) => Promise<number>
      productDelete: (id: number) => Promise<number>

      // 仓库管理
      warehouseList: () => Promise<any[]>
      warehouseAdd: (warehouse: any) => Promise<number>
      warehouseUpdate: (warehouse: any) => Promise<number>
      warehouseDelete: (id: number) => Promise<number>

      // 供应商管理
      supplierList: () => Promise<any[]>
      supplierAdd: (supplier: any) => Promise<number>
      supplierUpdate: (supplier: any) => Promise<number>
      supplierDelete: (id: number) => Promise<number>

      // 客户管理
      customerList: () => Promise<any[]>
      customerAdd: (customer: any) => Promise<number>
      customerUpdate: (customer: any) => Promise<number>
      customerDelete: (id: number) => Promise<number>

      // 采购入库
      inboundList: (page?: number, pageSize?: number, where?: string, params?: any[]) => Promise<any>
      inboundAdd: (inbound: any) => Promise<number>
      inboundUpdate: (inbound: any) => Promise<number>
      inboundDelete: (id: number) => Promise<void>

      // 销售出库
      outboundList: (page?: number, pageSize?: number, where?: string, params?: any[]) => Promise<any>
      outboundAdd: (outbound: any) => Promise<number>
      outboundUpdate: (outbound: any) => Promise<number>
      outboundDelete: (id: number) => Promise<void>

      // 库存调拨
      transferList: (page?: number, pageSize?: number, where?: string, params?: any[]) => Promise<any>
      transferAdd: (transfer: any) => Promise<number>
      transferUpdate: (transfer: any) => Promise<number>
      transferDelete: (id: number) => Promise<void>

      // 采购退货
      purchaseReturnList: (page?: number, pageSize?: number) => Promise<any>
      purchaseReturnAdd: (returnData: any) => Promise<number>
      purchaseReturnUpdate: (returnData: any) => Promise<number>
      purchaseReturnDelete: (id: number) => Promise<void>

      // 销售退货
      salesReturnList: (page?: number, pageSize?: number) => Promise<any>
      salesReturnAdd: (returnData: any) => Promise<number>
      salesReturnUpdate: (returnData: any) => Promise<number>
      salesReturnDelete: (id: number) => Promise<void>

      // 库存查询
      inventoryQuery: (warehouseId?: number, productCode?: string) => Promise<any>
      productStock: (productId: number, warehouseId: number) => Promise<number>

      // 成本结算
  costSettlementQuery: (year: number, month: number, productCode?: string, warehouseId?: number) => Promise<any>

  // ==================== 成本结算模块（扩展）====================
  costSaveSettlement: (settlement: any) => Promise<void>
  costSaveSettlements: (settlements: any[]) => Promise<void>
  costIsSettled: (params: { year: number; month: number }) => Promise<boolean>
  costGetSettledPeriods: () => Promise<Array<{ year: number; month: number }>>
  costGetLatestSettledPeriod: () => Promise<{ year: number; month: number } | null>
  costUnlockMonth: (params: { year: number; month: number }) => Promise<void>
  costInitialize: (params: { year: number; month: number }) => Promise<any>
  costAutoComplete: () => Promise<any>
  costReverse: (params: { year: number; month: number }) => Promise<any>
  costSettlementSummary: (params: any) => Promise<any>
  costSalesSummary: (params: any) => Promise<any>
  costTransferSummary: (params: any) => Promise<any>
  costTransactionDetails: (params: any) => Promise<any>
  costProductDetailLedger: (params: any) => Promise<any>
  costGetSnapshot: (params: any) => Promise<{ quantity: number; cost: number } | null>
  costGetMonthEndSnapshot: (params: any) => Promise<{ quantity: number; cost: number } | null>
  costGetProductCost: (params: any) => Promise<number | null>
  costSaveSnapshot: (snapshot: any) => Promise<void>

  // ==================== 收付款管理 ====================
  receiptList: () => Promise<any[]>
  receiptAdd: (data: any) => Promise<any>
  receiptUpdate: (data: any) => Promise<void>
  receiptDelete: (id: number) => Promise<void>
  paymentList: () => Promise<any[]>
  paymentAdd: (data: any) => Promise<any>
  paymentUpdate: (data: any) => Promise<void>
  paymentDelete: (id: number) => Promise<void>

  // ==================== 用户权限管理 ====================
  userList: () => Promise<any[]>
  userAdd: (data: any) => Promise<number>
  userUpdate: (data: any) => Promise<void>
  userDelete: (id: number) => Promise<void>
  roleList: () => Promise<any[]>
  employeeList: () => Promise<any[]>

  // 数据库备份
  dbBackupManual: () => Promise<any>
  dbBackupRestore: () => Promise<any>
  dbBackupList: () => Promise<any>
  dbExport: () => Promise<any>
  dbInfo: () => Promise<any>
  
  // 开票记录
  getInvoiceRecord: (inboundNo: string) => Promise<any>
  saveInvoiceRecord: (recordData: any) => Promise<number>
    }
  }
}

export interface Product {
  id: number
  code: string
  name: string
  spec?: string
  unit?: string
  status?: number
}

export interface Warehouse {
  id: number
  name: string
  status?: number
}

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
    amount: number
  }>
}

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

class DatabaseIPC {
  private get electron() {
    if (!window.electron) {
      throw new Error('Electron API 不可用，请确保在 Electron 环境中运行')
    }
    return window.electron
  }

  // ==================== 基础数据 ====================

  async getProducts(): Promise<Product[]> {
    try {
      const result = await this.electron.productList()
      let products: any[] = []
      if (Array.isArray(result)) {
        products = result
      } else if (result && Array.isArray(result.data)) {
        products = result.data
      }
      console.log('[DB-IPC] getProducts 成功:', products.length, '条记录')
      return products
    } catch (error) {
      console.error('[DB-IPC] 获取产品列表失败:', error)
      return []
    }
  }

  async getWarehouses(): Promise<Warehouse[]> {
    try {
      const result = await this.electron.warehouseList()
      let warehouses: any[] = []
      if (Array.isArray(result)) {
        warehouses = result
      } else if (result && Array.isArray(result.data)) {
        warehouses = result.data
      }
      console.log('[DB-IPC] getWarehouses 成功:', warehouses.length, '条记录')
      return warehouses
    } catch (error) {
      console.error('[DB-IPC] 获取仓库列表失败:', error)
      return []
    }
  }

  // ==================== 采购入库 ====================

  async getPurchaseInbounds(
    page = 1,
    pageSize = 10000,
    where?: string,
    params?: any[]
  ): Promise<{ list: PurchaseInbound[]; total: number }> {
    try {
      return await this.electron.inboundList(page, pageSize, where, params)
    } catch (error) {
      console.error('[DB-IPC] 获取采购入库列表失败:', error)
      return { list: [], total: 0 }
    }
  }

  // ==================== 销售出库 ====================

  async getSalesOutbounds(
    page = 1,
    pageSize = 10000,
    where?: string,
    params?: any[]
  ): Promise<{ list: SalesOutbound[]; total: number }> {
    try {
      return await this.electron.outboundList(page, pageSize, where, params)
    } catch (error) {
      console.error('[DB-IPC] 获取销售出库列表失败:', error)
      return { list: [], total: 0 }
    }
  }

  // ==================== 库存调拨 ====================

  async getTransfers(
    page = 1,
    pageSize = 10000,
    where?: string,
    params?: any[]
  ): Promise<{ data: InventoryTransfer[]; total: number }> {
    try {
      return await this.electron.transferList(page, pageSize, where, params)
    } catch (error) {
      console.error('[DB-IPC] 获取调拨列表失败:', error)
      return { data: [], total: 0 }
    }
  }

  // ==================== 成本结算 ====================

  async getCostSettlement(
    params: {
      year: number,
      month: number,
      productCode?: string,
      warehouseId?: number
    }
  ): Promise<CostSettlement | null> {
    try {
      return await this.electron.costSettlementQuery(params.year, params.month, params.productCode, params.warehouseId)
    } catch (error) {
      console.error('[DB-IPC] 获取成本结算数据失败:', error)
      return null
    }
  }

  async getCostSettlements(
    year: number,
    month: number,
    productCode?: string,
    warehouseId?: number
  ): Promise<CostSettlement[]> {
    try {
      const result = await this.electron.costSettlementQuery(year, month, productCode, warehouseId)
      return Array.isArray(result) ? result : (result ? [result] : [])
    } catch (error) {
      console.error('[DB-IPC] 获取成本结算列表失败:', error)
      return []
    }
  }

  async saveCostSettlement(settlement: CostSettlement): Promise<void> {
    try {
      await this.electron.costSaveSettlement(settlement)
    } catch (error) {
      console.error('[DB-IPC] 保存成本结算数据失败:', error)
    }
  }

  async saveCostSettlements(settlements: CostSettlement[]): Promise<void> {
    try {
      await this.electron.costSaveSettlements(settlements)
    } catch (error) {
      console.error('[DB-IPC] 批量保存成本结算数据失败:', error)
    }
  }

  async isCostSettled(year: number, month: number): Promise<boolean> {
    try {
      return await this.electron.costIsSettled({ year, month })
    } catch (error) {
      console.error('[DB-IPC] 检查结算状态失败:', error)
      return false
    }
  }

  async getSettledPeriods(): Promise<Array<{ year: number; month: number }>> {
    try {
      return await this.electron.costGetSettledPeriods()
    } catch (error) {
      console.error('[DB-IPC] 获取已结算期间列表失败:', error)
      return []
    }
  }

  async getLatestSettledPeriod(): Promise<{ year: number; month: number } | null> {
    try {
      return await this.electron.costGetLatestSettledPeriod()
    } catch (error) {
      console.error('[DB-IPC] 获取最新已结算期间失败:', error)
      return null
    }
  }

  async unlockCostMonth(year: number, month: number): Promise<void> {
    try {
      await this.electron.costUnlockMonth({ year, month })
    } catch (error) {
      console.error('[DB-IPC] 解锁月份失败:', error)
    }
  }

  async initializeCostData(params: { year: number; month: number }): Promise<any> {
    try {
      return await this.electron.costInitialize(params)
    } catch (error) {
      console.error('[DB-IPC] 成本初始化失败:', error)
      return { success: false, message: '初始化失败' }
    }
  }

  async initializeAllHistory(): Promise<any> {
    try {
      return await this.electron.costAutoComplete()
    } catch (error) {
      console.error('[DB-IPC] 初始化历史失败:', error)
      return { success: false, message: '初始化失败', settledMonths: 0 }
    }
  }

  async reverseCostSettlement(params: { year: number; month: number }): Promise<any> {
    try {
      return await this.electron.costReverse(params)
    } catch (error) {
      console.error('[DB-IPC] 反结算失败:', error)
      return { success: false, message: '反结算失败' }
    }
  }

  async getCostSettlementSummary(params: any): Promise<any> {
    try {
      return await this.electron.costSettlementSummary(params)
    } catch (error) {
      console.error('[DB-IPC] 获取成本结算汇总失败:', error)
      return null
    }
  }

  async getSalesCostSummary(params: any): Promise<any> {
    try {
      return await this.electron.costSalesSummary(params)
    } catch (error) {
      console.error('[DB-IPC] 获取销售成本统计失败:', error)
      return null
    }
  }

  async getTransferCostSummary(params: any): Promise<any> {
    try {
      return await this.electron.costTransferSummary(params)
    } catch (error) {
      console.error('[DB-IPC] 获取调拨成本统计失败:', error)
      return null
    }
  }

  async getTransactionDetails(params: any): Promise<any> {
    try {
      return await this.electron.costTransactionDetails(params)
    } catch (error) {
      console.error('[DB-IPC] 获取出入库明细失败:', error)
      return null
    }
  }

  async getProductDetailLedger(params: any): Promise<any> {
    try {
      const result = await this.electron.costProductDetailLedger(params)
      if (result) {
        return { success: true, data: result }
      }
      return { success: false, message: '获取明细账失败' }
    } catch (error) {
      console.error('[DB-IPC] 获取商品明细账失败:', error)
      return { success: false, message: '获取明细账失败' }
    }
  }

  async getSnapshot(
    productCode: string,
    warehouseId: number,
    date: string
  ): Promise<{ quantity: number; cost: number } | null> {
    try {
      return await this.electron.costGetSnapshot({
        productCode,
        warehouseId,
        date
      })
    } catch (error) {
      console.error('[DB-IPC] 获取库存快照失败:', error)
      return null
    }
  }

  async getMonthEndSnapshot(
    productCode: string,
    warehouseId: number,
    year: number,
    month: number
  ): Promise<{ quantity: number; cost: number } | null> {
    try {
      return await this.electron.costGetMonthEndSnapshot({
        productCode,
        warehouseId,
        year,
        month
      })
    } catch (error) {
      console.error('[DB-IPC] 获取月末快照失败:', error)
      return null
    }
  }

  async getProductCost(
    productCode: string,
    warehouseId: number,
    date: string
  ): Promise<number | null> {
    try {
      return await this.electron.costGetProductCost({
        productCode,
        warehouseId,
        date
      })
    } catch (error) {
      console.error('[DB-IPC] 获取产品成本价失败:', error)
      return null
    }
  }

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
      await this.electron.costSaveSnapshot({
        product_name: productName,
        warehouse_id: warehouseId,
        warehouse_name: warehouseName,
        snapshot_date: date,
        quantity,
        cost
      })
    } catch (error) {
      console.error('[DB-IPC] 保存库存快照失败:', error)
    }
  }

  // ==================== 采购退货 ====================

  async getPurchaseReturns(page = 1, pageSize = 10): Promise<any> {
    try {
      return await this.electron.purchaseReturnList(page, pageSize)
    } catch (error) {
      console.error('[DB-IPC] 获取采购退货列表失败:', error)
      return { data: [], total: 0 }
    }
  }

  async addPurchaseReturn(data: any): Promise<any> {
    try {
      return await this.electron.purchaseReturnAdd(data)
    } catch (error) {
      console.error('[DB-IPC] 新增采购退货单失败:', error)
      throw error
    }
  }

  async updatePurchaseReturn(data: any): Promise<void> {
    try {
      await this.electron.purchaseReturnUpdate(data)
    } catch (error) {
      console.error('[DB-IPC] 更新采购退货单失败:', error)
      throw error
    }
  }

  async deletePurchaseReturn(id: number): Promise<void> {
    try {
      await this.electron.purchaseReturnDelete(id)
    } catch (error) {
      console.error('[DB-IPC] 删除采购退货单失败:', error)
      throw error
    }
  }

  // ==================== 销售退货 ====================

  async getSalesReturns(page = 1, pageSize = 10): Promise<any> {
    try {
      return await this.electron.salesReturnList(page, pageSize)
    } catch (error) {
      console.error('[DB-IPC] 获取销售退货列表失败:', error)
      return { data: [], total: 0 }
    }
  }

  async addSalesReturn(data: any): Promise<any> {
    try {
      return await this.electron.salesReturnAdd(data)
    } catch (error) {
      console.error('[DB-IPC] 新增销售退货单失败:', error)
      throw error
    }
  }

  async updateSalesReturn(data: any): Promise<void> {
    try {
      await this.electron.salesReturnUpdate(data)
    } catch (error) {
      console.error('[DB-IPC] 更新销售退货单失败:', error)
      throw error
    }
  }

  async deleteSalesReturn(id: number): Promise<void> {
    try {
      await this.electron.salesReturnDelete(id)
    } catch (error) {
      console.error('[DB-IPC] 删除销售退货单失败:', error)
      throw error
    }
  }

  // ==================== 入库单 ====================

  async getInboundList(page = 1, pageSize = 10): Promise<{ data: any[]; total: number }> {
    try {
      const result = await this.electron.inboundList(page, pageSize)
      console.log('[DB-IPC] getInboundList 成功:', result?.data?.length || 0, '条记录')
      return result || { data: [], total: 0 }
    } catch (error) {
      console.error('[DB-IPC] 获取入库单列表失败:', error)
      return { data: [], total: 0 }
    }
  }

  async addInbound(data: any): Promise<any> {
    try {
      const result = await this.electron.inboundAdd(data)
      console.log('[DB-IPC] addInbound 成功，ID:', result)
      return result
    } catch (error) {
      console.error('[DB-IPC] 新增入库单失败:', error)
      throw error
    }
  }

  async updateInbound(data: any): Promise<void> {
    try {
      await this.electron.inboundUpdate(data)
      console.log('[DB-IPC] updateInbound 成功')
    } catch (error) {
      console.error('[DB-IPC] 更新入库单失败:', error)
      throw error
    }
  }

  async deleteInbound(id: number): Promise<void> {
    try {
      await this.electron.inboundDelete(id)
      console.log('[DB-IPC] deleteInbound 成功，ID:', id)
    } catch (error) {
      console.error('[DB-IPC] 删除入库单失败:', error)
      throw error
    }
  }

  // ==================== 出库单 ====================

  async getOutboundList(page = 1, pageSize = 10): Promise<{ data: any[]; total: number }> {
    try {
      const result = await this.electron.outboundList(page, pageSize)
      console.log('[DB-IPC] getOutboundList 成功:', result?.data?.length || 0, '条记录')
      return result || { data: [], total: 0 }
    } catch (error) {
      console.error('[DB-IPC] 获取出库单列表失败:', error)
      return { data: [], total: 0 }
    }
  }

  async addOutbound(data: any): Promise<any> {
    try {
      const result = await this.electron.outboundAdd(data)
      console.log('[DB-IPC] addOutbound 成功，ID:', result)
      return result
    } catch (error) {
      console.error('[DB-IPC] 新增出库单失败:', error)
      throw error
    }
  }

  async updateOutbound(data: any): Promise<void> {
    try {
      await this.electron.outboundUpdate(data)
      console.log('[DB-IPC] updateOutbound 成功')
    } catch (error) {
      console.error('[DB-IPC] 更新出库单失败:', error)
      throw error
    }
  }

  async deleteOutbound(id: number): Promise<void> {
    try {
      await this.electron.outboundDelete(id)
      console.log('[DB-IPC] deleteOutbound 成功，ID:', id)
    } catch (error) {
      console.error('[DB-IPC] 删除出库单失败:', error)
      throw error
    }
  }

  // ==================== 客户/供应商 ====================

  async getCustomers(): Promise<any[]> {
    try {
      const result = await this.electron.customerList()
      console.log('[DB-IPC] getCustomers 成功:', result?.length || 0, '条记录')
      return result || []
    } catch (error) {
      console.error('[DB-IPC] 获取客户列表失败:', error)
      return []
    }
  }

  async getSuppliers(): Promise<any[]> {
    try {
      const result = await this.electron.supplierList()
      console.log('[DB-IPC] getSuppliers 成功:', result?.length || 0, '条记录')
      return result || []
    } catch (error) {
      console.error('[DB-IPC] 获取供应商列表失败:', error)
      return []
    }
  }

  // ==================== 收款单 ====================

  async getReceiptList(): Promise<any[]> {
    try {
      return await this.electron.receiptList()
    } catch (error) {
      console.error('[DB-IPC] 获取收款单列表失败:', error)
      return []
    }
  }

  async addReceipt(data: any): Promise<any> {
    try {
      return await this.electron.receiptAdd(data)
    } catch (error) {
      console.error('[DB-IPC] 新增收款单失败:', error)
      throw error
    }
  }

  async updateReceipt(data: any): Promise<void> {
    try {
      await this.electron.receiptUpdate(data)
    } catch (error) {
      console.error('[DB-IPC] 更新收款单失败:', error)
      throw error
    }
  }

  async deleteReceipt(id: number): Promise<void> {
    try {
      await this.electron.receiptDelete(id)
    } catch (error) {
      console.error('[DB-IPC] 删除收款单失败:', error)
      throw error
    }
  }

  // ==================== 付款单 ====================

  async getPaymentList(): Promise<any[]> {
    try {
      return await this.electron.paymentList()
    } catch (error) {
      console.error('[DB-IPC] 获取付款单列表失败:', error)
      return []
    }
  }

  async addPayment(data: any): Promise<any> {
    try {
      return await this.electron.paymentAdd(data)
    } catch (error) {
      console.error('[DB-IPC] 新增付款单失败:', error)
      throw error
    }
  }

  async updatePayment(data: any): Promise<void> {
    try {
      await this.electron.paymentUpdate(data)
    } catch (error) {
      console.error('[DB-IPC] 更新付款单失败:', error)
      throw error
    }
  }

  async deletePayment(id: number): Promise<void> {
    try {
      await this.electron.paymentDelete(id)
    } catch (error) {
      console.error('[DB-IPC] 删除付款单失败:', error)
      throw error
    }
  }

  // ==================== 库存查询 ====================

  async getInventory(warehouseId?: number, productCode?: string): Promise<any> {
    try {
      return await this.electron.inventoryQuery(warehouseId, productCode)
    } catch (error) {
      console.error('[DB-IPC] 查询库存失败:', error)
      return null
    }
  }

  async getAllStocks(endDate?: string): Promise<any> {
    try {
      return await this.electron.allStocks(endDate)
    } catch (error) {
      console.error('[DB-IPC] 获取所有库存失败:', error)
      return []
    }
  }

  async getProductStock(productId: number, warehouseId: number): Promise<number> {
    try {
      const stock = await this.electron.productStock(productId, warehouseId)
      console.log(`[DB-IPC] getProductStock: 产品${productId}在仓库${warehouseId}的库存=`, stock)
      return stock || 0
    } catch (error) {
      console.error('[DB-IPC] 获取产品库存失败:', error)
      return 0
    }
  }

  async getProductLedger(
    productId: number,
    warehouseId: number,
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    try {
      const safeStartDate = (startDate && startDate.trim()) || undefined
      const safeEndDate = (endDate && endDate.trim()) || undefined
      console.log(`[DB-IPC] getProductLedger 安全参数:`, { productId, warehouseId, startDate: safeStartDate, endDate: safeEndDate })

      const rawResult = await this.electron.productLedger(productId, warehouseId, safeStartDate, safeEndDate)
      console.log(`[DB-IPC] getProductLedger 原始数据:`, Array.isArray(rawResult) ? rawResult.length + '条' : rawResult)

      if (!Array.isArray(rawResult)) {
        console.log('[DB-IPC] getProductLedger: 返回非数组，尝试转换')
        return Array.isArray(rawResult) ? rawResult : []
      }

      const result = rawResult.map((item: any) => {
        if (item.date && item.docNo && item.inboundQty !== undefined) {
          return item
        }
        return {
          date: item.inbound_date || item.outbound_date || item.return_date || item.transfer_date || '',
          docNo: item.inbound_no || item.outbound_no || item.return_no || item.transfer_no || '',
          type: item.doc_type || '',
          docType: item.doc_type || '',
          docId: item.inbound_id || item.outbound_id || item.return_id || item.transfer_id || 0,
          inboundQty: item.direction === 'in' ? (item.qty || 0) : (item.inboundQty || 0),
          inboundUnitPrice: item.direction === 'in' ? (item.price || 0) : (item.inboundUnitPrice || 0),
          inboundAmount: item.direction === 'in' ? (item.amount || 0) : (item.inboundAmount || 0),
          outboundQty: item.direction === 'out' ? (item.qty || 0) : (item.outboundQty || 0),
          outboundUnitPrice: item.direction === 'out' ? (item.price || 0) : (item.outboundUnitPrice || 0),
          outboundAmount: item.direction === 'out' ? (item.amount || 0) : (item.outboundAmount || 0),
          counter: item.supplier_name || item.customer_name || item.from_warehouse_name || item.counter || '',
          remark: item.remark || ''
        }
      })

      console.log(`[DB-IPC] getProductLedger 映射后: ${result.length} 条`)
      if (result.length > 0) {
        console.log('[DB-IPC] 第一条:', JSON.stringify(result[0]))
      }

      return result
    } catch (error) {
      console.error('[DB-IPC] 获取产品明细账失败:', error)
      return null
    }
  }

  async getStocks(endDate?: string): Promise<any[]> {
    try {
      const result = await this.getAllStocks(endDate)
      console.log('[DB-IPC] getStocks 成功:', Array.isArray(result) ? result.length : 0, '条记录')
      return Array.isArray(result) ? result : []
    } catch (error) {
      console.error('[DB-IPC] 获取库存列表失败:', error)
      return []
    }
  }

  async getStockBeforeDate(productId: number, warehouseId: number, date: string): Promise<number> {
    try {
      const result = await this.electron.stockBeforeDate(productId, warehouseId, date)
      console.log(`[DB-IPC] getStockBeforeDate: 产品${productId}在仓库${warehouseId}截至${date}的库存=`, result)
      return result || 0
    } catch (error) {
      console.error('[DB-IPC] 获取日期前库存失败:', error)
      return 0
    }
  }

  // ==================== 单据详情查询 ====================

  async getInboundById(id: number): Promise<any> {
    try {
      return await this.electron.inboundById(id)
    } catch (error) {
      console.error('[DB-IPC] 获取入库单详情失败:', error)
      return null
    }
  }

  async getOutboundById(id: number): Promise<any> {
    try {
      return await this.electron.outboundById(id)
    } catch (error) {
      console.error('[DB-IPC] 获取出库单详情失败:', error)
      return null
    }
  }

  async getPurchaseReturnById(id: number): Promise<any> {
    try {
      return await this.electron.purchaseReturnById(id)
    } catch (error) {
      console.error('[DB-IPC] 获取采购退货单详情失败:', error)
      return null
    }
  }

  async getSalesReturnById(id: number): Promise<any> {
    try {
      return await this.electron.salesReturnById(id)
    } catch (error) {
      console.error('[DB-IPC] 获取销售退货单详情失败:', error)
      return null
    }
  }

  async getTransferById(id: number): Promise<any> {
    try {
      return await this.electron.transferById(id)
    } catch (error) {
      console.error('[DB-IPC] 获取调拨单详情失败:', error)
      return null
    }
  }

  // ==================== 数据库备份 ====================

  async backupDatabase(): Promise<any> {
    try {
      return await this.electron.dbBackupManual()
    } catch (error) {
      console.error('[DB-IPC] 备份数据库失败:', error)
      return null
    }
  }

  async restoreDatabase(): Promise<any> {
    try {
      return await this.electron.dbBackupRestore()
    } catch (error) {
      console.error('[DB-IPC] 恢复数据库失败:', error)
      return null
    }
  }

  async getBackupList(): Promise<any[]> {
    try {
      return await this.electron.dbBackupList()
    } catch (error) {
      console.error('[DB-IPC] 获取备份列表失败:', error)
      return []
    }
  }

  async exportDatabase(): Promise<any> {
    try {
      return await this.electron.dbExport()
    } catch (error) {
      console.error('[DB-IPC] 导出数据库失败:', error)
      return null
    }
  }

  async getDatabaseInfo(): Promise<any> {
    try {
      return await this.electron.dbInfo()
    } catch (error) {
      console.error('[DB-IPC] 获取数据库信息失败:', error)
      return null
    }
  }

  // ==================== 用户/角色/员工 ====================

  async getUsers(): Promise<any[]> {
    try {
      return await this.electron.userList()
    } catch (error) {
      console.error('[DB-IPC] 获取用户列表失败:', error)
      return []
    }
  }

  async addUser(data: any): Promise<number> {
    try {
      return await this.electron.userAdd(data)
    } catch (error) {
      console.error('[DB-IPC] 添加用户失败:', error)
      throw error
    }
  }

  async updateUser(data: any): Promise<void> {
    try {
      await this.electron.userUpdate(data)
    } catch (error) {
      console.error('[DB-IPC] 更新用户失败:', error)
      throw error
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      await this.electron.userDelete(id)
    } catch (error) {
      console.error('[DB-IPC] 删除用户失败:', error)
      throw error
    }
  }

  async getRoles(): Promise<any[]> {
    try {
      return await this.electron.roleList()
    } catch (error) {
      console.error('[DB-IPC] 获取角色列表失败:', error)
      return []
    }
  }

  async getEmployees(): Promise<any[]> {
    try {
      return await this.electron.employeeList()
    } catch (error) {
      console.error('[DB-IPC] 获取员工列表失败:', error)
      return []
    }
  }

  // ==================== 通用查询 ====================

  async query(sql: string, params?: any[]): Promise<any[]> {
    try {
      return await this.electron.dbQuery(sql, params)
    } catch (error) {
      console.error('[DB-IPC] 执行查询失败:', error)
      throw error
    }
  }

  async insert(table: string, data: any): Promise<number> {
    try {
      return await this.electron.dbInsert(table, data)
    } catch (error) {
      console.error('[DB-IPC] 插入数据失败:', error)
      throw error
    }
  }

  async update(table: string, data: any, where: string, whereParams?: any[]): Promise<number> {
    try {
      return await this.electron.dbUpdate(table, data, where, whereParams)
    } catch (error) {
      console.error('[DB-IPC] 更新数据失败:', error)
      throw error
    }
  }

  async delete(table: string, where: string, whereParams?: any[]): Promise<number> {
    try {
      return await this.electron.dbDelete(table, where, whereParams)
    } catch (error) {
      console.error('[DB-IPC] 删除数据失败:', error)
      throw error
    }
  }

  async transaction(operations: any[]): Promise<any> {
    try {
      return await this.electron.dbTransaction(operations)
    } catch (error) {
      console.error('[DB-IPC] 执行事务失败:', error)
      throw error
    }
  }
  
  // ==================== 开票记录 ====================
  
  async getInvoiceRecord(inboundNo: string): Promise<any> {
    try {
      const result = await this.electron.getInvoiceRecord(inboundNo)
      console.log('[DB-IPC] getInvoiceRecord 成功:', inboundNo, result)
      return result
    } catch (error) {
      console.error('[DB-IPC] 获取开票记录失败:', error)
      return null
    }
  }
  
  async saveInvoiceRecord(recordData: any): Promise<number> {
    try {
      const result = await this.electron.saveInvoiceRecord(recordData)
      console.log('[DB-IPC] saveInvoiceRecord 成功:', recordData.inbound_no, result)
      return result
    } catch (error) {
      console.error('[DB-IPC] 保存开票记录失败:', error)
      throw error
    }
  }

  // ==================== 系统设置 ====================

  async getSystemSettings(): Promise<any> {
    try {
      const result = await this.electron.getSystemSettings()
      return result?.data || {}
    } catch (error) {
      console.error('[DB-IPC] 获取系统设置失败:', error)
      return {}
    }
  }

  async saveSystemSettings(settings: any): Promise<boolean> {
    try {
      const result = await this.electron.saveSystemSettings(settings)
      return result?.success || false
    } catch (error) {
      console.error('[DB-IPC] 保存系统设置失败:', error)
      return false
    }
  }
}

export const db = new DatabaseIPC()
