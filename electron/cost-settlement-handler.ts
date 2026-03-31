import { ipcMain, BrowserWindow } from 'electron'
import { CostSettlementDatabase } from './database-cost'
import { MonthlyCostSettlementService } from './cost-settlement-service'

/**
 * 成本结算 IPC 处理器
 * 处理前端发送的成本结算相关请求
 */
export class CostSettlementHandler {
  private costDb: CostSettlementDatabase
  private settlementService: MonthlyCostSettlementService
  private mainWindow: BrowserWindow

  constructor(db: CostSettlementDatabase, mainWindow: BrowserWindow) {
    this.costDb = db
    this.settlementService = new MonthlyCostSettlementService(db)
    this.mainWindow = mainWindow
  }

  /**
   * 注册 IPC 处理器
   */
  registerHandlers() {
    // 结算指定月份
    ipcMain.handle('cost:settle-month', async (event, { year, month, lock }) => {
      return this.settlementService.settleMonth(year, month, lock !== false)
    })

    // 重新结算从指定月份到现在
    ipcMain.handle('cost:recalculate-from', async (event, { year, month }) => {
      return this.settlementService.recalculateFromMonth(year, month)
    })

    // 获取指定期间的结算数据
    ipcMain.handle('cost:get-settlement', async (event, { productCode, warehouseId, year, month }) => {
      return this.costDb.getSettlement(productCode, warehouseId, year, month)
    })

    // 获取已锁定的结算数据
    ipcMain.handle('cost:get-locked-settlement', async (event, { productCode, warehouseId, year, month }) => {
      return this.costDb.getLockedSettlement(productCode, warehouseId, year, month)
    })

    // 检查是否已结算
    ipcMain.handle('cost:is-settled', async (event, { year, month }) => {
      return this.costDb.isSettled(year, month)
    })

    // 获取已结算期间列表
    ipcMain.handle('cost:get-settled-periods', async () => {
      return this.costDb.getSettledPeriods()
    })

    // 获取最新已结算期间
    ipcMain.handle('cost:get-latest-settled-period', async () => {
      return this.costDb.getLatestSettledPeriod()
    })

    // 解锁指定月份（用于反结算）
    ipcMain.handle('cost:unlock-month', async (event, { year, month }) => {
      return this.costDb.unlockSettlement(year, month)
    })

    // 检测单据日期并触发重算
    ipcMain.handle('cost:check-bill-date-and-recalculate', async (event, { billDate }) => {
      return this.checkBillDateAndRecalculate(billDate)
    })

    // 自动补全历史月份
    ipcMain.handle('cost:auto-complete-history', async () => {
      return this.settlementService.autoCompleteHistory()
    })

    // 检测产品仓库的单据日期并触发重算
    ipcMain.handle('cost:check-and-recalculate', async (event, { productCode, warehouseId, documentDate }) => {
      return this.settlementService.checkAndRecalculateIfNeeded(productCode, warehouseId, documentDate)
    })
  }

  /**
   * 检测单据日期，如果早于当前月份则触发重算
   */
  private checkBillDateAndRecalculate(billDate: string): { needRecalculate: boolean; year?: number; month?: number; message: string } {
    try {
      const bill = new Date(billDate)
      const billYear = bill.getFullYear()
      const billMonth = bill.getMonth() + 1

      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      // 如果单据日期在当前月份之前
      if (billYear < currentYear || (billYear === currentYear && billMonth < currentMonth)) {
        console.log(`检测到历史单据：${billDate}，需要重新结算`)
        
        // 返回需要重算的起始月份
        return {
          needRecalculate: true,
          year: billYear,
          month: billMonth,
          message: `单据日期 ${billDate} 早于当前月份，将重新结算从 ${billYear}年${billMonth}月 开始的成本数据`
        }
      }

      return {
        needRecalculate: false,
        message: '单据日期在当前月份，无需重新结算'
      }
    } catch (error) {
      console.error('检测单据日期失败:', error)
      return {
        needRecalculate: false,
        message: `检测失败：${error}`
      }
    }
  }

  /**
   * 触发重新结算（供外部调用）
   */
  triggerRecalculate(year: number, month: number) {
    console.log(`触发重新结算：${year}年${month}月`)
    
    // 异步执行，不阻塞主线程
    setTimeout(() => {
      this.settlementService.recalculateFromMonth(year, month)
        .then(result => {
          console.log('重新结算结果:', result)
          // 通知前端更新
          this.mainWindow.webContents.send('cost:recalculate-complete', result)
        })
        .catch(error => {
          console.error('重新结算失败:', error)
          this.mainWindow.webContents.send('cost:recalculate-error', error)
        })
    }, 100)
  }
}
