# Flame 二次元主题设计（THEME-DESIGN.md）

- 任务：T5（task-4）二次元 Theme 与背景设计 + T6（task-6）设置 UI 与联调
- Owner：theme teammate
- 上游基线：`pawelmalak/flame` @ `3e03c25138df4321143c4fbd1a99468ff375ebb2`（`git describe` = `v2.4.0-2-g3e03c25`）
- 权威对照产物：`build-logs/baseline-build/`（Lead 提供的干净 worktree 构建，`static/css/main.289a6408.css`）

---

## 1. 设计目标与非目标

| | |
|---|---|
| 目标 | minimal / clean / soft / anime / personal / self-hosted；半透明卡片 + 轻毛玻璃 + 圆角 + 柔和阴影 + 背景轻遮罩 + Light/Dark 两套 + 移动端适配 |
| 非目标（明确禁止） | cyberpunk / neon / 强发光 / 高饱和 / 复杂动画 / 游戏风 dashboard；远程 URL / 在线字体 / 视频 / WebGL / 3D / 动画库；新增 npm 依赖 |
| 硬约束 | 不改上游主题机制（`setTheme` + `localStorage 'theme'` + 后端 `/api/themes`）；Default 外观零回归；不重写任何 `*.module.css` |

---

## 2. 架构：为什么是「独立视觉皮肤」而不是「新主题预设」

上游的主题 = **`<body>` 上的 3 个内联 CSS 变量**（`store/action-creators/theme.ts:22-24` 写入 `document.body.style`，变量定义在 `client/src/index.css:43-47` 的 `body` 规则里），主题列表来自后端 `/api/themes`（SQLite，写入 `utils/init/themes.json`）。新增一套“主题预设”需要改后端种子数据 + 重启数据库，且无法承载“背景图/毛玻璃/圆角”等结构性视觉。

本方案改为**正交的视觉皮肤层**：

```
<html data-theme="default | anime-light | anime-dark" data-bg="on | off">
        │
        ├── 皮肤层（新增）：client/src/styles/anime.css
        │     · 背景层 body::before（本地 SVG + 渐变遮罩 + 纯色兜底）
        │     · 卡片/搜索栏/Modal/表格/Toast 的半透明 + 圆角 + 柔和阴影 + 轻毛玻璃
        │     · 面板、层级、焦点环、prefers-reduced-motion、@supports 兜底
        │     只写「非 --color-*」的视觉，绝不定义/覆盖主题三变量
        │
        └── 配色层（沿用上游，零改动）：redux setTheme(palette)
              · 选择 Anime 皮肤时由 AnimeStyle 组件调用既有 setTheme(palette)
              · 选择 Default 时恢复用户原配色（localStorage 'theme'，无则 config.defaultTheme）
```

这样：上游主题机制一行未改；皮肤可以随时通过 `data-theme="default"` 关闭；后端与数据库零改动；未来上游合并成本 = 「1 个新 CSS 文件 + 1 个新 utility + 1 个新设置组件 + index.css 一行 @import + index.html 一段内联脚本」。

### 2.1 为什么 `anime.css` 里没有任何 `--color-*` 规则，以及「表面色必须由主题推导」

`setTheme` 把三变量写成 `<body>` 的**内联样式**，内联样式优先级高于任何选择器；而变量定义本身也在 `body` 上。因此：

- 在 CSS 里写 `html[data-theme="anime-light"] { --color-primary: … }` 对 `body` 及其后代**不生效**（只有 `body` 自身没有内联值时才会被继承，属于不可依赖的中间态）；
- 若强行用 `!important` 覆盖则等于篡改上游主题机制，且会把用户在 ThemeGrid 里选的主题一起锁死。

结论（与 Lead T1 硬约束一致）：**anime.css 只做非配色的视觉**，配色一律经 `setTheme(palette)`。
门禁：`grep -nE '^\s*--color-(background|primary|accent)\s*:' client/src/styles/anime.css` → **0 行**。

**T11 修复（MAJOR）：皮肤与配色是两个独立选择。** 用户可以在「视觉风格 = Anime Light」的同时在主题网格里选一个暗色主题（如 tron：#EFFBFF 亮字 / #242B33 暗底），反之亦然。所以凡是**影响文字可读性**的颜色都必须从当前主题推导，不得硬编码 light/dark 表面色：

```css
/* 边框：由 primary 推导 */
--anime-border: color-mix(in srgb, var(--color-primary) 14%, transparent);
/* 面板/卡片/弹窗底：由 background 推导（百分比 = 保留多少主题底色） */
--anime-panel:  color-mix(in srgb, var(--color-background) 56%, transparent);
--anime-card:   color-mix(in srgb, var(--color-background) 76%, transparent);
/* 不支持 color-mix 时回退为不透明的主题底色 → 即上游 primary-on-background 成对关系 */
@supports not (background-color: color-mix(in srgb, red 50%, transparent)) { … }
```

**两个必须记住的坑（都已踩过并写进注释）：**

