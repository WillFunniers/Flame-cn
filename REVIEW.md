# Flame 中文二创 · 第一阶段独立复核报告（T9 / reviewer）

- 复核对象：工作目录 `$HOME/Flame`，上游 `pawelmalak/flame` @ `3e03c25138df4321143c4fbd1a99468ff375ebb2`（v2.4.0）为基线
- 复核镜像：`localhost/flame-zh:phase1`，ID `89ce94265f40834e3d2d7535b4d93b65b7a6e512e1783c34cb676c83d2219786`，227,250,875 B（216.7 MiB），created 2026-09-29 16:17:10 UTC
- 独立运行实例：容器 `flame-zh-review`，端口 **5017**（Lead 使用 5005，未复用），数据卷 `/tmp/flame-review-data`
- 对照资产：上游干净构建 `build-logs/baseline-build`（与 `main.289a6408.css` 一致）+ Lead 只读基线客户端 `http://127.0.0.1:5006`（同一后端）
- 渲染环境：`FONTCONFIG_FILE=/tmp/cjkfont/fonts.conf`（中文字形已由 `check-cjk-font.cjs` 独立验证为真字形，非豆腐块），Playwright 1.49.1（`$HOME/.dsh-tools/pw`，非项目依赖）
- 复核方式：**全部结论均由本机脚本重跑产生**，不引用 Lead/teammate 报告作结论；本次共修正 6 处自查脚本缺陷（见 §7），修正后所有结论可重跑

## 1. 总体结论

**PASS（有条件）** —— 构建、运行、中文化、Default 零回归、English 回归、响应式、性能/网络、原功能回归全部达标。

**修复轮（T14）结论：F-01 已关闭，F-04 已关闭**；残留的 2 项链接对比度失败（F-03）为**上游既有**，在 Default 基线下逐条相同（skin 引入的新增失败 = 0），按既有豁免记录、不阻塞验收。完整复验见 **§9**。

## 2. 验收判定表（任务书第二十五节 A–O）

| 标准 | 判定 | 独立证据 |
| --- | --- | --- |
| A Flame 正常构建 | **PASS** | `npx tsc --noEmit` 0 error；`npx react-scripts build` exit 0、`Compiled with warnings.`；warning 集合与上游**逐条一致**（25/25，0 新增，仅行号位移 19 处）→ `out/tsc.log`、`out/build.log`、`out/eslint-warnings.json` |
| B 可用 Podman 构建镜像 | **PASS** | **修复轮后已改用仓库未修改的 `.docker/Dockerfile` 构建**（我的独立构建 `flame-zh:review` 用 `Dockerfile.podman`；Lead 的最终镜像 `0bb9e63e42f3` 用原始 `.docker/Dockerfile`，日志 `build-logs/podman-build.log` 显示 `RUN apk …` 无 sed）→ 构建偏差已消除；三方产物内容哈希一致（新镜像 == 我的独立 `react-scripts build`：`main.b65bba5a.css` / `main.91f8f071.js`）；新镜像在 5019 端口实跑 HTTP 200、`/api/config` 200、日志正常 |
| C 可用 Podman 启动 | **PASS** | 我独立 `podman run` 5017/`flame-zh-review`：HTTP 200、`/api/config` 200、`POST /api/auth` 取得 token、`GET /api/apps` 200 → `out/runtime-check.txt` |
| D 浏览器能正常访问 | **PASS** | `smoke.cjs` 首页标题/搜索栏 PASS；冷启动 FCP 492ms / LCP 541ms / DCL 434ms / CLS 0 → `out/smoke-report.json`、`out/requests.json` |
| E 主要 UI 完整中文化 | **PASS** | 10 条路由 + 11 个模态/未登录上下文全部中文；zh 渲染中"纯拉丁文本"仅 21 处且全部合理（URL 路径、16 个后端主题名、`Weather API`）→ `out/text-zh.json`、`out/contexts-current-zh.json`、`out/term-check.json`。**T14 追加**：boot `<html lang>` 4 用例全 PASS（含"预先存 zh-CN"路径），`i18n` jest 8/8 → `out/html-lang.json` |
| F English 仍可用 | **PASS** | 与上游客户端同后端逐条对照：模态/表格/未登录/主题编辑器等 7 个上下文**逐字一致**；5 条设置路由整页拼接文本一致；差异仅为本次新增功能文案（Language / Visual style 等）→ `out/contexts-*.json`、`out/compare-rendered.json`、`out/en-regression.json` |
| G Anime Light 正常 | **PASS** | 配套配色：35 采样 0 FAIL（T14 复测最低 **5.90:1**）；**且所有皮肤×主题组合的新增失败 = 0**：anime-light+tron 0/7（修前 7/7 FAIL，最低 1.01:1；修后最低 **5.46:1**）；white/cloud 下仅剩与 Default 基线逐条相同的 2 项上游 accent 链接（F-03）→ `out/contrast-anime-light.json`、`out/theme-matrix.json`、`out/theme-matrix-cloud.json`、`out/theme-mismatch.json` |
| H Anime Dark 正常 | **PASS** | 配套配色 0 FAIL（最低 **9.99:1**）；anime-dark+white 修前 5/7 FAIL（1.03:1）→ 修后失败项收敛为与 Default 基线相同的 2 项上游链接、新增失败 = 0 → `out/contrast-anime-dark.json`、`out/theme-matrix.json` |
| I Default Theme 未被破坏 | **PASS** | 修复后构建 CSS 与上游逐规则 diff仍为 **removed 0 / changed 0**（155 → 229 规则，23,295 B）；皮肤内 24 条选择器**全部**限定在 `html[data-theme=…]`/`[data-bg]`，且不定义任何 `--color-*`；Default 实测最低 9.47:1 → `out/css-diff.json`、`out/scope-check.json`、`out/contrast-default.json` |
| J 背景正常 | **PASS** | `body::before`（fixed、`pointer-events:none`、插画 `url(.../anime-day.svg)` + **纯色主题兜底**）+ `body::after`（fixed、`pointer-events:none`、opacity 0.58 主题色 wash）；背景开关经真实控件（`#animeBackground`）开/关均同步 `data-bg` 与 `flame.bg`；资源 200（4599 B / 6076 B 与源码字节一致）→ `out/smoke-t14.log`、`out/runtime-check.txt`、截图 `out/screenshots/1366-home-zh-*` |
| K 背景资源失败有 fallback | **PASS** | 用 `page.route` **主动 abort** 全部 `*.svg` / `*background*` 请求后重载：纯色兜底层仍在且实测像素对比度 **15.07:1**，正文可读、截图留存（不依赖文档声明）；无 `color-mix` 的强制 fallback 分支亦全组合可读 → `out/smoke-t14.log`(`bg.fallback-on-resource-failure`)、`out/theme-matrix-fallback.json`、`out/screenshots/1366-home-anime-light-bg-aborted.png` |
| L 桌面端正常 | **PASS** | 1366 视口：7 个设置页签、CRUD、主题、背景全部通过；`scrollWidth<=innerWidth` → `out/smoke-report.json` |
| M 移动端正常 | **PASS** | 390 / 768：首页 + 设置/界面/Docker/主题页均无横向溢出；中文换行正常；小点击区仅上游既有的行内链接（与基线客户端逐项相同）→ `out/smoke-report.json`、`out/tap-targets.txt` |
| N 原有核心功能无明显回归 | **PASS** | 应用增/改/删、分类增/改/删、搜索（命中 + 无结果文案）、7 页签、Docker Integration UI（`#dockerHost`/`#dockerApps`）全部 PASS；修复轮复测 **55/57，0 hard FAIL**（2 项为非硬判定的小点击区，且与上游一致）→ `out/smoke-t14.log`、`out/smoke-report.json`、`out/dialogs.json` |
| O reviewer 完成独立复核 | **PASS** | 本报告 + `build-logs/review-evidence/` 全部脚本与证据可重跑；无 BLOCKER |

