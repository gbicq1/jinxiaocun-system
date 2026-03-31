/**
 * 调试日志工具
 * 用于在 Electron 中输出调试信息到主进程控制台
 */

export interface DebugLog {
  level: 'info' | 'warn' | 'error' | 'debug'
  module: string
  message: string
  data?: any
  timestamp: string
}

class DebugLogger {
  private enabled: boolean = true
  private module: string
  private logBuffer: DebugLog[] = []

  constructor(module: string) {
    this.module = module
  }

  /**
   * 启用/禁用日志
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  /**
   * 输出 info 日志
   */
  info(message: string, data?: any) {
    this.log('info', message, data)
  }

  /**
   * 输出 warn 日志
   */
  warn(message: string, data?: any) {
    this.log('warn', message, data)
  }

  /**
   * 输出 error 日志
   */
  error(message: string, data?: any) {
    this.log('error', message, data)
  }

  /**
   * 输出 debug 日志
   */
  debug(message: string, data?: any) {
    this.log('debug', message, data)
  }

  /**
   * 内部日志方法
   */
  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) {
    if (!this.enabled) return

    const log: DebugLog = {
      level,
      module: this.module,
      message,
      data,
      timestamp: new Date().toISOString()
    }

    // 保存到缓冲区
    this.logBuffer.push(log)
    
    // 限制缓冲区大小
    if (this.logBuffer.length > 1000) {
      this.logBuffer.shift()
    }

    // 在控制台输出
    const prefix = `[${this.module}]`
    const time = `[${log.timestamp.split('T')[1].split('.')[0]}]`
    
    switch (level) {
      case 'info':
        console.log(`${time} ${prefix} [INFO] ${message}`, data || '')
        break
      case 'warn':
        console.warn(`${time} ${prefix} [WARN] ${message}`, data || '')
        break
      case 'error':
        console.error(`${time} ${prefix} [ERROR] ${message}`, data || '')
        break
      case 'debug':
        console.log(`${time} ${prefix} [DEBUG] ${message}`, data || '')
        break
    }

    // 如果在 Electron 环境中，同时发送到主进程
    if (typeof window !== 'undefined' && (window as any).electron) {
      try {
        // 通过 IPC 发送到主进程（可选）
        // (window as any).electron.sendLog?.(log)
      } catch (e) {
        // 忽略错误
      }
    }
  }

  /**
   * 获取日志缓冲区
   */
  getBuffer(): DebugLog[] {
    return [...this.logBuffer]
  }

  /**
   * 清空缓冲区
   */
  clearBuffer() {
    this.logBuffer = []
  }
}

/**
 * 创建调试日志实例
 * @param module 模块名称
 */
export function createLogger(module: string): DebugLogger {
  return new DebugLogger(module)
}

// 全局日志实例
export const globalLogger = createLogger('Global')