1. **推导令牌必须声明在 `<body>` 上，不能声明在 `<html>` 上。** `var()` 是在「声明该自定义属性的元素」上做替换的：`--color-background` 只存在于 `<body>`（`index.css` 与 `setTheme` 的内联样式），若把 `--anime-panel: color-mix(… var(--color-background) …)` 写在 `html[data-theme=…]` 上，替换时 `<html>` 上没有这个变量 → 整条自定义属性变成 guaranteed-invalid → `background-color: var(--anime-panel)` 计算为 `transparent`（面板/卡片直接消失）。因此选择器是 `html[data-theme='anime-light'] body, html[data-theme='anime-dark'] body`（0,1,2 权重，高于 `index.css` 的 `body`，但低于 `setTheme` 写的内联值 —— 皮肤只「读」配色，绝不「写」配色）。
2. **背景层不使用 `color-mix`**：`body::before`（插画 + 纯色兜底）+ `body::after`（主题色 + `opacity`）两层，天然全浏览器可用，且插画永远被压进当前配色的明度区间（暗配色压暗、亮配色提亮）。

**最坏情况预算**：`(1 - wash) × (1 - panel)` = `0.42 × 0.44 ≈ 18%`，即插画最多只贡献 18% 的偏差；卡片再保留 80%。该预算由一次浏览器内 alpha 扫描（reviewer 的 ring-average 方法）确定，实测矩阵见 §7.2。

### 2.2 为什么 Container 面板不加 `backdrop-filter`

`filter` / `backdrop-filter` / `transform` 等属性会让祖先成为 `position: fixed` 后代的**包含块**。`<Container>` 内包含了 `position: fixed` 的 `<Modal>`（`components/Apps/Apps.tsx:75-76`、`components/Bookmarks/Bookmarks.tsx`）与首页左下角的 SettingsButton（`components/Home/Home.tsx`），若在其上使用毛玻璃，Modal 遮罩会退化为“相对面板定位并随页面滚动”。因此毛玻璃只加在**叶子级 surface**（AppCard / SearchBar / ModalForm / TableContainer / Notification）；`body::before` / `body::after` 也只有 `position: fixed` + `z-index: 0`，同样不影响 Modal 的定位上下文。


---

## 3. `data-theme` 契约

| 属性 | 取值 | 含义 | 来源 |
|---|---|---|---|
| `data-theme` | `default` | 上游原版外观（本文件所有规则都不匹配） | 默认值；`flame.style` 非法/缺失时 |
| | `anime-light` | 二次元浅色皮肤（日景背景） | `localStorage 'flame.style'` |
| | `anime-dark` | 二次元深色皮肤（夜景背景） | 同上 |
| `data-bg` | `on` | 显示背景插画 | 默认；`flame.bg !== 'off'` |
| | `off` | 关闭背景插画，仅保留渐变遮罩 + 纯色兜底 | `localStorage 'flame.bg' === 'off'` |

- 无属性 与 `data-theme="default"` **等价**（均无任何规则命中）。
- 首帧由 `client/public/index.html` 的内联 bootstrap 脚本写入（位于 `flame.css` 之后、`</head>` 之前），避免首屏闪烁；React 侧由 `utility/animeTheme.ts` 的 `applyBootThemeStyle()`（幂等）对齐，防止内联脚本被 CSP 拦截时状态不同步。
- `localStorage` 键：`flame.style`（皮肤）、`flame.bg`（背景）。**不写** `theme` 键（该键被上游 PAB 格式独占，`App.tsx:59` 启动时解析）。
- 皮肤选择的持久化在 `client/src/components/Settings/Themer/AnimeStyle/` 内额外使用一个私有键 `flame.theme.beforeAnime` 记住“切到 Anime 之前的用户配色”，以便切回 Default 时精确还原（Anime 皮肤调用的 `setTheme` 会覆盖 `localStorage 'theme'`）。

---

## 4. 设计令牌

所有令牌定义在 `client/src/styles/anime.css` 的 `html[data-theme=…]` 作用域内，前缀 `--anime-`。

### 4.1 配色（经 redux `setTheme` 应用，与 `THEME_STYLES[].palette` 一致）

| 令牌 | anime-light | anime-dark | 用途 |
|---|---|---|---|
| `--color-background` | `#fbf3f6`（樱白） | `#1b1a26`（夜蓝黑） | 页面底色 / 表格表头文字 / 反色 |
| `--color-primary` | `#2f2a3f`（墨紫） | `#f2edf7`（雾白） | 正文、标题、输入框底色、表头底色 |
| `--color-accent` | `#9d3b62`（深蔷薇） | `#f8b9d4`（樱粉） | 次强调文字、按钮描边、搜索栏下划线 |

> 浅色皮肤使用较深的 accent（`#9d3b62`），因为 accent 会作为 0.8em 的次要文字出现在卡片上；`#b1567f` 一类更“粉”的颜色在卡片上只有 4.0:1，不达标（见 §7）。

### 4.2 表面 / 遮罩 / 边框 / 阴影 / 圆角 / 模糊

