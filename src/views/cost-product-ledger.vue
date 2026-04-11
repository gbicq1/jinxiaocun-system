<template>
  <div class="cost-product-ledger">
    <div class="header">
      <h2>商品明细账（进销存明细）</h2>
      <el-button
        type="primary"
        @click="handlePrint"
        icon="Printer"
        title="打印明细账"
      >
        打印
      </el-button>
    </div>

    <!-- 查询条件 -->
    <el-card class="query-card">
      <el-form :inline="true" :model="queryForm" label-width="100px">
        <el-form-item label="产品编码">
          <el-input
            v-model="queryForm.productCode"
            placeholder="请输入产品编码"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="queryForm.warehouseId" placeholder="选择仓库" clearable>
            <el-option
              v-for="warehouse in warehouses"
              :key="warehouse.id"
              :label="warehouse.name"
              :value="warehouse.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="会计期间">
          <el-date-picker
            v-model="queryForm.startDate"
            type="month"
            placeholder="选择会计期间"
            value-format="YYYY-MM"
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery" icon="Search">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 明细账表格 -->
    <el-card v-loading="loading">
      <el-table
        :data="tableData"
        style="width: 100%"
        border
        height="600"
        :stripe="true"
      >
        <el-table-column prop="date" label="日期" width="120" fixed />
        <el-table-column prop="docType" label="凭证类型" width="100" />
        <el-table-column prop="docNo" label="凭证号" width="150" />
        <el-table-column prop="counterName" label="往来单位" width="150" />
        <el-table-column prop="productCode" label="产品编码" width="120" />
        <el-table-column prop="productName" label="产品名称" width="180" />

        <el-table-column label="入库数量" width="120" align="right">
          <template #default="scope">
            {{ scope.row.inboundQty > 0 ? scope.row.inboundQty.toFixed(4) : '-' }}
          </template>
        </el-table-column>

        <el-table-column label="出库数量" width="120" align="right">
          <template #default="scope">
            {{ scope.row.outboundQty > 0 ? scope.row.outboundQty.toFixed(4) : '-' }}
          </template>
        </el-table-column>

        <el-table-column label="单价" width="100" align="right">
          <template #default="scope">
            {{ scope.row.unitPrice ? Number(scope.row.unitPrice).toFixed(4) : '-' }}
          </template>
        </el-table-column>

        <el-table-column label="金额" width="120" align="right">
          <template #default="scope">
            {{ scope.row.amount > 0 ? '+' : '' }}{{ scope.row.amount.toFixed(2) }}
          </template>
        </el-table-column>

        <el-table-column label="结存数量" width="120" align="right">
          <template #default="scope">
            {{ scope.row.balanceQty.toFixed(4) }}
          </template>
        </el-table-column>

        <el-table-column label="结存金额" width="150" align="right">
          <template #default="scope">
            {{ Number(scope.row.balanceAmount).toFixed(2) }}
          </template>
        </el-table-column>

        <el-table-column prop="remark" label="备注" min-width="150" />
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getProductDetailLedger } from '@/api/cost'
import { getWarehouseList } from '@/api/common'
import Printer from '@/utils/printer'

const loading = ref(false)
const tableData = ref<any[]>([])
const warehouses = ref<any[]>([])
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const queryForm = reactive({
  productCode: '',
  warehouseId: '',
  startDate: '',
  endDate: ''
})

// 初始化
onMounted(() => {
  loadWarehouses()
  // 默认当前月份
  const now = new Date()
  queryForm.startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  handleQuery()
})

// 加载仓库列表
const loadWarehouses = async () => {
  const res = await getWarehouseList()
  if (res.success) {
    warehouses.value = res.data
  }
}

// 查询
const handleQuery = async () => {
  if (!queryForm.startDate) {
    ElMessage.warning('请选择会计期间')
    return
  }

  loading.value = true
  try {
    // 解析日期
    const [year, month] = queryForm.startDate.split('-').map(Number)
    const endDate = new Date(year, month, 0).toISOString()

    queryForm.endDate = endDate

    const res = await getProductDetailLedger({
      productCode: queryForm.productCode,
      warehouseId: queryForm.warehouseId,
      startDate: queryForm.startDate,
      endDate: queryForm.endDate
    })

    if (res.success) {
      tableData.value = res.data
      pagination.total = res.data.length
    } else {
      ElMessage.warning(res.message || '查询失败')
    }
  } catch (error) {
    console.error('查询失败:', error)
    ElMessage.error('查询失败')
  } finally {
    loading.value = false
  }
}

// 重置
const handleReset = () => {
  queryForm.productCode = ''
  queryForm.warehouseId = ''
  const now = new Date()
  queryForm.startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  handleQuery()
}

// 打印
const handlePrint = () => {
  if (tableData.value.length === 0) {
    ElMessage.warning('没有可打印的数据')
    return
  }

  const printContent = {
    title: '商品明细账',
    columns: [
      { key: 'date', title: '日期', width: 100 },
      { key: 'docType', title: '凭证类型', width: 100 },
      { key: 'docNo', title: '凭证号', width: 120 },
      { key: 'counterName', title: '往来单位', width: 120 },
      { key: 'productCode', title: '产品编码', width: 100 },
      { key: 'productName', title: '产品名称', width: 150 },
      { key: 'inboundQty', title: '入库数量', width: 100 },
      { key: 'outboundQty', title: '出库数量', width: 100 },
      { key: 'unitPrice', title: '单价', width: 100 },
      { key: 'amount', title: '金额', width: 100 },
      { key: 'balanceQty', title: '结存数量', width: 100 },
      { key: 'balanceAmount', title: '结存金额', width: 120 },
      { key: 'remark', title: '备注', width: 150 }
    ],
    data: tableData.value
  }

  Printer.printTable(printContent)
}

const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  handleQuery()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  handleQuery()
}
</script>

<style scoped>
.cost-product-ledger {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.query-card {
  margin-bottom: 20px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
