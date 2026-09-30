# Flame 上游审计报告（共享任务 T1）

- 审计者：auditor（T1 owner）
- 审计时间：2026-09-29 14:26–14:40 UTC
- 审计对象：`$HOME/Flame`（上游 `pawelmalak/flame`，以 `HEAD` 已跟踪内容为准）
- 审计方式：**纯只读**（read/grep/`git` 只读命令 + 只读静态扫描脚本，脚本放在 `/tmp/flame-audit/`，未写入仓库）
- 本任务写入范围：仅 `AUDIT.md`（本文件）。未修改任何源码、未执行 `npm install`/`npm run build`、未引入任何依赖。
- 行号约定：所有 `文件:行号` 均基于 `HEAD = 3e03c25138df4321143c4fbd1a99468ff375ebb2` 的已跟踪内容。

---

## 1. Repository / Branch / Commit / Upstream remote / working tree 状态

| 项目 | 复核结果 | 证据 |
|---|---|---|
| 远程 | `origin = https://github.com/pawelmalak/flame.git`（fetch/push） | `git remote -v` |
| 分支 | `master`，跟踪 `origin/master` | `git branch -vv` |
| HEAD commit | `3e03c25138df4321143c4fbd1a99468ff375ebb2`（Merge PR #488 `fix/sqlite-crash`） | `git rev-parse HEAD`；`git log --oneline -3` |
| HEAD 与 tag 关系 | **HEAD 不是 v2.4.0 tag**：`v2.4.0` 指向父提交 `069b669`，`git describe` = `v2.4.0-2-g3e03c25`，即 HEAD 比 v2.4.0 多 2 个提交 | `git describe --tags --always`；`git log --oneline -3 --decorate`（`069b669 (tag: v2.4.0)`） |
| 版本号 | `2.4.0`（`.env:3` `VERSION=2.4.0`；`client/.env:1` `REACT_APP_VERSION=2.4.0`） | `.env:3`、`client/.env:1` |
| 发布日志日期 | CHANGELOG 记为 `2026-04-24`（任务书写的是 2026-04-25，**予以纠正**） | `CHANGELOG.md:1` |
| working tree | **审计期间并非 clean（任务书基线需纠正）**：14:26 观测到 ` M client/package-lock.json`（+35/−70）；14:34 再观测已恢复，但变为 ` M .gitignore` 与 `?? build-logs/`。HEAD 全程未变。属于 Lead/并行成员在进行基线构建与证据留存 | 14:26 `git status --porcelain` → ` M client/package-lock.json`；14:34 复测 → ` M .gitignore`、`?? build-logs/`；`git diff .gitignore`（新增第 5 行 `client/build`）；`ls build-logs/`（`baseline-build/`、`review-evidence/`） |
| 结论 | commit 级基线可信且已核对；**"working tree clean"不成立**，本报告的源码结论只依赖已跟踪文件，不受上述并发改动影响（改动均未触及 `client/src/**`、`controllers/**`） | 同上 |

> 说明：审计期间工作区被其他成员并发修改（`.gitignore`、`build-logs/`），这属于共享工作目录的正常现象；已确认没有任何成员修改 `client/src/**` 或后端源码。

---

## 2. 目录结构与前后端职责边界

### 2.1 后端（Node/Express，仓库根）

| 路径 | 职责 | 证据 |
|---|---|---|
| `server.js` | 进程入口：加载 `.env`、`initApp()`、`connectDB()`、`associateModels()`、定时任务、创建 http server 并挂载 Express app + WebSocket | `server.js:1-2,5-17,19-41`（PORT 默认 5005 见 `server.js:20`） |
| `api.js` | Express 应用装配：静态目录、SPA 回退、JSON 解析、8 个 API 路由、错误处理 | `api.js:5-12`（静态 `public`、`/uploads`、SPA 回退）、`api.js:15`、`api.js:18-25`、`api.js:28` |
| `routes/*.js` | 8 个路由文件：`apps/auth/bookmark/category/config/queries/themes/weather`，负责方法+鉴权中间件装配 | `api.js:18-25`；`routes/apps.js:16-27`、`routes/config.js:14,16`、`routes/themes.js:14-27` |
| `controllers/**` | 业务逻辑，按域分目录：`apps/`（含 `apps/docker/`）、`auth/`、`bookmarks/`、`categories/`、`config/`、`queries/`、`themes/`、`weather/`；每个目录有 `index.js` 汇总导出 | `controllers/apps/index.js:1-8`、`controllers/config/index.js:1-6`、`controllers/themes/index.js:1-6` |
| `models/**` | Sequelize 模型：`App/Bookmark/Category/Config/Weather` + `associateModels.js` | `models/Config.js:4-28`、`models/associateModels.js:4-13`；`models/` 下**没有** `Theme.js` |
| `db/**` | SQLite 连接与迁移：`sequelize` dialect `sqlite`，storage `./data/db.sqlite`；umzug 迁移 6 个 | `db/index.js:10-14`、`db/index.js:16-25`、`db/index.js:27-46`；`db/migrations/00_initial.js:4-176`、`db/migrations/05_app-description.js:4-10` |
| `middleware/**` | `asyncWrapper/auth/errorHandler/multer/requireAuth/requireBody` 汇总导出；`auth` 解 JWT 并设置 `req.isAuthenticated` | `middleware/index.js:1-7`、`middleware/auth.js:4-21`、`middleware/requireAuth.js:3-9`、`middleware/multer.js:4-29` |
| `utils/**` | 文件读写（`File.js`）、配置读写（`loadConfig.js`）、初始化（`utils/init/*`）、定时任务（`jobs.js`）、日志、JWT、天气抓取 | `utils/File.js:3-26`、`utils/loadConfig.js:5-16`、`utils/init/index.js:7-13`、`utils/jobs.js:9-38` |
| `Socket.js` / `Sockets.js` | `ws` WebSocket 服务 + 命名 socket 注册表（仅 `weather`） | `Socket.js:5-21`、`Sockets.js:1-19`、`server.js:33-34` |
| `data/`、`public/` | 运行时目录：`data/config.json`、`data/themes.json`、`data/db.sqlite`、`data/uploads/`、`public/flame.css`；**均被 gitignore** | `.gitignore:2-3`；`utils/init/initConfig.js:9`、`controllers/themes/getThemes.js:8`、`db/index.js:12`、`middleware/multer.js:4-6` |
| `.dev/`、`.docker/`、`k8s/`、`skaffold.yaml` | 构建/开发/部署资产（非产品运行时） | `.docker/`（4 文件）、`.dev/`（6 文件）、`k8s/base/*`（6 文件）、`skaffold.yaml:1-65` |

### 2.2 前端（`client/`，CRA）

- 组件分层：页面级（`Home/Apps/Bookmarks/Settings`）→ 域组件（`Apps/*`、`Bookmarks/*`）→ 原子 UI（`components/UI/*`，经 `components/UI/index.ts:1-17` 统一导出）→ 容器/路由（`components/UI/Layout/Layout.tsx:8-10`、`components/Routing/ProtectedRoute.tsx`）。
- 状态：Redux + thunk，`store/actions`（action 类型）↔ `store/action-creators`（异步副作用）↔ `store/reducers`；统一出口 `store/index.ts:1-2`。
- 工具层：`utility/*`（解析、模板、localStorage 配置、主题 PAB 互转），统一出口 `utility/index.ts:1-16`；类型：`interfaces/*`（`interfaces/index.ts:1-12`）、`types/*`。

### 2.3 边界要点（对后续改造有实际影响）

1. **后端所有数据路径都是相对路径，进程必须从仓库根启动**：`api.js:8-9`（`__dirname` 拼接除外）、`db/index.js:12`（`./data/db.sqlite`）、`utils/loadConfig.js:12`、`utils/init/initConfig.js:9,11,22`、`controllers/themes/getThemes.js:8`、`middleware/multer.js:4-6`。从其他 cwd 启动会读写错误的 `data/`。
2. **持久化分三层，改造时不要混用**：SQLite（apps/bookmarks/categories/weather，`db/index.js:10-14`）、`data/config.json`（配置，`utils/loadConfig.js:12`）、`data/themes.json`（主题，`controllers/themes/getThemes.js:8`）。
3. `models/Config.js` 是**历史遗留**：当前配置读写完全不经过它，只有迁移 `01_new-config.js` 引用 | `db/migrations/01_new-config.js:2,10`；grep 全仓仅此一处引用 `require('../../models/Config')`。

