<template>
  <div class="price-list-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增价格
        </el-button>
      </div>
      <el-table :data="priceList" style="width: 100%">
        <el-table-column prop="productCode" label="产品编码" width="120" />
        <el-table-column prop="productName" label="产品名称" min-width="150" />
        <el-table-column prop="supplierName" label="供应商" width="150" />
            <el-table-column prop="purchasePrice" label="采购价" width="100">
              <template #default="{ row }">
                ¥{{ row.purchasePrice }}
              </template>
            </el-table-column>
            <el-table-column prop="salePrice" label="销售价（含税）" width="100">
              <template #default="{ row }">
                ¥{{ row.salePrice }}
              </template>
            </el-table-column>
            <el-table-column prop="effectiveDate" label="生效日期" width="120" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="dialogVisible" title="价格设置" width="700px">
      <el-form label-width="120px">
        <el-form-item label="产品编码"><el-input v-model="formData.productCode" /></el-form-item>
        <el-form-item label="产品名称"><el-input v-model="formData.productName" /></el-form-item>
        <el-form-item label="供应商"><el-input v-model="formData.supplierName" /></el-form-item>
        <el-form-item label="采购价"><el-input-number v-model="formData.purchasePrice" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="销售价（含税）"><el-input-number v-model="formData.salePrice" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="生效日期"><el-date-picker v-model="formData.effectiveDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

const priceList = ref<any[]>([])
const dialogVisible = ref(false)
const formData = reactive({ id: 0, productCode: '', productName: '', supplierName: '', purchasePrice: 0, salePrice: 0, effectiveDate: '' })

const loadPriceList = async () => {
  try {
    priceList.value = await db.getPriceList()
  } catch (error) {
    console.error('加载价格列表失败:', error)
    priceList.value = []
  }
}

const savePriceList = async () => {
  try {
    await db.savePriceList(priceList.value)
  } catch (error) {
    console.error('保存价格列表失败:', error)
  }
}

const handleAdd = () => {
  Object.assign(formData, { id: Date.now(), productCode: '', productName: '', supplierName: '', purchasePrice: 0, salePrice: 0, effectiveDate: '' })
  dialogVisible.value = true
}

const handleEdit = (row: any) => {
  Object.assign(formData, { ...row })
  dialogVisible.value = true
}

const handleDelete = async (row: any) => {
  priceList.value = priceList.value.filter(p => p.id !== row.id)
  await savePriceList()
}

const handleSubmit = async () => {
  const idx = priceList.value.findIndex(p => p.id === formData.id)
  if (idx === -1) priceList.value.push({ ...formData })
  else priceList.value[idx] = { ...formData }
  await savePriceList()
  dialogVisible.value = false
}

onMounted(() => loadPriceList())
</script>

<style scoped>
.price-list-page { padding: 20px; }
.toolbar { margin-bottom: 20px; }
</style>