所有表面令牌**都由当前主题推导**（T11 修复后），因此皮肤与配色可以任意组合：

| 令牌 | 值（`@supports` color-mix 路径） | 无 color-mix 回退 |
|---|---|---|
| `--anime-panel`（Container 面板，所有视口） | `color-mix(in srgb, var(--color-background) 56%, transparent)` | `var(--color-background)`（不透明） |
| `--anime-card`（AppCard / 搜索栏 / 表格 / 头部面板） | `color-mix(in srgb, var(--color-background) 76%, transparent)` | 同上 |
| `--anime-card-hover` | `color-mix(in srgb, var(--color-background) 86%, transparent)` | 同上 |
| `--anime-card-solid`（Modal / Toast） | `color-mix(in srgb, var(--color-background) 92%, transparent)` | 同上 |
| `--anime-border` / `-strong` | `color-mix(in srgb, var(--color-primary) 14% / 26%, transparent)` | `var(--color-primary)` |
| `--anime-scrim`（Modal 遮罩） | `color-mix(in srgb, #000 45%, transparent)` | `rgba(0,0,0,.45)` |
| `--anime-wash`（背景 wash 层的不透明度） | `0.58`（与配色无关） | `0.58` |
| `--anime-shadow` / `-soft` | `0 12px 34px rgba(0,0,0,.26)` / `0 6px 18px rgba(0,0,0,.18)`（中性黑，其上没有文字） | 同左 |
| `--anime-radius-panel` / `-card` / `-control` | `28px` / `16px` / `10px` | 同左 |
| `--anime-blur` | `10px` | 同左 |

> 文件里**仅剩** 4 个字面色值：3 个中性黑阴影/遮罩 + `color-mix(in srgb, #000 45%, transparent)` 的中性黑 scrim。它们都不承载文字，对任何配色都安全（Lead 已批准）。
> `--anime-bg-image`（日景/夜景）与 `color-scheme` 是皮肤自身的属性，与配色无关。

层级：`body::before`（插画 + 纯色兜底，`z-index: 0`）→ `body::after`（主题色 wash，`opacity: .58`，`z-index: 0`）→ `#root`（`z-index: 1`）→ 面板（56% 主题色，无模糊）→ 卡片（76% 主题色 + `blur(10px)` + 柔和阴影）→ 文字。
插画在面板内最多贡献 18% 的明度偏差，在面板外（页面留白/内容下方）为 42%，因此背景依然可见，只是柔和。

`box-shadow`/圆角/模糊数值刻意保持克制：无发光、无高饱和、无 `transform` 位移动画，唯一过渡是卡片 hover 的 `background-color / box-shadow .18s`。

---

## 5. 背景层与 fallback 策略

两层固定伪元素（都不使用 `color-mix`）：

```css
html[data-theme='anime-light'] body::before,
html[data-theme='anime-dark'] body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-color: var(--color-background);   /* 纯色兜底：插画加载失败时的最终底色 */
  background-image: var(--anime-bg-image);     /* 本地自制 SVG（可失败） */
  background-repeat: no-repeat;
  background-position: center top;
  background-size: cover;
}

html[data-theme='anime-light'] body::after,
html[data-theme='anime-dark'] body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-color: var(--color-background);   /* wash = 当前主题底色 */
  opacity: 0.58;                               /* 固定不透明度，任何浏览器可用 */
}

/* data-bg="off"：去掉插画与 wash，只剩平坦的主题底色 */
html[data-theme='anime-light'][data-bg='off'] body::before,
html[data-theme='anime-dark'][data-bg='off'] body::before { --anime-bg-image: none; }
html[data-theme='anime-light'][data-bg='off'] body::after,
html[data-theme='anime-dark'][data-bg='off'] body::after { opacity: 0; }
```

**fallback 保证（T11 之后的真实结构）**

1. **插画失败**：`body::before` 的 `background-color: var(--color-background)` 是列表最底层的纯色；插画 404/被拦截时该纯色直接成为页面底色，`body::after` 的 wash 再叠加，最终画面 = 平坦的主题底色，无破图、无白/黑块。
2. **对比度保证**：插画缺失时文字直接落在主题底色上（或半透明面板叠加主题底色），对比度等于配色的 `primary-on-background` 与 `accent-on-background`，只会**更高**。实测（运行时把 `anime-*.svg` 拦截为 404）：light 12.63 / 5.95，dark 14.92 / 10.54，均 ≥ 4.5。
3. **无 `color-mix` 环境**：面板/卡片底色回退为**不透明的主题底色** + `var(--color-primary)` 边框，即上游的成对关系，任何配色都可读，只损失半透明观感。
4. **无毛玻璃环境**：`@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px)))` 时卡片改用 `--anime-card-solid`（92% 主题色）。

**实测验证（T6 执行，证据见 §8）**：把 `--anime-bg-image` 临时指向不存在的路径 → 重新 build → 页面仍呈现柔和渐变、无破图、文字可读；随后必须还原路径并重新构建，最后以 `git diff` / `md5sum` 证明还原。

---

## 6. 移动端断点策略