---

## 3. 前端技术栈与版本、构建脚本清单

### 3.1 实际安装版本（从 `node_modules/*/package.json` 读取，非范围号）

后端：`express 4.18.2`、`sequelize 6.9.0`、`sqlite3 6.0.1`、`ws 8.13.0`、`umzug 2.3.0`、`axios 0.24.0`、`jsonwebtoken 8.5.1`、`docker-secret 1.2.4`、`multer 1.4.3`、`node-schedule 2.0.0`、`@kubernetes/client-node 0.15.1`、`dotenv 10.0.0`、`concurrently 6.3.0`（声明见 `package.json:19-37`）。

前端：`react 17.0.2`、`react-dom 17.0.2`、`react-scripts 5.0.1`、`typescript 4.4.4`、`react-redux 7.2.6`、`redux 4.1.2`、`react-router-dom 5.2.0`、`axios 0.24.0`、`@mdi/js 6.4.95`、`@mdi/react 1.5.0`、`skycons-ts 0.2.0`、`external-svg-loader 1.3.4`、`jwt-decode 3.1.2`、`web-vitals 2.1.2`（声明见 `client/package.json:5-33,59-61`）。

工具链：node `v22.22.1`、npm `9.2.0`（实测 `node -v` / `npm -v`）。CSS 方案：CSS Modules（`*.module.css` 共 36 个）+ 1 个全局 `client/src/index.css`；无预处理器、无 PostCSS/Babel 自定义配置（仓库内不存在 `.eslintrc*`/`eslint.config.*`/`.babelrc*`/`postcss.config*`）。

TypeScript 配置：`client/tsconfig.json:2-25`，`strict: true`（:13）、`noEmit: true`（:20）、`jsx: "react-jsx"`（:21）、`include: ["src"]`（:23-25）。

### 3.2 构建脚本清单（"真实存在"以 package.json 为准）

| 位置 | script | 内容 | 是否存在 |
|---|---|---|---|
| 根 | `start` | `node server.js` | 存在 `package.json:7` |
| 根 | `init-server` / `init-client` / `dir-init` / `dev-init` / `dev-server` / `dev-client` / `dev` / `skaffold` | 见左 | 存在 `package.json:8-15` |
| 根 | `build` / `lint` / `typecheck` / `test` | — | **不存在**（`package.json:6-16` 无这些键） |
| client | `start` | `react-scripts start` | 存在 `client/package.json:36` |
| client | `build` | `react-scripts build` | 存在 `client/package.json:37` |
| client | `test` | `react-scripts test` | 存在 `client/package.json:38`，但**仓库内无任何测试文件**（`*.test.*`/`*.spec.*` 全仓 0 个） |
| client | `eject` | `react-scripts eject` | 存在 `client/package.json:39` |
| client | `lint` / `typecheck` | — | **不存在**（`client/package.json:35-40` 仅 4 个 script） |

**CRA 隐含行为（必须写进 T2/T9 的验证口径）**：没有独立 `lint`/`typecheck` script 时，ESLint 与 TypeScript 检查由 `react-scripts` 内置：
- ESLint 配置内联在 `client/package.json:41-46`（`extends: react-app, react-app/jest`），`react-scripts 5.0.1` 在 `start`/`build` 时执行 ESLint（warning 不阻断，`CI=true` 时 warning 视为 error）。
- 类型检查由 `fork-ts-checker-webpack-plugin` 在 `react-scripts start/build` 内执行（配置受 `client/tsconfig.json` 约束）；由于 `noEmit: true`（`client/tsconfig.json:20`），单独跑 `npx tsc -p client/tsconfig.json --noEmit` 是等价的纯类型门禁，但**当前没有对应 script**，只能手动调用。
- 无 Prettier script；格式规则来自 `.prettierrc:1-8`（`singleQuote`、`printWidth: 80`、`trailingComma: es5`），`.prettierignore:1-2` 忽略 `*.md` 与 `docker-compose.yml`。**大量重排格式会毁掉最小 diff，改造必须遵守该配置**。

---

## 4. Dockerfile 家族、构建入口与 Podman 构建可行性（仅评估，不修改）

### 4.1 文件与入口清单

| 文件 | 用途/关键内容 | 证据 |
|---|---|---|
| `.docker/Dockerfile` | 主镜像：`node:20-alpine` 两阶段；builder 安装 `python3 make g++` 编译 sqlite3，`npm install --production`；构建前端后 `mv ./client/build/* ./public` 并 `rm -rf ./client`；运行阶段 `CMD sh -c "chown -R node /app/data && node server.js"`，`EXPOSE 5005`，`ENV NODE_ENV=production`、`PASSWORD=flame_password` | `.docker/Dockerfile:1-18`、`:20-31` |
| `.docker/Dockerfile.multiarch` | 与主 Dockerfile 逐行等价（唯一差异：`:10` `COPY . .    ` 行尾空格），配合 `buildx --platform` 出多架构 | `.docker/Dockerfile.multiarch:1-31` |
| `.docker/Dockerfile.dev` | skaffold/dev 镜像：先把 `./client` 构建成 `/app/build` → `./public`，再 `npm install`（含 devDeps），`CMD npm run skaffold` | `.docker/Dockerfile.dev:1-26` |
| `.docker/docker-compose.yml` | compose 示例：`image: pawelmalak/flame`、`/path/to/host/data:/app/data`、可选 `/var/run/docker.sock`（`:9`）、`PASSWORD`（`:15`）、可选 docker secrets（`:12-13,16,19-22`） | `.docker/docker-compose.yml:1-22` |
| `skaffold.yaml` | 3 个 profile（默认/`dev`/`shokohsc`/`prod`），kustomize 部署 `k8s/base` 或 `k8s/overlays/shokohsc` | `skaffold.yaml:1-65` |
| `k8s/base/*` | Deployment（`image: shokohsc/flame`、`containerPort 5005`、readinessProbe `/`、`fsGroup: 1000`）、service/ingress/rbac/namespace/kustomization | `k8s/base/deployment.yaml:14-28`、`k8s/base/kustomization.yaml:1-9` |
| `.dev/build_dev.sh` / `build_latest.sh` / `build_multiarch.sh` | 上游维护者脚本，硬编码 `docker build` / `docker buildx build` | `.dev/build_dev.sh:1`、`.dev/build_latest.sh:1-2`、`.dev/build_multiarch.sh:1-6` |
| `.dockerignore` | 排除 `node_modules`、`.github`、`public`、`k8s`、`skaffold.yaml`、`data` | `.dockerignore:1-6` |

**上游自身的不一致（事实陈述，非改造建议）**：`skaffold.yaml` 引用的 `Dockerfile.dev`（`:14,31,41`）与 `Dockerfile`（`:58`）位于**仓库根**，而实际文件在 `.docker/` 下；因此 `skaffold.yaml` 按现状无法直接构建成功。证据：`skaffold.yaml:14,31,41,58` vs `.docker/Dockerfile.dev:1`、`.docker/Dockerfile:1`。

### 4.2 本机 Podman 构建可行性（静态评估）

环境实测：`podman 5.7.0`（rootless=true、OCIRuntime=crun）、`docker` **不存在**（`command not found`）、`getenforce` 不存在（无 SELinux 工具链）、`node v22.22.1`、`npm 9.2.0`。

