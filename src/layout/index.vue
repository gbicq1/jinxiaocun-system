<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <div class="company">荆州供销农业服务有限公司</div>
        <h2>进销存系统</h2>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-sub-menu index="setup">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>期初基础设置</span>
          </template>
          <el-menu-item index="/setup/products">产品基础数据</el-menu-item>
          <el-menu-item index="/setup/warehouses">仓库仓位数据</el-menu-item>
          <el-menu-item index="/setup/suppliers">供应商信息</el-menu-item>
          <el-menu-item index="/setup/customers">客户信息</el-menu-item>
          <el-menu-item index="/setup/price-list">供应商价格表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="sales">
          <template #title>
            <el-icon><ShoppingCart /></el-icon>
            <span>销售管理</span>
          </template>
          <el-menu-item index="/sales/outbound">销售出库</el-menu-item>
          <el-menu-item index="/sales/returns">销售订单退换货</el-menu-item>
          <el-menu-item index="/sales/invoice-management">销售开票管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="purchase">
          <template #title>
            <el-icon><Shop /></el-icon>
            <span>采购管理</span>
          </template>
          <el-menu-item index="/purchase/inbound">采购入库</el-menu-item>
          <el-menu-item index="/purchase/returns">采购订单退换货</el-menu-item>
          <el-menu-item index="/purchase/invoice-management">采购开票管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="inventory">
          <template #title>
            <el-icon><Grid /></el-icon>
            <span>库存管理</span>
          </template>
          <el-menu-item index="/inventory/stock">实时库存查询</el-menu-item>
          <el-menu-item index="/inventory/transfer">库存调拨</el-menu-item>
          <el-menu-item index="/inventory/period">库存期初期末</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="finance">
          <template #title>
            <el-icon><Wallet /></el-icon>
            <span>财务管理</span>
          </template>
          <el-menu-item index="/finance/reconciliation">供应商/客户对账</el-menu-item>
          <el-menu-item index="/finance/cost-settlement">成本结算</el-menu-item>
          <el-menu-item index="/finance/receipt">收款单</el-menu-item>
          <el-menu-item index="/finance/payment">付款单</el-menu-item>
          <el-menu-item index="/finance/reports">报表中心</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="system">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </template>
          <el-menu-item index="/system/users">用户管理</el-menu-item>
          <el-menu-item index="/system/roles">角色管理</el-menu-item>
          <el-menu-item index="/system/employees">职工档案</el-menu-item>
          <el-menu-item index="/system/barcode-settings">条码扫描设置</el-menu-item>
          <el-menu-item index="/system/logs">操作日志</el-menu-item>
          <el-menu-item index="/system/recycle-bin">回收站</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <h3>{{ currentTitle }}</h3>
        </div>
        <div class="header-right">
          <el-button type="primary" size="small">管理员</el-button>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => (route.meta?.title as string) || '进销存系统')
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  overflow-x: hidden;
}

.logo {
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #2b3a4b;
  color: #fff;
}

.logo h2 {
  margin: 0;
  font-size: 18px;
  font-weight: normal;
}

.logo .company {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logo .company {
  font-size: 12px;
  color: #ffffff;
  padding-bottom: 4px;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.header-right {
  display: flex;
  align-items: center;
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