## 3. 环境与对象一致性（独立确认）

- 镜像 ID / 大小 / 创建时间与 Lead 提供值一致；`podman history` 显示 builder 阶段的 `sed` 仅存在于构建阶段。
- **独立复现构建**：我从当前工作树重新 `podman build`（复用 4 个缓存层，client 阶段真实重跑）→ 成功产出 `flame-zh:review`（`cc83997b4ad1`），并在 **5018** 端口独立运行该镜像：HTTP 200、`/api/config` 200、日志正常。三个来源（我独立构建的镜像、Lead 的 `phase1`、工作树的 `react-scripts build`）产物文件名/内容哈希完全一致 → 构建可复现、镜像对应最终源码。
- 运行阶段 `/etc/apk/repositories` = `dl-cdn.alpinelinux.org`（**未被镜像源改动影响**），证明 `Dockerfile.podman` 的 sed 不会改变产物。
- 镜像 `/app/public/static/{js,css}` 文件名与我在工作树独立构建完全一致（内容哈希命名）→ 镜像对应最终源码，无构建后漂移。
- 镜像内不含 `build-logs/`、`baseline-build`（`.dockerignore` 生效）。
- 复核期间工作树源码在我开始复核后未再变更（`find -newermt` 于镜像构建时间之后无源码文件）。

## 4. 方法与可重跑命令