| 评估项 | 结论 | 依据 |
|---|---|---|
| 多阶段构建 | 兼容：`.docker/Dockerfile` 仅使用 `FROM ... AS builder` 与 `COPY --from=builder`，无 `RUN --mount=`、无 heredoc、无 `ARG` 平台魔术，均为 Buildah 支持的经典语法 | `.docker/Dockerfile:1,20-22` |
| 构建入口 | `podman build -f .docker/Dockerfile .`（在仓库根执行）是等价入口；`podman buildx` **不存在**，多架构需 `podman build --platform linux/amd64,linux/arm64` | `.docker/Dockerfile:1`；`.dev/build_multiarch.sh:1-6` 使用 `docker buildx` |
| 依赖编译 | 无风险：builder 内 `apk add python3 make g++` 编译 `sqlite3` 原生模块，与运行 rootless 无关 | `.docker/Dockerfile:7-8`；`package.json:31` |
| 上下文 | `.dockerignore:3` 排除 `public`，因此运行时 `public/` 不会被镜像内既有内容覆盖；构建期 `mkdir -p ./public ./data`（`.docker/Dockerfile:12`）保证目标目录存在 | `.docker/Dockerfile:12-18`、`.dockerignore:1-6` |
| 根运行阶段风险点 | 唯一需要注意：`CMD` 内的 `chown -R node /app/data`（`.docker/Dockerfile:31`）。rootless 下若把宿主机目录 bind-mount 到 `/app/data` 且该目录不属于调用者 UID（映射进 userns 的范围），`chown` 会失败；使用具名卷或确保宿主目录归调用者所有即可。这是运行期挂载语义，**与 Flame 的 Docker Integration 功能无关** | `.docker/Dockerfile:31`；`.docker/docker-compose.yml:7-9` |
| SELinux | 本机无 `getenforce`/SELinux 工具，无需 `:z` 重标记 | 实测 `getenforce` → not found |
| 结论 | **Podman 可用于本项目的镜像构建**（用于开发/验证运行时）；不改动任何构建产物路径、不改动任何 Docker Integration 代码。README 的 `docker` 命令（`README.md:24-31,38,44-52`）与 `.dev/*.sh` 中的 `docker`/`docker buildx` 在无 Docker CLI 的机器上不会直接可执行 | `README.md:24-31,44-52`、`.dev/build_*.sh:1` |

> 明确边界：Podman 只是本机的开发/构建运行时。**不做任何"为适配 Podman 而修改 Flame Docker Integration"的改动或建议**（见第 9 节）。

---

## 5. 用户可见文本全量热区清单（T2 输入）

统计方式：只读扫描 `client/src/**/*.{ts,tsx}`，采集 ①JSX 文本节点（含跨行）②UI 属性字面量（`text/title/message/placeholder/label/header/description/alt/subtitle`）③通知对象 `title/message` 文案。计数为**候选文本行数**（同一行多段算 1 行，属性名如 `name="x"` 未计入），属估算上界。合计：**37 个文件、约 341 条候选行**；加上非组件来源（§5.3）后，本阶段需处理的文本条目约 **370+**。

### 5.1 按文件（降序，含具体行号）

| 文件（`client/src/` 前缀省略） | 估算条数 | 行号 |
|---|---|---|
| `components/Settings/UISettings/UISettings.tsx` | 50 | 61,64,68,69,76,79,82,86,87,93,96,100,101,106,114,118,119,125,128,132,133,139,142,146,147,153,156,160,161,167,171,172,184,188,189,193,198,202,203,207,211,214,217,221,222,228,231,235,236,240 |
| `components/Settings/GeneralSettings/GeneralSettings.tsx` | 35 | 87,90,93,97,98,99,104,108,112,116,117,123,126,130,131,136,140,144,148,149,156,160,164,165,170,172,175,194,198,213-214,221,225,229,230,234,238 |
| `components/Bookmarks/Form/BookmarksForm.tsx` | 27 | 75,76,99,100,115,116,161,164,166,175,178,180,189,191,197,212,215,217,222,232,238,241,253,260,263,267,268 |
| `components/Apps/AppForm/AppForm.tsx` | 26 | 62,63,110,113,115,124,127,129,138,141,143,148,156,159,161,167,177,183,186,199,206,209,213,214,219,221 |
| `components/Settings/WeatherSettings/WeatherSettings.tsx` | 26 | 47,48,60,61,66,100,103,107,108,113,122,125,129,137,143,147,156,159,162,166,167,173,176,180,181,185 |
| `store/action-creators/bookmark.ts` | 14 | 66,67,95,96,128,129,152,153,179,180,206,207,247,248 |
| `components/Settings/DockerSettings/DockerSettings.tsx` | 18 | 59,62,66,67,75,78,82,83,90,94,98,99,104,107,110,114,115,119 |
| `store/action-creators/app.ts` | 8 | 59,60,83,84,110,111,139,140 |
| `components/Settings/AppDetails/AuthForm/AuthForm.tsx` | 12 | 54,58,75,80,83,89,90,91,92,93,97,105 |
| `components/Settings/Themer/ThemeBuilder/ThemeCreator.tsx` | 11 | 95,98,100,109,112,121,124,133,136,146,148 |
| `components/Settings/GeneralSettings/CustomQueries/QueriesForm.tsx` | 10 | 75,78,80,88,91,93,101,104,106,113 |
| `store/action-creators/theme.ts` | 5 | 61,62,71,94,95 |
| `components/Bookmarks/Form/CategoryForm.tsx` | 7 | 72,75,77,85,88,92,93,97 |
| `store/action-creators/config.ts` | 3 | 61,62,111 |
| `components/Bookmarks/Bookmarks.tsx` | 6 | 146,151,156,161,167,177 |
| `components/Settings/Themer/Themer.tsx` | 6 | 69,76,83,85,88,100 |
| `components/Settings/AppDetails/AppDetails.tsx` | 5 | 20,28,35-37,47,51 |
| `components/Settings/StyleSettings/StyleSettings.tsx` | 5 | 45,46,55,58,64 |
| `components/Apps/AppTable/AppTable.tsx` | 6 | 47,48,67,93,97,106,136 |
| `components/Apps/Apps.tsx` | 4 | 81,82,88,95 |
| `components/Bookmarks/Table/CategoryTable.tsx` | 6 | 53,54,74,101,105,114,142 |
| `components/Bookmarks/Table/BookmarksTable.tsx` | 8 | 54,55,78,109,124,126,127,128,129,160 |
| `components/Home/Home.tsx` | 5 | 77,110,111-112,119,142 |
| `utility/checkVersion.ts` | 4 | 18,19,26,27 |
| `components/Apps/AppGrid/AppGrid.tsx` | 3 | 19,34,41 |
| `components/Bookmarks/BookmarkGrid/BookmarkGrid.tsx` | 3 | 29,50,57 |
| `components/Settings/GeneralSettings/CustomQueries/CustomQueries.tsx` | 3 | 41,42,45,69,95 |
| `components/Settings/Themer/ThemeBuilder/ThemeBuilder.tsx` | 2 | 76,86 |
| `store/action-creators/auth.ts` | 1 | 77 |
| `App.tsx` | 2 | 47,48 |
| `components/SearchBar/SearchBar.tsx` | 2 | 85,86 |
| `components/Home/Header/Header.tsx` | 1 | 42（"Go to Settings"） |
| `components/Settings/Settings.tsx` | 1 | 38 |
| `components/UI/Spinner/Spinner.tsx` | 1 | 6（"Loading..."） |
| `components/Home/Header/functions/greeter.ts` | 2 | 7（4 段问候语模板）、14（`Hello!`） |
| `components/Home/Header/functions/getDateTime.ts` | 18 | 5-11（7 个星期名）、15-26（12 个月名） |
| `components/Settings/Themer/ThemeBuilder/ThemeEditor.tsx` | 2 | 33（confirm）、40（表头数组 `['Name','Actions']`） |
| `utility/urlParser.ts` | 1 | 14（`Run Steam App`） |
| `utility/templateObjects/configTemplate.ts` | 3 | 8,27,28-30 |
| `utility/templateObjects/settingsTemplate.ts` | 3 | 15,16,17-18 |

### 5.2 无硬编码文本的组件（纯 props/children 容器，必须在**调用点**本地化）

`components/Apps/AppCard/AppCard.tsx`（`app.name`/`app.description`/`alt` 由数据驱动，`:27,56,57`）、`components/Bookmarks/BookmarkCard/BookmarkCard.tsx`（`:45,64,98`）、`components/NotificationCenter/NotificationCenter.tsx`（`:19-25`）、`components/UI/Modal/Modal.tsx`、`components/UI/Notification/Notification.tsx`、`components/UI/Forms/InputGroup/InputGroup.tsx`、`components/UI/Forms/ModalForm/ModalForm.tsx`、`components/UI/Headlines/Headline/Headline.tsx`、`components/UI/Headlines/SectionHeadline/SectionHeadline.tsx`、`components/UI/Headlines/SettingsHeadline/SettingsHeadline.tsx`、`components/UI/Tables/Table/Table.tsx`（`headers` prop，`:15-19`）、`components/UI/Tables/CompactTable/CompactTable.tsx`（`:15-17`）、`components/UI/Text/Message/Message.tsx`（children）、`components/UI/Buttons/Button/Button.tsx`（children）、`components/UI/Buttons/ActionButton/ActionButton.tsx`、`components/Actions/TableActions.tsx`（纯图标）、`components/UI/Icons/*`、`components/Home/Header/Header.tsx`（`greeter()`/`getDateTime()` 产出）、`components/Widgets/WeatherWidget/WeatherWidget.tsx`（数值+单位 `°C/°F/%`，`:72-78`）。

