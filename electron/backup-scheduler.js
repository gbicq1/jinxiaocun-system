"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupScheduler = void 0;
class BackupScheduler {
    constructor(backup) {
        this.timer = null;
        this.intervalMs = 24 * 60 * 60 * 1000; // 默认 24 小时
        this.backup = backup;
    }
    /**
     * 启动定时备份
     */
    start(immediate = false) {
        this.stop(); // 先停止之前的定时器
        const config = this.backup.getBackupConfig();
        if (!config.autoBackupEnabled) {
            console.log('自动备份已禁用');
            return;
        }
        // 根据配置计算间隔（单位：天）
        this.intervalMs = config.autoBackupInterval * 24 * 60 * 60 * 1000;
        console.log(`启动定时备份，间隔：${config.autoBackupInterval}天`);
        // 只在首次启动时立即执行一次备份
        if (immediate) {
            this.performBackup();
        }
        // 设置定时器
        this.timer = setInterval(() => {
            this.performBackup();
        }, this.intervalMs);
    }
    /**
     * 停止定时备份
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('定时备份已停止');
        }
    }
    /**
     * 执行备份
     */
    performBackup() {
        console.log('执行定时备份...');
        const backupPath = this.backup.autoBackup();
        if (backupPath) {
            console.log('定时备份完成:', backupPath);
            // 清理旧备份
            const config = this.backup.getBackupConfig();
            this.backup.cleanupOldBackups(config.keepCount);
        }
        else {
            console.error('定时备份失败');
        }
    }
    /**
     * 重新加载配置并重启定时器（只在配置改变时）
     */
    reloadConfig() {
        console.log('重新加载备份配置');
        const config = this.backup.getBackupConfig();
        const newIntervalMs = config.autoBackupInterval * 24 * 60 * 60 * 1000;
        // 只有当配置真正改变时才重启
        if (newIntervalMs !== this.intervalMs || !this.timer) {
            console.log('配置已改变，重启定时备份');
            this.start(false); // 不立即执行备份
        }
        else {
            console.log('配置未改变，保持现有定时备份');
        }
    }
}
exports.BackupScheduler = BackupScheduler;
