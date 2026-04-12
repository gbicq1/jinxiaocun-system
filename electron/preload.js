"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");

console.log('preload.js 开始执行')

// 暴露安全的 IPC 通道给渲染进程
electron_1.contextBridge.exposeInMainWorld('electron', {
  // 数据库初始化
  initDatabase: () => electron_1.ipcRenderer.invoke('db-init'),
  
  // 数据库基本操作
  dbQuery: (tableOrSql, sqlOrParams, params) => electron_1.ipcRenderer.invoke('db-query', tableOrSql, sqlOrParams, params),
  dbInsert: (table, data) => electron_1.ipcRenderer.invoke('db-insert', table, data),
  dbUpdate: (table, data, where, whereParams) => electron_1.ipcRenderer.invoke('db-update', table, data, where, whereParams),
  dbDelete: (table, where, whereParams) => electron_1.ipcRenderer.invoke('db-delete', table, where, whereParams),
  dbTransaction: (operations) => electron_1.ipcRenderer.invoke('db-transaction', operations),
  
  // 产品管理
  productList: (page, pageSize) => electron_1.ipcRenderer.invoke('product-list', page, pageSize),
  productAdd: (product) => electron_1.ipcRenderer.invoke('product-add', product),
  productUpdate: (product) => electron_1.ipcRenderer.invoke('product-update', product),
  productDelete: (id) => electron_1.ipcRenderer.invoke('product-delete', id),
  
  // 仓库管理
  warehouseList: () => electron_1.ipcRenderer.invoke('warehouse-list'),
  warehouseAdd: (warehouse) => electron_1.ipcRenderer.invoke('warehouse-add', warehouse),
  warehouseUpdate: (warehouse) => electron_1.ipcRenderer.invoke('warehouse-update', warehouse),
  warehouseDelete: (id) => electron_1.ipcRenderer.invoke('warehouse-delete', id),
  
  // 供应商管理
  supplierList: () => electron_1.ipcRenderer.invoke('supplier-list'),
  supplierAdd: (supplier) => electron_1.ipcRenderer.invoke('supplier-add', supplier),
  supplierUpdate: (supplier) => electron_1.ipcRenderer.invoke('supplier-update', supplier),
  supplierDelete: (id) => electron_1.ipcRenderer.invoke('supplier-delete', id),
  
  // 客户管理
  customerList: () => electron_1.ipcRenderer.invoke('customer-list'),
  customerAdd: (customer) => electron_1.ipcRenderer.invoke('customer-add', customer),
  customerUpdate: (customer) => electron_1.ipcRenderer.invoke('customer-update', customer),
  customerDelete: (id) => electron_1.ipcRenderer.invoke('customer-delete', id),
  
  // 采购入库
  inboundList: (page, pageSize, where, params) => electron_1.ipcRenderer.invoke('inbound-list', page, pageSize, where, params),
  inboundAdd: (inbound) => electron_1.ipcRenderer.invoke('inbound-add', inbound),
  inboundUpdate: (inbound) => electron_1.ipcRenderer.invoke('inbound-update', inbound),
  inboundDelete: (id) => electron_1.ipcRenderer.invoke('inbound-delete', id),
  inboundById: (id) => electron_1.ipcRenderer.invoke('inbound-by-id', id),
  
  // 销售出库
  outboundList: (page, pageSize, where, params) => electron_1.ipcRenderer.invoke('outbound-list', page, pageSize, where, params),
  outboundAdd: (outbound) => electron_1.ipcRenderer.invoke('outbound-add', outbound),
  outboundUpdate: (outbound) => electron_1.ipcRenderer.invoke('outbound-update', outbound),
  outboundDelete: (id) => electron_1.ipcRenderer.invoke('outbound-delete', id),
  outboundById: (id) => electron_1.ipcRenderer.invoke('outbound-by-id', id),
  
  // 库存调拨
  transferList: (page, pageSize, where, params) => electron_1.ipcRenderer.invoke('transfer-list', page, pageSize, where, params),
  transferAdd: (transfer) => electron_1.ipcRenderer.invoke('transfer-add', transfer),
  transferUpdate: (transfer) => electron_1.ipcRenderer.invoke('transfer-update', transfer),
  transferDelete: (id) => electron_1.ipcRenderer.invoke('transfer-delete', id),
  transferById: (id) => electron_1.ipcRenderer.invoke('transfer-by-id', id),
  
  // 采购退货
  purchaseReturnList: (page, pageSize) => electron_1.ipcRenderer.invoke('purchase-return-list', page, pageSize),
  purchaseReturnAdd: (returnData) => electron_1.ipcRenderer.invoke('purchase-return-add', returnData),
  purchaseReturnUpdate: (returnData) => electron_1.ipcRenderer.invoke('purchase-return-update', returnData),
  purchaseReturnDelete: (id) => electron_1.ipcRenderer.invoke('purchase-return-delete', id),
  purchaseReturnById: (id) => electron_1.ipcRenderer.invoke('purchase-return-by-id', id),
  
  // 销售退货
  salesReturnList: (page, pageSize) => electron_1.ipcRenderer.invoke('sales-return-list', page, pageSize),
  salesReturnAdd: (returnData) => electron_1.ipcRenderer.invoke('sales-return-add', returnData),
  salesReturnUpdate: (returnData) => electron_1.ipcRenderer.invoke('sales-return-update', returnData),
  salesReturnDelete: (id) => electron_1.ipcRenderer.invoke('sales-return-delete', id),
  salesReturnById: (id) => electron_1.ipcRenderer.invoke('sales-return-by-id', id),
  
  // 库存查询
  inventoryQuery: (warehouseId, productCode) => electron_1.ipcRenderer.invoke('inventory-query', warehouseId, productCode),

  // 获取所有库存（用于实时库存查询）
  allStocks: (endDate) => electron_1.ipcRenderer.invoke('all-stocks', endDate),

  // 获取单个产品的实时库存
  productStock: (productId, warehouseId) => electron_1.ipcRenderer.invoke('product-stock', productId, warehouseId),

  // 获取产品明细账（用于库存明细查询）
  productLedger: (productId, warehouseId, startDate, endDate) => electron_1.ipcRenderer.invoke('product-ledger', productId, warehouseId, startDate, endDate),

  // 获取指定日期前的库存
  stockBeforeDate: (productId, warehouseId, date) => electron_1.ipcRenderer.invoke('stock-before-date', productId, warehouseId, date),
  
  // 成本结算查询
  costSettlementQuery: (year, month, productCode, warehouseId) => electron_1.ipcRenderer.invoke('cost-settlement-query', year, month, productCode, warehouseId),

  // ==================== 成本结算模块 ====================
  costSaveSettlement: (settlement) => electron_1.ipcRenderer.invoke('cost:save-settlement', settlement),
  costSaveSettlements: (settlements) => electron_1.ipcRenderer.invoke('cost:save-settlements', settlements),
  costIsSettled: (params) => electron_1.ipcRenderer.invoke('cost:is-settled', params),
  costGetSettledPeriods: () => electron_1.ipcRenderer.invoke('cost:get-settled-periods'),
  costGetLatestSettledPeriod: () => electron_1.ipcRenderer.invoke('cost:get-latest-settled-period'),
  costUnlockMonth: (params) => electron_1.ipcRenderer.invoke('cost:unlock-month', params),
  costInitialize: (params) => electron_1.ipcRenderer.invoke('cost:initialize', params),
  costAutoComplete: () => electron_1.ipcRenderer.invoke('cost:auto-complete'),
  costReverse: (params) => electron_1.ipcRenderer.invoke('cost:reverse', params),
  costSettlementSummary: (params) => electron_1.ipcRenderer.invoke('cost:settlement-summary', params),
  costSalesSummary: (params) => electron_1.ipcRenderer.invoke('cost:sales-summary', params),
  costTransferSummary: (params) => electron_1.ipcRenderer.invoke('cost:transfer-summary', params),
  costTransactionDetails: (params) => electron_1.ipcRenderer.invoke('cost:transaction-details', params),
  costProductDetailLedger: (params) => electron_1.ipcRenderer.invoke('cost:product-detail-ledger', params),
  costGetSnapshot: (params) => electron_1.ipcRenderer.invoke('cost:get-snapshot', params),
  costGetMonthEndSnapshot: (params) => electron_1.ipcRenderer.invoke('cost:get-month-end-snapshot', params),
  costGetProductCost: (params) => electron_1.ipcRenderer.invoke('cost:get-product-cost', params),
  costSaveSnapshot: (snapshot) => electron_1.ipcRenderer.invoke('cost:save-snapshot', snapshot),

  // ==================== 收付款管理 ====================
  receiptList: () => electron_1.ipcRenderer.invoke('receipt-list'),
  receiptAdd: (data) => electron_1.ipcRenderer.invoke('receipt-add', data),
  receiptUpdate: (data) => electron_1.ipcRenderer.invoke('receipt-update', data),
  receiptDelete: (id) => electron_1.ipcRenderer.invoke('receipt-delete', id),
  paymentList: () => electron_1.ipcRenderer.invoke('payment-list'),
  paymentAdd: (data) => electron_1.ipcRenderer.invoke('payment-add', data),
  paymentUpdate: (data) => electron_1.ipcRenderer.invoke('payment-update', data),
  paymentDelete: (id) => electron_1.ipcRenderer.invoke('payment-delete', id),

  // ==================== 用户权限管理 ====================
  userList: () => electron_1.ipcRenderer.invoke('user-list'),
  userAdd: (data) => electron_1.ipcRenderer.invoke('user-add', data),
  userUpdate: (data) => electron_1.ipcRenderer.invoke('user-update', data),
  userDelete: (id) => electron_1.ipcRenderer.invoke('user-delete', id),
  roleList: () => electron_1.ipcRenderer.invoke('role-list'),
  employeeList: () => electron_1.ipcRenderer.invoke('employee-list'),

  // ==================== 数据库备份管理 ====================
  dbBackupManual: () => electron_1.ipcRenderer.invoke('db-backup-manual'),
  dbBackupRestore: () => electron_1.ipcRenderer.invoke('db-backup-restore'),
  dbBackupList: () => electron_1.ipcRenderer.invoke('db-backup-list'),
  dbBackupExport: () => electron_1.ipcRenderer.invoke('db-backup-export'),
  dbBackupInfo: () => electron_1.ipcRenderer.invoke('db-info'),
  dbBackupRestoreFrom: (backupPath) => electron_1.ipcRenderer.invoke('db-backup-restore-from', backupPath),
  dbBackupDelete: (filename) => electron_1.ipcRenderer.invoke('db-backup-delete', filename),
  dbBackupConfig: () => electron_1.ipcRenderer.invoke('db-backup-config'),
  dbBackupSaveConfig: (config) => electron_1.ipcRenderer.invoke('db-backup-save-config', config),
  dbBackupStats: () => electron_1.ipcRenderer.invoke('db-backup-stats'),
  dbBackupRestoreFromPath: (backupPath) => electron_1.ipcRenderer.invoke('db-backup-restore-from', backupPath),
  
  // ==================== 系统设置 ====================
  getSystemSettings: () => electron_1.ipcRenderer.invoke('system:get-settings'),
  saveSystemSettings: (settings) => electron_1.ipcRenderer.invoke('system:save-settings', settings),
  
  // ==================== 开票记录管理 ====================
  getInvoiceRecord: (inboundNo) => electron_1.ipcRenderer.invoke('invoice-get-record', inboundNo),
  saveInvoiceRecord: (recordData) => electron_1.ipcRenderer.invoke('invoice-save-record', recordData)
})

console.log('window.electron 已暴露')