### 5.3 非组件文本来源（易漏项）

| 来源 | 内容 | 证据 |
|---|---|---|
| `components/Settings/settings.json` | 7 个设置页签名：Theme/General/Interface/Weather/Docker/CSS/App（渲染于 `Settings.tsx:42-52`，`{name}`:50） | `settings.json:1-39`；`Settings.tsx:27,30-34,42-52` |
| `utility/searchQueries.json` | 12 个搜索提供方名称（Deezer/Disroot/DuckDuckGo/Google/IMDb/Local search/Reddit/Spotify/The Movie Database/Tidal/Wikipedia/YouTube），渲染进下拉框 | `searchQueries.json:1-40+`；`GeneralSettings.tsx:179-184,202-207`（`{query.name}`） |
| 主题名 | 16 个内置主题名（blackboard…mint），渲染于 `ThemePreview.tsx:35`；用户自定义主题名由用户输入 | `utils/init/themes.json:2-…`、`utils/init/initialFiles.json:42-186`、`ThemePreview.tsx:35` |
| `client/public/index.html` | `lang="en"`（`:2`）、meta description（`:51-54`）、`<title>Flame</title>`（`:56`）、noscript 文案（`:59`） | 同左 |
| `client/public/robots.txt` | `User-agent: *` / `Disallow: /` | `robots.txt:1-2` |
| 后端默认值 | `initialConfig.json:6`（customTitle）、`:25-27`（greetings/day/month schema）、`:29`（defaultTheme） | `utils/init/initialConfig.json:6,25-29` |
| 运行时 UI 标题 | `document.title = config.customTitle`（`config.ts:35`）、保存后再设置（`UISettings.tsx:42`） | 同左 |
| 版本提示 | `checkVersion.ts:19,27` 两条通知；其判定基准是**上游** `client/.env`（`:8`） | `checkVersion.ts:7-9,15-29` |

### 5.4 对 T2 的风险提示（来自文本形态本身）

1. **嵌套插值文案**：`Field cannot be empty: ${field}`（`AppForm.tsx:63`、`BookmarksForm.tsx:76`）把内部字段名（`name/url/icon`）拼进提示；`App ${name} ${status}`（`app.ts:60`）、`Category ${name} ${status}`（`bookmark.ts:129`）依赖外部传入的英文 `status`（`created/updated/deleted`）。这类串需要"参数化 + 枚举值字典"，不能整句替换。
2. **confirm 弹窗文案**：4 处 `window.confirm`（`BookmarksTable.tsx:78`、`AppTable.tsx:67`、`CategoryTable.tsx:74`、`ThemeEditor.tsx:33`），其中 `CategoryTable.tsx:74` 是长句（含 `ALL assigned bookmarks`）。
3. **重复的 True/False**：约 20 处 `<option value={1}>True</option>/<option value={0}>False</option>`（如 `UISettings.tsx:86,87,100,101,118,119,132,133,146,147,221,222,235,236`、`GeneralSettings.tsx:116,117,130,131,148,149,164,165,229,230`、`DockerSettings.tsx:82,83,98,99,114,115`），适合统一 `t('common.true')`。
4. **placeholder 与后端默认值同源**：`UISettings.tsx:172,189,203` 的 placeholder 与 `initialConfig.json:25-27` 的默认 schema 语义相同，翻译 placeholder 会造成"UI 暗示中文、后端仍写英文"的漂移；建议二者一起处理或明确"自定义内容优先于语言包"。
5. **日期/时间拼装**：`getDateTime.ts:40-47` 用数组下标 + 固定顺序拼接（美式/非美式两分支，`:31,39-47`），中文（或日文）顺序与分隔符不同，i18n 必须替换拼装逻辑而非只翻数组。
6. **表头数组**：`AppTable.tsx:106`、`BookmarksTable.tsx:124-129`、`CategoryTable.tsx:114`、`CustomQueries.tsx:69`、`ThemeEditor.tsx:40`。
7. **动作按钮名**：`Apps.tsx:88,95`、`Bookmarks.tsx:151,156,161,167` 通过 `ActionButton name=` 传入英文，属组件间契约，需在调用点翻译。

---

## 6. Theme 系统机制（关键结论）与冻结决策的独立可行性判定

### 6.1 精确机制（逐环证据）

1. **主题 = `body` 上 3 个 CSS 变量**：`client/src/index.css:43-53` 定义 `--color-background:#242b33`、`--color-primary:#effbff`、`--color-accent:#6ee2ff`（`:44-46`），`background-color: var(--color-background)` + `transition: background-color 0.3s`（`:49-50`）。同处还有第 4 个变量 `--spacing-ui: 10px`（`:47`），**不参与主题、不被 setTheme 写入**，全仓库 CSS 仅 `Home.module.css:7,8` 使用。
2. **变量由 `setTheme` 写入 `document.body.style`（即内联样式）+ `localStorage`**：
   - `theme.ts:19`：`localStorage.setItem('theme', parseThemeToPAB(colors))`（`remeberTheme` 默认 `true`，`:16`）；
   - `theme.ts:22-24`：`for (const [key, value] of Object.entries(colors)) document.body.style.setProperty('--color-' + key, value)` → **恰好写 3 个内联自定义属性**；
   - `theme.ts:26-29`：dispatch `setTheme` 更新 redux。
   - `ThemeColors` 就是 3 个 key：`interfaces/Theme.ts:1-5`（`background/primary/accent`）。
3. **PAB 格式**：`primary;accent;background`（注释见 `utility/parseTheme.ts:3`；解析 `:4-12`，序列化 `:14-20`）。注意 PAB 顺序与变量名顺序无关，靠对象 key 映射。
4. **启动注入链**：`App.tsx:58-60` 若 `localStorage.theme` 存在 → `parsePABToTheme` → `setTheme`；`App.tsx:72-76` 若无则将后端 `config.defaultTheme`（已是 PAB，见第 6 点）应用为初始主题。`App.tsx:55` 同时拉取主题列表。
5. **Redux 初值也读 localStorage**：`reducers/theme.ts:13-15` 用 `localStorage.theme`，否则硬编码 `'#effbff;#6ee2ff;#242b33'`（PAB，与 `index.css:44-46` 一致）；`:35-43` 处理 `setTheme`。
6. **主题数据来源（纠正任务书：不是 SQLite）**：`GET /api/themes`（`routes/themes.js:14-16`）→ `controllers/themes/getThemes.js:7-14` 读 `data/themes.json`（`:8`），经 `utils/File.js:9-17/19-25` 读写；`data/` 被 gitignore（`.gitignore:2`）。内置主题模板在 `utils/init/initialFiles.json:31-190`（16 条，`:42-186`），由 `utils/init/initFiles.js:4-6` + `createFile.js:13-25` 落盘；`utils/init/themes.json` 是**第二份完全相同**的 16 条副本（实测两份 names 完全一致，16/16），被 `normalizeTheme.js:9-13` 用于把 `config.defaultTheme` 的主题名解析成 PAB 字符串并回写 `data/config.json`（`:15-24`）。默认 `defaultTheme: "tron"`（`utils/init/initialConfig.json:29`；前端模板 `configTemplate.ts:32`、`settingsTemplate.ts:52`），tron 的颜色与默认 3 变量一致（`initialFiles.json:106-114`）。
7. **前端展示与切换**：`Themer.tsx:76-77`（App themes）→ `ThemeGrid.tsx:12-21` → `ThemePreview.tsx:14-37`，**点击即 `setTheme(colors)` 并写 localStorage**（`ThemePreview.tsx:20`，默认 `remeberTheme=true`）；用户主题 CRUD 走 `POST/PUT/DELETE /api/themes`（`theme.ts:46-128`、`routes/themes.js:17-27`）。
8. **主题被非 CSS 消费者使用**：`WeatherIcon.tsx:13,21,29` 用 `activeTheme.colors.accent` 作为 Skycons 画布颜色，并在 accent 变化时重绘 → 3 变量必须继续承载"语义色"。

### 6.2 对冻结决策 A：**"上游 3 变量主题机制不动" → 确认可行（支持）**