| 断点 | 策略 |
|---|---|
| < 769px（含 390px） | Container 面板**存在**但为全幅「纸张」形态：`border-radius: 0`、左右无边框（因为上游容器在此宽度是 100%），其余（56% 主题色 + 阴影）不变；wash 与桌面同为 0.58；卡片保持 `--anime-radius-card` / `blur(10px)`；设置页 AnimeStyle 选项单列堆叠 |
| ≥ 620px | AnimeStyle 选项 2 列 |
| 769 – 1200px | Container 面板为卡片形态（56% 主题色 + 1px primary 边框 + 柔和阴影 + 28px 圆角） |
| ≥ 1000px | AnimeStyle 选项 3 列（1366px 下横排三选一） |
| ≥ 1201px | 沿用上游 `Layout_Container` 的 `padding: 50px 250px`（面板随内容区自然撑开） |
| 任意宽度 | 无横向溢出（新增规则不含固定宽度/负边距）；无 `position: fixed` 的新元素（背景层 `pointer-events: none`） |

---

## 7. 文本对比度

**测量方法（可复现）**：WCAG 2.1 相对亮度公式（sRGB，`L = 0.2126R + 0.7152G + 0.0722B`，通道先做 sRGB→linear 变换），对比度 `(L1+0.05)/(L2+0.05)`。
合成链：`插画像素 → 主题遮罩 gradient → 表面（面板 / 卡片）→ 文字色`。
**最坏值扫描**：把两幅 SVG 的**全部绘制颜色**（渐变 stop、纯色 fill、以及各自 `opacity` 先合成后的实际像素色，共 14 色/幅）在 9 个纵向位置（0…100%）上逐一合成，取最小值；不使用手工挑选的采样点。

脚本：`/tmp/theme-draft/contrast.js`。**注意：该解析模型只对「皮肤推荐的 palette」有效**（它把表面色当成了 anime-light/anime-dark 自己的浅/深色）。T11 之后表面色由当前 palette 推导，权威结论请看 §7.2 的浏览器像素矩阵。保留本节是为了记录推导过程与「最坏插画像素」方法。

| 场景 | anime-light | anime-dark | 门槛 |
|---|---|---|---|
| 桌面：正文/标题 on 面板（最坏插画像素） | **9.72** | **7.81** | ≥ 4.5 |
| 桌面：次强调文字（accent）on 面板 | **4.58** | **5.52** | ≥ 4.5 |
| 桌面：正文 on 卡片（AppCard/搜索/Modal/Toast） | **11.88** | **11.38** | ≥ 4.5 |
| 桌面：accent on 卡片 | **5.60** | **8.04** | ≥ 4.5 |
| < 769px：正文 on 加强遮罩（无面板） | **9.78** | **7.32** | ≥ 4.5 |
| < 769px：accent on 加强遮罩 | **4.61** | **5.17** | ≥ 4.5 |
| 无插画（纯色/纯渐变底）：正文 / accent | 12.63 / 5.95 | 14.92 / 10.54 | ≥ 4.5 |
| 反色态（Button hover：`--color-background` on accent 填充） | 5.95 | 10.54 | ≥ 4.5 |

结论（解析模型）：**全部 ≥ 4.5:1**，最小值 4.58（light、accent、最坏插画像素）。
大字（h1 4em / SectionHeadline 20px 900）另有 3:1 门槛，实测远超。

### 7.1 浏览器像素级实测（Playwright，非解析模型）

方法：把页面重新渲染成「隐藏 `#root`」的状态并截图（此时画面 = 真实背景层：`background-color` + 插画 + 遮罩），用 canvas 在**文字包围盒内 7×5 网格逐点采样**，取对比度最低的那一个像素；随后把该文字元素的**全部祖先半透明面**（面板 0.34/0.42 → 卡片 0.56/0.45）按 DOM 顺序合成到采样像素上，再与 `getComputedStyle` 的真实文字色按 WCAG 2.1 求对比度。脚本：`/tmp/theme-draft/verify-browser2.js`（T6 证据）。

| 场景（视口） | 文字 | anime-light | anime-dark | 门槛 |
|---|---|---|---|---|
| 1366 | Header 问候语（56px/700） | 13.02 | 15.37 | ≥ 3 |
| 1366 | 区块标题 Applications（20px/900） | 13.02 | 15.37 | ≥ 3 |
| 1366 | 应用卡片标题（14px/500） | 13.44 | 15.76 | ≥ 4.5 |
| 1366 | 应用卡片描述 `--color-accent`（11.2px） | **6.33** | 11.14 | ≥ 4.5 |
| 1366 | 书签分类 `--color-accent`（16px/400） | **6.13** | 10.86 | ≥ 4.5 |
| 1366 | 表格表头（16px） | 12.63 | 14.92 | ≥ 4.5 |
| 1366 | 表格单元（16px） | 13.44 | 15.76 | ≥ 4.5 |
| 768 | 卡片标题 / 卡片描述 accent | 13.27 / **6.25** | 15.53 / 10.97 | ≥ 4.5 |
| 390 | 卡片标题 / 卡片描述 accent | 13.27 / **6.25** | — | ≥ 4.5 |
| 1366 · `data-bg=off` | 卡片描述 accent | — | 10.86 | ≥ 4.5 |
| 1366 · Default（上游） | 卡片描述 accent | 9.52（tron 主题基线） | — | ≥ 4.5 |

