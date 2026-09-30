# Flame 中文二创第一阶段完成报告

> 交付日期：2026-09-30 · 分支 `feature/zh-anime` · 独立复核：`REVIEW.md`（T9 + T14 复验，最终结论 **PASS**）

## Upstream

- **Repository**: https://github.com/pawelmalak/flame
- **Branch**: `feature/zh-anime`（本地分支；上游 `master` 未推送任何远程）
- **Commit**: `3e03c25138df4321143c4fbd1a99468ff375ebb2`（`git describe` = `v2.4.0-2-g3e03c25`；v2.4.0 tag 位于父提交 `069b669`）
- **Upstream 基线对照**: 干净 worktree `$HOME/flame-baseline`（同一 commit）及其构建产物 `build-logs/baseline-build`，用于英文逐字回归、CSS 规则级回归与 Default 外观对照

## 环境

- **Node**: v22.22.1（宿主机）／容器内 `node:20-alpine`
- **Package manager**: npm 9.2.0（项目使用 npm + `package-lock.json`）
- **Container runtime**: Podman 5.7.0 rootless（crun）——**本机无 Docker，全程未安装 Docker**
- **Podman version**: 5.7.0
- **浏览器**: Playwright 1.49.1 + Chromium headless（`$HOME/.dsh-tools/pw`，**不属于项目依赖**）；中文渲染由隔离 fontconfig（`/tmp/cjkfont`）提供，未修改宿主系统字体
- **平台**: Linux amd64

## 完成内容

- **中文化**：新增零依赖轻量 i18n 层 `client/src/i18n/`（`en` / `zh-CN` 各 **247 key**，key 集合机检一致；`t()` 可在组件外调用，无 Context Provider，React 17 兼容），接入 **39 个源文件**。覆盖：首页与中文问候/中文日期、搜索、应用（卡片/表格/表单 Modal/空状态）、书签与分类、设置全部 7 个页签（主题/通用/界面/天气/Docker/CSS/应用）、主题编辑器与主题创建表单、语言切换控件、Notification/Toast、Error、Empty state、Tooltip、Placeholder、身份验证、**Docker Integration 的全部 UI 文案**（产品逻辑零改动）。
- **English 保留**：`en` 字典与上游逐字一致（逐文件回归 263/263；全局 AST 比对 296 命中 + 14 条登记豁免）；并与**上游基线客户端对同一后端**做端到端对照，首页/模态/表格/设置页英文文案逐字一致。
- **Anime Light**：独立视觉皮肤 `html[data-theme="anime-light"]`（柔和浅色二次元），设置页可选，刷新保持。
- **Anime Dark**：独立视觉皮肤 `html[data-theme="anime-dark"]`（柔和深色二次元）。
- **Background**：本地自制原创 SVG（`anime-day.svg` 4599 B / `anime-night.svg` 6076 B，**无任何远程 URL / 在线字体 / 视频 / WebGL / 3D**）；背景层 = 插画 + 主题色纯色兜底 + 独立 wash 层；卡片半透明 + 轻毛玻璃（仅叶子 surface）+ 圆角 + 柔和阴影；背景开关持久化；**Default 皮肤下 0 个插画请求、首屏增量 0 B**。
- **Responsive**：390 / 768 / 1366 三视口无横向溢出、中文换行正常、点击区域正常；三主题在三视口均正常。

## 未做（本阶段明确排除）

- **Podman Integration**（Podman 仅作为开发/构建/运行的容器运行时；**未向 Flame 增加任何 Podman 相关产品功能**，源码中 0 处 podman 引用）
- Kubernetes、MCP、AI、Agent、多主机管理
- 新数据库、新认证系统、Docker API 重写、后端架构重写、React 大规模重构、插件系统
- 未安装 Docker、未修改宿主机容器运行时、未为测试 Docker Integration 新增任何代码
- 未引入任何新的 npm 依赖（`git diff` 的 4 个 package/lock 文件为空）

## Build

**PASS**

| 项 | 结果 |
| --- | --- |
| `cd client && npx tsc --noEmit -p tsconfig.json` | **exit 0，0 error** |
| `cd client && npx react-scripts build` | **`Compiled with warnings.`，exit 0** |
| ESLint warning | **25 行 / 16 文件，与上游基线集合逐条一致（新增 0、消失 0，仅 19 处行号位移）** — 证据 `build-logs/review-evidence/out/eslint-warnings.json` |
| jest（i18n） | 2 suites / 8 tests PASS |
| 新增依赖 | 0（`git diff` 的 `package.json` / `package-lock.json`（root 与 client）均为空） |
| 上游既有脚本 | 仓库无 `lint` / `typecheck` / `test` script（CRA 的 tsc/eslint 由 `react-scripts build` 内部执行），本次未伪造脚本 |

