"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduledTaskService = void 0;
const cost_settlement_service_1 = require("./cost-settlement-service");
/**
 * 定时任务服务
 * 负责每月自动执行成本结转
 */
class ScheduledTaskService {
    constructor(db, mainWindow) {
        this.timers = [];
        this.costDb = db;
        this.settlementService = new cost_settlement_service_1.MonthlyCostSettlementService(db);
        this.mainWindow = mainWindow;
    }
    /**
     * 启动定时任务
     */
    start() {
        console.log('启动定时任务服务...');
        // 系统启动时立即补全历史月份（延迟 10 秒执行）
        setTimeout(() => {
            this.autoCompleteHistory();
        }, 10000); // 10 秒后
        // 每天凌晨 2 点检查是否需要结算上月
        const dailyCheckTimer = setInterval(() => {
            this.checkAndSettlePreviousMonth();
        }, 24 * 60 * 60 * 1000); // 24 小时
        this.timers.push(dailyCheckTimer);
        // 启动时立即检查一次（延迟 5 秒）
        setTimeout(() => {
            this.checkAndSettlePreviousMonth();
        }, 5000); // 5 秒后
        console.log('定时任务已启动：每天凌晨 2 点检查成本结算');
    }
    /**
     * 停止定时任务
     */
    stop() {
        this.timers.forEach(timer => clearInterval(timer));
        this.timers = [];
        console.log('定时任务已停止');
    }
    /**
     * 检查并结算上月成本
     */
    async checkAndSettlePreviousMonth() {
        try {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            // 计算上月
            let prevYear = currentYear;
            let prevMonth = currentMonth - 1;
            if (prevMonth === 0) {
                prevYear = currentYear - 1;
                prevMonth = 12;
            }
            console.log(`检查 ${prevYear}年${prevMonth}月 是否已结算...`);
            // 检查是否已结算
            if (this.costDb.isSettled(prevYear, prevMonth)) {
                console.log(`${prevYear}年${prevMonth}月 已结算，跳过`);
                return;
            }
            console.log(`${prevYear}年${prevMonth}月 未结算，开始自动结算...`);
            // 执行结算
            const result = this.settlementService.settleMonth(prevYear, prevMonth, true);
            if (result.success) {
                console.log(`自动结算完成：${prevYear}年${prevMonth}月，共 ${result.count} 条记录`);
                // 通知前端
                this.mainWindow.webContents.send('cost:auto-settle-complete', {
                    year: prevYear,
                    month: prevMonth,
                    count: result.count,
                    success: true
                });
                // 显示系统通知
                this.showNotification('成本结算完成', `${prevYear}年${prevMonth}月 的成本数据已自动结算，共 ${result.count} 条记录`);
            }
            else {
                console.error(`自动结算失败：${prevYear}年${prevMonth}月`, result.error);
                // 通知前端
                this.mainWindow.webContents.send('cost:auto-settle-error', {
                    year: prevYear,
                    month: prevMonth,
                    error: result.error
                });
            }
        }
        catch (error) {
            console.error('检查成本结算失败:', error);
        }
    }
    /**
     * 显示系统通知
     */
    showNotification(title, body) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('system:notification', { title, body });
        }
    }
    /**
     * 自动补全历史月份结算数据
     */
    async autoCompleteHistory() {
        try {
            console.log('开始自动补全历史月份结算数据...');
            const result = this.settlementService.autoCompleteHistory();
            if (result.success && result.settledMonths > 0) {
                console.log(`历史月份补全完成：${result.message}`);
                // 通知前端
                this.mainWindow.webContents.send('cost:auto-complete-history', {
                    success: true,
                    message: result.message,
                    settledMonths: result.settledMonths
                });
                // 显示系统通知
                this.showNotification('历史成本结算完成', result.message);
            }
            else if (result.success) {
                console.log('历史月份补全：没有需要结算的月份');
            }
            else {
                console.error('历史月份补全失败:', result.message);
                this.mainWindow.webContents.send('cost:auto-complete-history', {
                    success: false,
                    message: result.message
                });
            }
        }
        catch (error) {
            console.error('自动补全历史月份失败:', error);
        }
    }
    /**
     * 手动触发结算指定月份
     */
    manualSettleMonth(year, month) {
        console.log(`手动结算：${year}年${month}月`);
        const result = this.settlementService.settleMonth(year, month, true);
        if (result.success) {
            console.log(`手动结算完成：${year}年${month}月，共 ${result.count} 条记录`);
            this.mainWindow.webContents.send('cost:manual-settle-complete', {
                year,
                month,
                count: result.count,
                success: true
            });
        }
        else {
            console.error(`手动结算失败：${year}年${month}月`, result.error);
            this.mainWindow.webContents.send('cost:manual-settle-error', {
                year,
                month,
                error: result.error
            });
        }
        return result;
    }
}
exports.ScheduledTaskService = ScheduledTaskService;
