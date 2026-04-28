// preload.js - Expose IPC APIs to renderer process
const { contextBridge, ipcRenderer } = require('electron')

// 获取所有注册的 IPC handler 名称
const ipcChannels = [
  // 数据库操作
  'db-init', 'db-query', 'db-insert', 'db-update', 'db-delete', 'db-transaction',
  // 产品管理
  'product-list', 'product-add', 'product-update', 'product-delete', 'db:products-list',
  // 仓库管理
  'warehouse-list', 'warehouse-add', 'warehouse-update', 'warehouse-delete', 'db:warehouses-list',
  // 供应商管理
  'supplier-list', 'supplier-add', 'supplier-update', 'supplier-delete',
  // 客户管理
  'customer-list', 'customer-add', 'customer-update', 'customer-delete',
  // 入库管理
  'inbound-list', 'inbound-add', 'inbound-update', 'inbound-delete', 'inbound-by-id',
  // 出库管理
  'outbound-list', 'outbound-add', 'outbound-update', 'outbound-delete', 'outbound-by-id',
  // 采购退货
  'purchase-return-add', 'purchase-return-list', 'purchase-return-update', 'purchase-return-delete', 'purchase-return-by-id',
  // 销售退货
  'sales-return-add', 'sales-return-list', 'sales-return-update', 'sales-return-delete', 'sales-return-by-id',
  // 调拨管理
  'transfer-list', 'transfer-add', 'transfer-update', 'transfer-delete', 'transfer-by-id',
  // 库存查询
  'inventory-query', 'product-stock', 'all-stocks', 'product-ledger', 'stock-before-date', 'stock-cost-before-date',
  'get-transfer-stock-cost', 'get-product-stock-cost-on-date',
  // 库存期间
  'inventory-period-list', 'inventory-period-save', 'inventory-period-delete',
  // 成本结算
  'cost-settlement-query', 'cost:initialize', 'cost:calculate-without-lock', 'cost:recalculate', 'cost:auto-complete',
  'cost:settlement-summary', 'cost:settlement-query-by-date-range',
  'cost:sales-summary', 'cost:sales-detail', 'cost:sales-daily-summary', 'cost:sales-monthly-summary',
  'cost:sales-profit-daily-summary', 'cost:sales-profit-monthly-summary',
  'cost:sales-cost-items-periods', 'cost:sales-profit-by-product', 'cost:sales-profit-by-category',
  'cost:transfer-summary', 'cost:transaction-details', 'cost:product-detail-ledger', 'cost:reverse',
  // 调试
  'debug:sales-return-data', 'debug:check-sales-returns',
  // 系统设置
  'system:get-settings', 'system:save-settings',
  // 数据库备份
  'db-backup-manual', 'db-backup-restore', 'db-backup-list', 'db-backup-restore-from',
  'db-backup-delete', 'db-backup-config', 'db-backup-save-config', 'db-backup-stats', 'db-backup-export',
  // 数据库导出
  'db-export', 'db-info',
  // 收款管理
  'receipt-list', 'receipt-add', 'receipt-update', 'receipt-delete',
  // 付款管理
  'payment-list', 'payment-add', 'payment-update', 'payment-delete',
  // 回收站
  'recycle-bin-list', 'recycle-bin-save', 'recycle-bin-add', 'recycle-bin-restore', 'recycle-bin-remove',
  // 其他
  'customers-list', 'suppliers-list', 'invoice-get-record', 'invoice-save-record'
]

// 创建 electron API 对象
const electronAPI = {}

// 为每个 IPC channel 创建一个调用函数
ipcChannels.forEach(channel => {
  const methodName = channel.replace(/[:-](\w)/g, (_, c) => c.toUpperCase())
  
  electronAPI[methodName] = (...args) => {
    return ipcRenderer.invoke(channel, ...args)
  }
})

// 手动映射：前端调用的方法名 -> IPC 通道名
const manualMappings = {
  // 系统设置（前端用 saveSystemSettings/getSystemSettings）
  getSystemSettings: 'system:get-settings',
  saveSystemSettings: 'system:save-settings',
  // 成本结算（前端用 cost* 前缀）
  costInitialize: 'cost:initialize',
  costCalculateWithoutLock: 'cost:calculate-without-lock',
  costRecalculate: 'cost:recalculate',
  costAutoComplete: 'cost:auto-complete',
  costSettlementSummary: 'cost:settlement-summary',
  costSettlementQueryByDateRange: 'cost:settlement-query-by-date-range',
  costSalesSummary: 'cost:sales-summary',
  costSalesDetail: 'cost:sales-detail',
  costSalesDailySummary: 'cost:sales-daily-summary',
  costSalesMonthlySummary: 'cost:sales-monthly-summary',
  costSalesProfitDailySummary: 'cost:sales-profit-daily-summary',
  costSalesProfitMonthlySummary: 'cost:sales-profit-monthly-summary',
  costSalesCostItemsPeriods: 'cost:sales-cost-items-periods',
  costSalesProfitByProduct: 'cost:sales-profit-by-product',
  costSalesProfitByCategory: 'cost:sales-profit-by-category',
  costTransferSummary: 'cost:transfer-summary',
  costTransactionDetails: 'cost:transaction-details',
  costProductDetailLedger: 'cost:product-detail-ledger',
  costReverse: 'cost:reverse',
  costIsSettled: 'cost:is-settled',
  costHasSettlementData: 'cost:has-settlement-data',
  // 调试
  debugSalesReturnData: 'debug:sales-return-data',
  debugCheckSalesReturns: 'debug:check-sales-returns',
  // 数据库备份
  dbBackupManual: 'db-backup-manual',
  dbBackupRestore: 'db-backup-restore',
  dbBackupList: 'db-backup-list',
  dbBackupRestoreFrom: 'db-backup-restore-from',
  dbBackupDelete: 'db-backup-delete',
  dbBackupConfig: 'db-backup-config',
  dbBackupSaveConfig: 'db-backup-save-config',
  dbBackupStats: 'db-backup-stats',
  dbBackupExport: 'db-backup-export',
  // 发票
  getInvoiceRecord: 'invoice-get-record',
  saveInvoiceRecord: 'invoice-save-record',
}

// 注册手动映射（覆盖自动生成的）
for (const [methodName, channel] of Object.entries(manualMappings)) {
  electronAPI[methodName] = (...args) => {
    return ipcRenderer.invoke(channel, ...args)
  }
}

// 添加 ipcRenderer 直接访问（用于事件监听）
electronAPI.ipcRenderer = {
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}

// 暴露 API 到 window 对象
contextBridge.exposeInMainWorld('electron', electronAPI)
