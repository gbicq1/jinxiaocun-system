/**
 * 统一的数据库访问工具 - 渲染进程使用
 * 确保所有业务数据都通过数据库保存，不使用 localStorage
 */

// 检查是否在 Electron 环境中
export const isElectron = () => {
  return typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined'
}

// 获取 electron 对象
const getElectron = () => {
  if (!isElectron()) {
    throw new Error('不在 Electron 环境中，请在 Electron 应用中运行此功能')
  }
  return (window as any).electron
}

/**
 * 数据库查询（只读操作）
 */
export const dbQuery = async (sql: string, params?: any[]) => {
  const electron = getElectron()
  return await electron.dbQuery(sql, params || [])
}

/**
 * 数据库插入
 */
export const dbInsert = async (table: string, data: any) => {
  const electron = getElectron()
  return await electron.dbInsert(table, data)
}

/**
 * 数据库更新
 */
export const dbUpdate = async (table: string, data: any, where: string, whereParams: any[]) => {
  const electron = getElectron()
  return await electron.dbUpdate(table, data, where, whereParams)
}

/**
 * 数据库删除
 */
export const dbDelete = async (table: string, where: string, whereParams: any[]) => {
  const electron = getElectron()
  return await electron.dbDelete(table, where, whereParams)
}

/**
 * 执行事务
 */
export const dbTransaction = async (operations: Array<() => Promise<any>>) => {
  const electron = getElectron()
  return await electron.dbTransaction(operations)
}

// ============ 业务数据访问方法 ============

/**
 * 获取所有产品
 */
export const getAllProducts = async () => {
  const electron = getElectron()
  return await electron.dbQuery('SELECT * FROM products ORDER BY code')
}

/**
 * 获取所有仓库
 */
export const getAllWarehouses = async () => {
  const electron = getElectron()
  return await electron.warehouseList()
}

/**
 * 获取所有供应商
 */
export const getAllSuppliers = async () => {
  const electron = getElectron()
  return await electron.supplierList()
}

/**
 * 获取所有客户
 */
export const getAllCustomers = async () => {
  const electron = getElectron()
  return await electron.customerList()
}

/**
 * 获取所有员工
 */
export const getAllEmployees = async () => {
  return await dbQuery('SELECT * FROM employees WHERE status = ?', ['active'])
}

/**
 * 获取入库单列表
 */
export const getInboundList = async (page = 1, pageSize = 100, where?: string, params?: any[]) => {
  const electron = getElectron()
  return await electron.inboundList(page, pageSize, where, params)
}

/**
 * 添加入库单
 */
export const addInbound = async (inbound: any) => {
  const electron = getElectron()
  return await electron.inboundAdd(inbound)
}

/**
 * 更新入库单
 */
export const updateInbound = async (inbound: any) => {
  const electron = getElectron()
  return await electron.inboundUpdate(inbound)
}

/**
 * 获取出库单列表
 */
export const getOutboundList = async (page = 1, pageSize = 100, where?: string, params?: any[]) => {
  const electron = getElectron()
  return await electron.outboundList(page, pageSize, where, params)
}

/**
 * 添加出库单
 */
export const addOutbound = async (outbound: any) => {
  const electron = getElectron()
  return await electron.outboundAdd(outbound)
}

/**
 * 更新出库单
 */
export const updateOutbound = async (outbound: any) => {
  const electron = getElectron()
  return await electron.outboundUpdate(outbound)
}

/**
 * 获取库存调拨列表
 */
export const getTransferList = async (page = 1, pageSize = 100, where?: string, params?: any[]) => {
  const electron = getElectron()
  return await electron.transferList(page, pageSize, where, params)
}

/**
 * 添加库存调拨
 */
export const addTransfer = async (transfer: any) => {
  const electron = getElectron()
  return await electron.transferAdd(transfer)
}

/**
 * 更新库存调拨
 */
export const updateTransfer = async (transfer: any) => {
  const electron = getElectron()
  return await electron.transferUpdate(transfer)
}