**结论**：所有实测点 ≥ 4.5:1，最小值 **6.13:1**（anime-light、accent、卡片面）。
实测值高于解析模型的最坏值（4.58），说明 §7 的模型是保守上界（它假设文字正好压在插画最暗/最亮像素上）。
两套皮肤的实际最低点都出现在 accent 文字上，这也是浅色皮肤 accent 取较深蔷薇 `#9d3b62` 的原因。

---

### 7.2 T11 权威矩阵：皮肤 × 用户配色 × 视口（浏览器实测，reviewer 同款方法）

**方法完全复刻 reviewer 的 `build-logs/review-evidence/probe-theme-matrix.cjs`**：取首页前 10 个可见文本节点，逐元素滚动到视口中央后整屏截图，用 canvas 计算该文字包围盒 **外扩 3px 的边框环（最外 2px）平均色**作为“局部背景”，再与元素 `getComputedStyle` 的文字色按 WCAG 2.1 求对比度；正文门槛 4.5、大字（≥24px 或 ≥18.66px 且 ≥700）门槛 3.0。
脚本：`/tmp/theme-draft/probe-matrix.cjs`（复刻版），原始输出 `/tmp/theme-draft/out/matrix-{normal,fallback}.json|.txt`，截图 `/tmp/theme-draft/out/matrix-*.png`。

| 皮肤 | 配色 | 390×844 | 1366×768 | 面板实际值 | 结论 |
|---|---|---|---|---|---|
| default（上游） | tron | 0 FAIL，min 5.20 | 0 FAIL，min 5.26 | — | 基线 |
| **anime-light** | **tron** | **0 FAIL，min 4.91** | **0 FAIL，min 6.17** | `color(srgb .14 .17 .20 / .56)` | ✅ F-01 修复前为 7/7 FAIL、最低约 1.0–2.3 |
| anime-dark | tron | 0 FAIL，min 5.49 | 0 FAIL，min 7.00 | 同上 | ✅ |
| default | white | 4 FAIL，min 1.05 | 3 FAIL，min 1.05 | — | 上游基线同样失败 |
| anime-light | white | 4 FAIL，min 1.05 | 3 FAIL，min 1.10 | `color(srgb 1 1 1 / .56)` | 与基线**同一条目**失败 |
| anime-dark | white | 4 FAIL，min 1.02 | 3 FAIL，min 1.03 | 同上 | 与基线**同一条目**失败 |
| default | cloud（中对比） | 4 FAIL，min 1.43 | 3 FAIL，min 1.44 | — | 上游基线同样失败 |
| anime-light | cloud | 4 FAIL，min 1.42 | 3 FAIL，min 1.64 | `color(srgb .945 .949 .941 / .56)` | 与基线**同一条目**失败 |
| anime-dark | cloud | 4 FAIL，min 1.34 | 3 FAIL，min 1.54 | 同上 | 与基线**同一条目**失败 |

**逐探针比对（关键结论）**：按 `(文本, 文字色)` 对齐 12 组「皮肤 × 配色 × 视口」的失败集合后，**皮肤引入的新增失败 = 0**（12/12 组合 skin-only failures = 0）。
`white` / `cloud` 的失败全部来自**配色自身**——例如 white 的 accent `#dddddd` 在白底上只有 1.36:1、cloud 的 accent `#37bbe4` 在 `#f1f2f0` 上只有 1.99:1，**在 Default 皮肤下同样失败**（同一批探针：`Go to Settings` / `self-hosted startpage` / `files` / `media`）。皮肤无法在「primary 需要浅底、accent 需要深底」这种自相矛盾的配色里同时满足两者，除非改写用户配色（违反“皮肤不得改配色”）。

**`@supports` fallback 路径矩阵**（把 `@supports (background-color: color-mix(…))` 整块删除后重新构建，走不透明回退）：

| 皮肤 × 配色 | 面板实际值 | 390×844 | 1366×768 | skin-only failures |
|---|---|---|---|---|
| default + tron | — | 0 FAIL，5.20 | 0 FAIL，5.26 | — |
| anime-light + tron | `rgb(36,43,51)`（不透明） | **0 FAIL，5.38** | **0 FAIL，6.86** | 0 |
| anime-dark + tron | `rgb(36,43,51)` | **0 FAIL，5.38** | **0 FAIL，6.86** | 0 |
| anime-* + white | `rgb(255,255,255)` | 4 / 3 FAIL（= 基线） | 4 / 3 FAIL（= 基线） | 0 |
| anime-* + cloud | `rgb(241,242,240)` | 4 / 3 FAIL（= 基线） | 4 / 3 FAIL（= 基线） | 0 |

