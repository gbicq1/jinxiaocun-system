import { BrowserWindow } from 'electron'
import { CostSettlementDatabase } from './database-cost'
import { MonthlyCostSettlementService } from './cost-settlement-service'

/**
 * 定时任务服务
 * 负责每月自动执行成本结转
 */
export class ScheduledTaskService {
  private costDb: CostSettlementDatabase
  private settlementService: MonthlyCostSettlementService
  private mainWindow: BrowserWindow
  private timers: NodeJS.Timeout[] = []

  constructor(db: CostSettlementDatabase, mainWindow: BrowserWindow) {
    this.costDb = db
    this.settlementService = new MonthlyCostSettlementService(db)
    this.mainWindow = mainWindow
  }

  /**
   * 启动定时任务
   */
  start() {
    console.log('启动定时任务服务...')

    // 每天凌晨 2 点检查是否需要结算上月
    const dailyCheckTimer = setInterval(() => {
      this.checkAndSettlePreviousMonth()
    }, 24 * 60 * 60 * 1000) // 24 小时

    this.timers.push(dailyCheckTimer)

    // 启动时立即检查一次
    setTimeout(() => {
      this.checkAndSettlePreviousMonth()
    }, 5000) // 5 秒后

    console.log('定时任务已启动：每天凌晨 2 点检查成本结算')
  }

  /**
   * 停止定时任务
   */
  stop() {
    this.timers.forEach(timer => clearInterval(timer))
    this.timers = []
    console.log('定时任务已停止')
  }

  /**
   * 检查并结算上月成本
   */
  private async checkAndSettlePreviousMonth() {
    try {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      // 计算上月
      let prevYear = currentYear
      let prevMonth = currentMonth - 1
      if (prevMonth === 0) {
        prevYear = currentYear - 1
        prevMonth = 12
      }

      console.log(`检查 ${prevYear}年${prevMonth}月 是否已结算...`)

      // 检查是否已结算
      if (this.costDb.isSettled(prevYear, prevMonth)) {
        console.log(`${prevYear}年${prevMonth}月 已结算，跳过`)
        return
      }

      console.log(`${prevYear}年${prevMonth}月 未结算，开始自动结算...`)

      // 执行结算
      const result = this.settlementService.settleMonth(prevYear, prevMonth, true)

      if (result.success) {
        console.log(`自动结算完成：${prevYear}年${prevMonth}月，共 ${result.count} 条记录`)

        // 通知前端
        this.mainWindow.webContents.send('cost:auto-settle-complete', {
          year: prevYear,
          month: prevMonth,
          count: result.count,
          success: true
        })

        // 显示系统通知
        this.showNotification('成本结算完成', `${prevYear}年${prevMonth}月 的成本数据已自动结算，共 ${result.count} 条记录`)
      } else {
        console.error(`自动结算失败：${prevYear}年${prevMonth}月`, result.error)

        // 通知前端
        this.mainWindow.webContents.send('cost:auto-settle-error', {
          year: prevYear,
          month: prevMonth,
          error: result.error
        })
      }
    } catch (error) {
      console.error('检查成本结算失败:', error)
    }
  }

  /**
   * 显示系统通知
   */
  private showNotification(title: string, body: string) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('system:notification', { title, body })
    }
  }

  /**
   * 手动触发结算指定月份
   */
  manualSettleMonth(year: number, month: number) {
    console.log(`手动结算：${year}年${month}月`)

    const result = this.settlementService.settleMonth(year, month, true)

    if (result.success) {
      console.log(`手动结算完成：${year}年${month}月，共 ${result.count} 条记录`)

      this.mainWindow.webContents.send('cost:manual-settle-complete', {
        year,
        month,
        count: result.count,
        success: true
      })
    } else {
      console.error(`手动结算失败：${year}年${month}月`, result.error)

      this.mainWindow.webContents.send('cost:manual-settle-error', {
        year,
        month,
        error: result.error
      })
    }

    return result
  }
}
