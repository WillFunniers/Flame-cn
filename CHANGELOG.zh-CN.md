# Flame-cn 更新日志

本文件记录 **Flame-cn 二创分支**的变更。上游 Flame 自身的更新日志见 [CHANGELOG.md](CHANGELOG.md)（保持原样，便于与上游同步）。

- 上游基线：pawelmalak/flame `3e03c25`（`v2.4.0`）
- 分支：`feature/zh-anime`

---

## v2.4.0-zh.3 — 2026-10-03

tag `v2.4.0-zh.3` · 上一个发布：`v2.4.0-zh.2`（`c27b086`）

### 修复

- **和风天气响应格式不匹配 —— 只有真实 API 才会暴露的缺陷。**
  `v2.4.0-zh.2` 请求的是 `/weather/v1/current/<lat>/<lon>`，而这个端点返回的是**新版响应格式**
  （`condition` / `temperature` / `humidity` / `wind`，**没有**顶层 `code`、**没有** `now`，
  湿度与云量是小数、风速是 m/s）。但解析器、图标映射和 Weather 数据模型全是按
  **`/v7/weather/now`** 的格式写的（`{code, updateTime, now:{temp, icon, text, windSpeed, humidity, cloud}}`）。

  两者不匹配时**不会报错**：`code` 不存在所以不抛异常，`now` 不存在所以每个字段都取默认值
  —— 结果是 **天气组件显示 0°C**，而 `GET /api/weather/update` 仍然返回 HTTP 200。

  现在改为请求 `/v7/weather/now?location=<longitude>,<latitude>`（v7 的 `location` 是「经度,纬度」）。
  解析器、图标映射、数据模型、UI **一个字都没改**。

  **真实凭据验证结果**：使用专属 API Host + 真实 JWT 凭据，
  `tempC=28, tempF=82.4, conditionText=阴, conditionCode=1009, humidity=83, cloud=99, windK=10`，
  `externalLastUpdate` 为和风天气真实时间戳，且 `GET /api/weather` 可正确读回。

  > 说明：**JWT 认证在 zh.2 里就是正确的**（真实请求 HTTP 200、token 被接受）。
  > 缺陷仅在于响应解析。这也正是 zh.2 把「真实 API 验证」标为 NOT TESTED 所掩盖掉的问题。

### 未改变

依赖、Flame 架构、天气 UI、天气数据模型、`package.json` / lockfile、`.docker/Dockerfile`：**零改动**。
本次只改了 `utils/weather/qweather.js` 的请求 URL（含注释说明为何用 v7）以及对应的一条单测断言。

### 验证记录

| 项 | 结果 |
|---|---|
| `node --test`（后端单元测试） | 87/87 |
| **真实和风天气 API**（专属 Host + JWT） | **PASS** — HTTP 200，天气数据正确写入 SQLite 并可读回 |
| 认证头检查 | PASS — 仅 `Authorization: Bearer`，无 `X-QW-Api-Key`，共 1 个认证头 |
| `/api/weather/status` 泄露检查 | PASS — 不返回 Host / Credential ID / JWT / 私钥 |
| 容器日志泄露检查 | PASS — 无 JWT / API Key / 私钥 / Authorization 头 |
| Podman 构建（未修改的 Dockerfile） | PASS |

### 已知问题（沿用自 zh.2）

- 应用内版本号仍是 `2.4.0`（`client/.env` 的 `REACT_APP_VERSION`）。这是刻意的：
  `client/src/utility/checkVersion.ts` 拿它和**上游仓库**比对，改成 `2.4.0-zh.x` 会导致永久误报「有新版本」。
- 「检查更新」按钮访问的是上游 `pawelmalak/flame`，不是本 fork。

---

## v2.4.0-zh.2 — 2026-09-30

commit `c27b086` · 上一个发布：`v2.4.0-zh.1`（`bc3962d`）

本次发布的主题是**和风天气（QWeather）的 Ed25519 JWT 动态认证**，以及围绕它的凭据安全加固。

### 新增

- **和风天气支持 Ed25519 JWT 认证**（`utils/weather/qweatherJwt.js`）。
  - 使用 Node 内置 `crypto` 签发 `alg=EdDSA` 的 JWT：`kid` = Credential ID，`iss` = Developer ID，`sub` = Project ID，`iat = now-30`，`exp = iat+900`，Base64URL 无填充编码。
  - **不引入任何新依赖**（`jsonwebtoken@8.5.1` 底层不支持 EdDSA，因此没有升级依赖、也没有引入 `jose`）。
  - 私钥**只从 PEM 文件读取**（`QWEATHER_PRIVATE_KEY_PATH`），在内存中缓存；token 带模块级缓存，**剩余有效期小于 60 秒时自动重签**。
  - 认证方式由 `QWEATHER_AUTH_MODE` **显式决定**（`jwt` / `api-key`）；两种凭据**永不叠加发送**。
- `GET /api/weather/status` 现在返回 `provider` / `configured` / `authMode`，**不再返回 API Host**。
- 和风天气的上游错误信息现在会保留 `HTTP 状态码` + `type` / `title` / `detail` / `invalidParams`（此前会被折叠成一句无用的 `Request failed with status code 400`）。

