// 清除 localStorage 中的所有数据
// 在浏览器控制台中执行此脚本

console.log('开始清除 localStorage 数据...')

// 保存当前需要保留的键（如果有）
const keysToKeep = []

// 获取所有键
const allKeys = Object.keys(localStorage)
console.log('localStorage 中的所有键:', allKeys)

// 删除所有键（除了需要保留的）
allKeys.forEach(key => {
  if (!keysToKeep.includes(key)) {
    localStorage.removeItem(key)
    console.log(`已删除：${key}`)
  }
})

console.log('localStorage 数据清除完成！')
console.log('剩余的键:', Object.keys(localStorage))
