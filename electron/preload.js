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
  
  // 销售出库
  outboundList: (page, pageSize, where, params) => electron_1.ipcRenderer.invoke('outbound-list', page, pageSize, where, params),
  outboundAdd: (outbound) => electron_1.ipcRenderer.invoke('outbound-add', outbound),
  outboundUpdate: (outbound) => electron_1.ipcRenderer.invoke('outbound-update', outbound),
  outboundDelete: (id) => electron_1.ipcRenderer.invoke('outbound-delete', id),
  
  // 库存调拨
  transferList: (page, pageSize, where, params) => electron_1.ipcRenderer.invoke('transfer-list', page, pageSize, where, params),
  transferAdd: (transfer) => electron_1.ipcRenderer.invoke('transfer-add', transfer),
  transferUpdate: (transfer) => electron_1.ipcRenderer.invoke('transfer-update', transfer),
  transferDelete: (id) => electron_1.ipcRenderer.invoke('transfer-delete', id),
  
  // 采购退货
  purchaseReturnList: (page, pageSize) => electron_1.ipcRenderer.invoke('purchase-return-list', page, pageSize),
  purchaseReturnAdd: (returnData) => electron_1.ipcRenderer.invoke('purchase-return-add', returnData),
  purchaseReturnUpdate: (returnData) => electron_1.ipcRenderer.invoke('purchase-return-update', returnData),
  purchaseReturnDelete: (id) => electron_1.ipcRenderer.invoke('purchase-return-delete', id),
  
  // 销售退货
  salesReturnList: (page, pageSize) => electron_1.ipcRenderer.invoke('sales-return-list', page, pageSize),
  salesReturnAdd: (returnData) => electron_1.ipcRenderer.invoke('sales-return-add', returnData),
  salesReturnUpdate: (returnData) => electron_1.ipcRenderer.invoke('sales-return-update', returnData),
  salesReturnDelete: (id) => electron_1.ipcRenderer.invoke('sales-return-delete', id),
  
  // 库存查询
  inventoryQuery: (warehouseId, productCode) => electron_1.ipcRenderer.invoke('inventory-query', warehouseId, productCode),
  
  // 获取单个产品的实时库存
  productStock: (productId, warehouseId) => electron_1.ipcRenderer.invoke('product-stock', productId, warehouseId),
  
  // 成本结算查询
  costSettlementQuery: (year, month, productCode, warehouseId) => electron_1.ipcRenderer.invoke('cost-settlement-query', year, month, productCode, warehouseId),
  
  // 数据库备份管理
  dbBackupManual: () => electron_1.ipcRenderer.invoke('db-backup-manual'),
  dbBackupRestore: () => electron_1.ipcRenderer.invoke('db-backup-restore'),
  dbBackupList: () => electron_1.ipcRenderer.invoke('db-backup-list'),
  dbExport: () => electron_1.ipcRenderer.invoke('db-export'),
  dbInfo: () => electron_1.ipcRenderer.invoke('db-info'),
  
  // IPC 直接访问（用于 db-ipc.ts）
  ipcRenderer: electron_1.ipcRenderer
})

console.log('window.electron 已暴露')
