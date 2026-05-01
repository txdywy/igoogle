# Google Release Radar

纯前端静态技术站点，用 GitHub Actions 定时抓取 Google 生态公开更新源并部署到 GitHub Pages。

## 数据源

- Chrome: Chromium Dash API + Chrome VersionHistory API
- ChromeOS: Chromium Dash `cros/fetch_serving_builds`
- Pixel/Android: Pixel OTA / Factory Images 页面指纹 + Android Security Bulletin
- Android SDK: `repository2-1.xml`
- RSS: Chrome Releases Blog + Android Developers Blog

Pixel 固件页面目前不稳定暴露结构化固件列表，所以站点保存页面指纹和官方 `Last updated` 信息，用于变更监控；真正的版本表优先使用官方 JSON/XML 源。

## 本地运行

```bash
npm install
npm run fetch:data
npm run dev
```

## 部署

推送到 `main` 后，`.github/workflows/deploy.yml` 会每 6 小时抓取一次数据、构建并部署 GitHub Pages。仓库需要在 Settings → Pages 中启用 GitHub Actions 作为 Pages 来源。