/**
 * 获取采购退货列表
 */
export const getPurchaseReturnList = async (page = 1, pageSize = 100) => {
  const electron = getElectron()
  return await electron.purchaseReturnList(page, pageSize)
}

/**
 * 添加采购退货
 */
export const addPurchaseReturn = async (returnData: any) => {
  const electron = getElectron()
  return await electron.purchaseReturnAdd(returnData)
}

/**
 * 更新采购退货
 */
export const updatePurchaseReturn = async (returnData: any) => {
  const electron = getElectron()
  return await electron.purchaseReturnUpdate(returnData)
}

/**
 * 获取销售退货列表
 */
export const getSalesReturnList = async (page = 1, pageSize = 100) => {
  const electron = getElectron()
  return await electron.salesReturnList(page, pageSize)
}

/**
 * 添加销售退货
 */
export const addSalesReturn = async (returnData: any) => {
  const electron = getElectron()
  return await electron.salesReturnAdd(returnData)
}

/**
 * 更新销售退货
 */
export const updateSalesReturn = async (returnData: any) => {
  const electron = getElectron()
  return await electron.salesReturnUpdate(returnData)
}

/**
 * 查询库存余额
 */
export const getInventory = async (warehouseId?: number, productCode?: string) => {
  const electron = getElectron()
  return await electron.inventoryQuery(warehouseId, productCode)
}

/**
 * 获取产品实时库存
 */
export const getProductStock = async (productId: number, warehouseId: number) => {
  const electron = getElectron()
  return await electron.productStock(productId, warehouseId)
}

/**
 * 获取成本结算数据
 */
export const getCostSettlement = async (year: number, month: number, productCode?: string, warehouseId?: number) => {
  const electron = getElectron()
  return await electron.costSettlementQuery(year, month, productCode, warehouseId)
}

/**
 * 数据库备份 - 手动备份
 */
export const backupDatabase = async () => {
  const electron = getElectron()
  return await electron.dbBackupManual()
}

/**
 * 数据库备份 - 恢复
 */
export const restoreDatabase = async () => {
  const electron = getElectron()
  return await electron.dbBackupRestore()
}

/**
 * 数据库备份 - 获取备份列表
 */
export const getBackupList = async () => {
  const electron = getElectron()
  return await electron.dbBackupList()
}

/**
 * 数据库导出
 */
export const exportDatabase = async () => {
  const electron = getElectron()
  return await electron.dbExport()
}

/**
 * 获取数据库信息
 */
export const getDatabaseInfo = async () => {
  const electron = getElectron()
  return await electron.dbInfo()
}

/**
 * 用户设置相关（仍然使用 localStorage，因为这是用户偏好）
 */
export const UserSettings = {
  // 获取当前用户
  getCurrentUser: () => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('currentUser')
      return userStr ? JSON.parse(userStr) : null
    }
    return null
  },

  // 设置当前用户
  setCurrentUser: (user: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentUser', JSON.stringify(user))
    }
  },

  // 获取默认仓库 ID
  getDefaultWarehouseId: () => {
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('defaultWarehouseId')
      return id ? parseInt(id) : null
    }
    return null
  },

  // 设置默认仓库 ID
  setDefaultWarehouseId: (warehouseId: number) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('defaultWarehouseId', warehouseId.toString())
    }
  },

  // 获取默认经办人 ID
  getDefaultHandlerId: () => {
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('defaultHandlerId')
      return id ? parseInt(id) : null
    }
    return null
  },

  // 设置默认经办人
  setDefaultHandler: (handlerId: number, handlerName: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('defaultHandlerId', handlerId.toString())
      localStorage.setItem('defaultOperator', handlerName)
    }
  },

  // 获取公司名称
  getCompanyName: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('companyName') || '荆州供销农业服务有限公司'
    }
    return '荆州供销农业服务有限公司'
  },

  // 设置公司名称
  setCompanyName: (name: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('companyName', name)
    }
  }
}
