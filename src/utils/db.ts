/**
 * 统一的数据库访问工具
 * 提供安全的 Electron IPC 数据库访问接口
 */

// 检查是否在 Electron 环境中
export const isElectron = () => {
  const result = typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined'
  console.log('isElectron 检查:', result, 'window:', typeof window, 'window.electron:', typeof (window as any).electron)
  return result
}

// 获取 electron 对象
const getElectron = () => {
  if (!isElectron()) {
    const errorMsg = '不在 Electron 环境中，请在 Electron 应用中运行此功能'
    console.error(errorMsg)
    console.error('当前 window 对象:', window)
    console.error('当前 window.electron 对象:', (window as any).electron)
    throw new Error(errorMsg)
  }
  return (window as any).electron
}

/**
 * 字段名映射（数据库字段 → 驼峰）
 */
const dbToCamelMappings: Record<string, string> = {
  inbound_no: 'voucherNo',
  inbound_date: 'voucherDate',
  outbound_no: 'voucherNo',
  outbound_date: 'voucherDate',
  warehouse_id: 'warehouseId',
  customer_id: 'customerId',
  product_id: 'productId',
  total_amount: 'totalAmount',
  cost_price: 'costPrice',
  sell_price: 'sellPrice',
  sale_price: 'salePrice',
  unit_price: 'unitPrice',
  stock_quantity: 'stockQuantity',
  warning_quantity: 'warningQuantity',
  tax_rate: 'taxRate',
  contact_person: 'contactPerson',
  contact_phone: 'contactPhone',
  contact_email: 'contactEmail',
  credit_limit: 'creditLimit',
  bank_name: 'bankName',
  bank_account: 'bankAccount',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  created_by: 'createdBy',
  handler_name: 'handlerName'
}

/**
 * 将数据库字段名转换为驼峰命名
 */
const convertSnakeToCamel = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(convertSnakeToCamel)
  }
  
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = dbToCamelMappings[key] || key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        newObj[camelKey] = convertSnakeToCamel(obj[key])
      }
    }
    return newObj
  }
  
  return obj
}

/**
 * 查询数据
 */
export const dbQuery = async (sql: string, params?: any[]) => {
  try {
    const electron = getElectron()
    const result = await electron.dbQuery(sql, params || [])
    // 将查询结果的字段名转换为驼峰
    return convertSnakeToCamel(result)
  } catch (error) {
    console.error('数据库查询失败:', error)
    throw error
  }
}

/**
 * 字段名映射（驼峰 → 数据库字段）
 */
const fieldMappings: Record<string, string> = {
  // 采购入库（只保留数据库实际存在的字段）
  voucherNo: 'inbound_no',
  voucherDate: 'inbound_date',
  warehouseId: 'warehouse_id',
  totalAmount: 'total_amount',
  // 产品
  costPrice: 'cost_price',
  sellPrice: 'sell_price',
  stockQuantity: 'stock_quantity',
  warningQuantity: 'warning_quantity',
  taxRate: 'tax_rate',
  // 仓库
  contactPerson: 'contact_person',
  contactPhone: 'contact_phone',
  contactEmail: 'contact_email',
  // 供应商/客户
  creditLimit: 'credit_limit',
  // 通用
  createdAt: 'created_at',
  updatedAt: 'updated_at'
}

/**
 * 只保留数据库表实际存在的字段
 */
const keepOnlyExistingFields = (data: any, table: string) => {
  if (!data || typeof data !== 'object') return data
  
  const existingFields: Record<string, string[]> = {
    purchase_inbound: ['inbound_no', 'order_id', 'warehouse_id', 'inbound_date', 'total_amount', 'status', 'remark', 'created_by'],
    sales_outbound: ['outbound_no', 'customer_id', 'warehouse_id', 'outbound_date', 'total_amount', 'status', 'remark', 'created_by', 'handler_name'],
    products: ['code', 'name', 'category', 'unit', 'barcode', 'spec', 'tax_rate', 'cost_price', 'sell_price', 'stock_quantity', 'warning_quantity', 'status', 'remark'],
    warehouses: ['code', 'name', 'address', 'contact_person', 'contact_phone', 'status', 'remark'],
    suppliers: ['code', 'name', 'contact_person', 'contact_phone', 'contact_email', 'address', 'bank_name', 'bank_account', 'status', 'remark'],
    customers: ['code', 'name', 'contact_person', 'contact_phone', 'contact_email', 'address', 'credit_limit', 'status', 'remark']
  }
  
  const allowedFields = existingFields[table]
  if (!allowedFields) return data
  
  const cleaned: any = {}
  for (const key of allowedFields) {
    if (data.hasOwnProperty(key)) {
      cleaned[key] = data[key]
    }
  }
  return cleaned
}

/**
 * 清理对象，移除不可序列化的属性
 */