证据支撑：3 变量是上游唯一的主题通道（`interfaces/Theme.ts:1-5`）；注入方式单一（`theme.ts:19-24`）；主题持久化只依赖 localStorage key `'theme'`（`theme.ts:19`、`reducers/theme.ts:13-14`、`App.tsx:58-59`）；后端只存 name+colors（`controllers/themes/getThemes.js:8-14`）。冻结它不会挡住新增皮肤/背景，也不会破坏 Default（默认值在三处一致：`index.css:44-46`、`reducers/theme.ts:15`、`initialConfig.json:29` + `initialFiles.json:106-114`）。

### 6.3 对冻结决策 B：**"新增独立视觉皮肤 `data-theme`（default / anime-light / anime-dark）" → 有条件确认（可行，但有一条硬约束必须遵守；若越界则需反驳）**

**硬约束（最重要的一条）**：`setTheme` 把 3 个变量写成 `<body>` 的**内联样式**（`theme.ts:22-24`）。样式表中的 `body[data-theme="anime-dark"] { --color-background: … }` 会被内联样式覆盖（作者内联 > 作者选择器，除非样式表声明带 `!important`）。当前仓库**没有任何 `!important`**（`client/src/**/*.css` grep 命中 0），也没有任何属性选择器（`[data-` grep 命中 0），所以：

| 皮肤形态 | 可行性 | 说明与证据 |
|---|---|---|
| **P1（推荐）皮肤只改"非 `--color-*`"的视觉**（背景图/纹理/字体/圆角/阴影/透明度/动效），并把属性挂在 `document.documentElement`（`html`）上 | ✅ 完全可行，**零改上游主题文件** | 不与内联样式冲突；`html[data-theme=…] xxx` 作用域清晰；`data-theme="default"` 或属性缺省时无任何规则 → **原版 100% 可恢复**。当前 body 背景由 `index.css:49` 控制，Modal `z-index:100`（`Modal.module.css:7`）、NotificationCenter `z-index:500`（`NotificationCenter.module.css:6`）是唯一层级占用，皮肤装饰层必须低于 100 |
| **P2a 皮肤需要"改色"**：用 `body[data-theme=…]{--color-*: … !important}` 覆盖 | ⚠️ 技术可行但有语义代价 | 作者样式表的 `!important` 能胜过非 `!important` 内联样式，因此能覆盖；但皮肤开启时**用户选择的 3 变量主题将不可见**（`ThemePreview.tsx:20` 的切换会"点了没反应"），必须同时在切主题或选 `default` 时清除皮肤属性。属于"可用但需明示的降级"，且引入了全仓首个 `!important` |
| **P2b 皮肤需要"改色"**：在 `setTheme` 内合并皮肤色 | ❌ 与冻结决策 A 冲突 | `theme.ts:15-30` 是被冻结的文件；改它即"主题机制被改"，且 `reducers/theme.ts:13-15`、`App.tsx:58-60/72-76` 都要跟着改 |

**其他必须注意的实现事实（都已核实）**：
- 皮肤属性必须**自己持久化**（独立 localStorage key，如 `skin`）。不能复用 `'theme'`：该 key 被 `setTheme` 独占且内容必须能通过 `parsePABToTheme`（`parseTheme.ts:4-12`；启动即解析 `App.tsx:59`、`reducers/theme.ts:13-14`），写入非 PAB 字符串会破坏主题启动。
- 建议在 `index.tsx:10-17`（React 渲染前）读取并设置属性，避免首屏闪烁；`index.tsx` 仅 17 行，属低风险小文件。
- `body` 有 `transition: background-color 0.3s`（`index.css:50`），皮肤若改 body 背景会有 0.3s 过渡（视觉上通常无害，若要即时需皮肤层自己覆盖 transition）。
- 新增皮肤 CSS 若为全局样式（选择器需要命中 `html/body`），必须新建独立全局 css 并在 `index.tsx:3` 旁 import（CSS Modules 会把类名哈希化，不适合 `html[data-theme]` 这类全局选择器）。
- **不需要任何新依赖**（纯 CSS + 一个属性写入），符合"不引入依赖"约束。
- `anime-light`/`anime-dark` 两个皮肤之间必须能共存于同一套 3 变量主题：因为 P1 不碰变量，任选一个 3 变量主题都能与任一皮肤叠加。

**结论**：冻结决策 B **在 P1 形态下成立且推荐**；若 T5/T6 的设计意图是"皮肤自带配色"，则必须走 P2a 并显式接受"皮肤接管颜色、3 变量主题在皮肤开启时不可见"的语义，或改回 P2b 从而**反驳**决策 A。请以 P1 为实现基线。

### 6.4 取舍对比："新增主题预设" vs "独立视觉皮肤"

| 方案 | 改动面 | 对既有安装 | 结论 |
|---|---|---|---|
| 新增 3 变量主题预设 | **必须同时改 2 个完全重复的文件**：`utils/init/initialFiles.json:31-190` 与 `utils/init/themes.json`（实测当前两份 16 条完全相同） | ❌ **对已存在 `data/themes.json` 的安装无效**：`createFile.js:13-25` 只在目标文件**不存在**时写模板（`fs.existsSync(srcPath)` 即为已存在分支，`:14-22`），因此新预设不会出现在老安装的主题网格里，需要额外写迁移/合并逻辑 | 不是最小路径 |
| 独立 `data-theme` 皮肤 | 新增 `client/src/skin/*` + `index.tsx` 1 行 import（可选加设置项） | ✅ 新增文件即可生效，无需数据迁移 | **推荐（最小 diff、不破坏 Default、可恢复原版）** |

补充：即便要"预设颜色"，也可用皮肤层提供 3 色（走 P2a），而**不必**触碰 `data/themes.json` 初始化链。

---

## 7. CSS 架构

| 项目 | 结论与证据 |
|---|---|
| 全局 CSS | 仅 `client/src/index.css`，且只在一处被 import：`index.tsx:3`。内容：4 组 `@font-face` Roboto（`:1-35`）、全局 reset（`:37-41`）、`body` 变量与背景/字体（`:43-53`）、`a { color: var(--color-primary) }`（`:55-58`）。**不存在 `:root` 选择器**；变量定义在 `body` 上 |
| CSS Modules | 36 个 `*.module.css`，按组件就近放置（如 `AppCard.module.css`、`Settings.module.css`）。CRA/`react-scripts` 默认对 `*.module.css` 启用 modules | `find client/src -name '*.module.css' \| wc -l` = 36；`client/package.json:27` |
| 变量使用 | 全部组件样式通过 `var(--color-*)` 取色，例如 `Button.module.css:4,11-12`、`InputGroup.module.css:20-21`、`Table.module.css:24-25`、`Notification.module.css:3,13-14`、`ActionButton.module.css:17-18`、`Home.module.css:4`。变量只读、不可被组件覆写（无 `!important`，无属性选择器） |
| 用户自定义 CSS 注入 | `client/public/index.html:55`：`<link rel="stylesheet" href="%PUBLIC_URL%/flame.css" />`。CRA 会把 `client/public/**` 原样拷到 build 根，`%PUBLIC_URL%` 在构建期替换；容器构建再把 `client/build/*` 移到 `./public`（`.docker/Dockerfile:12-18`），因此运行时链为 `/flame.css` → `<repo>/public/flame.css` |
| 自定义 CSS 读写路径 | 读：`StyleSettings.tsx:22-27` `GET /api/config/0/css` → `controllers/config/getCSS.js:8-16`，读 `public/flame.css`（`:9`）；写：`StyleSettings.tsx:37-50` `PUT /api/config/0/css` → `controllers/config/updateCSS.js:9-23`，写 `public/flame.css`（`:10-11`）**并复制到 `data/flame.css`**（`:13-17`）。路由装配 `routes/config.js:16`（PUT 需鉴权） |
| 两个同名 `flame.css` | ①`client/public/flame.css`：**被跟踪但为空文件（0 字节）**，只作为 CRA 构建/开发期的占位资源；②`<repo>/public/flame.css`：运行时真身，`public/` 被 gitignore（`.gitignore:3`），由 `createFile` 从 `data/flame.css` 拷贝或写空模板（`initialFiles.json:4-14`、`createFile.js:10-25`），`.dockerignore:3` 又把 `public` 排除出构建上下文。**开发模式（`react-scripts start`）下 `/flame.css` 命中的是那个空占位文件**，所以在 dev 里通过 UI 保存的自定义 CSS 不会立刻可见（需要构建或直接改 `client/public/flame.css`）；生产模式命中运行时的 `public/flame.css` |
| 其他 | 无 CSS 预处理器、无 PostCSS 配置、无 Tailwind 等；`client/src/components/UI/**` 与 `Settings/**` 的样式文件与组件同名同目录 |

