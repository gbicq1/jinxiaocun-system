// Electron API 类型声明
declare global {
  interface Window {
    electron?: {
      dbQuery: (table: string, sql: string, params?: any[]) => Promise<any[]>
      dbInsert: (table: string, data: any) => Promise<number>
      dbUpdate: (table: string, data: any, where: string, params?: any[]) => Promise<void>
      dbDelete: (table: string, where: string, params?: any[]) => Promise<void>
      invoke: (channel: string, ...args: any[]) => Promise<any>
    }
  }
}

export {}