```bash
# 0) 准备（中文字体 + 独立实例）
export FONTCONFIG_FILE=/tmp/cjkfont/fonts.conf
IMAGE=localhost/flame-zh:phase1 PASSWORD=reviewpass PORT=5017 NAME=flame-zh-review KEEP=1 \
  bash build-logs/review-evidence/runtime-check.sh            # → out/runtime-check.txt
export BASE_URL=http://127.0.0.1:5017 PASSWORD=reviewpass

# 1) 构建/类型/CSS 零回归/warning 集合
bash build-logs/review-evidence/build-check.sh                 # → out/{tsc.log,build.log,build-check.txt,css-diff.json}
node build-logs/review-evidence/extract-eslint-warnings.cjs out/build.log out/baseline-build-ci-true.log

# 2) 文案（A/B/C）+ 术语
node build-logs/review-evidence/text-scan.cjs                  # → out/{text-zh,text-en,text-default-locale,text-findings}.json
BASE_URL=http://127.0.0.1:5006 PASSWORD=flame_zh_test_2026 OUT=$PWD/build-logs/review-evidence/out/baseline-client \
  node build-logs/review-evidence/text-scan.cjs                # 上游客户端对照
node build-logs/review-evidence/compare-rendered.cjs out/text-en.json out/baseline-client/text-en.json
node build-logs/review-evidence/en-regression.cjs
node build-logs/review-evidence/term-check.cjs
LABEL=current-en node build-logs/review-evidence/context-scan.cjs     # 模态/未登录上下文（en）
LABEL=current-zh LANG_CODE=zh-CN node build-logs/review-evidence/context-scan.cjs
LABEL=baseline-en BASE_URL=http://127.0.0.1:5006 PASSWORD=flame_zh_test_2026 node build-logs/review-evidence/context-scan.cjs
LANG_CODE=zh-CN node build-logs/review-evidence/probe-dialogs.cjs     # window.confirm 文案

# 3) 主题/可读性/响应式/功能/网络
FULL=1 node build-logs/review-evidence/smoke.cjs               # → out/smoke-report.json + screenshots/
node build-logs/review-evidence/contrast.cjs                   # → out/contrast-{default,anime-light,anime-dark}.json
SKINS=default,anime-light,anime-dark APP_THEMES=tron,white \
  node build-logs/review-evidence/probe-theme-matrix.cjs       # → out/theme-matrix.json（F-01 证据）
node build-logs/review-evidence/requests.cjs                   # → out/requests.json（G1/G2）
LABEL=current node build-logs/review-evidence/tap-targets.cjs  # → out/tap-targets.txt

# 4) 离线自检（脚本自身可信度）
node build-logs/review-evidence/selftest.cjs                   # PNG 解码/环取样/WCAG 算法
node build-logs/review-evidence/selftest-browser.cjs           # 真实截图→解码→取背景→对比度
node build-logs/review-evidence/check-cjk-font.cjs             # 有无 FONTCONFIG_FILE 对照

# 5) 修复轮复验（T14 / §9）
node build-logs/review-evidence/scope-check.cjs                       # 皮肤作用域 + 不定义 --color-*
SKINS=default,anime-light,anime-dark APP_THEMES=tron,white,cloud \
  node build-logs/review-evidence/probe-theme-matrix.cjs              # 6~9 组合像素矩阵（theme-matrix*.json）
FORCE_NO_COLOR_MIX=1 SKINS=default,anime-light,anime-dark APP_THEMES=tron,white \
  node build-logs/review-evidence/probe-theme-matrix.cjs              # 强制无 color-mix fallback
node build-logs/review-evidence/probe-theme-mismatch.cjs              # F-01 原始复现（像素）
node build-logs/review-evidence/probe-html-lang.cjs                   # F-04 boot <html lang> 4 用例
cd client && CI=true npx --no-install react-scripts test --watchAll=false --testPathPattern=i18n
```

## 5. 逐项复核证据（A–L）

### A. 中文完整性
- zh 渲染的"纯拉丁可见文本"共 **21 处**，全部合理：`/applications`、`/bookmarks`（空态提示里的路由路径）、16 个后端主题名（`blackboard…mint`）、`Weather API`（`/settings/weather`）、`Ingress`/`Kubernetes`（`/settings/docker`）、`Wiki`（认证提示）、`English`（语言选项自称）。
- 模态/未登录上下文均为中文（`out/contexts-current-zh.json`）：应用表单、书签表单、分类表单、主题创建、设置-界面、登录页。
- 原生 `window.confirm` 文案亦已中文化（DOM 扫描不可见，已单独取证）：`确定要删除 X 吗？`、`确定要删除 X 吗？该分类下的所有书签都将被删除` → `out/dialogs.json`。
- 后端返回错误文案按例外放行（任务书允许）；未发现前端硬编码英文残留（`out/static-scan.txt` §4/§5 复核）。

### B. 术语一致性
`out/term-check.json`：术语表 14 项中 13 项在上游确存在且 zh 字典全部具备，并按预期渲染（应用/书签/设置/主题/搜索/保存/编辑/添加/更新/密码/身份验证）。`Username` 上游 UI 从未出现（**N/A**）；`Cancel` 上游仅存在于图标名 `mdiCancel`，无 Cancel 按钮（**N/A**，自动适用性判定在此为误报，已人工复核）；`Delete` 通过 confirm 文案验证。
技术名词 Docker/API/URL/Kubernetes 保留英文；en/zh 字典中 7 个 key 取值相同（`docker.kubernetes`、`docker.section`、`nav.css`、`nav.docker`、`ui.url`、`weather.apiSection`、`weather.weatherApiLink`）——均为技术名词，合理。

### C. English 回归
- 与上游客户端（5006，同一后端）逐上下文对照：`auth-logged-out`、`apps-add-modal`、`bookmarks-add-category-modal`、`bookmarks-add-bookmark-modal`、`bookmarks-table`、`themer-create-theme-modal`、`apps-add-modal-closed` **逐字一致**；其余 4 个上下文差异全部来自数据（应用名/时间戳）或本次新增控件 → `out/contexts-*.json` 对照。
- 路由级整页拼接文本（与节点粒度无关）：`/settings/app`、`/settings/css`、`/settings/docker`、`/settings/general`、`/settings/weather`、`/bookmarks` 与上游一致；`/settings`、`/settings/interface` 仅新增本次功能文案 → `out/compare-rendered.json`。
- 上游源码字面量覆盖：97 条中 39 条可在 10 条路由直接命中（其余为模态/未登录/瞬时态），模态部分已由 context-scan 逐字覆盖 → `out/en-regression.json`。
- 抽查（≥10）：`Save changes`、`Save CSS`、`Check for updates`、`Logout`、`Go back`、`Click to get current location`、`App name`、`App URL`、`Add new application`（模态）、`Update application`（模态）、`Add theme`（模态）、`Theme name/Primary color/Accent color`（模态）均与上游一致。