## Podman Build

**PASS**

- **最终镜像**：`localhost/flame-zh:phase1`，ID `a638594c5913`（228 MB）
- **命令（使用仓库中未修改的 `.docker/Dockerfile`）**：
  `podman build --network=host -f .docker/Dockerfile -t flame-zh:phase1 .`
- 耗时 4m31s（2026-09-30 02:49:08 → 02:53:39 UTC），日志 `build-logs/podman-build.log`（`Compiled with warnings.` / `BUILD_EXIT:0`）
- 该镜像由**最终提交后的工作树**构建；其客户端产物 `main.b65bba5a.css` / `main.91f8f071.js` 与 reviewer T14 复验的镜像 `0bb9e63e42f3` **完全同名同哈希**（唯一差异是镜像内的文档 md 更新为最终版），因此 T14 的功能性结论对最终镜像继续成立；Lead 也在该镜像上重跑 `smoke.cjs` = **36 PASS / 0 FAIL**
- 预热构建（同一原始 Dockerfile，01:41:10 → 01:58:44，17m34s）证明上游 Dockerfile 在本机 Podman 下可直接构建；最终产物直接由它产出，**`.docker/**` 未做任何修改**
- 历史说明：首次构建（T7）曾因本机到 `dl-cdn.alpinelinux.org` 的带宽在构建时段仅 20.9 KB/s，临时使用过逐字副本 `build-logs/Dockerfile.podman`（仅 builder 阶段 apk 前加 1 行镜像源替换）。该偏差已在 T13 消除；`podman history` 与运行阶段 `/etc/apk/repositories` 均确认最终镜像不含任何源替换
- 独立复现：reviewer 自行 `podman build` 产出 `flame-zh:review` 并在 5018 端口运行；三方产物内容哈希一致（`main.b65bba5a.css` / `main.91f8f071.js`）

## Podman Runtime

**PASS**

```bash
podman run -d --name flame-zh -p 5005:5005 -e PASSWORD=*** \
  -v $HOME/flame-runtime-data:/app/data flame-zh:phase1
```

- `podman ps` 正常；日志：JWT secret / migrations / SQLite / websocket / `Server is running on port 5005 in production mode`
- `curl http://127.0.0.1:5005/` → **200**（Flame HTML，~26 ms）；`POST /api/auth/` → 200 + JWT；插画资源 200/304
- **未挂载 `/var/run/docker.sock`**；未引入 compose / quadlet 等新编排体系
- reviewer 独立以 5017 / 5019 端口运行复核实例，同样 PASS
- 记录：`build-logs/podman-runtime.md`

## Browser Smoke Test

**PASS**（全部针对最终镜像 `0bb9e63e42f3`）

| 套件 | 结果 | 覆盖 |
| --- | --- | --- |
| `build-logs/smoke.cjs` | **36 PASS / 0 FAIL** | 首页/搜索/登录/中文 9 路由/语言切换/应用增改删/三主题/背景+fallback/390·768·1366 溢出/外链/运行时错误 |
| `build-logs/verify-core.cjs` | **13 PASS / 0 FAIL** | 应用增改删、分类增删、书签新增、搜索、默认主题；与上游基线客户端对同一后端：body 配色一致、英文首页文案逐字一致 |
| `build-logs/verify-zh.cjs` | **18 PASS / 0 FAIL** | 中文首页/中文日期/应用页+表单 Modal/书签页/设置外壳+7 页签/视觉风格区块/语言控件/`<html lang>=zh-CN`/anime-light+tron 表面由主题推导 |
| reviewer `smoke.cjs`（FULL） | **55/57，0 hard FAIL** | 2 项为非硬判定的小点击区，与上游基线逐项相同 |

截图：`build-logs/screenshots/`（三主题 × 三视口、中文各页面、fallback、上游对照、anime-light+tron 组合）。

## Reviewer

**PASS**（`REVIEW.md`，独立复核 T9 + 变更范围复验 T14）

