# 第三方素材清单（THIRD-PARTY-ASSETS.md）

**结论：本阶段新增的全部视觉素材均为自制原创 SVG，无任何第三方素材。**

- 自制文件：2 个
  - `client/src/assets/backgrounds/anime-day.svg`
  - `client/src/assets/backgrounds/anime-night.svg`
- 作者：本项目（theme teammate）使用文本编辑器手工编写 SVG 源码，逐点计算坐标/渐变，未使用任何生成式 AI 绘图、未使用任何图库素材、未描摹任何受版权保护的插画或角色。
- 许可证：随本项目仓库（Flame 上游为 MIT，见 `LICENSE.md`）以 MIT 授权发布。
- 引入方式：本地文件，经 CRA 的 asset 管线（CSS `url()` → webpack `asset/resource`）打包进 `static/media/`，**无任何远程 URL**（无 CDN、无 Google Fonts、无在线图片、无视频、无 WebGL、无 3D 库）。
- 版权风险自查：
  - 画面内容为抽象几何风景（渐变天空、云、山脊、抽象鸟居剪影、樱花瓣、月亮、星点），**不含任何人物形象**，不含任何已有动漫/游戏角色的造型、服装、标志、配色方案或字体 logo。
  - 未复制任何图库的路径数据；所有 `path` 坐标为本项目自算。
  - 无第三方字体：沿用上游自带的 Roboto 本地字体文件（`client/src/assets/fonts/Roboto/*`，随上游仓库提供，本阶段未新增字体）。
  - 无 icon 素材新增：界面图标继续使用上游的 `@mdi/js`（Material Design Icons，随上游依赖）。
- 制作说明（可复现）：
  - 画布：`viewBox="0 0 1600 900"`（16:9），`preserveAspectRatio="xMidYMid slice"`；CSS 侧 `background-size: cover` + `background-position: center top`，因此在窄屏（390px）纵向裁切后，构图中心（鸟居/山脊/樱花瓣）仍在可视区，太阳/月亮被安排在右侧、桌面端可见。
  - 日景：`linearGradient` 天空（`#ffe9f2 → #f7f0ff → #e7f3ff`）+ 径向太阳光晕 + 6 组椭圆云 + 两层山脊 `path` + 抽象鸟居（4 个圆角 `rect`）+ 水面带 + 17 片 `<use href="#p">` 樱花瓣（同一 `path` 定义，逐个 `translate/rotate/scale`）。
  - 夜景：深靛渐变天空（`#141526 → #20203e → #2b2545`）+ 低透明度月亮与月牙遮罩 + 25 颗星点（`#cdc3e6`，opacity ≤ 0.7）+ 4 个柔和星芒 + 云带 + 山脊 + 鸟居 + 水面 + 17 片夜景樱花瓣。
  - 亮度刻意压低：夜景月亮与星点不使用纯白，透明度也受限，以保证叠加文字后仍满足 WCAG AA（≥ 4.5:1，见 `THEME-DESIGN.md` §7）。
  - 体积：日景 4599 B、夜景 6076 B（均 < 10 KB）；XML 用 `xmllint --noout` 校验通过。
- 若未来引入任何第三方素材，必须在本文件补登：作者 / 来源 / 许可证 / 原始 URL / 是否允许商用 / 是否要求署名。