### D/I. Default 零回归与主题
- 构建 CSS 逐规则 diff：**removed 0 / changed 0**；新增 72 条（含 2 条 `prefers-reduced-motion` 规则）；新增中 16 条无 `data-theme` 前缀者为新组件 CSS Module 类，Default 皮肤下不存在对应元素 → 不构成外观影响。
- 主题机制未被改写：仍为 body 三变量 + `localStorage 'theme'`；新皮肤走独立 `html[data-theme]` + `localStorage 'flame.style'`，`index.html` 仅新增 1 个 bootstrap 内联脚本。
- 真实 UI 选择 → 刷新（boot 路径）后 `data-theme`、`flame.style`、`theme`(PAB) 三者一致恢复。

### E. 可读性（方法：截图像素外环取真实背景 + WCAG 2.1）
| 主题 | 采样 | FAIL | 最低对比度 | 采证方式 |
| --- | --- | --- | --- | --- |
| default | 35 | 0 | 9.47:1 | UI 点击 + 刷新后测量 |
| anime-light | 35 | 0 | **6.03:1** | 同上 |
| anime-dark | 35 | 0 | **8.79:1** | 同上 |

阈值：正文 ≥4.5:1、大字（≥24px 或 ≥18.66px bold）≥3:1。**注意**：以上为"皮肤 + 其配套配色"的达标结论；用户另行挑选非配套应用主题时的组合见 F-01。

### F/M. 响应式
390 / 768 / 1366 三视口首页与设置页 `document.documentElement.scrollWidth <= innerWidth` 全部成立、无溢出元素；中文换行正常；点击区小于 24px 的仅 `Go back`(51×16)、`Go to Settings`(88×16) 等行内链接，且**与上游基线客户端逐项完全相同**（`out/tap-targets.txt`）。

### G. 性能与网络
- 冷启动（全新 context、无缓存）：FCP **492ms**、LCP **541ms**、DCL 434ms、load 501ms、CLS **0**；总 55 请求 / 180.2 KiB。
- **G1 本次新增外部请求 = 0**（`out/requests.json` → `externalNew: []`）。
- **G2 已知上游例外**：`https://raw.githubusercontent.com/pawelmalak/flame/master/client/.env`，来源 `client/src/utility/checkVersion.ts:7-9`（`App.tsx:63` 调用），本次实测 status=200；并从主 bundle `main.69b38b7f.js` 中检索到该 URL 字符串，证明属上游已编译代码、本次未改动。
- 版本 toast 探针：**缺席**（`client/.env:1` `REACT_APP_VERSION=2.4.0` 与上游 master 相同）→ 版本比对正常。
- 字体/图标全部同源：Roboto woff2 3 个来自 `/static/media/...`；无 Google Fonts/CDN/远程图片；背景 SVG 同源。

### H. 构建
- `tsc --noEmit`：**0 error**。
- `react-scripts build`（**未使用 `CI=true`**）：exit 0、`Compiled with warnings.`；产物 CSS 23,583 B（上游 14,928 B，+8.5 KiB）、JS 2,948,001 B、build 总计 7.3 MB、media 168 K。
- warning 集合：当前 **25 条**，上游 **25 条**，按 `(file, rule, message)` 归一后**新增 0、消失 0**，仅 19 处行号位移（i18n 插入行导致）。上游 `CI=true` 下确实失败（我已复现 exit 1）→ Lead 的构建方式调整正确。
- 新增依赖 **0**（`git diff client/package.json` 为空）；`client deps: 28 / devDeps: 1` 与上游一致。

### I. Runtime
`out/runtime-check.txt`：独立容器 5017 启动成功、`curl /` 200、`/api/config` 200、登录取 token 成功、`GET /api/apps` 200、背景 SVG 200（4599 B / 6076 B）、日志无错误。

### J. 原功能回归
应用增/改/删、分类增/改/删、搜索命中与"无结果"文案、7 个设置页签逐个可达且渲染各自内容（SPA 导航，URL 未被重定向）、Docker Integration UI（`#dockerHost` + `#dockerApps`）均在；提示/通知中文化（`成功 / 应用已添加`）。53/55 PASS，0 hard FAIL。

### K. 上游同步风险
- 后端与 Dockerfile 家族**零改动**（`git diff HEAD -- controllers routes models db middleware utils server.js api.js .docker` 为空）；无重命名、无删除 → future merge 风险低。
- 前端 44 个文件变更 +652/−370，主要集中在 `client/src/components/**`（+568/−326）与 `store`（+40/−35）；新增文件集中在 `client/src/i18n/**`、`client/src/styles/anime.css`、`client/src/assets/backgrounds/**`、`client/src/utility/animeTheme.ts`、两个新组件目录 → 与上游冲突面可控。
- 值得注意的非源码改动（Lead 侧）：`.gitignore` +1 行（`client/build`）、`.dockerignore` +1 行（`build-logs`）；新增 `build-logs/**`（含 Dockerfile 副本、日志、截图、`baseline-build` 7.2 MB、我方 `out/build-review` 7.3 MB）与仓库外 worktree `$HOME/flame-baseline`。
- **提交建议**：只提交源码 + 文档（`AUDIT.md`、`I18N-*.md`、`THEME-DESIGN.md`、`THIRD-PARTY-ASSETS.md`、`REVIEW.md`、`FINAL-REPORT.md`）；`build-logs/**` 建议排除（或将精简后的证据目录单独归档），`baseline-build/`、`out/build-review/`、`out/build-baseline*` 不应入库；`.dockerignore` 增加 `build-logs` 是对的（已生效，镜像内确认无该目录）。

