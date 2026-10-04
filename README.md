# Flame-cn

> **基于 [pawelmalak/flame](https://github.com/pawelmalak/flame) 的中文增强分支。**
> An opinionated Chinese fork of Flame: full Simplified-Chinese UI, an independent wallpaper
> layer, and a server-side **QWeather (和风天气)** provider with **Ed25519 JWT** authentication.
>
> **当前正式版本：`v2.4.0-zh.3`** · 基于上游 Flame `v2.4.0`（`3e03c25`）
>
> | 文档 | 说明 |
> |---|---|
> | [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md) | 本分支更新日志（含升级注意事项） |
> | [USER-GUIDE.zh-CN.md](USER-GUIDE.zh-CN.md) | 中文使用说明书（面向使用者，逐页讲解界面） |
> | [Releases](https://github.com/WillFunniers/Flame-cn/releases) | 正式版本与发行说明 |
>
> **正式部署请使用 tag 安装**（见 [Quick Start](#quick-start)）。`main` 与 `feature/zh-anime`
> 是开发分支，内容随时可能变动，不适合作为安装入口。

**TL;DR — docker compose（最省事，推荐）：**

```bash
git clone https://github.com/WillFunniers/Flame-cn.git && cd Flame-cn
git checkout v2.4.0-zh.3
cp .env.example .env.local          # 编辑它，至少设置 FLAME_PASSWORD
docker compose --env-file .env.local up -d --build
# open http://<server-ip>:5005
```

仓库自带 [`compose.yaml`](compose.yaml) 与 [`.env.example`](.env.example)：数据落在 `./flame-data`，
QWeather 私钥放进 `secrets/`（该目录与 `.env.local` 都已在 `.gitignore` 中，不会被提交）。
Podman 用户把 `docker` 换成 `podman` 即可。详见 [Docker](#docker) 章节。

**TL;DR — Docker（不用 compose）:**

```bash
git clone https://github.com/WillFunniers/Flame-cn.git && cd Flame-cn
git checkout v2.4.0-zh.3
export DATA_DIR="$HOME/flame-data" && mkdir -p "$DATA_DIR"
docker build -f .docker/Dockerfile -t flame-cn:v2.4.0-zh.3 .
docker run -d --name flame-cn -p 5005:5005 --restart unless-stopped \
  -e PASSWORD='<set-a-strong-password>' \
  -v "$DATA_DIR":/app/data \
  flame-cn:v2.4.0-zh.3
# open http://<server-ip>:5005
```

**TL;DR — Podman（无需 Docker）:**

```bash
git clone https://github.com/WillFunniers/Flame-cn.git && cd Flame-cn
git checkout v2.4.0-zh.3
export DATA_DIR="$HOME/flame-data" && mkdir -p "$DATA_DIR"
podman build --network=host -f .docker/Dockerfile -t flame-cn:v2.4.0-zh.3 .
podman run -d --name flame-cn -p 5005:5005 \
  -e PASSWORD='<set-a-strong-password>' \
  -v "$DATA_DIR":/app/data \
  flame-cn:v2.4.0-zh.3
# open http://<server-ip>:5005
```

---

## Features

- 🈶 **完整中文界面** — 简体中文 / English 可切换，默认跟随浏览器语言；覆盖首页、应用、书签、设置全部页签与通知文案。
- 🖼️ **独立壁纸层** — 用自己的图片做背景，**与主题配色解耦**，任意主题都能搭配；可在设置里随时关掉，回到原版外观。
- 🌤 **和风天气（QWeather）Provider** — 作为**服务端**天气源，支持 **Ed25519 JWT 动态签发**（token 自动缓存与续签），同时保留 API Key 兼容。
- 🎨 **上游主题机制保持不变** — 16 套内置主题 + 自定义主题编辑器，与上游行为一致，可随时回原版外观。
- 🔐 **凭据只在服务端** — API Host / Credential ID / JWT / 私钥永不进入浏览器、响应体或前端 bundle。
- 🧩 **零新增依赖** — 未新增任何 npm 依赖，未改动 `.docker/Dockerfile`、天气数据模型与天气 UI 结构。
- 🐳 **Docker 集成保持上游原样** — 本分支**没有**为 Podman 做 Docker 集成适配（详见 [Configuration](#configuration)）。

## Requirements

| 项 | 要求 |
|---|---|
| 操作系统 | 任意 Linux（已在 x86_64 上验证；上游基础镜像 `node:20-alpine` 同时提供 arm64） |
| 容器运行时 | **Docker** 或 **Podman** 二者之一（都支持；两条路径见 [Docker](#docker) / [Podman](#podman)） |
| 构建时 | 能访问 npm registry 与 Docker Hub 的网络（拉取 `node:20-alpine` 与 npm 包） |
| 磁盘 | 镜像约 230 MB + 数据目录（视应用图标/上传的壁纸而定） |
| 内存 | 256 MB 以上可用内存 |
| 端口 | 默认 `5005`（可用 `PORT` 环境变量改） |
| 可选 | 和风天气账号（只有要用 QWeather 天气源时才需要） |

> 构建过程会把前端 `client/` 编译为静态资源放进镜像，**运行时不需要 Node.js**。

## Quick Start

以下步骤在**一台全新的 Linux 主机**上可直接执行，不依赖任何既有环境。
Docker 与 Podman **任选其一**：完整命令见 [Docker](#docker) 与 [Podman](#podman)，两者的差别只有运行时命令本身与 Podman 构建时多加的 `--network=host`。

### 1. 获取源码并锁定版本

```bash
git clone https://github.com/WillFunniers/Flame-cn.git
cd Flame-cn
git checkout v2.4.0-zh.3        # 用 tag 固定版本，不要用 main / feature 分支
```

### 2. 准备数据目录（持久化，**不要删**）

```bash
export DATA_DIR="$HOME/flame-data"
mkdir -p "$DATA_DIR"
```

> 换成任何你喜欢的路径都可以（例如 `/srv/flame-data`）。这个目录保存配置、数据库、上传的壁纸与主题，**升级时必须保留**。

### 3. 构建镜像

```bash
# Docker
docker build -f .docker/Dockerfile -t flame-cn:v2.4.0-zh.3 .

# Podman（需要 --network=host 才能正常拉 npm 包）
podman build --network=host -f .docker/Dockerfile -t flame-cn:v2.4.0-zh.3 .
```

- 构建使用的是**仓库内未修改的** `.docker/Dockerfile`。
- `--network=host` 只有 Podman 需要；Docker 直接构建即可。

### 4. 启动容器

```bash
# Docker
docker run -d --name flame-cn -p 5005:5005 --restart unless-stopped \
  -e PASSWORD='换成你自己的强密码' \
  -v "$DATA_DIR":/app/data \
  flame-cn:v2.4.0-zh.3

# Podman
podman run -d --name flame-cn -p 5005:5005 \
  -e PASSWORD='换成你自己的强密码' \
  -v "$DATA_DIR":/app/data \
  --restart unless-stopped \
  flame-cn:v2.4.0-zh.3
```

### 5. 打开界面

```
http://<这台主机的IP>:5005
```

首次进入用你设置的 `PASSWORD` 登录。到这里就已经可以正常使用了 —— QWeather 是**可选**的，不配置也不影响其他任何功能（见 [QWeather](#qweather)）。

### 6. 升级到新版本

见 [Upgrade](#upgrade)。

## Docker

`.docker/Dockerfile` 是**标准 Dockerfile**（本分支未做任何修改），`docker build` 与 `docker compose` 都可直接使用。

### 用 compose.yaml 一键部署（推荐）

仓库根目录自带可直接使用的 [`compose.yaml`](compose.yaml)，已经处理好数据卷、密钥只读挂载、重启策略与健康检查：

```bash
git clone https://github.com/WillFunniers/Flame-cn.git
cd Flame-cn
git checkout v2.4.0-zh.3

cp .env.example .env.local        # 编辑 .env.local，至少把 FLAME_PASSWORD 改成强密码
docker compose --env-file .env.local up -d --build
```

打开 `http://<服务器IP>:5005` 即可。

常用操作：

```bash
docker compose --env-file .env.local logs -f      # 看日志
docker compose --env-file .env.local ps           # 看状态（含 healthcheck）
docker compose --env-file .env.local restart
docker compose --env-file .env.local down         # 停并删容器；数据目录不受影响
docker compose --env-file .env.local up -d --build  # 升级/改配置后重建
```

`.env.local` 里可配置的项（全部有默认值，详见 [`.env.example`](.env.example)）：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `FLAME_PASSWORD` | `please-change-me` | 登录密码，**务必修改** |
| `FLAME_PORT` | `5005` | 对外端口 |
| `DATA_DIR` | `./flame-data` | 数据目录（宿主路径） |
| `FLAME_VERSION` | `v2.4.0-zh.3` | 本地构建产物的镜像 tag |
| `QWEATHER_*` | 空 | 见 [QWeather](#qweather) 章节 |

> - `.env.local`、`secrets/`、`flame-data/` 都已写入 [`.gitignore`](.gitignore)，**不会**被提交。
> - QWeather 私钥请放进 `secrets/`（`compose.yaml` 已把该目录**只读**挂到容器内的 `/run/secrets`），然后把 `QWEATHER_PRIVATE_KEY_PATH=/run/secrets/ed25519-private.pem` 写进 `.env.local`。
> - **Podman 用户同样可用这份 compose**：`podman compose --env-file .env.local up -d --build`，或安装 `podman-compose` 后 `podman-compose --env-file .env.local up -d --build`。

### 构建（不用 compose）

```bash
git clone https://github.com/WillFunniers/Flame-cn.git
cd Flame-cn
git checkout v2.4.0-zh.3

docker build -f .docker/Dockerfile -t flame-cn:v2.4.0-zh.3 .
```

> 只有 Podman 构建时需要额外加 `--network=host`，Docker 不需要。

### 运行

```bash
export DATA_DIR="$HOME/flame-data"
mkdir -p "$DATA_DIR"

docker run -d --name flame-cn -p 5005:5005 \
  --restart unless-stopped \
  -e PASSWORD='换成你自己的强密码' \
  -v "$DATA_DIR":/app/data \
  flame-cn:v2.4.0-zh.3
```

### docker compose（长期运行推荐）

直接使用仓库自带的 [`compose.yaml`](compose.yaml) —— 用法见上面的 [用 compose.yaml 一键部署](#用-composeyaml-一键部署推荐)。
如果你不想用仓库里的文件，也可以自己写一份最小 compose：

```yaml
services:
  flame-cn:
    build: { context: ., dockerfile: .docker/Dockerfile }
    image: flame-cn:v2.4.0-zh.3
    container_name: flame-cn
    restart: unless-stopped
    ports:
      - "5005:5005"
    volumes:
      - ${DATA_DIR:-./flame-data}:/app/data
    environment:
      - PASSWORD=${FLAME_PASSWORD:?请先设置 FLAME_PASSWORD}
```

```bash
export DATA_DIR="$HOME/flame-data"
export FLAME_PASSWORD='换成你自己的强密码'
docker compose up -d --build
docker compose logs -f
docker compose down          # 删除容器；DATA_DIR 不受影响
```

### 用 Docker secret 提供密码（可选）

Flame 支持 `PASSWORD_FILE`，也支持读取 `/run/secrets`：

```yaml
services:
  flame-cn:
    image: flame-cn:v2.4.0-zh.3
    container_name: flame-cn
    restart: unless-stopped
    ports:
      - "5005:5005"
    volumes:
      - ${DATA_DIR:-./flame-data}:/app/data
    environment:
      - PASSWORD_FILE=/run/secrets/flame_password
    secrets:
      - flame_password

secrets:
  flame_password:
    file: ./flame_password.txt      # 文件里只放一行密码
```

```bash
printf '%s' '你的强密码' > ./flame_password.txt && chmod 600 ./flame_password.txt
docker compose up -d
```

> QWeather 的私钥同样建议用 secret / 只读挂载提供（见 [QWeather](#qweather)），**不要**写进 `environment`。

### 常用运维

```bash
docker ps                          # 查看是否在运行
docker logs -f flame-cn            # 实时日志
docker restart flame-cn            # 重启
docker stop flame-cn               # 停止
docker start flame-cn              # 启动
docker rm -f flame-cn              # 删除容器（**不影响 DATA_DIR**）
docker images | grep flame-cn      # 查看镜像
```

### 升级

```bash
cd Flame-cn
git fetch --tags && git checkout v2.4.0-zh.3
docker build -f .docker/Dockerfile -t flame-cn:v2.4.0-zh.3 .

docker rm -f flame-cn
docker run -d --name flame-cn -p 5005:5005 --restart unless-stopped \
  -e PASSWORD='你的密码' \
  -v "$DATA_DIR":/app/data \
  flame-cn:v2.4.0-zh.3
```

用 compose 的话直接：

```bash
git fetch --tags && git checkout v2.4.0-zh.3
docker compose up -d --build
```

> 仓库里的 `.docker/docker-compose.yml` 是**上游官方镜像**的示例（`image: pawelmalak/flame`），请勿直接用于本分支 —— 用上面给出的 compose 内容。

### Docker 集成（自动发现容器）

Flame 的「Docker」页签通过 Docker socket 自动发现正在运行的容器。**默认没有挂载**，需要时自行加：

```yaml
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

> ⚠️ 挂载 Docker socket 相当于把宿主机 Docker 的控制权交给这个容器，请自行评估风险。本分支**未修改**这部分上游逻辑；在 Podman 环境下该功能不工作，这是预期行为。

## Podman

### 常用运维

```bash
podman ps                          # 查看是否在运行
podman logs -f flame-cn            # 实时日志
podman restart flame-cn            # 重启
podman stop flame-cn               # 停止
podman start flame-cn              # 启动
podman rm -f flame-cn              # 删除容器（**不影响 DATA_DIR**）
podman images | grep flame-cn      # 查看镜像
```

### 开机自启（Quadlet，Podman 5 推荐）

`podman generate systemd` 已标记 deprecated，推荐用 Quadlet：

```bash
mkdir -p ~/.config/containers/systemd
cat > ~/.config/containers/systemd/flame-cn.container <<'EOF'
[Unit]
Description=Flame-cn self-hosted start page

[Container]
Image=flame-cn:v2.4.0-zh.3
ContainerName=flame-cn
PublishPort=5005:5005
Environment=PASSWORD=换成你自己的强密码
Volume=%h/flame-data:/app/data

[Service]
Restart=always

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now flame-cn.service
loginctl enable-linger "$USER"     # 未登录时也能启动
```

> 注意：Quadlet 会自动创建容器，所以先 `podman rm -f flame-cn` 避免同名冲突。

## QWeather

和风天气是**可选的服务端天气源**。它的凭据**只从服务器环境变量和只读挂载的密钥文件读取**，永远不会下发到浏览器。

> 不配置 QWeather 时，Flame 的默认天气源仍是上游的 WeatherAPI.com（在设置页填 key），或干脆关掉天气组件。**缺少 QWeather 配置不会让容器启动失败。**

### 推荐方式：Ed25519 JWT

**第 1 步 — 生成密钥对（在你自己的机器上）**

```bash
mkdir -p ~/qweather && cd ~/qweather
openssl genpkey -algorithm ED25519 -out ed25519-private.pem
openssl pkey -pubout -in ed25519-private.pem > ed25519-public.pem
chmod 600 ed25519-private.pem
cat ed25519-public.pem        # 把这段公钥粘贴到和风天气控制台
```

> **用仓库自带的 [`compose.yaml`](compose.yaml) 时更简单**：直接在仓库目录里生成，放进 `secrets/`
> （该目录首次 `up` 时会自动创建，且已写入 `.gitignore`）：
>
> ```bash
> mkdir -p secrets
> openssl genpkey -algorithm ED25519 -out secrets/ed25519-private.pem
> openssl pkey -pubout -in secrets/ed25519-private.pem > ed25519-public.pem
> chmod 600 secrets/ed25519-private.pem
> cat ed25519-public.pem
> ```
>
> 然后在 `.env.local` 里把 `QWEATHER_PRIVATE_KEY_PATH` 设为 `/run/secrets/ed25519-private.pem` —— 
> `compose.yaml` 已经把 `secrets/` **只读**挂到了容器的 `/run/secrets`，不需要再改 compose 文件。

**第 2 步 — 在[和风天气控制台](https://console.qweather.com)创建 JWT 凭据**

1. 「项目管理」→ 选择/新建项目 → 「添加凭据」
2. 身份认证方式选 **JSON Web Token**
3. 把上一步的**公钥**内容粘贴进去并保存
4. 记下这个凭据的 **ID**（对应 `QWEATHER_KEY_ID`）
5. 在「设置」里复制 **API Host**（形如 `abcxyz.xy.qweatherapi.com`）与 **开发者 ID**（Q 开头 10 位）
6. 在项目页面复制 **项目 ID**

**第 3 步 — 写一个 env 文件（不要用 `-e` 传凭据）**

```bash
cat > ~/qweather/qweather.env <<'EOF'
QWEATHER_API_HOST=<your-api-host>
QWEATHER_AUTH_MODE=jwt
QWEATHER_KEY_ID=<credential-id>
QWEATHER_DEVELOPER_ID=<developer-id>
QWEATHER_PROJECT_ID=<project-id>
QWEATHER_PRIVATE_KEY_PATH=/run/secrets/qweather_ed25519.pem
EOF
chmod 600 ~/qweather/qweather.env
```

**第 4 步 — 启动容器，把私钥以只读方式挂进去**

```bash
# Docker
docker rm -f flame-cn
docker run -d --name flame-cn -p 5005:5005 --restart unless-stopped \
  -e PASSWORD='换成你自己的强密码' \
  --env-file ~/qweather/qweather.env \
  -v ~/qweather/ed25519-private.pem:/run/secrets/qweather_ed25519.pem:ro \
  -v "$DATA_DIR":/app/data \
  flame-cn:v2.4.0-zh.3

# Podman
podman rm -f flame-cn
podman run -d --name flame-cn -p 5005:5005 \
  -e PASSWORD='换成你自己的强密码' \
  --env-file ~/qweather/qweather.env \
  -v ~/qweather/ed25519-private.pem:/run/secrets/qweather_ed25519.pem:ro \
  -v "$DATA_DIR":/app/data \
  flame-cn:v2.4.0-zh.3
```

**第 5 步 — 在界面里选用**

设置 →「天气」→ **天气服务 = 和风天气** → 保存。状态显示「已配置」即成功。

> ⚠️ **`QWEATHER_API_HOST` 必须是控制台给你的专属 Host。** 旧的公共地址
> `api.qweather.com` / `devapi.qweather.com` / `geoapi.qweather.com` 已被和风天气逐步停用，
> 本版会**直接拒绝**这些地址（状态显示「未配置」），**不会**静默回落到公共地址。

### 兼容方式：只用 API Key

```
QWEATHER_API_HOST=<your-api-host>
QWEATHER_AUTH_MODE=api-key
QWEATHER_API_KEY=<your-api-key>
```

### JWT 是怎么签的

Flame 在服务端用 Node 内置 `crypto` 签发 Ed25519 JWT，无需额外依赖：

| 字段 | 值 |
|---|---|
| `alg` | `EdDSA` |
| `kid` | `QWEATHER_KEY_ID` |
| `iss` | `QWEATHER_DEVELOPER_ID` |
| `sub` | `QWEATHER_PROJECT_ID` |
| `iat` | 当前时间 − 30 秒（容忍时钟偏差） |
| `exp` | `iat` + 900 秒 |

token 带模块级缓存，**剩余有效期少于 60 秒时自动重签**；请求以 `Authorization: Bearer <token>` 发出。`QWEATHER_AUTH_MODE` 显式决定认证方式，JWT 与 API Key **永远不会同时发送**。

### 关于 `/run/secrets`

Flame 沿用了上游的 docker-secret 支持：**挂在 `/run/secrets/` 下的文件会被读入进程环境变量**（用文件名大写作为变量名）。所以把私钥放在 `/run/secrets/` 时，你会看到一条
`... was overwritten with docker secret value` 的启动日志 —— 这是正常的，日志里**不会**出现密钥内容。若不希望它被读入环境，可把私钥挂到 `/run/secrets` 之外的路径并相应修改 `QWEATHER_PRIVATE_KEY_PATH`。

## Configuration

全部配置通过**环境变量**提供：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `5005` | Web 监听端口（容器内） |
| `PASSWORD` | `flame_password` | 登录密码。**务必修改**；Flame 不在界面上保存或显示它 |
| `PASSWORD_FILE` | — | 从文件读取密码（配合 docker/podman secret 使用） |
| `NODE_ENV` | `production`（镜像内置） | 运行模式；`development` 会输出更多日志 |
| `QWEATHER_API_HOST` | — | 和风天气专属 API Host（不含 `https://`、不含路径） |
| `QWEATHER_AUTH_MODE` | — | `jwt` 或 `api-key`。**必填**，不设即为「未配置」 |
| `QWEATHER_KEY_ID` | — | JWT 凭据 ID（`kid`） |
| `QWEATHER_DEVELOPER_ID` | — | 和风天气开发者 ID（`iss`） |
| `QWEATHER_PROJECT_ID` | — | 项目 ID（`sub`） |
| `QWEATHER_PRIVATE_KEY_PATH` | — | 容器内 Ed25519 私钥 PEM 路径 |
| `QWEATHER_API_KEY` | — | 仅 `api-key` 模式使用 |

**应用内设置**（界面里改，存在数据目录里）：主题与配色、壁纸开关、语言、天气源与经纬度、时区/日期格式、搜索提供方、自定义 CSS 等。详见 [USER-GUIDE.zh-CN.md](USER-GUIDE.zh-CN.md)。

> **Docker 集成**保持上游原样：它走 Docker socket/API。本分支**未做 Podman 适配**，也不默认挂载 `/var/run/docker.sock`，所以这一页不会自动发现容器 —— 这是预期行为。

## Upgrade

**核心原则：镜像可以随时删除重建，`DATA_DIR` 绝对不要删。**

第一步对两种运行时都一样：

```bash
cd Flame-cn
git fetch --tags
git checkout v2.4.0-zh.3        # 换成目标版本
```

**Docker：**

```bash
docker build -f .docker/Dockerfile -t flame-cn:v2.4.0-zh.3 .

docker rm -f flame-cn
docker run -d --name flame-cn -p 5005:5005 --restart unless-stopped \
  -e PASSWORD='你的密码' \
  --env-file ~/qweather/qweather.env \
  -v ~/qweather/ed25519-private.pem:/run/secrets/qweather_ed25519.pem:ro \
  -v "$DATA_DIR":/app/data \
  flame-cn:v2.4.0-zh.3
```

用 compose 的话：`docker compose up -d --build`

**Podman：**

```bash
podman build --network=host -f .docker/Dockerfile -t flame-cn:v2.4.0-zh.3 .

podman rm -f flame-cn
podman run -d --name flame-cn -p 5005:5005 \
  -e PASSWORD='你的密码' \
  --env-file ~/qweather/qweather.env \
  -v ~/qweather/ed25519-private.pem:/run/secrets/qweather_ed25519.pem:ro \
  -v "$DATA_DIR":/app/data \
  --restart unless-stopped \
  flame-cn:v2.4.0-zh.3
```

**清理旧镜像（可选，只删镜像不删数据）：**

```bash
docker rmi flame-cn:v2.4.0-zh.2      # Docker
podman rmi flame-cn:v2.4.0-zh.2      # Podman
```

> **升级前请先读 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md) 的「升级注意」。**
> 例如 `v2.4.0-zh.2`/`zh.3` 起 `QWEATHER_AUTH_MODE` 变为**必填**：老配置只有 `QWEATHER_API_KEY`
> 时会显示「未配置」，补上 `QWEATHER_AUTH_MODE=api-key` 即可恢复。这类问题**只影响天气功能**。

数据目录中的数据库由 Flame 自动迁移，正常升级无需手工操作。

## Backup / Data

### 数据目录里有什么

容器内路径 `/app/data`（宿主机即 `DATA_DIR`）：

| 文件 / 目录 | 内容 |
|---|---|
| `config.json` | 全部应用设置（主题、天气源、经纬度、界面选项…） |
| `db.sqlite` | 应用、书签、分类、主题、天气记录（SQLite 数据库） |
| `uploads/` | 上传的图标与背景图（例如 `wallpaper.png`） |
| `themes.json` | 主题定义 |
| `customQueries.json` | 自定义搜索引擎 |
| `flame.css` | 你在「CSS」页签保存的自定义样式 |
| `.secret` | 用于签发登录 token 的密钥，**不要泄露，也不要删** |
| `db_backups/` | 数据库自动备份 |

### 备份

```bash
# 停一下更稳妥；也可以直接热备份
docker stop flame-cn            # Podman 用户换成：podman stop flame-cn
tar czf "flame-backup-$(date +%F).tar.gz" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
docker start flame-cn           # Podman 用户换成：podman start flame-cn
```

### 恢复

把备份解回同一个 `DATA_DIR`，然后按 [Quick Start](#quick-start) 第 4 步重新起容器即可。

> ⚠️ **不要删除 `DATA_DIR`**：所有应用、书签、设置、上传的壁纸都在里面。删容器、删镜像都不影响它；删它就等于恢复出厂设置。

## Security

- **凭据只走服务端。** QWeather 的 API Host、Credential ID、Developer ID、Project ID、API Key、JWT 与私钥**不会**出现在浏览器请求、响应体、前端 bundle 或页面 DOM 中；浏览器的全部流量只到 Flame 自己。
- **不要用 `-e KEY=value` 传凭据。** 那样凭据会明文出现在 `ps`、`docker inspect` / `podman inspect` 和 shell 历史里。请用 `--env-file` 加 **只读**挂载（`:ro`）的私钥文件。
- **私钥永不进入 Git。** 仓库里没有任何 `.pem`、密钥或真实凭据；请把它放在仓库目录之外（例如 `~/qweather/`）。
- **状态接口不泄露配置。** `GET /api/weather/status` 只返回 `provider` / `configured` / `authMode`，不返回 Host 或任何凭据。
- **日志不打印凭据。** 上游错误信息会保留 HTTP 状态与 `type`/`title`/`detail`/`invalidParams`，但其中的 Host、密钥、JWT 与 PEM 会被脱敏成 `[redacted-*]`；传输层失败（DNS/超时）的错误对象也会被清理掉请求配置与主机信息。
- **建议**：不要把 `5005` 端口直接暴露到公网。用 Nginx/Caddy 反向代理并配 HTTPS，必要时再套一层 VPN。Flame 的登录密码是唯一门槛，请使用强密码。
- **数据目录含 `.secret`**（签发登录 token 用），备份文件请妥善保管。

## Releases

| 版本 | 说明 |
|---|---|
| **`v2.4.0-zh.3`** | **当前正式版本。** 修复真实和风天气 API 响应格式不匹配（天气显示 0°C 的问题），已在真实专属 API Host + 真实 JWT 凭据下完成 HTTP 200 验证 |
| `v2.4.0-zh.2` | 首个引入 Ed25519 JWT 认证与凭据安全加固的候选版本 |
| `v2.4.0-zh.1` | 中文界面 + 独立壁纸层 + 上游主题机制恢复 |

**安装请始终使用 tag**：

```bash
git clone https://github.com/WillFunniers/Flame-cn.git
cd Flame-cn
git fetch --tags
git checkout v2.4.0-zh.3
```

- 最新正式版本与发行说明：<https://github.com/WillFunniers/Flame-cn/releases>
- 逐版本变更记录：[CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)
- `main` 与 `feature/zh-anime` 是开发分支，**不是**安装入口。

## Upstream

- 上游项目：[pawelmalak/flame](https://github.com/pawelmalak/flame)（本项目基于其 `v2.4.0` / `3e03c25`）
- 官方镜像：`pawelmalak/flame`
- 本分支目的：在不破坏上游结构的前提下提供中文界面、独立壁纸与和风天气支持。为了让上游同步保持容易，本分支**未修改** `.docker/Dockerfile`、`package.json` 依赖、天气数据模型与天气 UI 结构。
- 许可证：见 [LICENSE.md](LICENSE.md)（沿用上游）
- 第三方素材说明：[THIRD-PARTY-ASSETS.md](THIRD-PARTY-ASSETS.md)

## 项目内部文档

以下文件是开发过程的记录，普通使用者**不需要**阅读：

[AUDIT.md](AUDIT.md) · [REVIEW.md](REVIEW.md) · [FINAL-REPORT.md](FINAL-REPORT.md) · [I18N-DESIGN.md](I18N-DESIGN.md) · [I18N-INVENTORY.md](I18N-INVENTORY.md) · [THEME-DESIGN.md](THEME-DESIGN.md)
