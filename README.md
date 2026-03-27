# 进销存管理系统

一个基于 Vue 3 + TypeScript + Electron 的进销存管理系统，用于管理采购、销售、库存等业务流程。

## 技术栈

- **前端框架**: Vue 3 + TypeScript
- **UI 组件库**: Element Plus
- **桌面应用**: Electron
- **路由管理**: Vue Router 4
- **构建工具**: Vite

## 功能模块

### 1. 采购管理
- 采购订单管理
- 采购入库
- 采购退货
- 采购申请

### 2. 销售管理
- 销售订单管理
- 销售出库
- 销售退货
- 报价单管理

### 3. 库存管理
- 库存查询
- 库存明细
- 库存盘点
- 库存调拨
- 库存预警
- 期初库存

### 4. 财务管理
- 收款管理
- 付款管理
- 对账管理
- 成本核算

### 5. 基础资料
- 产品管理
- 供应商管理
- 客户管理
- 仓库管理
- 价格表

### 6. 系统管理
- 用户管理
- 角色管理
- 员工管理
- 操作日志
- 回收站

## 项目结构

```
进销存系统/
├── src/
│   ├── views/          # 页面组件
│   │   ├── dashboard/  # 仪表盘
│   │   ├── purchase/   # 采购模块
│   │   ├── sales/      # 销售模块
│   │   ├── inventory/  # 库存模块
│   │   ├── finance/    # 财务模块
│   │   ├── setup/      # 基础资料
│   │   └── system/     # 系统管理
│   ├── layout/         # 布局组件
│   ├── router/         # 路由配置
│   ├── utils/          # 工具函数
│   └── types/          # TypeScript 类型定义
├── electron/           # Electron 主进程
├── public/             # 静态资源
└── package.json
```

## 开发指南

### 环境要求

- Node.js >= 16
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 运行 Electron 应用

```bash
npm run electron
```

## 数据存储

当前版本使用 localStorage 进行数据存储，数据保存在浏览器本地。

### 数据键名

- `products`: 产品列表
- `suppliers`: 供应商列表
- `customers`: 客户列表
- `warehouses`: 仓库列表
- `purchaseOrders`: 采购订单
- `purchaseInbounds`: 采购入库
- `purchaseReturns`: 采购退货
- `salesOrders`: 销售订单
- `salesOutbounds`: 销售出库
- `salesReturns`: 销售退货
- `stockInitial`: 期初库存
- `stockCounts`: 库存盘点
- `stockTransfers`: 库存调拨

## 测试

项目包含多个测试文件：

- `TESTING.md`: 测试指南
- `TEST_CHECKLIST.md`: 测试清单
- `TEST_INBOUND.md`: 入库功能测试
- `TEST_REPORT.md`: 测试报告
- `test-modules.html`: 模块测试页面
- `test-suite.js`: 测试套件

## 注意事项

1. 当前版本使用 localStorage 存储数据，清除浏览器缓存会导致数据丢失
2. 建议定期导出数据进行备份
3. 部分功能仍在开发中

## 开发计划

- [ ] 添加数据库支持（SQLite/MySQL）
- [ ] 添加数据导入导出功能
- [ ] 完善权限管理
- [ ] 添加数据报表
- [ ] 优化用户体验
- [ ] 添加数据备份恢复功能

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。