### L. 许可证 / 第三方素材
- `LICENSE.md` = MIT（Copyright 2021 Paweł Malak），未见许可变更。
- `THIRD-PARTY-ASSETS.md` 声明"全部为自制原创 SVG，无第三方素材"；我独立核对：两个 SVG 共 4599 B / 6076 B，仅含 `path`/`use`/`linearGradient`/几何图元，**无 `<image>`、无 `<script>`、无外部 `href`、无 `@font-face`**；唯一出现的 `http://` 是 SVG 命名空间声明 `xmlns="http://www.w3.org/2000/svg"`（非网络请求）。
- 渲染来源全部本地：Roboto 沿用上游本地字体文件（未新增、未改动）；图标沿用上游 `@mdi/js`。
- 全 diff 与新增文件中**未引入任何远程 URL/在线字体/远程图片**。

## 6. 问题清单（分级）

### F-01 MAJOR（本次二创新引入，必修）— ✅ 已修复并关闭（T14 复验，见 §9）
**Anime 皮肤 + 非配套应用主题配色 → 正文不可读**

- 位置：`client/src/styles/anime.css:33-49`（anime-light 表面色 `--anime-panel/card/...` 硬编码浅色 rgba）、`client/src/styles/anime.css:61-76`（anime-dark 硬编码深色 rgba）。
- 复现（真实 UI，非构造）：
  1. `podman run` 实例（或任一环境）登录 → `/settings`
  2. 在"视觉风格"选 **Anime Light**
  3. 在同页"App themes"网格里点 **tron**（深色主题，文字 `#EFFBFF`）
  4. 回首页 → 浅色半透明卡片上渲染浅色文字
- 实测（截图像素外环取真实背景）：
  | 皮肤 | 应用主题 | FAIL/采样 | 最低对比度 |
  | --- | --- | --- | --- |
  | anime-light | tron | **7/7** | **1.01:1** |
  | anime-dark | white | **5/7** | **1.03:1** |
  | anime-dark | tron | 0/7 | 10.45:1（正常） |
  | anime-light | white | 2/7 | 1.14:1（见 F-03，非本缺陷） |
  | default | tron | 0/7 | 9.46:1（Default 未受影响，I 项仍 PASS） |
- 影响范围：**两个 skin 对称失效**——皮肤表面色按自身明暗硬编码，而文字色来自用户主题变量，二者极性相反即失效；由正常 UI 操作可达（两个控件同页），不涉及数据/安全，故定级 **MAJOR**。
- 证据：`out/theme-matrix.json`、`out/screenshots/theme-matrix-anime-light-tron.png`、`out/screenshots/theme-matrix-anime-dark-white.png`、`out/theme-mismatch.txt`、`out/pipeline3.log`
- 最小修法（对 Lead 方案的评判）：
  - 方向**正确**：让皮肤只提供质感（背景图/圆角/阴影/模糊/边框透明度），表面色由 `var(--color-background)` 推导（`color-mix(in srgb, var(--color-background) N%, transparent)`），文字与表面始终成对跟随主题，任意组合保持可读。
  - 两点必须补充：**(a) fallback 本身也要可读**——`@supports` 之外的 fallback 若沿用当前硬编码浅/深 rgba，那么在 Chromium <111 / Safari <16.2 等无 `color-mix` 的引擎上缺陷依旧存在；建议 fallback 用"通用支持"的等价写法：伪元素 `background-color: var(--color-background); opacity: N`（与皮肤层叠加），或退化为 `background: transparent` 并保证文字对比度（当前背景图为浅色/深色固定资源，故推荐前者）。**(b) 除表面色外还需检查皮肤内的文字/链接"墨色"**：若 `anime.css` 另有硬编码文字色/边框色参与对比度，应一并改为 `var(--color-primary)`/`var(--color-accent)` 派生。
  - 修复后请保持 Default 零回归：新增规则必须仍全部位于 `html[data-theme="anime-light"|"anime-dark"]`（或 `[data-bg]`）作用域内。
  - 建议同时把"皮肤推荐配色"与"用户手选主题"的关系在 UI 上说明（例如切换皮肤时明确提示配色已同步/可用"恢复推荐配色"），减少用户主动构造失败组合的概率；但这是可选增强，不是必修项。

### F-02 MINOR（上游既有缺陷，需披露，非本次回归）
**首次启动（空 data 卷）主题异常，重启一次自愈**