const cleanData = (data: any, table?: string): any => {
  if (!data || typeof data !== 'object') return data
  
  const cleaned: any = {}
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const value = data[key]
      // 跳过函数、undefined 和以 _ 开头的属性
      if (typeof value !== 'function' && value !== undefined && !key.startsWith('_')) {
        // 使用映射表中的字段名，如果没有映射则自动转换
        let dbKey = fieldMappings[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase()
        
        // 处理特殊值
        if (value === null || value === undefined) {
          continue // 跳过 null 和 undefined 值
        }
        
        // 如果是基本类型，直接赋值
        if (typeof value === 'string' || typeof value === 'number') {
          cleaned[dbKey] = value
        }
        // 布尔值转为整数
        else if (typeof value === 'boolean') {
          cleaned[dbKey] = value ? 1 : 0
        }
        // 如果是对象或数组，递归清理（不传递 table，避免 items 被过滤）
        else if (typeof value === 'object') {
          const nestedValue = cleanData(value)
          if (Object.keys(nestedValue).length > 0) {
            cleaned[dbKey] = nestedValue
          }
        }
      }
    }
  }
  
  // 如果指定了表名，只保留该表实际存在的字段
  const finalData = table ? keepOnlyExistingFields(cleaned, table) : cleaned
  
  console.log('清理后数据:', JSON.stringify(finalData, null, 2))
  return finalData
}

/**
 * 插入数据
 */
export const dbInsert = async (table: string, data: any) => {
  try {
    const electron = getElectron()
    const cleanedData = cleanData(data, table)
    console.log('插入数据 - 原始:', data, '清理后:', cleanedData)
    return await electron.dbInsert(table, cleanedData)
  } catch (error: any) {
    console.error('数据库插入失败:', error)
    throw error
  }
}

/**
 * 更新数据
 */
export const dbUpdate = async (table: string, data: any, where: string, whereParams?: any[]) => {
  try {
    const electron = getElectron()
    const cleanedData = cleanData(data, table)
    console.log('更新数据 - 原始:', data, '清理后:', cleanedData)
    return await electron.dbUpdate(table, cleanedData, where, whereParams || [])
  } catch (error: any) {
    console.error('数据库更新失败:', error)
    throw error
  }
}

/**
 * 删除数据
 */
export const dbDelete = async (table: string, where: string, whereParams?: any[]) => {
  try {
    const electron = getElectron()
    return await electron.dbDelete(table, where, whereParams || [])
  } catch (error) {
    console.error('数据库删除失败:', error)
    throw error
  }
}

/**
 * 执行事务
 */
export const dbTransaction = async (operations: any[]) => {
  try {
    const electron = getElectron()
    return await electron.dbTransaction(operations)
  } catch (error) {
    console.error('数据库事务失败:', error)
    throw error
  }
}

/**
 * 产品相关操作
 */
export const productApi = {
  list: async (page: number = 1, pageSize: number = 10) => {
    const electron = getElectron()
    return await electron.productList(page, pageSize)
  },
  add: async (product: any) => {
    const electron = getElectron()
    return await electron.productAdd(product)
  },
  update: async (product: any) => {
    const electron = getElectron()
    return await electron.productUpdate(product)
  },
  delete: async (id: number) => {
    const electron = getElectron()
    return await electron.productDelete(id)
  }
}

/**
 * 仓库相关操作
 */
export const warehouseApi = {
  list: async () => {
    const electron = getElectron()
    return await electron.warehouseList()
  },
  add: async (warehouse: any) => {
    const electron = getElectron()
    return await electron.warehouseAdd(warehouse)
  },
  update: async (warehouse: any) => {
    const electron = getElectron()
    return await electron.warehouseUpdate(warehouse)
  },
  delete: async (id: number) => {
    const electron = getElectron()
    return await electron.warehouseDelete(id)
  }
}

/**
 * 供应商相关操作
 */
export const supplierApi = {
  list: async () => {
    const electron = getElectron()
    return await electron.supplierList()
  },
  add: async (supplier: any) => {
    const electron = getElectron()
    return await electron.supplierAdd(supplier)
  },
  update: async (supplier: any) => {
    const electron = getElectron()
    return await electron.supplierUpdate(supplier)
  },
  delete: async (id: number) => {
    const electron = getElectron()
    return await electron.supplierDelete(id)
  }
}

/**
 * 客户相关操作
 */
export const customerApi = {
  list: async () => {
    const electron = getElectron()
    return await electron.customerList()
  },
  add: async (customer: any) => {
    const electron = getElectron()
    return await electron.customerAdd(customer)
  },
  update: async (customer: any) => {
    const electron = getElectron()
    return await electron.customerUpdate(customer)
  },
  delete: async (id: number) => {
    const electron = getElectron()
    return await electron.customerDelete(id)
  }
}
