# 搬砖记 · 真·安卓 APP 打包指南

这次用 **Capacitor + GitHub Actions** 打成真正的原生安卓 APK：

- ✅ 代码完全打包进 APK（卸载 GitHub 仓库也能用）
- ✅ 使用 Android 原生 WebView，**没有 Chrome 套壳地址栏**
- ✅ 有自己的应用 logo、启动画面、应用名
- ✅ 图标点开就是全屏 APP，跟微信支付宝一样

---

## 一、把代码推到 GitHub（你之前的仓库就行）

仓库里已经多了这些文件，都要上传：

**新增文件夹**：
- `android/` 整个文件夹（Android 原生项目）
- `.github/workflows/` (GitHub 云构建脚本)

**新增文件**：
- `capacitor.config.json`
- `package.json`
- `.gitignore`

**更新的文件**：
- `app.js`、`index.html`、`sw.js`、`manifest.json`、`icon-*.png`

### 推荐做法：用 Git Desktop 或 GitHub Desktop 一次性推送

1. 下载 GitHub Desktop: https://desktop.github.com/
2. 克隆你的仓库 `w` 到本地
3. 把 `D:\ai\项目\记账工时App\` 下的所有文件（除 `node_modules`、`待上传-GitHub`、`banzhuanji-apk`）复制到 GitHub Desktop 克隆的那个文件夹
4. GitHub Desktop 会自动识别变化，填写 commit 信息 → Push

### 或者用网页上传（慢但简单）

一个个拖到 GitHub 网页，但 `android/` 里有很多小文件，建议用 Desktop。

---

## 二、GitHub Actions 自动构建 APK

代码推上去后：

1. 访问你的仓库 https://github.com/sushi342119/w
2. 点顶部 **Actions** 标签
3. 左边会有 **"Build Android APK"**
4. 每次推送代码后，它会**自动运行**（约 5-10 分钟）
5. 看到绿色 ✓ 就是构建成功

## 三、下载 APK

1. 进 Actions → 点击最新的那次运行
2. 页面最底部 **Artifacts** 区域有个 **搬砖记-apk**
3. 点击下载（是个 zip）
4. 解压得到 `app-debug.apk`

## 四、装到手机

1. APK 传到手机（微信文件传输助手最简单）
2. 点击安装
3. 如果提示"来源未知"，开权限允许

---

## 🎉 完成后的效果

- 桌面图标：**黄色安全帽小人**（方的和圆的自动适配）
- 点开：深色启动画面 1 秒 → 进入 App
- **完全没有地址栏、没有 Chrome 标志、没有"由浏览器运行"**
- 离线可用（所有代码和图标都在 APK 内）
- 跟你安装任何 App 没有任何区别

## 🔄 以后更新怎么办

改完代码后再次推到 GitHub，Actions 会自动打出新 APK，下载安装即可（同一签名会自动覆盖升级，数据不丢）。

---

## 💡 常见问题

**Q：为什么这次不是 Chrome 套壳？**  
因为这次用的是 Capacitor，它用 Android 原生 `WebView` 组件，没有地址栏、没有浏览器 UI，完全是应用自己的容器。

**Q：APK 体积多大？**  
约 4-6 MB，比 Chrome 套壳那个（1.3MB）大，因为包含了完整的 Android 运行时代码。

**Q：构建失败了怎么办？**  
去 Actions 看红色 ✗ 那个任务的日志，粘给我，我帮你排查。

**Q：要交 $25 开发者费吗？**  
不用，这个 APK 可以直接安装，不需要上架 Play Store。
