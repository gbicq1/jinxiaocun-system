// Electron API 类型声明
declare global {
  interface Window {
    electron?: {
      dbQuery: (table: string, sql: string, params?: any[]) => Promise<any[]>
      dbInsert: (table: string, data: any) => Promise<number>
      dbUpdate: (table: string, data: any, where: string, params?: any[]) => Promise<void>
      dbDelete: (table: string, where: string, params?: any[]) => Promise<void>
      invoke: (channel: string, ...args: any[]) => Promise<any>
      // 数据库备份管理
      dbBackupManual: () => Promise<{ success: boolean; path?: string; error?: string }>
      dbBackupRestore: () => Promise<{ success: boolean; error?: string }>
      dbBackupList: () => Promise<Array<{ filename: string; path: string; size: number; date: Date }>>
      dbBackupExport: () => Promise<{ success: boolean; path?: string; error?: string }>
      dbBackupInfo: () => Promise<{ path: string; size: number; exists: boolean }>
      dbBackupRestoreFrom: (backupPath: string) => Promise<{ success: boolean; error?: string }>
      dbBackupRestoreFromPath: (backupPath: string) => Promise<{ success: boolean; error?: string }>
      dbBackupDelete: (filename: string) => Promise<{ success: boolean; error?: string }>
      dbBackupConfig: () => Promise<{ autoBackupEnabled: boolean; autoBackupInterval: number; keepCount: number }>
      dbBackupSaveConfig: (config: { autoBackupEnabled: boolean; autoBackupInterval: number; keepCount: number }) => Promise<{ success: boolean }>
      dbBackupStats: () => Promise<{ totalBackups: number; totalSize: number; oldestBackup: Date | null; newestBackup: Date | null }>
      // 回收站
      recycleBinList: () => Promise<any[]>
      recycleBinSave: (items: any[]) => Promise<void>
      recycleBinAdd: (type: string, data: any) => Promise<void>
      recycleBinRestore: (itemId: number) => Promise<any>
      recycleBinRemove: (itemId: number) => Promise<void>
    }
  }
}

export {}