即：**不支持 `color-mix` 时皮肤退化为「上游成对关系」，可读性 = 上游，零回归。**

**alpha 取值依据（Lead 已批准 76% 这一项，扫描数据保留于此）**
浏览器内扫描（`/tmp/theme-draft/sweep-alphas.cjs`）在页面里直接覆盖 `--anime-wash / --anime-panel / --anime-card`，再按 reviewer 的 ring-average 方法测量，取 4 个最苛刻组合（anime-light+tron@390、anime-dark+white@390、anime-dark+cloud@390、anime-dark+tron@1366）的最差值：

| wash | panel | card | 最差探针 | 插画在面板内的透出 `(1-wash)(1-panel)` |
|---|---|---|---|---|
| 0.58 | 0.52 | 0.64 | 4.51 | 0.202 |
| 0.58 | 0.52 | 0.72 | 4.68 | 0.202 |
| 0.58 | 0.52 | 0.80 | 4.91 | 0.202 |
| 0.58 | 0.60 | 0.64 | 4.66 | 0.168 |
| 0.58 | 0.60 | 0.72 | 4.80 | 0.168 |
| 0.58 | 0.60 | 0.80 | 4.98 | 0.168 |
| 0.62 | 0.52 | 0.72 | 4.76 | 0.182 |
| 0.62 | 0.60 | 0.72 | 4.87 | 0.152 |
| 0.66 | 0.60 | 0.72 | 4.91 | 0.136 |
| 0.70 | 0.60 | 0.80 | 5.11 | 0.120 |

结论：**card 是最有效的杠杆**（0.64 → 0.80 把最差探针从 4.51 抬到 4.91），wash / panel 提高同样有效但会更快吃掉插画可见度。最终取折中点 **wash 0.58 / panel 56% / card 76%**（card 比 Lead 建议上限 75% 高 1pp，**已获 Lead 批准**），实建后实测最差探针 **4.91**（见上表），相对 4.5 门槛留约 9% 余量。

**验收口径（Lead 已批准，与 reviewer 的 F-03 判定一致）**：残留的 `white` / `cloud` accent 失败属**上游配色自身缺陷**（F-03 MINOR，Default 皮肤同样失败），因此皮肤侧的验收标准为 **「skin 引入的新增失败 = 0」/「不劣于 Default 上游基线」**；皮肤不得改写用户配色。

## 8. 文件清单（本方案新增 / 修改）

### 新增

| 文件 | 说明 |
|---|---|
| `client/src/styles/anime.css` | 皮肤全部规则（约 290 行，20 条规则 / 56 个选择器），100% 限定在 anime 作用域 |
| `client/src/assets/backgrounds/anime-day.svg` | 自制原创抽象日景（4599 B） |
| `client/src/assets/backgrounds/anime-night.svg` | 自制原创抽象夜景（6076 B） |
| `client/src/utility/animeTheme.ts` | 皮肤状态存取 + `<html>` 属性同步 + `useThemeStyle()`（冻结契约，4488 B） |
| `client/src/components/Settings/Themer/AnimeStyle/AnimeStyle.tsx` | 视觉风格三选一 + 背景开关 |
| `client/src/components/Settings/Themer/AnimeStyle/AnimeStyle.module.css` | 上述组件样式（响应式 1/2/3 列） |
| `THEME-DESIGN.md` | 本文件 |
| `THIRD-PARTY-ASSETS.md` | 素材来源与制作说明 |

构建产物（`client/build`，非入库）：`static/media/anime-day.<hash>.svg` 4599 B、`static/media/anime-night.<hash>.svg` 6076 B。
CRA 只对 `bmp/gif/jpeg/png` 做 10 KB 内联（`webpack.config.js` 的 `imageInlineSizeLimit`），CSS `url()` 引用的 **SVG 走 `asset/resource` 单独出文件**，因此：
- 背景插画是**独立请求**（HTTP 200 可被 T8 断言）；
- Default 皮肤下 `body::before` 规则不匹配 → 浏览器**不会请求**这两个文件（实测：Default 场景 0 个 `static/media/anime-*` 请求），首屏增量为 0 字节。


### 修改（最小追加）

| 文件 | 改动 |
|---|---|
| `client/src/index.css` | 文件最前面新增 1 行 `@import './styles/anime.css';`（+ 注释）；`body` 的三变量定义行未动 |
| `client/public/index.html` | `<head>` 内、`flame.css` 之后新增 1 段内联 bootstrap `<script>`；`title`/`meta` 未动 |
| `client/src/components/Settings/Themer/Themer.tsx` | 挂载 `<AnimeStyle />`（位于 “App themes” 之上）；可见文案改走 `useT()` |

### 明确未改动

`client/src/i18n/**`、`client/src/App.tsx`、`client/src/index.tsx`、`Settings/Themer/{ThemeGrid,ThemePreview,ThemeBuilder}/**`、`Settings/` 下其它目录、`store/**`、`utility/` 除 `animeTheme.ts` 外的文件、任何 `*.module.css`、后端、Docker/K8s/Skaffold、`package.json` 与两个 lockfile。

