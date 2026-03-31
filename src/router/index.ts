import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/layout/index.vue'

const routes: any[] = [
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '系统首页', icon: 'HomeFilled' }
      }
    ]
  },
  {
    path: '/setup',
    component: Layout,
    redirect: '/setup/products',
    meta: { title: '期初基础设置', icon: 'Setting' },
    children: [
      {
        path: 'products',
        name: 'SetupProducts',
        component: () => import('@/views/setup/products.vue'),
        meta: { title: '产品基础数据', icon: 'List' }
      },
      {
        path: 'warehouses',
        name: 'SetupWarehouses',
        component: () => import('@/views/setup/warehouses.vue'),
        meta: { title: '仓库仓位数据', icon: 'OfficeBuilding' }
      },
      {
        path: 'suppliers',
        name: 'SetupSuppliers',
        component: () => import('@/views/setup/suppliers.vue'),
        meta: { title: '供应商信息', icon: 'User' }
      },
      {
        path: 'customers',
        name: 'SetupCustomers',
        component: () => import('@/views/setup/customers.vue'),
        meta: { title: '客户信息', icon: 'Users' }
      },
      {
        path: 'price-list',
        name: 'SetupPriceList',
        component: () => import('@/views/setup/price-list.vue'),
        meta: { title: '供应商价格表', icon: 'Money' }
      }
    ]
  },
  {
    path: '/sales',
    component: Layout,
    redirect: '/sales/quotes',
    meta: { title: '销售管理', icon: 'ShoppingCart' },
    children: [
      {
        path: 'quotes',
        name: 'SalesQuotes',
        component: () => import('@/views/sales/quotes.vue'),
        meta: { title: '销售报价单', icon: 'Document' }
      },
      {
        path: 'orders',
        name: 'SalesOrders',
        component: () => import('@/views/sales/orders.vue'),
        meta: { title: '销售订单', icon: 'Tickets' }
      },
      {
        path: 'outbound',
        name: 'SalesOutbound',
        component: () => import('@/views/sales/outbound.vue'),
        meta: { title: '销售出库', icon: 'Box' }
      },
      {
        path: 'returns',
        name: 'SalesReturns',
        component: () => import('@/views/sales/returns.vue'),
        meta: { title: '销售订单退换货', icon: 'RefreshLeft' }
      },
      {
        path: 'invoice-management',
        name: 'SalesInvoiceManagement',
        component: () => import('@/views/sales/invoice-management.vue'),
        meta: { title: '销售开票管理', icon: 'Document' }
      }
    ]
  },
  {
    path: '/purchase',
    component: Layout,
    redirect: '/purchase/requests',
    meta: { title: '采购管理', icon: 'Shop' },
    children: [
      {
        path: 'requests',
        name: 'PurchaseRequests',
        component: () => import('@/views/purchase/requests.vue'),
        meta: { title: '采购申请单', icon: 'Document' }
      },
      {
        path: 'orders',
        name: 'PurchaseOrders',
        component: () => import('@/views/purchase/orders.vue'),
        meta: { title: '采购订单', icon: 'Tickets' }
      },
      {
        path: 'inbound',
        name: 'PurchaseInbound',
        component: () => import('@/views/purchase/inbound.vue'),
        meta: { title: '采购入库', icon: 'Box' }
      },
      {
        path: 'returns',
        name: 'PurchaseReturns',
        component: () => import('@/views/purchase/returns.vue'),
        meta: { title: '采购订单退换货', icon: 'RefreshRight' }
      },
      {
        path: 'invoice-management',
        name: 'PurchaseInvoiceManagement',
        component: () => import('@/views/purchase/invoice-management.vue'),
        meta: { title: '采购开票管理', icon: 'Document' }
      }
    ]
  },
  {
    path: '/inventory',
    component: Layout,
    redirect: '/inventory/stock',
    meta: { title: '库存管理', icon: 'Grid' },
    children: [
      {
        path: 'stock',
        name: 'InventoryStock',
        component: () => import('@/views/inventory/stock.vue'),
        meta: { title: '实时库存查询', icon: 'View' }
      },
      {
        path: 'inbound',
        name: 'InventoryInbound',
        component: () => import('@/views/inventory/inbound.vue'),
        meta: { title: '入库单查询', icon: 'Box' }
      },
      {
        path: 'outbound',
        name: 'InventoryOutbound',
        component: () => import('@/views/inventory/outbound.vue'),
        meta: { title: '出库单查询', icon: 'Box' }
      },
      {
        path: 'transfer',
        name: 'InventoryTransfer',
        component: () => import('@/views/inventory/transfer.vue'),
        meta: { title: '库存调拨', icon: 'SwitchButton' }
      },
      {
        path: 'period',
        name: 'InventoryPeriod',
        component: () => import('@/views/inventory/period.vue'),
        meta: { title: '库存期初期末', icon: 'Calendar' }
      }
    ]
  },
  {
    path: '/finance',
    component: Layout,
    redirect: '/finance/reconciliation',
    meta: { title: '财务管理', icon: 'Wallet' },
    children: [
      {
        path: 'reconciliation',
        name: 'FinanceReconciliation',
        component: () => import('@/views/finance/reconciliation.vue'),
        meta: { title: '供应商/客户对账', icon: 'Files' }
      },
      {
        path: 'cost-settlement',
        name: 'FinanceCostSettlement',
        component: () => import('@/views/finance/cost-settlement.vue'),
        meta: { title: '成本结算', icon: 'Money' }
      },
      {
        path: 'receipt',
        name: 'FinanceReceipt',
        component: () => import('@/views/finance/receipt.vue'),
        meta: { title: '收款单', icon: 'Money' }
      },
      {
        path: 'payment',
        name: 'FinancePayment',
        component: () => import('@/views/finance/payment.vue'),
        meta: { title: '付款单', icon: 'Money' }
      }
    ]
  },
  {
    path: '/system',
    component: Layout,
    redirect: '/system/users',
    meta: { title: '系统设置', icon: 'Setting' },
    children: [
      {
        path: 'users',
        name: 'SystemUsers',
        component: () => import('@/views/system/users.vue'),
        meta: { title: '用户管理', icon: 'User' }
      },
      {
        path: 'roles',
        name: 'SystemRoles',
        component: () => import('@/views/system/roles.vue'),
        meta: { title: '角色管理', icon: 'Avatar' }
      },
      {
        path: 'employees',
        name: 'SystemEmployees',
        component: () => import('@/views/system/employees.vue'),
        meta: { title: '职工档案', icon: 'OfficeBuilding' }
      },
      {
        path: 'logs',
        name: 'SystemLogs',
        component: () => import('@/views/system/logs.vue'),
        meta: { title: '操作日志', icon: 'Document' }
      },
      {
        path: 'recycle-bin',
        name: 'SystemRecycleBin',
        component: () => import('@/views/system/recycle-bin.vue'),
        meta: { title: '回收站', icon: 'Delete' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
