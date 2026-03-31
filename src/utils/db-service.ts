/**
 * 数据库服务 - 用于前端访问 Electron 数据库
 * 通过 IPC 与主进程通信
 */

export interface DBResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

export interface PageResult<T = any> {
  total: number
  page: number
  pageSize: number
  data: T[]
}

class DatabaseService {
  private isElectron: boolean

  constructor() {
    this.isElectron = !!(window as any).electron
  }

  /**
   * 检查是否在 Electron 环境中
   */
  checkElectron(): boolean {
    return this.isElectron
  }

  /**
   * 执行查询
   */
  async query<T = any>(sql: string, params?: any[]): Promise<DBResult<T[]>> {
    if (!this.isElectron) {
      return { success: false, error: '请在 Electron 环境中使用数据库功能' }
    }

    try {
      const result = await (window as any).electron.dbQuery(sql, params || [])
      return { success: true, data: result }
    } catch (error: any) {
      console.error('数据库查询失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 插入数据
   */
  async insert<T = any>(table: string, data: any): Promise<DBResult<T>> {
    if (!this.isElectron) {
      return { success: false, error: '请在 Electron 环境中使用数据库功能' }
    }

    try {
      const id = await (window as any).electron.dbInsert(table, data)
      return { success: true, data: { id } as T }
    } catch (error: any) {
      console.error('数据库插入失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 更新数据
   */
  async update(table: string, data: any, where: string, whereParams?: any[]): Promise<DBResult> {
    if (!this.isElectron) {
      return { success: false, error: '请在 Electron 环境中使用数据库功能' }
    }

    try {
      const changes = await (window as any).electron.dbUpdate(table, data, where, whereParams || [])
      return { success: true, data: { changes } }
    } catch (error: any) {
      console.error('数据库更新失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 删除数据
   */
  async delete(table: string, where: string, whereParams?: any[]): Promise<DBResult> {
    if (!this.isElectron) {
      return { success: false, error: '请在 Electron 环境中使用数据库功能' }
    }

    try {
      const changes = await (window as any).electron.dbDelete(table, where, whereParams || [])
      return { success: true, data: { changes } }
    } catch (error: any) {
      console.error('数据库删除失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 获取单个记录
   */
  async getOne<T = any>(table: string, where: string, params?: any[]): Promise<DBResult<T>> {
    const sql = `SELECT * FROM ${table} WHERE ${where} LIMIT 1`
    const result = await this.query<T>(sql, params)
    
    if (!result.success) {
      return result
    }

    if (!result.data || result.data.length === 0) {
      return { success: false, error: '未找到记录' }
    }

    return { success: true, data: result.data[0] }
  }

  /**
   * 获取所有记录
   */
  async getAll<T = any>(table: string, where?: string, params?: any[], orderBy?: string): Promise<DBResult<T[]>> {
    let sql = `SELECT * FROM ${table}`
    if (where) {
      sql += ` WHERE ${where}`
    }
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`
    }

    return await this.query<T>(sql, params)
  }

  /**
   * 分页查询
   */
  async getPage<T = any>(
    table: string,
    page: number = 1,
    pageSize: number = 10,
    where?: string,
    params?: any[],
    orderBy?: string
  ): Promise<DBResult<PageResult<T>>> {
    try {
      // 查询总数
      let countSql = `SELECT COUNT(*) as count FROM ${table}`
      if (where) {
        countSql += ` WHERE ${where}`
      }
      const countResult = await this.query<{ count: number }>(countSql, params)
      
      if (!countResult.success || !countResult.data) {
        return { success: false, error: countResult.error }
      }

      const total = countResult.data[0]?.count || 0

      // 查询数据
      let dataSql = `SELECT * FROM ${table}`
      if (where) {
        dataSql += ` WHERE ${where}`
      }
      if (orderBy) {
        dataSql += ` ORDER BY ${orderBy}`
      }
      dataSql += ` LIMIT ? OFFSET ?`

      const dataParams = [...(params || []), pageSize, (page - 1) * pageSize]
      const dataResult = await this.query<T>(dataSql, dataParams)

      if (!dataResult.success || !dataResult.data) {
        return { success: false, error: dataResult.error }
      }

      return {
        success: true,
        data: {
          total,
          page,
          pageSize,
          data: dataResult.data
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * 执行事务
   */
  async transaction(operations: Array<() => Promise<void>>): Promise<DBResult> {
    if (!this.isElectron) {
      return { success: false, error: '请在 Electron 环境中使用数据库功能' }
    }

    try {
      await (window as any).electron.dbTransaction(operations)
      return { success: true }
    } catch (error: any) {
      console.error('事务执行失败:', error)
      return { success: false, error: error.message }
    }
  }
}

// 导出单例
export const dbService = new DatabaseService()