---

## 9. i18n key 依赖清单（theme 侧只使用、不修改）

`AnimeStyle.tsx` / `Themer.tsx` 通过 `import { useT } from '../../../../i18n';` 使用以下 key（Lead 冻结）：

| key | 用在哪 |
|---|---|
| `theme.visualStyle` | AnimeStyle 区块标题 / radiogroup 的 aria-label |
| `theme.visualStyleHint` | 区块说明 |
| `theme.default` / `theme.animeLight` / `theme.animeDark` | 三个选项名称（来自 `THEME_STYLES[].labelKey`） |
| `theme.defaultDesc` / `theme.animeLightDesc` / `theme.animeDarkDesc` | 每个选项下一行说明 |
| `theme.animeBackground` | 背景开关 label |
| `theme.animeBackgroundHint` | 背景开关说明 |
| `theme.backgroundOn` / `theme.backgroundOff` | 背景开关两个选项 |
| `theme.appThemes` / `theme.userThemes` / `theme.otherSettings` / `theme.defaultThemeForNewUsers` | Themer.tsx 原有可见文案 |
| `ui.saveChanges` | Themer.tsx “Save changes” |

兜底：若 i18n 最终使用 `theme.saveChanges` 而非 `ui.saveChanges`，theme 侧改一行常量即可（T6 收口时以 `client/src/i18n/en.ts` 实际 key 为准，实测 `grep` 结果记入 T6 报告）。

---

## 10. 验证方式（Default 零回归）

1. **作用域守卫（机检）**：`node check-scope.js client/src/styles/anime.css`
   规则：把 `anime.css` 解析成全量选择器，要求**每一个**逗号分隔的选择器都以 `html[data-theme="anime-light"]` 或 `html[data-theme="anime-dark"]` 开头，且文件内 0 处出现 `data-theme="default"`。
2. **产物级规则 diff（机检，权威）**：`node css-regression.js build-logs/baseline-build/static/css/main.289a6408.css client/build/static/css/main.*.css`
   做法：把两个 CSS 产物解析成 `<媒体上下文>||<选择器>` → 声明体 的规则表（解析器对 baseline 自比对必须 0 删除 / 0 修改），比较 baseline 与本次构建：
   - `REMOVED = 0` 且 `CHANGED = 0` → **没有任何上游规则被删除或修改**；
   - `ADDED` 中所有含 `data-theme` 的规则 = 本皮肤；不含 `data-theme` 的规则若出现，则必须来自其它成员的新组件（i18n 的 LanguageSettings 等），逐条列出。
   CSS Modules 的类名 hash 只由「文件路径 + 类名」决定（`react-dev-utils/getCSSModuleLocalIdent.js`），与文件内容无关，因此 baseline 与本构建的类名（如 `AppCard_AppCard__xxxxx`）完全一致，可直接做选择器级比对。
3. **DOM 属性级证明**：`data-theme` 缺失 / `= "default"` 两种情况下，浏览器的计算样式必须完全相同（T6 用 Playwright 比较代表性元素：`body`、卡片、搜索栏、输入框、表头），而切到 `anime-dark` 后必须出现差异。
4. **默认态零新增元素**：皮肤不新增任何 React 组件/DOM 节点；唯一新增的可视元素是 `body::before` 伪元素，而它只在 anime 作用域内生成（Default 下 `content` 规则不匹配 → 伪元素不存在）。

### 10.1 背景 fallback 的验证方式与结论（T6 实测）

**先说一个构建事实**：CRA/webpack 的 `css-loader` 在**构建期**解析 CSS `url()`。若把 `anime.css` 的 URL 改成不存在的文件，`npx react-scripts build` 会直接失败：

```
Failed to compile.
Module not found: Error: Can't resolve '../assets/backgrounds/anime-day-MISSING.svg'
```

（实测：改坏路径后 `BUILD=1`，且 CRA 会先清空 `client/build`，因此必须立刻还原并重建。）
所以「改错路径 → rebuild」这条路在 CRA 下**不可用**，只能验证到「构建期能发现资源缺失」。运行时 fallback（CDN/代理/网络故障、或文件被替换）才是真正需要兜底的场景，改用下面两种更强的验证：

| 验证 | 做法 | 结果 |
|---|---|---|
| A. 运行时 404 | Playwright 拦截 `**/static/media/anime-*.svg` → 返回 404；`flame.bg=on` | `body::before` 的 `background-image` 变为 `none, linear-gradient(...)`；采样到的背景像素 = `rgb(251,243,246)`（light）/ `rgb(27,26,38)`（dark），即纯色 + 渐变；0 个页面错误 |
| B. 还原后正常态 | 不做拦截 | 插画请求 200；采样像素为柔和渐变 + 插画；0 个页面错误 |

两种状态下 `body::before` **始终**同时具备三层：`background-color`（纯色兜底）+ `linear-gradient`（渐变遮罩/兜底）+ 可选的插画层；文字对比度在 404 状态下反而更高（light 卡片标题 13.27:1、accent 6.25:1；dark 15.53:1 / 10.97:1，均 ≥ 4.5）。命令与完整输出见 T6 报告与 `/tmp/theme-draft/verify-fallback.js`。

