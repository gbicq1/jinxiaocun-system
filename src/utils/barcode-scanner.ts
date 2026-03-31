/**
 * 条码扫描枪服务
 * 支持 USB/蓝牙扫描枪的模拟键盘输入
 */

export interface BarcodeScanEvent {
  barcode: string
  timestamp: Date
  source: 'scanner' | 'keyboard'
}

export type BarcodeScanHandler = (event: BarcodeScanEvent) => void

class BarcodeScannerService {
  private buffer: string = ''
  private timer: NodeJS.Timeout | null = null
  private scanTimeout: number = 100 // 扫描超时时间（毫秒）
  private handlers: BarcodeScanHandler[] = []
  private enabled: boolean = true
  private lastScanTime: Date | null = null
  private minScanInterval: number = 500 // 最小扫描间隔（毫秒）

  /**
   * 初始化条码扫描器
   */
  init() {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.handleKeyDown.bind(this))
      console.log('[BarcodeScanner] 初始化完成')
    }
  }

  /**
   * 销毁扫描器
   */
  destroy() {
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.handleKeyDown.bind(this))
    }
    if (this.timer) {
      clearTimeout(this.timer)
    }
  }

  /**
   * 启用/禁用扫描器
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    console.log(`[BarcodeScanner] ${enabled ? '已启用' : '已禁用'}`)
  }

  /**
   * 设置扫描超时时间
   */
  setScanTimeout(timeout: number) {
    this.scanTimeout = timeout
  }

  /**
   * 注册扫描事件处理器
   */
  onScan(handler: BarcodeScanHandler) {
    this.handlers.push(handler)
    console.log(`[BarcodeScanner] 注册处理器，当前处理器数量：${this.handlers.length}`)
  }

  /**
   * 移除扫描事件处理器
   */
  offScan(handler: BarcodeScanHandler) {
    const index = this.handlers.indexOf(handler)
    if (index > -1) {
      this.handlers.splice(index, 1)
    }
  }

  /**
   * 清除所有处理器
   */
  clearHandlers() {
    this.handlers = []
  }

  /**
   * 处理键盘事件
   */
  private handleKeyDown(event: KeyboardEvent) {
    if (!this.enabled) {
      return
    }

    // 检查是否在输入框中（如果是，可能是手动输入）
    const target = event.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

    // 扫描枪通常会快速连续输入，且不以 Ctrl/Alt/Shift 开头
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return
    }

    // 获取字符
    const char = this.getCharFromEvent(event)
    
    if (!char) {
      // 特殊键处理
      if (event.key === 'Enter') {
        // 回车键，提交条码
        this.submitBarcode()
        event.preventDefault()
        return
      } else if (event.key === 'Escape') {
        // 退出键，清空缓冲区
        this.clearBuffer()
        event.preventDefault()
        return
      }
      return
    }

    // 添加到缓冲区
    this.buffer += char

    // 清除之前的定时器
    if (this.timer) {
      clearTimeout(this.timer)
    }

    // 设置新定时器
    this.timer = setTimeout(() => {
      // 超时，可能是手动输入
      if (this.buffer.length > 1) {
        // 如果缓冲区有多个字符，尝试提交
        this.submitBarcode()
      } else {
        // 单个字符，清空
        this.clearBuffer()
      }
    }, this.scanTimeout)
  }

  /**
   * 从键盘事件获取字符
   */
  private getCharFromEvent(event: KeyboardEvent): string | null {
    // 优先使用 key
    if (event.key && event.key.length === 1) {
      return event.key
    }
    
    // 使用 code 转换
    const code = event.code
    if (code.startsWith('Key')) {
      // A-Z
      return code.replace('Key', '').toUpperCase()
    } else if (code.startsWith('Digit')) {
      // 0-9
      return code.replace('Digit', '')
    } else if (code.startsWith('Numpad')) {
      // 数字键盘
      const num = code.replace('Numpad', '')
      if (/^\d$/.test(num)) {
        return num
      }
    }
    
    return null
  }

  /**
   * 提交条码
   */
  private submitBarcode() {
    const barcode = this.buffer.trim()
    
    if (barcode.length === 0) {
      return
    }

    // 检查扫描间隔
    const now = new Date()
    if (this.lastScanTime) {
      const interval = now.getTime() - this.lastScanTime.getTime()
      if (interval < this.minScanInterval) {
        console.log(`[BarcodeScanner] 扫描间隔过短，忽略：${interval}ms`)
        this.clearBuffer()
        return
      }
    }

    this.lastScanTime = now

    // 创建扫描事件
    const scanEvent: BarcodeScanEvent = {
      barcode,
      timestamp: now,
      source: 'scanner'
    }

    console.log(`[BarcodeScanner] 扫描到条码：${barcode}`)

    // 触发处理器
    this.handlers.forEach(handler => {
      try {
        handler(scanEvent)
      } catch (error) {
        console.error('[BarcodeScanner] 处理器执行错误:', error)
      }
    })

    // 清空缓冲区
    this.clearBuffer()

    // 播放提示音
    this.playBeep()
  }

  /**
   * 清空缓冲区
   */
  private clearBuffer() {
    this.buffer = ''
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /**
   * 播放扫描提示音
   */
  private playBeep() {
    if (typeof window !== 'undefined') {
      try {
        // 使用 AudioContext 生成提示音
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = 1200 // 频率 1200Hz
        oscillator.type = 'sine'
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.1)
      } catch (error) {
        // 忽略音频错误
        console.log('[BarcodeScanner] 提示音播放失败:', error)
      }
    }
  }

  /**
   * 手动触发扫描（用于测试）
   */
  triggerScan(barcode: string) {
    const scanEvent: BarcodeScanEvent = {
      barcode,
      timestamp: new Date(),
      source: 'keyboard'
    }
    
    this.handlers.forEach(handler => {
      try {
        handler(scanEvent)
      } catch (error) {
        console.error('[BarcodeScanner] 处理器执行错误:', error)
      }
    })
  }

  /**
   * 获取扫描器状态
   */
  getStatus() {
    return {
      enabled: this.enabled,
      bufferLength: this.buffer.length,
      handlerCount: this.handlers.length,
      lastScanTime: this.lastScanTime,
      scanTimeout: this.scanTimeout
    }
  }
}

// 导出单例
export const barcodeScanner = new BarcodeScannerService()

// 导出工具函数
export function initBarcodeScanner() {
  barcodeScanner.init()
}

export function onBarcodeScan(handler: BarcodeScanHandler) {
  barcodeScanner.onScan(handler)
}

export function destroyBarcodeScanner() {
  barcodeScanner.destroy()
}