| 标准 | 判定 | 要点 |
| --- | --- | --- |
| A Flame 正常构建 | PASS | tsc 0 error；build exit 0；warning 集合 25/25 与上游逐条一致 |
| B 可用 Podman 构建镜像 | PASS | 独立 `podman build` 复现 + 新镜像实跑；产物哈希一致；构建偏差已消除 |
| C 可用 Podman 启动 | PASS | 独立 5017/5019 端口实例：HTTP 200、API 200、登录取 token |
| D 浏览器能正常访问 | PASS | 首页/标题/搜索栏 PASS；FCP 492 ms / LCP 541 ms / DCL 434 ms / CLS 0 |
| E 主要 UI 完整中文化 | PASS | 10 路由 + 11 个模态/未登录上下文全中文；残留纯拉丁文本 21 处均合理（URL 路径/16 个后端主题名/`Weather API`）；boot `<html lang>` 4/4 |
| F English 仍可用 | PASS | 7 个上下文与上游逐字一致；5 条设置路由整页文本一致 |
| G Anime Light 正常 | PASS | 配套配色 35 采样 0 FAIL（最低 **5.90:1**）；skin×theme 组合**新增失败 = 0** |
| H Anime Dark 正常 | PASS | 配套配色 0 FAIL（最低 **9.99:1**）；组合新增失败 = 0 |
| I Default Theme 未被破坏 | PASS | 构建 CSS 与上游逐规则 diff **removed 0 / changed 0**；皮肤 24 条选择器全部限定作用域且不定义 `--color-*`；Default 最低 9.47:1 |
| J 背景正常 | PASS | 插画层 + 纯色兜底层 + wash 层结构经真实控件开关验证；资源字节与源码一致 |
| K 背景资源失败有 fallback | PASS | **主动 abort 全部 svg 请求**后纯色兜底仍在，实测像素对比度 **15.07:1**；无 `color-mix` 的强制 fallback 分支全组合可读 |
| L 桌面端正常 | PASS | 1366：7 页签 / CRUD / 主题 / 背景全通过 |
| M 移动端正常 | PASS | 390 / 768 无横向溢出，中文换行正常 |
| N 原有核心功能无明显回归 | PASS | 应用/分类/书签 CRUD、搜索、7 页签、Docker Integration UI 全部 PASS |
| O reviewer 完成独立复核 | PASS | 56+ 证据文件可重跑；无 BLOCKER |

**Reviewer 发现的缺陷与处置**：F-01（MAJOR，皮肤表面色硬编码 → 与用户配色组合时不可读）**已修复并 CLOSED**（anime-light+tron 由 1.01:1 → 5.44–5.46:1，skin 引入的新增失败 = 0）；F-04（MINOR，boot 未同步 `<html lang>`）**已修复并 CLOSED**；F-02 / F-03 / NIT 判为上游既有或非阻塞。

## 修改文件

**源码（44 个已跟踪文件改动：+652 / −370）**

