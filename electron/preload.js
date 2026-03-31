"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// 暴露安全的 IPC 通道给渲染进程
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // 数据库初始化
    initDatabase: () => electron_1.ipcRenderer.invoke('db-init'),
    // 数据库操作
    query: (table, sql, params = []) => electron_1.ipcRenderer.invoke('db-query', table, sql, params),
    insert: (table, data) => electron_1.ipcRenderer.invoke('db-insert', table, data),
    update: (table, data, where, whereParams) => electron_1.ipcRenderer.invoke('db-update', table, data, where, whereParams),
    delete: (table, where, whereParams) => electron_1.ipcRenderer.invoke('db-delete', table, where, whereParams),
    // 产品操作
    getProductList: (page, pageSize) => electron_1.ipcRenderer.invoke('product-list', page, pageSize),
    addProduct: (product) => electron_1.ipcRenderer.invoke('product-add', product),
    updateProduct: (product) => electron_1.ipcRenderer.invoke('product-update', product),
    deleteProduct: (id) => electron_1.ipcRenderer.invoke('product-delete', id)
});
