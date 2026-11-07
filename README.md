# F-Log2C LUT 预览工具 / F-Log2C LUT Preview Tool

## 🎯 项目简介 / Project Overview

这是一个专业的 F-Log2C LUT（色彩查找表）在线预览工具，支持实时预览 Fujifilm F-Log2C 胶片模拟效果。

A professional F-Log2C LUT (Look-Up Table) online preview tool that supports real-time preview of Fujifilm F-Log2C film simulation effects.

## ✨ 主要特性 / Key Features

- 📸 **图片上传**：支持 JPG、PNG、WebP 格式
- 🎨 **12 种 LUT 风格**：PROVIA、Velvia、ETERNA、Classic Chrome 等
- 🎛️ **实时调整**：LUT 强度、对比度、饱和度三重控制
- 🌏 **中英文切换**：完整的国际化支持
- 📱 **响应式设计**：完美适配手机、平板、桌面设备
- 🎭 **深色科技风格**：玻璃态 UI + 渐变光效
- 💾 **一键下载**：导出处理后的图片

## 🚀 快速开始 / Quick Start

### 方法 1：直接使用 / Direct Usage

1. 在支持静态文件服务的 Web 服务器中部署 `website` 目录
2. 访问 `index.html` 即可使用

### 方法 2：本地测试 / Local Testing

使用 Python 快速启动本地服务器：

```bash
cd website
python3 -m http.server 8000
```

然后访问：http://localhost:8000

### 方法 3：使用 Node.js / Using Node.js

```bash
cd website
npx serve
```

## 📂 项目结构 / Project Structure

```
website/
├── index.html              # 主页面
├── admin/                  # 后台管理
│   ├── index.html          # 管理页面
│   ├── admin.css           # 管理样式
│   └── admin.js            # 管理逻辑
├── css/
│   └── style.css           # 主样式表
├── js/
│   ├── lut-engine.js       # LUT 解析和应用引擎
│   ├── i18n.js             # 国际化模块
│   └── main.js             # 主应用逻辑
├── luts/                   # LUT 文件目录
│   ├── luts-config.json    # LUT 配置文件
│   └── *.cube              # 12 个 LUT 文件 (每个约 7MB)
└── README.md               # 本文档
```

## 🎨 使用方法 / How to Use

### 前台使用 / Frontend Usage

1. **上传图片**：点击或拖拽图片到上传区域
2. **选择 LUT**：从 12 种胶片风格中选择一个
3. **调整参数**：
   - LUT 强度：控制效果应用程度 (0-100%)
   - 对比度：调整明暗对比 (50-150%)
   - 饱和度：调整色彩鲜艳度 (0-200%)
4. **下载图片**：点击下载按钮保存处理后的图片
5. **切换语言**：点击右上角 中/EN 按钮

### 后台管理 / Backend Management

访问 `/admin/index.html` 进入后台管理系统

#### 上传新 LUT / Upload New LUT

1. 填写 LUT 信息：
   - LUT ID：英文标识（如 `new-style`）
   - 英文名称和描述
   - 中文名称和描述
2. 选择 `.cube` 文件
3. 点击"上传 LUT"按钮
4. 将 `.cube` 文件手动上传到服务器的 `luts/` 目录
5. 下载更新后的 `luts-config.json`
6. 替换服务器上的 `luts/luts-config.json` 文件

#### 删除 LUT / Delete LUT

1. 在 LUT 列表中找到要删除的项
2. 点击"删除"按钮
3. 下载更新后的配置文件并替换服务器文件
4. 手动从服务器删除对应的 `.cube` 文件

## 🔧 技术细节 / Technical Details

### LUT 处理 / LUT Processing

- **格式**：3D LUT Cube 文件 (65×65×65 网格)
- **插值算法**：三线性插值 (Trilinear Interpolation)
- **色彩空间**：输入 F-Log2C + F-Gamut C，输出各胶片风格

### 性能优化 / Performance Optimization

- 大图自动降采样到 1920×1080
- Canvas 2D 上下文优化
- LUT 数据缓存
- 实时渲染管线

### 浏览器兼容性 / Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## ⚠️ 重要提示 / Important Notes

1. **仅供预览**：此工具用于快速预览 LUT 效果，不适用于专业色彩管理工作流
2. **色彩空间假设**：工具假设输入图片为 F-Log2C + F-Gamut C 色彩空间
3. **性能限制**：超大图片会自动降采样以保证流畅性
4. **离线使用**：所有处理在浏览器本地完成，无需上传到服务器

## 📦 部署到 GitHub Pages / Deploy to GitHub Pages

网站地址 / Site URL：**https://neal-flut-photochanger.github.io/F-Log2C/**

### 首次发布 / First Publish

1. 用用户名 `neal-flut-photochanger` 注册 GitHub 账号：https://github.com/signup
2. 新建一个 **Public** 仓库，名称为 `F-Log2C`，不要勾选添加 README
3. 创建 Personal Access Token（勾选 `repo` 权限）：https://github.com/settings/tokens
4. 在终端运行：
   ```bash
   cd /Users/apple/Desktop/F-Log2C/website
   ./deploy.sh "First publish"
   ```
   提示输入密码时，粘贴上一步的 Token（不是 GitHub 登录密码）
5. 打开仓库 Settings → Pages，Source 选 `Deploy from a branch`，分支选 `main`、目录选 `/(root)`，保存
6. 等待 1–2 分钟，访问上面的网站地址

### 日常更新 / Updating

任何改动（代码或 LUT）完成后运行 `./deploy.sh "更新说明"` 即可，GitHub Pages 会自动重新发布。

## 🔄 更新 LUT 的完整流程 / Complete LUT Update Workflow

1. 本地运行 `python3 -m http.server 8000`，访问 http://localhost:8000/admin/
2. 在管理界面添加新 LUT 信息
3. 点击"下载 luts-config.json"，替换 `luts/luts-config.json`
4. 把新的 `.cube` 文件放进 `luts/` 目录
5. 运行 `./deploy.sh "Add new LUT"`，1–2 分钟后线上网站即可使用新 LUT

## 🎨 自定义样式 / Customization

主要样式变量位于 `css/style.css` 顶部，可修改：

- 主色调：`#5865f2` 和 `#8b5cf6`
- 背景渐变
- 卡片圆角和间距
- 字体系列

## 📝 许可证 / License

此项目使用 MIT 许可证。LUT 文件版权归 Fujifilm 所有。

## 🙏 致谢 / Credits

- Fujifilm F-Log2C LUT 文件
- 现代浏览器的 Canvas API
- 开源社区

---

**开发日期 / Development Date**: 2026-11-08  
**版本 / Version**: 1.0.0
