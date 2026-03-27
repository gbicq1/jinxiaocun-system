<template>
  <div class="products-page">
    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增产品
        </el-button>
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出 Excel
        </el-button>
        <el-input
          v-model="searchQuery"
          placeholder="搜索产品编码/名称"
          style="width: 300px; margin-left: auto"
          clearable
          @clear="handleSearch"
        >
          <template #append>
            <el-button @click="handleSearch">
              <el-icon><Search /></el-icon>
            </el-button>
          </template>
        </el-input>
      </div>

      <el-table
        :data="products"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="code" label="产品编码" width="120" />
        <el-table-column prop="name" label="产品名称" min-width="150" />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="spec" label="规格" width="150" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="stockQuantity" label="库存" width="80">
          <template #default="{ row }">
            <el-tag :type="row.stockQuantity < row.warningQuantity ? 'danger' : 'success'">
              {{ row.stockQuantity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="costPrice" label="成本价" width="100">
          <template #default="{ row }">
            ¥{{ row.costPrice }}
          </template>
        </el-table-column>
        <el-table-column prop="sellPrice" label="销售价" width="100">
          <template #default="{ row }">
            ¥{{ row.sellPrice }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="产品编码" prop="code">
          <el-input v-model="formData.code" placeholder="请输入产品编码" />
        </el-form-item>
        <el-form-item label="产品名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入产品名称" />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-input v-model="formData.category" placeholder="请输入产品分类" />
        </el-form-item>
        <el-form-item label="规格型号" prop="spec">
          <el-input v-model="formData.spec" placeholder="请输入规格型号" />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="formData.unit" placeholder="个/件/箱等" />
        </el-form-item>
        <el-form-item label="条形码" prop="barcode">
          <el-input v-model="formData.barcode" placeholder="请输入条形码" />
        </el-form-item>
        <el-form-item label="成本价" prop="costPrice">
          <el-input-number
            v-model="formData.costPrice"
            :min="0"
            :precision="2"
            :step="0.01"
            :controls="false"
            placeholder="选填"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="销售价" prop="sellPrice">
          <el-input-number
            v-model="formData.sellPrice"
            :min="0"
            :precision="2"
            :step="0.01"
            :controls="false"
            placeholder="选填"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="库存数量" prop="stockQuantity">
          <el-input-number
            v-model="formData.stockQuantity"
            :min="0"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="预警数量" prop="warningQuantity">
          <el-input-number
            v-model="formData.warningQuantity"
            :min="0"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注信息"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="formData.status"
            :active-value="1"
            :inactive-value="0"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import exportToCsv from '../../utils/exportCsv'

interface Product {
  id?: number
  code: string
  name: string
  category?: string
  spec?: string
  unit?: string
  barcode?: string
  costPrice: number
  sellPrice: number
  stockQuantity: number
  warningQuantity: number
  status: number
  remark?: string
}

const products = ref<Product[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const searchQuery = ref('')
const dialogVisible = ref(false)
const dialogTitle = ref('新增产品')
const formRef = ref()

const formData = reactive<Product>({
  code: '',
  name: '',
  category: '',
  spec: '',
  unit: '',
  barcode: '',
  costPrice: 0,
  sellPrice: 0,
  stockQuantity: 0,
  warningQuantity: 10,
  status: 1,
  remark: ''
})

const rules = {
  code: [{ required: true, message: '请输入产品编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入产品名称', trigger: 'blur' }]
}

// 加载产品列表
const loadProducts = async () => {
  try {
    // 检查是否有 Electron 环境
    if (window.electron && window.electron.dbQuery) {
      // Electron 环境
      const result = await window.electron.dbQuery('products', 'SELECT * FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?', [
        pageSize.value,
        (currentPage.value - 1) * pageSize.value
      ])
      products.value = result
      total.value = result.length
    } else {
      // 前端环境 - 使用模拟数据
      const savedData = localStorage.getItem('products')
      const allProducts = savedData ? JSON.parse(savedData) : []
      
      // 搜索过滤
      let filtered = allProducts
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = allProducts.filter((p: Product) => 
          p.code.toLowerCase().includes(query) || 
          p.name.toLowerCase().includes(query)
        )
      }
      
      // 分页
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      products.value = filtered.slice(start, end)
      total.value = filtered.length
    }
  } catch (error) {
    ElMessage.error('加载产品列表失败')
    console.error(error)
  }
}

// 新增产品
const handleAdd = () => {
  dialogTitle.value = '新增产品'
  Object.assign(formData, {
    code: '',
    name: '',
    category: '',
    spec: '',
    unit: '',
    barcode: '',
    costPrice: 0,
    sellPrice: 0,
    stockQuantity: 0,
    warningQuantity: 10,
    status: 1,
    remark: ''
  })
  dialogVisible.value = true
}

// 编辑产品
const handleEdit = (row: Product) => {
  dialogTitle.value = '编辑产品'
  Object.assign(formData, row)
  dialogVisible.value = true
}

// 删除产品
const handleDelete = async (row: Product) => {
  try {
    await ElMessageBox.confirm('确定要删除该产品吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    if (window.electron && window.electron.dbDelete) {
      // Electron 环境
      await window.electron.dbDelete('products', 'id = ?', [row.id])
    } else {
      // 前端环境 - 使用 localStorage
      const savedData = localStorage.getItem('products')
      const allProducts = savedData ? JSON.parse(savedData) : []
      const filtered = allProducts.filter((p: Product) => p.id !== row.id)
      localStorage.setItem('products', JSON.stringify(filtered))
    }
    
    ElMessage.success('删除成功')
    loadProducts()
  } catch {
    // 用户取消删除
  }
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    
    if (formData.id) {
      // 更新
      if (window.electron && window.electron.dbUpdate) {
        // Electron 环境
        await window.electron.dbUpdate('products', formData, 'id = ?', [formData.id])
      } else {
        // 前端环境 - 使用 localStorage
        const savedData = localStorage.getItem('products')
        const allProducts = savedData ? JSON.parse(savedData) : []
        const index = allProducts.findIndex((p: Product) => p.id === formData.id)
        if (index !== -1) {
          allProducts[index] = { ...formData }
          localStorage.setItem('products', JSON.stringify(allProducts))
        }
      }
      ElMessage.success('更新成功')
    } else {
      // 新增
      const newProduct = {
        ...formData,
        id: Date.now() // 生成唯一 ID
      }
      
      if (window.electron && window.electron.dbInsert) {
        // Electron 环境
        await window.electron.dbInsert('products', newProduct)
      } else {
        // 前端环境 - 使用 localStorage
        const savedData = localStorage.getItem('products')
        const allProducts = savedData ? JSON.parse(savedData) : []
        allProducts.push(newProduct)
        localStorage.setItem('products', JSON.stringify(allProducts))
      }
      
      ElMessage.success('新增成功')
    }
    
    dialogVisible.value = false
    loadProducts()
  } catch (error) {
    console.error('提交失败:', error)
    // 不要显示错误消息，因为验证错误已经由表单显示了
  }
}

// 搜索
const handleSearch = () => {
  currentPage.value = 1
  loadProducts()
}

// 分页
const handleSizeChange = () => {
  currentPage.value = 1
  loadProducts()
}

const handlePageChange = () => {
  loadProducts()
}

// 导出 Excel
const handleExport = () => {
  const columns = [
    { label: '产品编码', key: 'code' },
    { label: '产品名称', key: 'name' },
    { label: '规格', key: 'specification' },
    { label: '单位', key: 'unit' },
    { label: '销售价（含税）', key: 'sellPrice' },
    { label: '采购价', key: 'costPrice' }
  ]
  exportToCsv('products.csv', columns, products.value)
}

// 多选
const handleSelectionChange = (selection: any[]) => {
  console.log('选中:', selection)
}

onMounted(() => {
  loadProducts()
})
</script>

<style scoped>
.products-page {
  padding: 20px;
}

.toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
