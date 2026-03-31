/**
 * 成本结算进度监听工具（优化功能 3：进度提示）
 * 用于在前端显示成本结算的进度
 */

interface ProgressCallback {
  (type: 'start' | 'complete' | 'error', data: any): void
}

/**
 * 监听成本结算进度事件
 * @param callback 进度回调函数
 * @returns 取消监听函数
 */
export const listenToProgress = (callback: ProgressCallback): (() => void) => {
  // 监听开始事件
  window.electron?.ipcRenderer?.on?.('cost:progress-start', (event: any, data: any) => {
    console.log('📊 成本结算进度:', data)
    callback('start', data)
  })

  // 监听完成事件
  window.electron?.ipcRenderer?.on?.('cost:progress-complete', (event: any, data: any) => {
    console.log('✅ 成本结算完成:', data)
    callback('complete', data)
  })

  // 返回取消监听函数
  return () => {
    window.electron?.ipcRenderer?.removeAllListeners?.('cost:progress-start')
    window.electron?.ipcRenderer?.removeAllListeners?.('cost:progress-complete')
  }
}

/**
 * 显示进度提示（使用 Element Plus）
 */
export const showProgressMessage = async () => {
  // 动态导入 ElMessage 和 ElNotification
  const { ElMessage, ElNotification } = await import('element-plus')

  let progressMessage: any = null

  const callback = (type: 'start' | 'complete' | 'error', data: any) => {
    if (type === 'start') {
      // 显示进度消息
      progressMessage = ElMessage({
        message: `${data.year}年${data.month}月 ${data.message}`,
        type: 'info',
        duration: 0, // 不自动关闭
        showClose: false
      })
    } else if (type === 'complete') {
      // 关闭进度消息
      if (progressMessage) {
        progressMessage.close()
      }

      // 显示完成通知
      ElNotification({
        title: data.result.success ? '结算完成' : '结算失败',
        message: `${data.year}年${data.month}月：${data.message}`,
        type: data.result.success ? 'success' : 'error',
        duration: 3000
      })
    }
  }

  // 开始监听
  const unsubscribe = listenToProgress(callback)

  // 返回取消监听函数（组件卸载时调用）
  return unsubscribe
}

/**
 * 显示进度条（使用 ElProgress）
 */
export const showProgressBar = async (totalMonths: number) => {
  const { ElProgress, ElMessage } = await import('element-plus')

  let currentMonth = 0
  const progressContainer = document.createElement('div')
  progressContainer.style.position = 'fixed'
  progressContainer.style.top = '20px'
  progressContainer.style.right = '20px'
  progressContainer.style.width = '300px'
  progressContainer.style.zIndex = '9999'
  document.body.appendChild(progressContainer)

  const progress = ElProgress({
    percentage: 0,
    textInside: true,
    color: '#409EFF',
    format: (percentage: number) => `${percentage}% (${currentMonth}/${totalMonths})`
  })

  // 将进度条渲染到容器中
  progressContainer.innerHTML = ''
  progressContainer.appendChild(progress.$el)

  const callback = (type: 'start' | 'complete' | 'error', data: any) => {
    if (type === 'start') {
      currentMonth++
      const percentage = Math.round((currentMonth / totalMonths) * 100)
      progress.percentage = percentage
    } else if (type === 'complete') {
      // 延迟关闭进度条
      setTimeout(() => {
        progress.$destroy()
        progressContainer.remove()
      }, 1000)
    }
  }

  // 开始监听
  const unsubscribe = listenToProgress(callback)

  // 返回取消监听函数
  return unsubscribe
}
