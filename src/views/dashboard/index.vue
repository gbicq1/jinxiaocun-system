<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background-color: #409EFF;">
            <el-icon><ShoppingCart /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">125</div>
            <div class="stat-label">销售订单</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background-color: #67C23A;">
            <el-icon><Shop /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">89</div>
            <div class="stat-label">采购订单</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background-color: #E6A23C;">
            <el-icon><Grid /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">1,234</div>
            <div class="stat-label">库存商品</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-icon" style="background-color: #F56C6C;">
            <el-icon><Wallet /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">¥45,678</div>
            <div class="stat-label">应收款项</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>近期销售订单</span>
            </div>
          </template>
          <el-table :data="salesOrders" style="width: 100%">
            <el-table-column prop="orderNo" label="订单号" width="150" />
            <el-table-column prop="customer" label="客户" width="120" />
            <el-table-column prop="amount" label="金额" width="120">
              <template #default="{ row }">
                ¥{{ row.amount.toLocaleString() }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="date" label="日期" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>库存预警</span>
            </div>
          </template>
          <el-table :data="stockWarnings" style="width: 100%">
            <el-table-column prop="code" label="产品编码" width="120" />
            <el-table-column prop="name" label="产品名称" />
            <el-table-column prop="stock" label="库存" width="80">
              <template #default="{ row }">
                <el-tag type="danger">{{ row.stock }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="warning" label="预警线" width="80" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const salesOrders = ref([
  { orderNo: 'SO2024001', customer: '张三公司', amount: 12500, status: '待发货', date: '2024-01-15' },
  { orderNo: 'SO2024002', customer: '李四贸易', amount: 8600, status: '已完成', date: '2024-01-14' },
  { orderNo: 'SO2024003', customer: '王五电子', amount: 15800, status: '待审核', date: '2024-01-14' },
  { orderNo: 'SO2024004', customer: '赵六科技', amount: 9200, status: '待发货', date: '2024-01-13' },
])

const stockWarnings = ref([
  { code: 'P001', name: 'A 型产品', stock: 5, warning: 10 },
  { code: 'P005', name: 'B 型产品', stock: 3, warning: 15 },
  { code: 'P008', name: 'C 型产品', stock: 8, warning: 20 },
])

const getStatusType = (status: string) => {
  const map: any = {
    '待审核': 'warning',
    '待发货': 'primary',
    '已完成': 'success',
  }
  return map[status] || ''
}
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  color: #fff;
  font-size: 24px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #999;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