- i18n 层（新增）：`client/src/i18n/{index,types,en,zh-CN}.ts`、`check-keys.js`、`__tests__/*`
- i18n 接入（改）：`client/src/App.tsx`、`index.tsx`、`components/**`（Home/Header、SearchBar、Apps/*、Bookmarks/*、Settings/*（含 Themer、ThemeBuilder×3、UISettings、StyleSettings、DockerSettings、WeatherSettings、GeneralSettings+CustomQueries、AppDetails+AuthForm）、UI/*）、`store/action-creators/*`（app/auth/bookmark/config/theme）、`utility/{checkVersion,urlParser}.ts`
- 语言设置（新增）：`client/src/components/Settings/LanguageSettings/**`
- 主题皮肤（新增/改）：`client/src/styles/anime.css`、`client/src/utility/animeTheme.ts`、`client/src/components/Settings/Themer/AnimeStyle/**`、`client/src/components/Settings/Themer/Themer.tsx`、`client/src/index.css`（+1 行 `@import`）、`client/public/index.html`（+1 段 bootstrap script）
- 背景素材（新增）：`client/src/assets/backgrounds/{anime-day,anime-night}.svg`
- 构建卫生（改）：`.gitignore`（+`client/build`）、`.dockerignore`（+`build-logs`）
- **后端零改动**：`controllers/ routes/ models/ db/ middleware/ utils/ server.js api.js` 无任何文件变更
- **依赖零改动**：4 个 `package*.json` 无变更

**文档（新增）**：`AUDIT.md`、`I18N-INVENTORY.md`、`I18N-DESIGN.md`、`THEME-DESIGN.md`、`THIRD-PARTY-ASSETS.md`、`REVIEW.md`、`FINAL-REPORT.md`

**非交付物（建议不提交）**：`build-logs/**`（脚本、日志、截图、基线构建产物、预热 Dockerfile 副本）

## 已知问题

1. **全新安装的上游缺陷（非本次回归）**：空数据卷**首次**启动时 `db/migrations/01_new-config.js:5` 用 `utils/init/initialConfig.json` 覆盖 `data/config.json`，把 `utils/init/normalizeTheme.js` 刚写好的 PAB 默认主题打回主题名 `"tron"` → body 三个 CSS 变量为 `tron/undefined/undefined`、背景透明（白底）。**重启一次即恢复正常 tron（#242B33）**。后端零改动，行为与上游一致（reviewer F-02，证据 `first-boot-defect.txt`）。
2. **上游既有配色缺陷（F-03）**：内置 `white` / `cloud` 主题的 `--color-accent`（如 `#dddddd`）被 `Message.module.css:6,21` 用作行内链接色 → 浅底 1.14–1.99:1。**在 Default 皮肤下逐条复现**，非本次引入；皮肤侧「新增失败 = 0」。
3. **上游既有外部请求**：`client/src/utility/checkVersion.ts:8` 每次加载请求 `raw.githubusercontent.com`（未新增、未修改；版本号相同故不触发提示）。
4. **静态 HTML 文案**：`client/public/index.html` 的 `<title>Flame</title>`、`<meta description>`、`<noscript>` 未本地化（brand / 非 UI / 无 JS 兜底），已在 `I18N-DESIGN.md §9.4` 登记。
5. **后端返回的英文错误文案**（`Invalid credentials`、`Unauthorized` 等）在前端原样展示，本阶段未改后端（14 类，已登记）。
6. **语言切换入口需登录**：切换器位于 `/settings/interface`（上游该页签 `authRequired: true`）；未登录用户依赖浏览器语言自动判定（`zh*` → 中文，其他 → 英文），启动时已同步 `<html lang>`。
7. **冷启动受保护路由会重定向**：直接打开 `/settings/general` 会落到 `/settings/app`（`autoLogin` 异步，首帧未认证即被 `ProtectedRoute` 重定向）——上游行为，已与基线客户端对照确认一致。
8. **镜像内含新增文档与 sourcemap**：`AUDIT.md` 等 5 个 md（约 190 KB）与 js/css `.map` 会进入镜像（`COPY . .` 语义），sourcemap 上游基线同样可下载；不视为回归。
9. **NIT（均与上游一致，未改）**：新增应用后 Modal 不自动关闭；搜索栏仅在 keyup 更新；`Weather API` 保留英文。

## 后续建议

1. `db/migrations/01_new-config.js` 覆盖 `defaultTheme` 属上游缺陷，建议向上游反馈；本项目为保持后端零改动未修复（如需本地修复，最小做法是在迁移流程结束后重跑 `normalizeTheme()`）。
2. `white` / `cloud` 的 accent 链接对比度建议单列一个可选上游补丁，不要混入本阶段最小 diff。
3. 若后续需要用户自定义背景图，沿用现有 `data-theme` / `flame.style` / `flame.bg` 契约扩展（仅本地上传，禁止远程 URL）。
4. 可将语言选择器同时放到 `/settings` 主题页（无需登录），提升未登录用户切换便利性。
5. 建议提交拆分（保持可读历史与上游同步友好）—— **已按此落地**（分支 `feature/zh-anime`，6 个 commit，工作树干净，仅 `build-logs/` 有意保持未跟踪）：

| commit | 说明 |
| --- | --- |
| `bc4bdaa` | `chore: ignore build artifacts and local build logs` |
| `c335995` | `feat(i18n): add lightweight zh-CN/English language layer` |
| `ea2573f` | `feat(i18n): localize the full user-facing UI` |
| `f8ff482` | `feat(theme): add original local anime background artwork` |
| `e75f80d` | `feat(theme): add anime light/dark visual skins` |
| `1bbd977` | `docs: add audit, i18n/theme design, third-party asset and review records`（本报告自身在随后一次 `docs: finalize phase-1 report` 中定稿） |

相对上游 `3e03c25`：**66 个文件，+4715 / −370**（其中源码 44 个文件 +652/−370，其余为新增 i18n/主题/素材与文档）。git 身份使用仓库级 `Flame-ZH <flame-zh@localhost>`（未修改用户全局配置）。