---

## 8. Background 现状

**结论：上游没有任何背景图/自定义背景能力。** 证据：

1. 全仓（`client/src/**` 的 `.ts/.tsx/.css`）grep `background-image|backgroundImage|background-size|wallpaper|cover` → **0 处**；grep `background` → 仅 `background-color`（`index.css:44,49`、`Table.module.css:24`、`Notification.module.css:3,13`、`Button.module.css:4,11`、`ActionButton.module.css:2,17`、`InputGroup.module.css:20,45`、`ModalForm.module.css:2`、`Modal.module.css:14,19`、`AppCard.module.css:40`、`SearchBar.module.css:7`、`Home.module.css:4`）——**没有任何 `background-image`/`url(...)` 背景**。
2. 全局背景只有纯色：`index.css:49` `body { background-color: var(--color-background) }`，颜色由 3 变量主题决定（第 6 节）。
3. 设置项里没有背景相关字段：`UISettings.tsx:58-241` 的全部选项（页面标题/隐藏搜索栏/禁用自动聚焦/隐藏 header/日期/时间/日期格式/自定义问候语·星期·月份/隐藏应用·书签）中**没有背景项**；`Config` 接口（`interfaces/Config.ts:3-35`）与 `initialConfig.json:1-33` 也**没有任何 background 字段**。
4. 唯一的上传能力是**图标**：`middleware/multer.js:8-15`（存 `data/uploads`，文件名 `Date.now()--原名`）、`:17` `supportedTypes = ['jpg','jpeg','png','svg','svg+xml','x-icon']`、`:29` `upload.single('icon')`；仅用于 apps 路由（`routes/apps.js:18,24`）与前端 `AppCard.tsx:22`、`BookmarkCard.tsx:58,70`（`/uploads/${icon}`，静态目录 `api.js:9`）。
5. 唯一的"今天就能换背景"的途径是**用户自定义 CSS**：`StyleSettings` → `public/flame.css` → `index.html:55`，用户可自行写 `body{background-image:url(...)}`。这既是现状，也是"背景层"可以复用的注入点（但无 UI、无上传、无持久化保障）。
6. 对 T5/T6 的落点建议（基于上述事实）：背景属**皮肤层**（第 6.3 节 P1），用 URL 方式（localStorage 或皮肤配置）实现可零后端改动；若要做"上传背景图"，需要新增后端路由并复用 multer 存储（`middleware/multer.js:8-29`），属新增后端面，与"最小改造"目标相悖，建议一期不做。层级上必须低于 `Modal z-index:100`（`Modal.module.css:7`）与 `NotificationCenter z-index:500`（`NotificationCenter.module.css:6`）。

---

## 9. 现有 Docker Integration 的边界（含"禁止改动"清单）

### 9.1 产品逻辑（完整链路）

1. 开关与参数来自 `data/config.json`：`dockerApps`、`dockerHost`、`kubernetesApps`、`unpinStoppedApps`（`interfaces/Config.ts:21-24`；默认 `false/false/localhost/false`，`initialConfig.json:19-22`）。
2. 触发点在 `GET /api/apps`：`getAllApps.js:12-16` 读配置，`:20-22` 若 `dockerApps` 调 `useDocker(apps)`，`:24-26` 若 `kubernetesApps` 调 `useKubernetes(apps)`；路由装配 `routes/apps.js:16-19`（GET 带 `auth` 但不要求登录）；生产环境禁止缓存 `getAllApps.js:41-47`。
3. Docker 分支（`controllers/apps/docker/useDocker.js`）：`:8-12` 读 `dockerHost`；`:18-27` 若 host 含 `localhost` → 走 `http://${host}/containers/json?{"status":["running"]}` + `socketPath: '/var/run/docker.sock'`；`:28-35` 否则走宿主暴露的 Docker API；`:50-83` 解析容器 Labels，支持 Traefik 1.x/2.x 规则推导 `flame.url`；`:86-90` 要求 `flame.name`+`flame.url`+`flame.type=app*`；`:109-113` 按 `unpinStoppedApps` 取消固定；`:115-144` 按名字 upsert `App` 记录（不动自定义图标）。
4. Kubernetes 分支（`controllers/apps/docker/useKubernetes.js`）：`:13-18` `kc.loadFromCluster()` + 列举所有 namespace ingress；`:37-48` 要求注释 `flame.pawelmalak/name|url|type=app*`；`:50+` 同 `unpinStoppedApps` 逻辑。
5. 设置界面：`DockerSettings.tsx:59-119`（Docker host / Use Docker API / Unpin stopped containers / Kubernetes Ingress API），表单模板 `settingsTemplate.ts:44-49`，类型 `interfaces/Forms.ts:37-42`。**后端没有独立的 `/api/docker` 路由**，Docker 设置通过通用 `PUT /api/config`（`routes/config.js:14`）。
6. 相邻但独立的"docker"特性：Docker secrets 读取 `PASSWORD`（`utils/init/initDockerSecrets.js:5-19`、依赖 `docker-secret` `package.json:24`、compose 示例 `.docker/docker-compose.yml:12-13,16,19-22`）——这是**密码注入**，与容器发现集成无关，同样不得改动。

### 9.2 禁止改动边界（freeze list）

| 禁止改动 | 证据 |
|---|---|
| `controllers/apps/docker/**`（`useDocker.js`、`useKubernetes.js`、`index.js`） | `controllers/apps/docker/useDocker.js:1-148`、`useKubernetes.js:1-50+`、`docker/index.js:1-4` |
| `controllers/apps/getAllApps.js`（含 `:6` 的 require 与 `:20-26` 调用） | `getAllApps.js:6,11-27,41-52` |
| `models/App.js` / `db/migrations/**` / `db/index.js` | `db/index.js:10-25`、`db/migrations/00_initial.js:4-176` |
| `middleware/multer.js` 及 `routes/apps.js` 的 `upload` 装配 | `middleware/multer.js:8-29`、`routes/apps.js:5,18,24` |
| `package.json` 依赖集（`@kubernetes/client-node`、`docker-secret`）与两个 lockfile | `package.json:19-37`、`client/package.json:5-33` |
| `.docker/**`、`.dockerignore`、`skaffold.yaml`、`k8s/**`、`.dev/build_*.sh`（构建资产由 Lead 负责） | 第 4.1 节全部证据 |
| `utils/init/initDockerSecrets.js`、`.env` 的 `PORT`/`PASSWORD` 语义 | `utils/init/initDockerSecrets.js:5-19`、`.env:1-4` |
| 任何"为 Podman 适配"的改动 | 见 9.3 |

### 9.3 关于 Podman 的明确声明

本机无 Docker CLI、有 rootless Podman（第 4.2 节实测）。Flame 的 Docker Integration 依赖的是 **Docker Engine HTTP API / `docker.sock`**（`useDocker.js:20-34`）与 **Kubernetes in-cluster API**（`useKubernetes.js:13-18`），这是上游产品设计。**本审计不提任何 Podman 适配建议，也不允许后续阶段以此为理由改动第 9.2 节任何文件**；Podman 仅作为本机的构建/运行实验运行时。

---

## 10. 最小改造路径建议（i18n 层 + 主题皮肤层 + 背景层）

### 10.1 层 1：轻量自建 i18n —— **确认可行（支持冻结决策）**，且与上游既有 idiom 完全一致

**支持证据（关键）**：上游已有"配置值同时写入 localStorage 供非组件代码直接读取"的既有机制：
- `store/action-creators/config.ts:16-23` 定义 `keys` 白名单（`useAmericanDate/greetingsSchema/daySchema/monthSchema/showTime/hideDate`），`:38-40` 与 `:72-74` 在拉取/更新配置后逐个落 localStorage；
- `utility/storeUIConfig.ts:1-8` 即 `localStorage.setItem(key, String(config[key]))`；
- 消费端 `greeter.ts:5-8`、`getDateTime.ts:4-12,31-33` **直接读 localStorage**，不经过 redux。
→ 新增 `language` 键并复用同一机制，是零新增模式、零新增依赖的最小改法；`t()` 可作为独立模块读 `localStorage.language`（模块级缓存 + `document.documentElement.lang` 同步）。

**建议改动清单**