- 复现：清空数据卷启动 → `data/config.json` 的 `defaultTheme` = `"tron"`（主题名而非 PAB）→ body 变量为 `tron / undefined / undefined`、`background-color: rgba(0,0,0,0)`（白底）；`podman restart` 后变为 `#EFFBFF;#6EE2FF;#242B33`、`rgb(36,43,51)`。
- 根因（上游）：`db/migrations/01_new-config.js:5` 用 `utils/init/initialConfig.json`（`:29` `"defaultTheme": "tron"`）覆盖 `data/config.json`，冲掉 `utils/init/normalizeTheme.js` 刚写入的 PAB；`utils/init/index.js:10-12` 的调用顺序使迁移发生在 normalize 之后（首次启动才触发）。
- 判定：后端 `git diff` 为空，属**上游既有缺陷**，不计入本次回归；但交付物面向自托管首装用户，建议在 `README`/`FINAL-REPORT` 明确"首次启动后重启一次"或由 Lead 决定是否在**后端范围外**用启动脚本规范化（本报告不建议改后端以保持 upstream 可同步）。
- 证据：`out/first-boot-defect.txt`

### F-03 MINOR（上游既有，非本次回归）
**内置 `white` 主题的 accent 用作行内链接色，浅底上对比度不足**

- 复现：`/settings` 选应用主题 **white**（accent `#dddddd`）→ 首页空态提示中的 `/applications`、`/bookmarks` 链接（`Message.module.css:6,21` 使用 `var(--color-accent)`）在浅色背景上约 1.14–1.35:1。
- 判定：**Default 皮肤同样复现**（default+white 2/7 FAIL，min 1.35:1）→ 属上游主题数据/样式问题，不是 Anime 皮肤引入；不改也可验收，建议记录并择机向上游反馈。
- 证据：`out/theme-matrix.json`（default+white 行）、`out/contrast-default.json`

### F-04 MINOR（首屏 a11y）— ✅ 已修复并关闭（T14 复验，见 §9）
**返回用户 boot 时 `<html lang>` 未同步**

- 复现：`localStorage.flame.lang='zh-CN'` → 刷新 → 界面为中文但 `document.documentElement.lang === 'en'`；在本次会话内经 UI 切换后才会同步为 `zh-CN`。
- 位置：`client/src/i18n/index.ts`（`syncDocumentLang` 仅在 `setLang()` 内调用，模块初始化未调用）。
- 最小修法：模块初始化时执行一次 `syncDocumentLang(getLang())`（或在 `client/src/index.tsx` 渲染前设置）。
- 证据：`out/first-boot... log` 中的 `probe-lang` 输出、`out/run-env.json` 同批日志

### F-05 MINOR（Lead 侧文档/数字，非源码）— ⚠️ 部分消除
- **构建源替换偏差**：修复轮 Lead 已改用仓库未修改的 `.docker/Dockerfile` 成功构建最终镜像（`0bb9e63e42f3`，日志 `build-logs/podman-build.log` 中 `RUN apk …` 无 sed）→ 本项**已消除**；`build-logs/Dockerfile.podman` 及 `flame-zh:review` 仅存为构建环境问题的历史证据。
- **warning 计数**：Lead 报告称上游 8 条 warning，实测 **25 条**（当前与上游集合完全一致）。建议按 `out/eslint-warnings.json` 修正文档，避免后续误判"新增 warning"。
- **apk 镜像源测速**：Lead 记录 upstream 20.9 KB/s；我在同一宿主机独立复测（多次、含持续传输）：`dl-cdn.alpinelinux.org` 1.9–3.4 MB/s、`mirrors.aliyun.com` 7.7–8.3 MB/s（镜像约快 2.5–4×，而非 ~100×）。结论不变（换镜像只是构建环境适配、且只作用于 builder 阶段），但数字建议改为可复现口径或注明测量时间。
- 证据：`out/k-static.txt`、`out/baseline-build-ci-true.log`

### NIT 级
- **N-1** 运行镜像内包含 5 个开发文档（`/app/*.md`，合计 189,804 B）——无害，建议 `.dockerignore` 追加排除。
- **N-2** `.js.map` 4,286,853 B / `.css.map` 40,218 B 随镜像发布且可 200 下载（`GENERATE_SOURCEMAP=false` 可关闭）；**上游基线同样如此**（baseline `main.3270a6fa.js.map` 4,219,642 B，HTTP 200），属既有行为。
- **N-3** 新增应用成功后模态不自动关闭（`AppForm.tsx` add 分支未调用 `modalHandler()`）——与上游逐字一致，属既有 UX，非回归（测试脚本需按用户操作点 X 关闭）。
- **N-4** 搜索栏仅在 `keyup` 更新（上游一致），自动化必须真实键入，`fill()` 不触发。
- **N-5** `/settings/weather` 中文句中保留 `Weather API`（术语表允许保留 API，但 `Weather` 可考虑译为"天气"）。
- **N-6** `/settings/docker` 保留 `Ingress`/`Kubernetes`、认证提示保留 `Wiki` —— 技术名词，建议保留。

## 7. 复核自查修正记录（结论可信度说明）

为保证"不依赖他人报告"，本次复核脚本自身经过自检，并修正了 6 处会产出**错误结论**的缺陷：

