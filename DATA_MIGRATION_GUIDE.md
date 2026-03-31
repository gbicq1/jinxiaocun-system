# 数据迁移使用指南

##  当前状态

✅ **浏览器模式正常工作** (`npm run dev`)
⚠️ **Electron 模式需要编译环境** (需要 Visual Studio C++ 组件)

## 📋 推荐方案

### 方案 1：使用浏览器模式（推荐）

虽然目前无法在 Electron 中运行，但您可以：

1. **在浏览器中查看数据**
   ```bash
   npm run dev
   ```
   访问 `http://localhost:5173`

2. **数据迁移功能已就绪**
   - 导航到：系统设置 > 数据迁移
   - 可以查看 localStorage 中的所有数据
   - 可以导出 JSON 备份

3. **等待 Electron 环境配置完成后再迁移到数据库**

### 方案 2：安装 Visual Studio Build Tools（需要时间）

如果您想让 Electron 完全运行并迁移数据到数据库：

1. **下载 Visual Studio Build Tools**
   - 访问：https://visualstudio.microsoft.com/downloads/
   - 下载 "Build Tools for Visual Studio"

2. **安装 C++ 组件**
   - 运行安装程序
   - 选择 "Desktop development with C++" 工作负载
   - 确保勾选：
     - MSVC v142 或更高版本
     - Windows 10/11 SDK
     - C++ CMake tools

3. **重新编译 better-sqlite3**
   ```bash
   npx electron-rebuild -f -w better-sqlite3
   npm run electron:dev
   ```

### 方案 3：使用已编译的预构建版本

尝试下载预编译的 better-sqlite3：

```bash
npm rebuild better-sqlite3 --build-from-source=false
```

## 🔧 临时解决方案

由于 Electron 暂时无法运行，您可以：

1. **继续使用浏览器模式**
   - 所有数据保存在 localStorage
   - 功能完全可用
   - 只是无法使用数据库持久化

2. **定期导出备份**
   - 使用数据迁移页面的"导出为 JSON"功能
   - 定期备份重要数据

3. **等待环境配置完成**
   - 安装好 Visual Studio Build Tools 后
   - 重新运行 `npm run electron:dev`
   - 然后使用数据迁移工具

## 📊 数据迁移流程（当 Electron 可以运行时）

### 步骤 1：在浏览器中准备数据
```bash
npm run dev
```
- 访问系统，确保所有数据已录入
- 导航到：系统设置 > 数据迁移
- 查看数据概览

### 步骤 2：导出备份（可选但推荐）
- 点击"导出为 JSON"
- 保存备份文件

### 步骤 3：启动 Electron
```bash
npm run electron:dev
```
- Electron 窗口会自动打开
- 连接到 Vite 开发服务器

### 步骤 4：执行迁移
- 在 Electron 窗口中导航到：系统设置 > 数据迁移
- 点击"开始迁移到数据库"
- 等待迁移完成

### 步骤 5：验证数据
- 在 Electron 中查看各个模块
- 确认所有数据已正确迁移

## ⚠️ 注意事项

1. **Node.js 版本兼容性**
   - 当前 Node.js: v24.14.0 (NODE_MODULE_VERSION 137)
   - Electron 需要：NODE_MODULE_VERSION 145
   - 必须使用 electron-rebuild 重新编译 native 模块

2. **编译环境要求**
   - Windows: Visual Studio Build Tools + C++ 组件
   - 或使用预编译二进制文件

3. **数据一致性**
   - 迁移前确保浏览器数据是最新的
   - 迁移后 Electron 和浏览器数据会独立
   - 建议迁移后主要在 Electron 中工作

## 🎯 下一步行动

**立即可做**：
```bash
# 1. 启动浏览器模式
npm run dev

# 2. 访问数据迁移页面
# http://localhost:5173 -> 系统设置 -> 数据迁移

# 3. 查看数据并导出备份
```

**需要安装编译环境后**：
```bash
# 1. 安装 Visual Studio Build Tools
# 2. 重新编译
npx electron-rebuild -f -w better-sqlite3

# 3. 启动 Electron
npm run electron:dev

# 4. 在 Electron 中执行数据迁移
```

## 📞 需要帮助？

如果遇到编译问题：
1. 检查 Visual Studio Build Tools 是否正确安装
2. 确保安装了"Desktop development with C++"工作负载
3. 尝试以管理员身份运行命令行
4. 清理 node_modules 后重新安装：
   ```bash
   Remove-Item -Recurse -Force node_modules
   npm install
   npx electron-rebuild -f -w better-sqlite3
   ```
