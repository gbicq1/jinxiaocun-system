# 清除 localStorage 数据说明

## 方法一：在浏览器控制台执行（推荐）

1. 打开浏览器访问系统：http://localhost:5173/
2. 按 **F12** 打开开发者工具
3. 切换到 **Console** 标签页
4. 复制并粘贴以下代码，然后按回车：

```javascript
// 清除所有 localStorage 数据
console.log('开始清除 localStorage 数据...')
const allKeys = Object.keys(localStorage)
console.log('删除前的键:', allKeys)
allKeys.forEach(key => {
  localStorage.removeItem(key)
  console.log(`已删除：${key}`)
})
console.log('✅ localStorage 数据清除完成！')
console.log('剩余的键:', Object.keys(localStorage))
```

5. 刷新页面（Ctrl+R 或 F5）

## 方法二：使用浏览器开发者工具

1. 打开浏览器访问系统：http://localhost:5173/
2. 按 **F12** 打开开发者工具
3. 切换到 **Application** 标签页（Chrome）或 **Storage** 标签页（Firefox）
4. 在左侧菜单中展开 **Local Storage**
5. 点击 `http://localhost:5173`
6. 右键点击右侧数据列表，选择 **Clear** 或 **Delete All**
7. 刷新页面

## 方法三：使用隐私模式

1. 关闭所有浏览器窗口
2. 打开浏览器的隐私模式/无痕模式
3. 访问系统：http://localhost:5173/
4. 这样就是一个全新的 localStorage，没有任何历史数据

## 验证清除效果

清除后，刷新页面并检查控制台日志，应该看到：
- ✅ 没有"数据库迁移已完成，跳过迁移"的提示
- ✅ 没有"开始数据迁移"的提示
- ✅ 数据库已存在，跳过表创建

## 已删除的文件

以下迁移脚本文件已删除：
- ❌ `src/utils/migrate-localstorage.ts`
- ❌ `src/utils/database-migration.js`
- ❌ `src/utils/database-init.js`

现在系统完全依赖数据库，不再使用 localStorage 存储业务数据！