1. `text-scan.cjs` 把第一遍（英文）捕获误写为 `text-zh.json`，且 en 遍文本被计入"未翻译"finding → 已分离 `defaultLocale/en/zh` 三遍并仅对 zh 遍判定。
2. 直接 `page.goto('/settings/*')` 会因 `ProtectedRoute`（`client/src/components/Routing/ProtectedRoute.tsx:8-12`）在异步 `autoLogin` 完成前 `<Redirect to="/settings/app">`，导致**所有设置子页捕获到的其实是 AppDetails 页**（上游客户端同样如此）→ 已改为 SPA 内导航（点击 NavLink / `pushState`+`popstate`），并断言 URL 未被重定向（`route redirects: 0`）。这也是 Lead 侧 `page.goto` 式冒烟可能存在的同类盲点。
3. `contrast.cjs` 原先只写 `flame.style`（皮肤）而不应用配套配色，产出"anime-light 全 34 项 1:1"的**假结论** → 已改为真实 UI 选择 + 刷新 boot 路径；修正后 anime-light 实测最低 6.03:1（达标）。真正的缺陷经独立的"皮肤×主题"矩阵确认（F-01）。
4. CSS 解析器 `css-diff.cjs` 的 base/cur 标签颠倒 → 已修（并用合成用例 + 真实 baseline 自比对验证）。
5. Playwright `page.evaluate(fn, a, b)` 多参数报错（`check-cjk-font.cjs`、`diag-click.cjs`）→ 已修。
6. `networkidle` 与上游 `checkVersion` 外部 XHR 冲突导致偶发超时、`fill()` 不触发 `keyup`、点击已被选中的 Default 选项不产生存储变更、`[class*="ActionButton"]` 同时匹配容器与子元素 —— 均已修正/改为确定性选择器。

另：`css-diff.cjs`、`en-regression.cjs` 均用正/负对照验证过不会"假 PASS"（分别用合成改动与人为删除 25% 字面量检出）。

## 8. 修复后再验证范围（Lead 请求）

收到 F-01 补丁后，我只针对变更范围重验，不重跑全量：

```bash
export FONTCONFIG_FILE=/tmp/cjkfont/fonts.conf
# a) Default 零回归（逐规则，必须 removed 0 / changed 0）
bash build-logs/review-evidence/build-check.sh                        # tsc + build + css-diff
# b) 该缺陷组合 + 全矩阵像素对比度
SKINS=default,anime-light,anime-dark APP_THEMES=tron,white \
  node build-logs/review-evidence/probe-theme-matrix.cjs
node build-logs/review-evidence/contrast.cjs                          # 皮肤+配套配色回归
# c) 三主题/背景/功能冒烟（重建镜像后，用新镜像起 5017）
FULL=1 node build-logs/review-evidence/smoke.cjs
# d) 新增 CSS 仍须限定在 data-theme 作用域内
grep -nE '^[^@/]*\{' client/src/styles/anime.css | grep -v 'data-theme'   # 期望：无 UNSCOPED 规则
```

**再验证通过标准（T14 已按此执行并全部满足）**：`css-diff` removed/changed = 0；`scope-check` 无 UNSCOPED 选择器且不定义 `--color-*`；矩阵中 **skin 引入的新增失败 = 0**（与同主题 Default 基线逐条比对，F-03 的上游 accent 链接除外并单独标注）；`contrast-{default,anime-light,anime-dark}` 0 FAIL；无 `color-mix` 的强制 fallback 下同样满足"新增失败 = 0"；`smoke.cjs` 0 hard FAIL；boot `<html lang>` 与当前语言一致。

## 9. F-01 / F-04 复验（T14，独立重跑）

**复验对象**：`localhost/flame-zh:phase1`（`0bb9e63e42f3af7b52365444b06de348ff877761e3c01b58609dbf8d0fb9ff6f`，227,302,074 B，2026-09-30 02:19:38 UTC），
独立实例 **5019** / 容器 `flame-zh-review19` / 数据卷 `/tmp/flame-review19-data`（空卷 + 重启一次以绕过 F-02 上游首启缺陷）。
**变更范围机检**：自上次复核以来源码仅改动 3 个文件 —— `client/src/styles/anime.css`、`client/src/i18n/index.ts`、`client/src/i18n/__tests__/html-lang.test.ts`；后端 / `.docker` / 依赖均 0 改动。

### 9.1 逐项结果

