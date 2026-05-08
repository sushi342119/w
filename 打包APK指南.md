# 搬砖记 · 打包成 APK 完整指南

从网页 App 变成真正能装到手机上的安卓 APK。总共分两步：**上传到 GitHub Pages** → **用 PWA Builder 打包**。

预计耗时：**15-25 分钟**。

> ⚡ **提示**：要上传的文件已经整理到 `待上传-GitHub/` 这个文件夹里，直接把里面的 5 个文件全选拖到 GitHub 上传页就行。

---

## 第一步：上传到 GitHub Pages（获得 HTTPS 网址）

### 1. 注册 GitHub 账号（如已有跳过）
访问 https://github.com/signup，用邮箱注册即可。

### 2. 新建仓库
登录后点右上角 + → `New repository`：
- Repository name: `banzhuanji`（随意，英文就行）
- 勾选 `Public`（必须公开，GitHub Pages 免费版要求）
- 不用勾选 README
- 点击 `Create repository`

### 3. 上传代码
新仓库页面点击 **"uploading an existing file"** 链接（蓝字）

需要上传的文件列表：
- `index.html`
- `app.js`
- `manifest.json`
- `sw.js`
- `icon.svg`

**不用上传**：`启动.bat`、`README.md`、`icon-bricknote.svg`、`icon-bricks.svg`、`icon-worker.svg`、`icon-preview.html`（这些是本地开发用的）

把上面 5 个文件**拖拽**到网页虚线框里，等它显示绿色对勾，底部 `Commit changes` 按钮点一下。

### 4. 开启 Pages
仓库顶部菜单 **Settings** → 左侧 **Pages**：
- Source: 选 **Deploy from a branch**
- Branch: 选 **main** 和 **/ (root)**
- 点 **Save**

等 1-3 分钟，刷新 Pages 页面，会显示：
> Your site is live at **https://你的用户名.github.io/banzhuanji/**

这就是你的 HTTPS 网址！先用手机浏览器打开看看，能正常用就 OK。

---

## 第二步：用 PWA Builder 打包 APK

### 1. 打开 PWA Builder
访问 https://www.pwabuilder.com/

首页有一个大大的输入框，把刚才的 GitHub Pages 网址粘进去（`https://你的用户名.github.io/banzhuanji/`），点 **Start**。

### 2. 检查分数
它会给你的 App 评分，大致会显示：
- **Manifest** ✓（已准备）
- **Service Worker** ✓（已准备）
- **Security** ✓（HTTPS 有了）

如果有黄色警告不影响打包，直接进下一步。

### 3. 打包 Android
右上角点 **Package for stores**，选 **Android**。

第一个选项 **Android Package**（默认）就够了，下面需要填：
- Package ID: `com.banzhuanji.app`（自己取，唯一就行）
- App name: `搬砖记`
- Launcher name: `搬砖记`
- App version: `1.0.0`
- App version code: `1`
- Display mode: `Standalone`
- Host: 你的 GitHub Pages 域名
- Start URL: `/banzhuanji/`

下面大部分保持默认。

### 4. 下载 APK
点 **Generate Package**，稍等 30 秒，它会生成一个 zip。下载解压后里面有：
- `app-release-signed.apk` ← **这是可以装到手机的！**
- 其他签名文件（妥善保存，以后更新用同一个才能覆盖）

### 5. 装到手机
把 apk 文件传到手机（微信传自己、数据线、网盘都行），点击安装。

第一次可能需要在设置里开启"允许安装未知来源应用"。

---

## 常见问题

**Q：打开后显示白屏？**  
多半是 Service Worker 缓存了旧版本，卸载重装就好。

**Q：以后代码改了怎么更新？**  
改完直接在 GitHub 网页仓库里上传新文件覆盖，PWA Builder 重新生成 APK，手机重装。

**Q：APK 能上架应用市场吗？**  
可以，但需要实名认证和开发者费用（各市场不同，100~300元/年）。自己用的话不需要上架。

**Q：网址能改短吗？**  
GitHub Pages 自带域名改不了，但可以买个便宜的 .xyz 域名（一年几块钱）绑定。目前先用默认的就够。

---

## 如果不想折腾 GitHub

更简单的替代方案：**Netlify Drop**（https://app.netlify.com/drop）
- 不用注册账号
- 把 5 个文件（index.html/app.js/manifest.json/sw.js/icon.svg）打包成 zip，拖到网页
- 瞬间拿到一个 `https://xxx.netlify.app` 网址
- 然后走上面的第二步

GitHub Pages 和 Netlify Drop 任选一个都可以。