| 类型 | 文件 | 动作 | 依据/风险 |
|---|---|---|---|
| 新增 | `client/src/i18n/index.ts`（`t(key, params)`、`setLocale`、`getLocale`，无依赖的手写实现） | 全新文件，零冲突 | — |
| 新增 | `client/src/i18n/locales/zh-CN.ts`、`en-US.ts`（键值对） | 全新文件 | 键集合需覆盖 §5 全量清单 |
| 新增 | `client/src/i18n/types.ts`（键类型，可选，保证 `strict` 下类型安全） | 全新文件 | `client/tsconfig.json:13` `strict:true` |
| 改 | `client/src/interfaces/Config.ts` | +1 行 `language: string`（`:3-35` 内） | 上游 DEV_GUIDELINES 要求同步改类型 |
| 改 | `client/src/utility/templateObjects/configTemplate.ts` | +1 行 `language`（参照 `:3-36`） | 同上 |
| 改 | `utils/init/initialConfig.json` | +1 行 `"language"`（`:1-33`） | 老安装由 `initConfig.js:16-20` 自动补键，**无需迁移** ✔ |
| 改 | `client/src/store/action-creators/config.ts` | `keys` 数组（`:16-23`）加入 `'language'` | 让 `t()` 无需 redux 即可读 locale |
| 改 | `client/src/utility/index.ts` | 增加 `export * from './i18n'`（或直接 `export * from '../i18n'`，参照 `:1-16`） | 保持统一导出风格 |
| 改 | 文本热区（§5.1 的 37 个文件 + §5.3） | 逐条替换为 `t()`，**只改字符串、不改逻辑/顺序/格式** | 高风险大文件见 10.4 |
| 改 | `client/public/index.html:2` | `lang="en"` → 静态改中文或运行时由 `setLocale` 同步 | 极小 |
| 新增 | 设置入口：可放在 `UISettings.tsx` 的 "Miscellaneous" 段（`:60-73` 后）或在 `settings.json` 增页签 | 若增页签需改 `settings.json:1-39` + `Settings.tsx:57-74`，冲突面更大 → 建议放进 `UISettings` |

**实现约束/坑**：
1. 切换语言后需刷新才能让 `greeter()`/`getDateTime()`（读 localStorage）立即生效；上游已有"改完提示刷新"的先例（`StyleSettings.tsx:46` "CSS saved. Reload page to see changes"），复用该 UX 最省事。
2. 明确优先级：**用户自定义 schema（`greetingsSchema`/`daySchema`/`monthSchema`）> 语言包**，因为 `greeter.ts:5-8`、`getDateTime.ts:4-27` 已把自定义值放在首位；语言包应作为 `initialConfig.json:25-27` 的"本地化默认值"来源，而不是覆盖用户输入。
3. `Field cannot be empty: ${field}`（`AppForm.tsx:63`、`BookmarksForm.tsx:76`）必须参数化；`status`（`app.ts:60`、`bookmark.ts:129`）需与 `app.ts` 内 `created/updated/deleted` 枚举一起本地化。
4. **不要引入 i18n 依赖**（`react-i18next`/`i18next` 等）：会改 `client/package.json:5-33` 与 `client/package-lock.json`（该 lockfile 在本次审计中已被并发修改过，见第 1 节），直接放大第 11 节的同步风险。
5. 不要在 `client/package.json` 增加 script 之外的字段；`react-scripts build` 会因新增未使用依赖/类型报错而失败。

### 10.2 层 2：主题皮肤层（`data-theme`）

| 类型 | 文件 | 动作 |
|---|---|---|
| 新增 | `client/src/skin/skin.ts` | 读写 `localStorage.skin`；在 `document.documentElement` 上 set/remove `data-theme`；导出 `applySkin/getSkin/setSkin`；同步 `color-scheme`（可选） |
| 新增 | `client/src/skin/skins.css` | **全局 CSS（非 module）**：`html[data-theme='anime-light'] …`、`html[data-theme='anime-dark'] …`；`default` 不写规则（或不设属性） |
| 改 | `client/src/index.tsx:3` 附近 | `import './skin/skins.css'` + 渲染前 `applySkin()`（防 FOUC；该文件仅 17 行，低风险） |
| 改（可选） | 设置控件：`UISettings.tsx` 或新组件 | 皮肤选择下拉；若只存 localStorage 则**零后端改动** |
| **不改** | `store/action-creators/theme.ts`、`store/reducers/theme.ts`、`utility/parseTheme.ts`、`index.css:44-46`、`ThemeGrid/ThemePreview` | 冻结区（第 6.2/6.3 节） |

**关键禁令**：皮肤层不得重新声明 `--color-background/--color-primary/--color-accent` 到 `body`（会被 `theme.ts:22-24` 的内联样式覆盖；需要覆盖则须 `!important` 并接受 6.3 节 P2a 的语义代价）。默认皮肤 = 无属性/`default` = 上游原样。

### 10.3 层 3：背景层

| 类型 | 文件 | 动作 | 说明 |
|---|---|---|---|
| 新增 | `client/src/skin/skins.css` 内 `body::before` / `html[data-theme] body::before` | 背景图层（`position: fixed; inset: 0; z-index: 0`，`pointer-events: none`） | 必须 < Modal(100)/NotificationCenter(500)（`Modal.module.css:7`、`NotificationCenter.module.css:6`） |
| 新增 | `client/src/skin/background.ts` | 读取/保存背景配置（URL 或预设名），设置 `--skin-background-image` 等**新变量**（不占用 3 个既有变量） | 复用 skin 的 localStorage 命名空间 |
| 改（可选） | `UISettings.tsx` 新增"Background" 段 | 输入框（URL）/启用开关 | 若加后端字段则需同时改 `Config.ts`、`configTemplate.ts`、`initialConfig.json`、`settingsTemplate.ts`、`Forms.ts`（见 10.1 同款清单） |
| **禁止** | 新建上传路由 / 改 `middleware/multer.js:8-29` / 改 `routes/apps.js:18,24` | — | 上传背景超出最小改造范围，且触碰 9.2 freeze list |

### 10.4 高风险大文件（**禁止重写，只允许精准增删**）

按行数排序（`wc -l` 实测）：`components/Bookmarks/Form/BookmarksForm.tsx` 275、`components/Settings/UISettings/UISettings.tsx` 243、`components/Settings/GeneralSettings/GeneralSettings.tsx` 242、`components/Apps/AppForm/AppForm.tsx` 225、`store/action-creators/bookmark.ts` 401、`store/action-creators/app.ts` 207、`components/Settings/WeatherSettings/WeatherSettings.tsx` 188、`store/action-creators/config.ts` 156、`store/action-creators/theme.ts` 128（冻结）、`components/Settings/DockerSettings/DockerSettings.tsx` 122（冻结逻辑，文案可改）、`App.tsx` 91、`components/Settings/Themer/Themer.tsx` 105、`components/Settings/Settings.tsx` 79。

规则：①不做全文件格式化（`.prettierrc:1-8` 与现有代码一致，但重排会放大 diff）；②每次只替换字符串字面量，保持行结构；③`settings.json`、`index.css`、`client/package.json`、`.gitignore`、`.docker/**` 视为"高冲突面"文件，非必要不碰。

---

## 11. 上游同步风险评估

