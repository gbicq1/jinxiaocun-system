import { app, dialog } from 'electron'
import { resolve, dirname } from 'path'
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, unlinkSync, statSync, createReadStream, createWriteStream } from 'fs'
import { createReadStream as createReadStreamOrig } from 'original-fs'
import { createHash } from 'crypto'

export class DatabaseBackup {
  private dbPath: string
  private backupDir: string
  private configDir: string
  private configPath: string

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.backupDir = resolve(app.getPath('userData'), 'backups')
    this.configDir = resolve(app.getPath('userData'), 'config')
    this.configPath = resolve(this.configDir, 'backup-config.json')
    
    // 确保备份目录和配置目录存在
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true })
    }
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true })
    }
  }

  /**
   * 自动备份数据库（启动时调用）
   */
  autoBackup(): string | null {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const backupFileName = `inventory_backup_${timestamp}.db`
      const backupPath = resolve(this.backupDir, backupFileName)

      // 复制数据库文件
      copyFileSync(this.dbPath, backupPath)
      
      console.log('数据库自动备份完成:', backupPath)
      return backupPath
    } catch (error: any) {
      console.error('数据库自动备份失败:', error.message)
      return null
    }
  }

  /**
   * 手动备份数据库（用户触发）
   */
  async manualBackup(): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      // 让用户选择保存位置
      const result = await dialog.showSaveDialog({
        title: '选择数据库备份保存位置',
        defaultPath: `inventory_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.db`,
        filters: [
          { name: 'SQLite Database', extensions: ['db'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return { success: false }
      }

      // 复制数据库文件到用户选择的位置
      copyFileSync(this.dbPath, result.filePath)
      
      console.log('数据库手动备份完成:', result.filePath)
      return { success: true, path: result.filePath }
    } catch (error: any) {
      console.error('数据库手动备份失败:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * 恢复数据库
   */
  async restoreBackup(): Promise<{ success: boolean; error?: string }> {
    try {
      // 让用户选择备份文件
      const result = await dialog.showOpenDialog({
        title: '选择要恢复的数据库备份文件',
        filters: [
          { name: 'SQLite Database', extensions: ['db'] }
        ],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false }
      }

      const backupPath = result.filePaths[0]
      
      // 验证备份文件是否存在
      if (!existsSync(backupPath)) {
        return { success: false, error: '备份文件不存在' }
      }

      // 先备份当前数据库（以防万一）
      this.autoBackup()

      // 复制备份文件到数据库位置
      copyFileSync(backupPath, this.dbPath)
      
      console.log('数据库恢复完成:', backupPath, '->', this.dbPath)
      return { success: true }
    } catch (error: any) {
      console.error('数据库恢复失败:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * 获取备份列表
   */
  getBackupList(): Array<{ filename: string; path: string; size: number; date: Date }> {
    try {
      if (!existsSync(this.backupDir)) {
        return []
      }

      const files = readdirSync(this.backupDir)
        .filter(file => file.startsWith('inventory_backup_') && file.endsWith('.db'))
        .map(filename => {
          const filePath = resolve(this.backupDir, filename)
          const stats = statSync(filePath)
          return {
            filename,
            path: filePath,
            size: stats.size,
            date: stats.birthtime
          }
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime())

      return files
    } catch (error: any) {
      console.error('获取备份列表失败:', error.message)
      return []
    }
  }

  /**
   * 删除旧备份（保留最近 N 个）
   */
  cleanupOldBackups(keepCount: number = 10): void {
    try {
      const backups = this.getBackupList()
      
      if (backups.length > keepCount) {
        const toDelete = backups.slice(keepCount)
        toDelete.forEach(backup => {
          try {
            unlinkSync(backup.path)
            console.log('删除旧备份:', backup.filename)
          } catch (error: any) {
            console.error('删除备份失败:', backup.filename, error.message)
          }
        })
      }
    } catch (error: any) {
      console.error('清理旧备份失败:', error.message)
    }
  }

  /**
   * 导出数据库到指定位置（用于迁移到其他电脑）
   */
  async exportDatabase(): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const result = await dialog.showSaveDialog({
        title: '选择数据库导出位置',
        defaultPath: `进销存数据库_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.db`,
        filters: [
          { name: 'SQLite Database', extensions: ['db'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return { success: false }
      }

      copyFileSync(this.dbPath, result.filePath)
      
      console.log('数据库导出完成:', result.filePath)
      return { success: true, path: result.filePath }
    } catch (error: any) {
      console.error('数据库导出失败:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * 获取数据库信息
   */
  getDatabaseInfo(): { path: string; size: number; exists: boolean } {
    const exists = existsSync(this.dbPath)
    let size = 0
    
    if (exists) {
      size = statSync(this.dbPath).size
    }

    return {
      path: this.dbPath,
      size,
      exists
    }
  }

  /**
   * 验证备份文件完整性
   */
  verifyBackup(backupPath: string): { valid: boolean; error?: string } {
    try {
      if (!existsSync(backupPath)) {
        return { valid: false, error: '备份文件不存在' }
      }

      const stats = statSync(backupPath)
      if (stats.size === 0) {
        return { valid: false, error: '备份文件为空' }
      }

      // 简单的 SQLite 文件验证（检查文件头）
      const buffer = Buffer.alloc(16)
      const fd = require('fs').openSync(backupPath, 'r')
      require('fs').readSync(fd, buffer, 0, 16, 0)
      require('fs').closeSync(fd)

      const header = buffer.toString('utf8', 0, 15)
      if (!header.includes('SQLite format 3')) {
        return { valid: false, error: '无效的 SQLite 数据库文件' }
      }

      return { valid: true }
    } catch (error: any) {
      return { valid: false, error: `验证失败：${error.message}` }
    }
  }

  /**
   * 从指定备份文件恢复
   */
  async restoreFromBackup(backupPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 验证备份文件
      const verifyResult = this.verifyBackup(backupPath)
      if (!verifyResult.valid) {
        return { success: false, error: verifyResult.error }
      }

      // 先备份当前数据库（以防万一）
      this.autoBackup()

      // 复制备份文件到数据库位置
      copyFileSync(backupPath, this.dbPath)
      
      console.log('数据库恢复完成:', backupPath, '->', this.dbPath)
      return { success: true }
    } catch (error: any) {
      console.error('数据库恢复失败:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * 删除指定备份
   */
  deleteBackup(filename: string): { success: boolean; error?: string } {
    try {
      const backupPath = resolve(this.backupDir, filename)
      
      if (!existsSync(backupPath)) {
        return { success: false, error: '备份文件不存在' }
      }

      unlinkSync(backupPath)
      console.log('删除备份:', filename)
      return { success: true }
    } catch (error: any) {
      console.error('删除备份失败:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * 获取备份配置
   */
  getBackupConfig(): { autoBackupEnabled: boolean; autoBackupInterval: number; keepCount: number } {
    try {
      if (existsSync(this.configPath)) {
        const config = JSON.parse(require('fs').readFileSync(this.configPath, 'utf-8'))
        return {
          autoBackupEnabled: config.autoBackupEnabled !== false,
          autoBackupInterval: config.autoBackupInterval || 1,
          keepCount: config.keepCount || 10
        }
      }
    } catch (error: any) {
      console.error('读取备份配置失败:', error.message)
    }

    // 默认配置
    return {
      autoBackupEnabled: true,
      autoBackupInterval: 1, // 1 天
      keepCount: 10
    }
  }

  /**
   * 保存备份配置
   */
  saveBackupConfig(config: { autoBackupEnabled: boolean; autoBackupInterval: number; keepCount: number }): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
      console.log('备份配置已保存:', config)
    } catch (error: any) {
      console.error('保存备份配置失败:', error.message)
    }
  }

  /**
   * 压缩备份（用于导出）
   */
  async exportCompressedBackup(): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const exportPath = resolve(app.getPath('downloads'), `进销存备份_${timestamp}.db`)

      // 让用户选择保存位置
      const result = await dialog.showSaveDialog({
        title: '选择数据库导出位置',
        defaultPath: exportPath,
        filters: [
          { name: 'SQLite Database', extensions: ['db'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return { success: false }
      }

      copyFileSync(this.dbPath, result.filePath)
      
      console.log('数据库导出完成:', result.filePath)
      return { success: true, path: result.filePath }
    } catch (error: any) {
      console.error('数据库导出失败:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * 获取备份统计信息
   */
  getBackupStats(): { totalBackups: number; totalSize: number; oldestBackup: Date | null; newestBackup: Date | null } {
    try {
      const backups = this.getBackupList()
      
      if (backups.length === 0) {
        return {
          totalBackups: 0,
          totalSize: 0,
          oldestBackup: null,
          newestBackup: null
        }
      }

      const totalSize = backups.reduce((sum, b) => sum + b.size, 0)
      const oldestBackup = backups[backups.length - 1].date
      const newestBackup = backups[0].date

      return {
        totalBackups: backups.length,
        totalSize,
        oldestBackup,
        newestBackup
      }
    } catch (error: any) {
      console.error('获取备份统计失败:', error.message)
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null
      }
    }
  }
}