| # | 复核项 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | `build-check.sh`（tsc + build + CSS 规则级 diff） | tsc **0 error**；build exit 0、`Compiled with warnings.`；**removed 0 / changed 0**（155 → 229 规则，14,928 → 23,295 B） | `out/build-check.txt`、`out/css-diff.json` |
| 1b | ESLint warning 集合 | 25 → 25，**新增 0 / 消失 0**（同一 multiset） | `out/eslint-warnings.json` |
| 2 | 6 组合矩阵（normal） | default+tron 0/7；default+white 2/7；**anime-light+tron 0/7（min 5.46）**；anime-light+white 2/7；**anime-dark+tron 0/7**；**anime-dark+white 2/7**（修前 5/7） | `out/theme-matrix.json` |
| 2b | **skin 引入的新增失败**（与同主题 Default 基线逐条对比） | **全部组合 = 0**（残留的 `/applications`、`/bookmarks` 两项在 default+white / anime-light+white / anime-dark+white 下**逐条相同**；逐条比对输入来自 `out/theme-matrix.json` 的 `rows[].pass`） | `out/theme-matrix.json` |
| 2c | `cloud` 配色追加验证（Lead 要求） | default+cloud 2/7、anime-light+cloud 2/7、anime-dark+cloud 2/7，**新增失败 = 0**，失败项同为那两个上游 accent 链接 | `out/theme-matrix-cloud.json` |
| 3 | `contrast.cjs` 三皮肤（真实 UI + boot 路径） | default 0/35（min 9.47）、anime-light 0/35（min **5.90**）、anime-dark 0/35（min **9.99**） | `out/contrast-*.json`、`out/contrast-summary.json` |
| 4 | 作用域机检 | 24 条选择器**全部**限定在 `html[data-theme=…]`/`[data-bg]`；`--color-(background|primary|accent)` 定义 **0** 处 | `out/scope-check.json` |
| 5 | **无 `color-mix` 强制 fallback**（拦截 CSS，剥离 3 个 `@supports(…color-mix…)` 块；覆盖 tron/white） | anime-light+tron 0/7（9.47）、anime-dark+tron 0/7（9.47）、white 各组合只剩与 Default 相同的 2 项上游链接、**新增失败 = 0** → fallback 自身可读 | `out/theme-matrix-fallback.json` |
| 6 | 新镜像 `smoke.cjs`（FULL） | **55/57 PASS，0 hard FAIL**（2 项为 info 级小点击区，与上游基线逐项相同）；含 `bg.image-layer-declared` / `bg.solid-fallback-layer-declared` / `bg.wash-layer-declared` / `bg.fallback-on-resource-failure`（abort 后像素对比度 **15.07:1**） | `out/smoke-t14.log` |
| 6b | F-04 boot `<html lang>`（4 用例） | 0 failure：`stored zh-CN + de-DE` → `zh-CN`、`zh 浏览器语言` → `zh-CN`、无存储 → `en`、`stored en` → `en`；另 `i18n` jest **8/8 PASS** | `out/html-lang.json` |
| 7 | F-01 原始复现步骤 | **10/10 PASS，min 5.44:1**（修前 7/7 FAIL、1.01:1） | `out/theme-mismatch.json`、`out/screenshots/theme-mismatch-anime-light-plus-dark-theme.png` |
| 8 | 镜像/工作树一致性 | 独立 `react-scripts build` 产物 `main.b65bba5a.css` / `main.91f8f071.js` 与新镜像 `/app/public/static/**` **完全一致** | `out/build-check.txt`、`podman exec … ls` |

### 9.2 对 Lead 三点的裁定

1. **F-01 关闭**：皮肤不再自带固定明暗表面，改为由 `var(--color-background)/var(--color-primary)` 经 `color-mix` 推导（`anime.css:80-130`），并以"皮肤×主题"矩阵实测确认 **skin 引入的新增失败 = 0**；`anime-light+tron` 由 1.01:1 → 5.46:1，`anime-dark+white` 由 1.03:1 → 收敛到与 Default 相同的上游链接项。
2. **F-04 关闭**：boot 路径 `<html lang>` 已同步（4/4 用例），且 jest 用例纳入回归。
3. **验收口径裁定**：同意「**skin 引入的新增失败 = 0**」为 F-01 的关闭标准，而非"任意配色 0 FAIL"。理由：F-03 的 `--color-accent` 行内链接对比度不足（`Message.module.css:6,21` × 内置 `white`/`cloud` 的 accent）在 **Default 皮肤下逐条复现**，属上游主题数据缺陷；若以"任意配色 0 FAIL"为门槛，将要求二创修复上游主题数据/组件样式，既越界也无法通过"Default 零回归"约束。F-03 保持 MINOR 记录，建议后续单独向上游反馈或由本项目以独立可选补丁处理。
4. **`card` 76% 定值**：我独立复测该组合最低 **5.44–5.46:1**（阈值 4.5），余量约 21%，**接受** Lead 的 +1pp 决定。
5. **fallback 路径**：`@supports` 弹出后表面回退到不透明主题底色，实测与 Default 基线完全一致（新增失败 0）→ 我此前提出的"fallback 自身必须可读"要求在实现中得到满足（`anime.css:80-90`）。

### 9.3 提示：本次复核修正了 1 处自查断言（非产品问题）

上一版 `smoke.cjs` 的 `bg.gradient-layer-declared` 断言假设"背景第二层是 `linear-gradient`"。T11 实现改为 **纯色兜底层（`body::before` background-color）+ 独立 wash 层（`body::after` opacity .58）**，因此该断言在新实现下必然为 false。我已把断言改为与新契约一致的三项机器可检条件（插画层含 `*anime*.svg` 且 `pointer-events:none`、兜底层 background-color 非透明、wash 层 opacity>0 且 `pointer-events:none`），并在 abort 场景下追加**像素对比度**断言。修正后 smoke 0 hard FAIL（见 §9.1 第 6 行）——这是断言口径过时，**不是产品缺陷**。

### 9.4 最终判定

| 项 | 结论 |
| --- | --- |
| F-01（MAJOR） | **CLOSED**（新增失败 0；原复现 10/10 PASS） |
| F-04（MINOR） | **CLOSED**（boot `html lang` 4/4 + jest 8/8） |
| 新增问题 | **无**（本次仅修正 1 处自查断言口径） |
| F-02 / F-03 / NIT | 维持原判（F-02 上游首启、F-03 上游 accent 链接、N-1/N-2 等非阻塞；F-05 构建偏差已消除） |
| A–O 判定 | A–O **全部 PASS**（E/G/H/I 已按 §9.1 更新） |
| **最终总体结论** | **PASS** — 交付物达到第一阶段验收要求 |