| 风险等级 | 文件/区域 | 为什么难维护 | 缓解 |
|---|---|---|---|
| 🔴 极高 | `client/package.json` + `client/package-lock.json` + `package.json` + `package-lock.json` | 上游每次发版都可能动依赖；lockfile 已在本审计期间发生过并发改动（第 1 节）。任何新增依赖都会产生不可 rebase 的巨量 diff | **坚持零新依赖**（i18n/皮肤/背景都不需要）；lockfile 只由安装流程产生，不手工编辑 |
| 🔴 极高 | `CHANGELOG.md:1-…`、`README.md:1-…`、`client/.env:1`、`.env:1-4` | 上游每个版本必改；`checkVersion.ts:7-9` 直接读**上游** `client/.env` 并与本地 `REACT_APP_VERSION`（`client/.env:1`）比较 | 不要为了"消掉升级提示"改 `client/.env`（会失去上游版本探测能力）；README/CHANGELOG 若要本地化，建议**新增** `README.zh-CN.md` 而非改原文件 |
| 🟠 高 | `utils/init/initialFiles.json`、`utils/init/initialConfig.json`、`utils/init/themes.json` | 三份文件内容高度重复（themes 16 条在前后两者中完全相同）；上游改内置主题/默认配置会与本地改动冲突；另外 `data/` 侧改动对老安装无效（`createFile.js:13-25`） | 仅追加键/主题；新增主题若走皮肤层可完全绕开这些文件（第 6.4 节） |
| 🟠 高 | 文本热区中的大文件（§10.4） | 同一文件上游也会改文案，逐行字符串替换会让 rebase 冲突点密集 | 只改字符串、不做重排；把键值集中在 `client/src/i18n/locales/*.ts`，让组件内 diff 最小化；冲突时以"上游结构 + 我方键名"合并 |
| 🟡 中 | `client/public/index.html`、`client/src/index.tsx`、`client/src/index.css` | 上游偶有改（如 favicon/版本/变量） | 改动控制在 1-2 行（import、lang/属性）；新的全局 CSS 放**新文件** |
| 🟡 中 | `client/src/store/action-creators/*.ts`、`client/src/store/reducers/theme.ts` | 通知文案与主题状态是上游活跃区 | 只加键/只换字符串；`theme.ts` 完全冻结 |
| 🟡 中 | `settings.json`、`Settings.tsx`、`UISettings.tsx`、`GeneralSettings.tsx` | 设置页签与选项随版本增删 | 语言/皮肤入口优先塞进既有的 `UISettings.tsx` 段落（`:60-73` 之后），不新增页签 |
| 🟢 低 | `controllers/themes/*`、`routes/config.js`、`middleware/*` | 本次不需要改动 | 保持零改动 |
| ⚪ 无风险 | **全新文件**：`client/src/i18n/**`、`client/src/skin/**`、`README.zh-CN.md`、`AUDIT.md` | 与上游无重叠 | 改造尽量把逻辑压到新增文件里（这也是最小 diff 的核心策略） |
| ⚪ 无风险 | `data/**`、`public/**`、`build-logs/**`、`client/build/**` | 已 gitignore（`.gitignore:1-5`）或不在版本控制内 | 不提交生成物 |

**总体判断**：只要满足"①零新依赖 ②零/极小改 theme 机制 ③文本改动集中在新增 i18n 文件 + 组件内单行替换 ④不动 `.docker/**`、`skaffold.yaml`、`k8s/**`、后端 Docker Integration ⑤不动 lockfile 与 `client/.env`"，本次二创的 diff 就可以在一个 upstream rebase 里手工收敛；反之（尤其"改主题机制"或"新增主题预设文件"）会显著提高同步成本。

---

## 12. 许可证与第三方素材

1. **主许可证：MIT。** `LICENSE.md:1-21` 为 MIT 全文，`Copyright (c) 2021 Paweł Malak`（`:3`）。允许闭源/修改/再分发，**须保留版权与许可声明**（`:12-13`）。因此本二创项目需在分发物中保留 `LICENSE.md`（不能删除/替换为自有许可），建议在 README 中标注"基于 pawelmalak/flame (MIT) 的修改版"。
2. **元数据不一致（事实记录）**：根 `package.json:18` 声明 `"license": "ISC"`，与 `LICENSE.md` 的 MIT 冲突；以 `LICENSE.md`（MIT）为准。`client/package.json`（`:1-61`）没有 `license` 字段。
3. **第三方素材现状（仓库内只找到 `./LICENSE.md` 一个许可证文件，`find` 结果 0 个其他 `LICENSE*/COPYING*/NOTICE*`）**：
   - Roboto 字体（woff/woff2，8 个文件）直接 vendored 在 `client/src/assets/fonts/Roboto/`，经 `index.css:1-35` 的 `@font-face` 引入；**仓库内没有随附字体许可证文件**。Roboto 上游为 Apache-2.0，二创若继续内联分发，建议补一份字体许可说明。
   - 图标：`@mdi/js 6.4.95`（`client/package.json:6`）的 `LICENSE` 文件为 **"Pictogrammers Free License"**，而其 `package.json` 标称 `Apache-2.0`（两者不一致，已在 node_modules 中核实）；`@mdi/react 1.5.0`（`:7`）为 MIT；`Icon.tsx`/`ActionIcons.tsx` 通过 `iconParser` 使用 MDI 图标名（`utility/iconParser.ts`）。
   - 天气动画：`skycons-ts 0.2.0`（`client/package.json:31`）为 **MIT**（`node_modules/skycons-ts/LICENSE` 实测 "MIT License, Copyright (c) 2018 Andreas Pätzold"）；使用点 `WeatherIcon.tsx:3,21-23`。
   - TypeScript（`4.4.4`）Apache-2.0、`web-vitals` Apache-2.0，其余前端依赖均为 MIT；后端 `sqlite3` BSD-3-Clause、`dotenv` BSD-2-Clause、`@kubernetes/client-node` Apache-2.0，其余 MIT（逐个从 `node_modules/*/package.json` 的 `license` 字段实测）。
   - 生产构建会把第三方许可声明抽出到 `static/js/main.*.js.LICENSE.txt`（实例：`build-logs/baseline-build/static/js/main.3270a6fa.js.LICENSE.txt`，由 Lead 的基线构建生成）。
   - 仓库截图素材 `.github/{home,apps,bookmarks,settings,themes}.png`（`README.md:3,144` 等引用）为上游项目自带，二创界面与截图不一致属预期。
4. **素材风险提示（对 T5/T6）**：二次元立绘/背景图是**新增的第三方素材**，其许可不覆盖在本仓库 MIT 之下；若采用网络素材，必须单独记录来源与许可，建议放在 `client/public/` 或新增 `assets/` 并附 `THIRD-PARTY.md`，不要与 MIT 混为一谈。

---

## 附录 A：审计方法与可复现命令（只读）

```bash
cd $HOME/Flame
git remote -v; git branch -vv; git describe --tags --always; git status --porcelain
wc -l client/src/components/**/*.tsx        # 文件规模
find client/src -name '*.module.css' | wc -l   # 36
node -e "console.log(require('./utils/init/themes.json').themes.length)"   # 16
```
文本热区扫描脚本位于 `/tmp/flame-audit/textscan4.js`（启发式：JSX 文本节点含跨行 + UI 属性字面量 + 通知对象），输出 `/tmp/flame-audit/inventory.txt`。**该脚本不写入仓库**，结果已人工剔除 TS 类型签名误报（如 `async (dispatch: Dispatch`）。

## 附录 B：对任务书基线的修正清单（汇总）

| # | 任务书表述 | 复核结论 | 证据 |
|---|---|---|---|
| 1 | "working tree clean" | ❌ 不成立（审计期间 `.gitignore` 被改、`build-logs/` 新增、`client/package-lock.json` 一度被改） | 第 1 节 |
| 2 | commit `3e03c25…` 即 v2.4.0 | ⚠️ 该 commit 是 v2.4.0 之后的第 2 个提交（`v2.4.0-2-g3e03c25`，tag 在 `069b669`） | `git describe`；`git log --oneline -3 --decorate` |
| 3 | v2.4.0 日期 2026-04-25 | ❌ CHANGELOG 记为 `2026-04-24` | `CHANGELOG.md:1` |
| 4 | 主题来自后端 `/api/themes`（SQLite） | ❌ **SQLite 里没有主题**：主题在 `data/themes.json`（JSON 文件）；SQLite 存 apps/bookmarks/categories/weather，配置在 `data/config.json` | `controllers/themes/getThemes.js:8`、`utils/File.js:9-25`、`db/index.js:10-14`、`utils/loadConfig.js:12` |
| 5 | 前端构建 `client` 目录 `npm run build`，Dockerfile 两阶段并把 `client/build` 移到 `./public` | ✅ 全部确认 | `client/package.json:37`、`.docker/Dockerfile:1-18` |
| 6 | 3 变量主题机制 + localStorage `theme` + `document.body.style.setProperty` | ✅ 全部确认（补充：还存在第 4 个静态变量 `--spacing-ui`，以及 `reducers/theme.ts:13-15` 的硬编码兜底） | `index.css:44-47`、`theme.ts:19-24`、`reducers/theme.ts:13-15` |
| 7 | client 无独立 lint/typecheck script | ✅ 确认（仅 start/build/test/eject），CRA 内置 ESLint/类型检查；仓库内 0 个测试文件 | `client/package.json:35-46` |
| 8 | 内置主题数量（README 称 15） | ⚠️ 实为 16，且在两份文件中重复 | `README.md:14` vs `initialFiles.json:42-186` / `themes.json`（实测 16/16 一致） |
