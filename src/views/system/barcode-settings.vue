<template>
  <div class="barcode-settings">
    <el-row :gutter="20">
      <!-- 左侧：设置面板 -->
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>📷 条码扫描枪设置</span>
            </div>
          </template>

          <el-alert
            title="使用说明"
            type="info"
            :closable="false"
            show-icon
            style="margin-bottom: 20px"
          >
            <p>1. 系统支持 USB 接口和蓝牙接口的条码扫描枪</p>
            <p>2. 扫描枪会模拟键盘输入，无需额外驱动</p>
            <p>3. 扫描条码后会自动添加到当前聚焦的输入框</p>
            <p>4. 在销售出库、采购入库等单据中可直接使用</p>
          </el-alert>

          <el-form :model="settings" label-width="150px">
            <el-form-item label="扫描枪状态">
              <el-switch
                v-model="settings.enabled"
                @change="handleEnabledChange"
                active-text="已启用"
                inactive-text="已禁用"
              />
              <div class="form-tip">
                禁用后扫描枪将无法使用，仅支持手动输入
              </div>
            </el-form-item>

            <el-form-item label="扫描超时时间">
              <el-input-number
                v-model="settings.scanTimeout"
                :min="50"
                :max="500"
                :step="10"
                @change="handleTimeoutChange"
              />
              <span class="unit">毫秒</span>
              <div class="form-tip">
                扫描枪快速输入时的字符间隔时间，建议 100ms
              </div>
            </el-form-item>

            <el-form-item label="最小扫描间隔">
              <el-input-number
                v-model="settings.minScanInterval"
                :min="100"
                :max="2000"
                :step="100"
                @change="handleIntervalChange"
              />
              <span class="unit">毫秒</span>
              <div class="form-tip">
                防止重复扫描的最小间隔时间，建议 500ms
              </div>
            </el-form-item>

            <el-form-item label="提示音">
              <el-switch
                v-model="settings.beepEnabled"
                active-text="开启"
                inactive-text="关闭"
              />
              <div class="form-tip">
                扫描成功时播放提示音
              </div>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSave">保存设置</el-button>
              <el-button @click="handleReset">重置设置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 使用场景 -->
        <el-card style="margin-top: 20px;">
          <template #header>
            <span>📋 使用场景</span>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="销售出库">
              在商品选择框中，直接扫描商品条码，系统会自动匹配对应商品
            </el-descriptions-item>
            <el-descriptions-item label="采购入库">
              在商品选择框中，扫描商品条码快速录入入库商品
            </el-descriptions-item>
            <el-descriptions-item label="库存盘点">
              扫描商品条码快速定位商品，进行盘点操作
            </el-descriptions-item>
            <el-descriptions-item label="产品档案">
              在产品列表中扫描条码快速查找产品
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <!-- 右侧：测试和状态 -->
      <el-col :span="8">
        <!-- 测试区域 -->
        <el-card>
          <template #header>
            <span>🧪 测试扫描</span>
          </template>
          <el-input
            v-model="testBarcode"
            placeholder="使用扫描枪扫描或手动输入条码"
            clearable
            @keyup.enter="handleTestScan"
          >
            <template #append>
              <el-button @click="handleTestScan">测试</el-button>
            </template>
          </el-input>
          <div class="form-tip" style="margin-top: 10px;">
            扫描或输入条码后按回车测试
          </div>
        </el-card>

        <!-- 扫描器状态 -->
        <el-card style="margin-top: 20px;">
          <template #header>
            <span>📊 扫描器状态</span>
          </template>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="启用状态">
              <el-tag :type="status.enabled ? 'success' : 'info'">
                {{ status.enabled ? '已启用' : '已禁用' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="处理器数量">
              {{ status.handlerCount }}
            </el-descriptions-item>
            <el-descriptions-item label="缓冲区长度">
              {{ status.bufferLength }}
            </el-descriptions-item>
            <el-descriptions-item label="上次扫描时间">
              {{ status.lastScanTime ? formatTime(status.lastScanTime) : '从未' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 扫描历史 -->
        <el-card style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <span>📜 扫描历史</span>
              <el-button size="small" @click="clearHistory">清空</el-button>
            </div>
          </template>
          <el-table :data="scanHistory" max-height="300" empty-text="暂无扫描记录" size="small">
            <el-table-column prop="barcode" label="条码" min-width="120" />
            <el-table-column prop="source" label="来源" width="60">
              <template #default="{ row }">
                <el-tag :type="row.source === 'scanner' ? 'success' : 'info'" size="small">
                  {{ row.source === 'scanner' ? '扫描' : '手动' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="timestamp" label="时间" width="140">
              <template #default="{ row }">
                {{ formatTime(row.timestamp) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  barcodeScanner,
  initBarcodeScanner,
  onBarcodeScan,
  type BarcodeScanEvent
} from '@/utils/barcode-scanner'

// 设置
const settings = reactive({
  enabled: true,
  scanTimeout: 100,
  minScanInterval: 500,
  beepEnabled: true
})

// 状态
const status = ref({
  enabled: true,
  bufferLength: 0,
  handlerCount: 0,
  lastScanTime: null as Date | null,
  scanTimeout: 100
})

// 测试条码
const testBarcode = ref('')

// 扫描历史
const scanHistory = ref<BarcodeScanEvent[]>([])

// 初始化
onMounted(() => {
  initBarcodeScanner()
  
  // 注册扫描处理器
  onBarcodeScan(handleScan)
  
  // 加载保存的设置
  loadSettings()
  
  // 更新状态
  updateStatus()
})

// 加载设置
const loadSettings = () => {
  const saved = localStorage.getItem('barcode_scanner_settings')
  if (saved) {
    try {
      const config = JSON.parse(saved)
      settings.enabled = config.enabled ?? true
      settings.scanTimeout = config.scanTimeout ?? 100
      settings.minScanInterval = config.minScanInterval ?? 500
      settings.beepEnabled = config.beepEnabled ?? true
      
      // 应用设置
      barcodeScanner.setEnabled(settings.enabled)
      barcodeScanner.setScanTimeout(settings.scanTimeout)
    } catch (error) {
      console.error('加载条码扫描器设置失败:', error)
    }
  }
}

// 保存设置
const handleSave = () => {
  const config = {
    enabled: settings.enabled,
    scanTimeout: settings.scanTimeout,
    minScanInterval: settings.minScanInterval,
    beepEnabled: settings.beepEnabled
  }
  
  localStorage.setItem('barcode_scanner_settings', JSON.stringify(config))
  ElMessage.success('设置已保存')
}

// 重置设置
const handleReset = () => {
  settings.enabled = true
  settings.scanTimeout = 100
  settings.minScanInterval = 500
  settings.beepEnabled = true
  
  barcodeScanner.setEnabled(true)
  barcodeScanner.setScanTimeout(100)
  
  localStorage.removeItem('barcode_scanner_settings')
  ElMessage.success('设置已重置')
}

// 处理扫描
const handleScan = (event: BarcodeScanEvent) => {
  console.log('收到扫描事件:', event)
  
  // 添加到历史
  scanHistory.value.unshift({ ...event })
  
  // 限制历史记录数量
  if (scanHistory.value.length > 50) {
    scanHistory.value.pop()
  }
  
  // 提示
  if (settings.beepEnabled) {
    ElMessage.success(`扫描成功：${event.barcode}`)
  }
  
  // 更新状态
  updateStatus()
}

// 测试扫描
const handleTestScan = () => {
  if (!testBarcode.value.trim()) {
    ElMessage.warning('请输入条码')
    return
  }
  
  barcodeScanner.triggerScan(testBarcode.value.trim())
  testBarcode.value = ''
}

// 启用/禁用
const handleEnabledChange = (value: boolean) => {
  barcodeScanner.setEnabled(value)
  updateStatus()
}

// 超时时间
const handleTimeoutChange = (value: number) => {
  barcodeScanner.setScanTimeout(value)
  updateStatus()
}

// 扫描间隔
const handleIntervalChange = (value: number) => {
  // 这里可以添加设置最小扫描间隔的方法
  ElMessage.info('最小扫描间隔设置已保存')
}

// 更新状态
const updateStatus = () => {
  const s = barcodeScanner.getStatus()
  status.value = {
    enabled: s.enabled,
    bufferLength: s.bufferLength,
    handlerCount: s.handlerCount,
    lastScanTime: s.lastScanTime,
    scanTimeout: s.scanTimeout
  }
}

// 格式化时间
const formatTime = (time: Date | string | null) => {
  if (!time) return '从未'
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 清空历史
const clearHistory = () => {
  scanHistory.value = []
  ElMessage.success('已清空扫描历史')
}

// 清理
onUnmounted(() => {
  // destroyBarcodeScanner()
})
</script>

<style scoped lang="scss">
.barcode-settings {
  padding: 20px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    span {
      font-size: 16px;
      font-weight: bold;
    }
  }
  
  .unit {
    margin-left: 10px;
    color: #909399;
  }
  
  .form-tip {
    margin-top: 5px;
    color: #909399;
    font-size: 12px;
    line-height: 1.5;
  }
}
</style>