还原证明：`cp` 回原文件后 `md5sum client/src/styles/anime.css` = `5c5aac5ed73edbeb409ea27b9315635d`（与改动前一致），并重新构建成功。

### 10.2 关键实测命令汇总

```bash
cd client && npx tsc --noEmit -p tsconfig.json          # 0 error
cd client && npx react-scripts build                     # Compiled with warnings, exit 0
node check-scope.js client/src/styles/anime.css          # 0 unscoped selectors, 0 data-theme="default"
node css-regression.js <baseline.css> client/build/static/css/main.*.css
                                                          # REMOVED 0 / CHANGED 0 / ADDED 20 (all data-theme)
node verify-browser2.js                                   # 134/134 checks passed
node verify-fallback.js blocked --block                   # fallback cases PASSED
```


---

## 11. 已知问题 / 取舍

1. **`<meta name="description">` 与 `<title>Flame</title>` 未翻译**：`index.html` 属 theme 独占文件，按 Lead 冻结只新增内联脚本，不改 title/meta；brand 名 Flame 不翻译，`meta description` 非 UI 文案，属已知豁免（中文站点的 SEO/描述文案如需本地化，应由 Lead 决定后在后续任务处理）。
2. **CSS Modules 选择器依赖生成规则**：通过 `[class*="文件_类名__"]` 命中组件 surface。若上游未来更换构建器或改 `localName` 规则，仅“卡片/面板/模糊”这些增强会失效，配色与文字仍由主题三变量保证（渐进降级）。已尽量选择**叶子级**、语义稳定的类名。
3. **皮肤可见度取舍（T11 之后）**：表面色由配色推导后，插画在面板内只贡献 ≤18% 的明度偏差（面板外 42%），因此背景比 T6 版本更“柔和/更淡”。这是保证「任意配色组合都可读」的必然代价：最苛刻组合（anime-light 皮肤 + tron 暗色配色的亮 accent）需要 ~82% 的主题色压制。alpha 已经过扫描挑选（见 §7.2 末）。
4. **配色自身的 accent 缺陷不由皮肤修复**：如 §7.2 所述，`white`/`cloud`/`neon` 等配色的 accent 与自身背景对比度本来就不足 4.5（上游 Default 皮肤同样失败）。皮肤保证「不比上游更差」，不重写用户配色。
5. **移动端**：< 769px 时 wash 与桌面相同（0.58），面板改为全幅纸张形态（无左右边框/圆角），因此文字始终落在面板/卡片上而不是直接压在插画上。小屏裁切后插画细节最密集，加上 18% 的透出比例，背景在手机上更像柔和纹理。
5. **`backdrop-filter` 的一致性问题**：Chromium/Firefox 支持，Safari 需 `-webkit-` 前缀（CRA 的 autoprefixer 依据 `browserslist` 自动补齐）；完全不支持的环境走 `@supports` 兜底（近不透明表面）。
6. **`data-theme="default"` 属性始终存在**（由 bootstrap 写入）：属性本身不参与任何选择器，视觉与「无属性」完全一致；保留它可以让 DevTools 与自动化测试更容易判断状态。
7. **字体未更换**：沿用上游 Roboto（本地 `assets/fonts`），不引入在线字体；二次元气质由插画、圆角、柔和阴影与配色承担。
8. **Theme 页在 Default 皮肤下也会出现「视觉风格」区块**（设计如此，Task-6 要求放在 “App themes” 之上便于发现）。它不改变上游任何既有元素的外观，只是新增一段设置 UI；皮肤选择本身对未登录用户也可用（纯前端 localStorage）。
9. **无 CJK 字体的环境里，Playwright 截图会显示豆腐块**：本机 headless chromium 未安装中文字体（`fc-list :lang=zh` 为空），因此 `themer-animestyle-zh.png` 里中文渲染为 □□□——**这是截图环境的字体问题，不是应用问题**：同一轮的 DOM 断言已确认文本为 `默认 / 二次元浅色 / 二次元深色 / 开启 / 关闭`。T8/T9 若要用截图判定中文显示，需先为该环境安装中文字体（例如 `fonts-noto-cjk`）。
10. **`flame.theme.beforeAnime` 这个额外键**：仅用于「切回 Default 时还原用户原配色」，因为皮肤调色是经上游 `setTheme` 写入 `localStorage 'theme'` 的，会覆盖用户原值。它不在冻结的 `flame.style` / `flame.bg` 契约里，只是 AnimeStyle 组件的内部实现细节（同名键在进入 Anime 皮肤时写入、切回 Default 时删除）。
11. **上游 `checkVersion()` 会请求 `raw.githubusercontent.com`**（`utility/checkVersion.ts:8`，上游既有行为，与本皮肤无关）：T9 若以「在线请求必须为 0」判定，需要把这条上游既有请求单独标注豁免。