### 安全加固

- 私钥、JWT、API Key、API Host **不出现在**：日志、HTTP 响应体、错误信息、前端 bundle。
- 传输失败（DNS / 连接超时等）重抛的错误对象会被清理掉 `config` / `request` / `response` / `address` / `port` / `hostname` / `host`，并脱敏 `message` 与 `stack`，避免被 `console.log(err)` 打印出去。
- 上游返回的错误文本即使回显了 Host / 凭据，也会被替换为 `[redacted-host]` / `[redacted]` / `[redacted-pem]`。
- `QWEATHER_API_HOST` 只接受裸 `host[:port]`；含路径/查询/片段的值一律拒绝。**已停用的公共地址 `api.qweather.com` / `devapi.qweather.com` / `geoapi.qweather.com` 会被直接拒绝**，不会静默回落。

### 升级注意（从 `v2.4.0-zh.1` 升级必读）

| 变更 | 影响 | 处理 |
|---|---|---|
| `QWEATHER_AUTH_MODE` 变为**必填** | 只带 `QWEATHER_API_KEY` 的旧部署，天气状态会变成「未配置」，天气组件不显示 | 补上 `QWEATHER_AUTH_MODE=api-key`，或改用 JWT |
| 静态环境变量 `QWEATHER_JWT` **已移除** | 该变量从来只能填一个会过期的静态 token，本来不可用 | 改用 JWT 三要素 + 私钥 PEM |
| 公共 API Host 被拒绝 | `QWEATHER_API_HOST=api.qweather.com` 会变成「未配置」 | 换成控制台给你的**专属 Host** |

> 以上**只影响天气功能**，不影响 Flame 的其他任何功能；容器仍可正常启动。

### 未改变（刻意保持）

- 依赖：`package.json` / `package-lock.json` **零改动**。
- 架构：未重构（Provider 注册表 + 最小改造）。
- 天气 UI、天气数据模型（`models/Weather.js`）、i18n、路由：**零改动**（仅 `client/src/interfaces/Weather.ts` 有 2 行类型跟进）。
- `.docker/Dockerfile`：**零改动**。
- 上游主题机制、Docker 集成：保持原样。

### 验证记录

| 项 | 结果 |
|---|---|
| `tsc --noEmit` | 0 error |
| CRA `react-scripts build` | exit 0，警告数与改动前一致（25 条，均为上游既有） |
| 前端 jest | 8/8 |
| 后端 `node --test`（Node 内置 runner，零新依赖） | **87/87** |
| Podman 镜像构建（未修改的 Dockerfile） | exit 0 |
| 容器内实跑（真实 Podman + 真实 TLS + 真实 JWT 签发 + 真实 SQLite 写入） | **61/61** 检查通过 |
| 浏览器端凭据泄露检查（真实 Chromium） | **12/12** 通过 |
| 独立对抗验证 | 4 轮，发现并修复 4 个真实缺陷，最终无「可达」泄露 |

### 已知问题 / 未完成事项

- **未对真实和风天气 API Host 发起过真实请求**（发布时未取得用户的实际凭据）。JWT 的签名、请求头、链路已经通过本地 HTTPS 上游 + 容器实跑验证，但「和风天气服务端是否接受该 token」这一步尚未实测。
- **应用内版本号仍显示 `2.4.0`**（`client/.env` 的 `REACT_APP_VERSION`）。这是刻意保留的：`client/src/utility/checkVersion.ts` 会拿它跟**上游仓库**的版本比对，一旦改成 `2.4.0-zh.2`，界面会**永远**弹出「有新版本可用！」（并指向上游 changelog）。如需显示 `zh.2`，必须同时调整 `checkVersion`。
- 「检查更新」按钮访问的是上游 `pawelmalak/flame` 仓库，不是本 fork；在无外网环境下无反应属正常。

---

## v2.4.0-zh.1 — Phase 1 / Phase 1.1

tag `v2.4.0-zh.1`（`bc3962d`）→ 后续提交 `f101b04`、`55a3fcb`

### 新增

- **中文界面（i18n）**：自建轻量语言层（零依赖），简体中文 / English 可切换，默认跟随浏览器语言。
- **独立壁纸层**：本地图片背景（`/uploads/wallpaper.png`）+ 开关，**与主题解耦**，带渐变兜底。
- **和风天气（QWeather）Provider**：作为可选的**服务端**天气源（凭据只走环境变量，不下发浏览器）；默认仍是上游 WeatherAPI.com，原行为不变。
- 中文 [使用说明书](USER-GUIDE.zh-CN.md)。

### 变更 / 回退

- 移除了第一阶段自造的二次元主题皮肤，**恢复上游原生主题机制**（16 套内置主题 + 自定义主题，外观与原版一致）。
- `utils/getExternalWeather.js` 改为 Provider 注册表的薄封装；原 WeatherAPI 逻辑逐字抽到 `utils/weather/weatherapi.js`，行为不变。

### 设计/审计文档

`AUDIT.md`、`I18N-DESIGN.md`、`I18N-INVENTORY.md`、`THEME-DESIGN.md`、`THIRD-PARTY-ASSETS.md`、`REVIEW.md`、`FINAL-REPORT.md`。
