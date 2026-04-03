"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseBackup = void 0;
const electron_1 = require("electron");
const path_1 = require("path");
const fs_1 = require("fs");
class DatabaseBackup {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.backupDir = (0, path_1.resolve)(electron_1.app.getPath('userData'), 'backups');
        // 确保备份目录存在
        if (!(0, fs_1.existsSync)(this.backupDir)) {
            (0, fs_1.mkdirSync)(this.backupDir, { recursive: true });
        }
    }
    /**
     * 自动备份数据库（启动时调用）
     */
    autoBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const backupFileName = `inventory_backup_${timestamp}.db`;
            const backupPath = (0, path_1.resolve)(this.backupDir, backupFileName);
            // 复制数据库文件
            (0, fs_1.copyFileSync)(this.dbPath, backupPath);
            console.log('数据库自动备份完成:', backupPath);
            return backupPath;
        }
        catch (error) {
            console.error('数据库自动备份失败:', error.message);
            return null;
        }
    }
    /**
     * 手动备份数据库（用户触发）
     */
    async manualBackup() {
        try {
            // 让用户选择保存位置
            const result = await electron_1.dialog.showSaveDialog({
                title: '选择数据库备份保存位置',
                defaultPath: `inventory_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.db`,
                filters: [
                    { name: 'SQLite Database', extensions: ['db'] }
                ]
            });
            if (result.canceled || !result.filePath) {
                return { success: false };
            }
            // 复制数据库文件到用户选择的位置
            (0, fs_1.copyFileSync)(this.dbPath, result.filePath);
            console.log('数据库手动备份完成:', result.filePath);
            return { success: true, path: result.filePath };
        }
        catch (error) {
            console.error('数据库手动备份失败:', error.message);
            return { success: false, error: error.message };
        }
    }
    /**
     * 恢复数据库
     */
    async restoreBackup() {
        try {
            // 让用户选择备份文件
            const result = await electron_1.dialog.showOpenDialog({
                title: '选择要恢复的数据库备份文件',
                filters: [
                    { name: 'SQLite Database', extensions: ['db'] }
                ],
                properties: ['openFile']
            });
            if (result.canceled || result.filePaths.length === 0) {
                return { success: false };
            }
            const backupPath = result.filePaths[0];
            // 验证备份文件是否存在
            if (!(0, fs_1.existsSync)(backupPath)) {
                return { success: false, error: '备份文件不存在' };
            }
            // 先备份当前数据库（以防万一）
            this.autoBackup();
            // 复制备份文件到数据库位置
            (0, fs_1.copyFileSync)(backupPath, this.dbPath);
            console.log('数据库恢复完成:', backupPath, '->', this.dbPath);
            return { success: true };
        }
        catch (error) {
            console.error('数据库恢复失败:', error.message);
            return { success: false, error: error.message };
        }
    }
    /**
     * 获取备份列表
     */
    getBackupList() {
        try {
            if (!(0, fs_1.existsSync)(this.backupDir)) {
                return [];
            }
            const files = (0, fs_1.readdirSync)(this.backupDir)
                .filter(file => file.startsWith('inventory_backup_') && file.endsWith('.db'))
                .map(filename => {
                const filePath = (0, path_1.resolve)(this.backupDir, filename);
                const stats = (0, fs_1.statSync)(filePath);
                return {
                    filename,
                    path: filePath,
                    size: stats.size,
                    date: stats.birthtime
                };
            })
                .sort((a, b) => b.date.getTime() - a.date.getTime());
            return files;
        }
        catch (error) {
            console.error('获取备份列表失败:', error.message);
            return [];
        }
    }
    /**
     * 删除旧备份（保留最近 N 个）
     */
    cleanupOldBackups(keepCount = 10) {
        try {
            const backups = this.getBackupList();
            if (backups.length > keepCount) {
                const toDelete = backups.slice(keepCount);
                toDelete.forEach(backup => {
                    try {
                        (0, fs_1.unlinkSync)(backup.path);
                        console.log('删除旧备份:', backup.filename);
                    }
                    catch (error) {
                        console.error('删除备份失败:', backup.filename, error.message);
                    }
                });
            }
        }
        catch (error) {
            console.error('清理旧备份失败:', error.message);
        }
    }
    /**
     * 导出数据库到指定位置（用于迁移到其他电脑）
     */
    async exportDatabase() {
        try {
            const result = await electron_1.dialog.showSaveDialog({
                title: '选择数据库导出位置',
                defaultPath: `进销存数据库_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.db`,
                filters: [
                    { name: 'SQLite Database', extensions: ['db'] }
                ]
            });
            if (result.canceled || !result.filePath) {
                return { success: false };
            }
            (0, fs_1.copyFileSync)(this.dbPath, result.filePath);
            console.log('数据库导出完成:', result.filePath);
            return { success: true, path: result.filePath };
        }
        catch (error) {
            console.error('数据库导出失败:', error.message);
            return { success: false, error: error.message };
        }
    }
    /**
     * 获取数据库信息
     */
    getDatabaseInfo() {
        const exists = (0, fs_1.existsSync)(this.dbPath);
        let size = 0;
        if (exists) {
            size = (0, fs_1.statSync)(this.dbPath).size;
        }
        return {
            path: this.dbPath,
            size,
            exists
        };
    }
}
exports.DatabaseBackup = DatabaseBackup;
