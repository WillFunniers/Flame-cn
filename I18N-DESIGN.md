# I18N-DESIGN.md — Flame 中文二创 i18n 方案与基础设施（T3）

> 对应任务：task-3（T3）。上游与基线：`pawelmalak/flame` @ `3e03c25138df4321143c4fbd1a99468ff375ebb2`（v2.4.0）。
> 盘点输入：`I18N-INVENTORY.md`（T2，247 key + 39 豁免）。
> 约束：**零新增 npm 依赖**、不引入 Context Provider（兼容 React 17）、`t()` 必须能在组件外调用、不改后端。

## 1. 方案比选与结论

| 方案 | 说明 | 结论 |
| --- | --- | --- |
| A. 引入 i18next / react-intl / lingui | 功能完整（复数、ICU、懒加载、日期本地化） | ❌ 与「零新增依赖」硬约束冲突；bundle 体积与上游 diff 都显著变大 |
| **B. 轻量自建语言层（采用）** | 两个纯 TS 字典 + 模块级语言状态 + 5 个导出 API；`{name}` 插值；模块级订阅 + hook 驱动重渲染 | ✅ 零依赖、零 Provider、可在组件外调用、diff 小、易与上游同步 |
| C. 只用 React Context | 需要 Provider 包裹整棵树 | ❌ 任务明确要求不引入 Provider；且 store/utility 层无法用 hook |

**采用方案 B。** 语言状态是模块级单例（`let currentLang` + `Set<listener>`），组件通过 `useI18n()/useT()` 订阅；`t()` 直接读模块级状态，因此 `store/action-creators/*.ts`、`utility/*.ts` 等非组件代码也能调用。React 17 没有 `useSyncExternalStore`，所以用 `useState + useEffect` 订阅 + `useCallback([lang])` 保证语言切换后消费组件重渲染。

## 2. 文件清单（本任务新增，全部为 i18n owner 独占）

| 文件 | 作用 |
| --- | --- |
| `client/src/i18n/types.ts` | `Lang` / `Dictionary` / `Vars` / `Translate` 类型 |
| `client/src/i18n/en.ts` | 英文字典，**247 key，值逐字等于上游原文**（English 回归基准） |
| `client/src/i18n/zh-CN.ts` | 简体中文字典，**247 key，与 en 集合完全一致** |
| `client/src/i18n/index.ts` | 运行时：`LANGS` / `DEFAULT_LANG` / `getLang` / `setLang` / `t` / `useI18n` / `useT` |
| `client/src/i18n/check-keys.js` | 零依赖 key 集合一致性自检脚本（`node src/i18n/check-keys.js`） |
| `client/src/components/Settings/LanguageSettings/LanguageSettings.tsx` | 语言切换 UI（下拉，即切即生效并持久化） |
| `client/src/components/Settings/LanguageSettings/LanguageSettings.module.css` | 组件样式（仅宽度，复用 `InputGroup` 原子） |

## 3. 冻结 API 契约（实现与契约逐条对照）

```ts
// client/src/i18n/index.ts
export type Lang = 'en' | 'zh-CN';
export const LANGS: { code: Lang; label: string }[];   // [{code:'en',label:'English'},{code:'zh-CN',label:'简体中文'}]
export const DEFAULT_LANG: Lang;                       // 'en'
export function getLang(): Lang;                       // localStorage 'flame.lang' -> navigator.language(zh* => 'zh-CN') -> 'en'
export function setLang(lang: Lang): void;             // 持久化 + 通知订阅者 + 同步 document.documentElement.lang
export function t(key: string, vars?: Record<string, string | number>): string;
export function useI18n(): { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string };
export function useT(): (key: string, vars?: Record<string, string | number>) => string;
```

| 契约点 | 实现 | 证据 |
| --- | --- | --- |
| `Lang` 联合类型 | `types.ts` 定义，`index.ts` 用 `export type { ... } from './types'` 再导出 | `client/src/i18n/types.ts:1`、`index.ts:13` |
| `LANGS` 顺序/内容 | `[{code:'en',label:'English'},{code:'zh-CN',label:'简体中文'}]` | `index.ts:15-18` |
| `DEFAULT_LANG === 'en'` | `export const DEFAULT_LANG: Lang = 'en'` | `index.ts:20` |
| `getLang()` 优先级 | ① `localStorage['flame.lang']`（仅接受 `en` / `zh-CN` / `zh*`）② `navigator.language`：`zh*` → `zh-CN`，其余 → `en` ③ `DEFAULT_LANG` | `index.ts:78-99` |
| `setLang()` 三件事 | `localStorage.setItem('flame.lang')` + `listeners.forEach()` + `document.documentElement.lang = lang`；非法值直接 return | `index.ts:102-118` |
| `t()` 回退链 | 当前语言 → `en` → key 本身（用 `hasOwnProperty` 判断，**空字符串也是合法值**） | `index.ts:129-141` |
| `t()` 插值 | `{name}` 正则 `/\\{(\\w+)\\}/g`，未提供的占位符原样保留 | `index.ts:120-127` |
| `t()` 组件外可用 | 无 hook 依赖，仅读模块级 `currentLang` / 字典；`readStorage` 对 `localStorage` 不存在（SSR/测试）做 `typeof` 保护 | `index.ts:28-50` |
| `useI18n()` / `useT()` | 模块级 `Set<listener>` 订阅；`useState(getLang)` 初始化；`useCallback(..., [lang])` 使 `t` 在语言切换后换新引用 | `index.ts:144-176` |
| 无 Context Provider | 全文无 `createContext` / `Provider` | `grep -c createContext client/src/i18n/index.ts` → 0 |
| 零依赖 | 只 import `react`（已存在）与 `./en`、`./zh-CN`、`./types` | `grep -n "^import" client/src/i18n/index.ts` |

## 4. 字典结构与命名空间

- key 命名空间（与 tasks 约定一致）：`nav.*`(8) `home.*`(10) `search.*`(1) `apps.*`(32) `bookmarks.*`(42) `settings.*`(44) `ui.*`(19) `notify.*`(6) `error.*`(9) `auth.*`(0，见下) `theme.*`(27) `weather.*`(18) `docker.*`(6) `queries.*`(5) `app.*`(20)，合计 **247**。
- **`auth.*` 说明**：上游身份验证模块的用户可见文案全部落在「设置-应用」页（AppDetails/AuthForm），按 UI 归属收敛到 `app.*`（authentication/password/login/logout/session duration…）；`error.*` 覆盖错误类 toast。因此 `auth.*` 无独立 key，避免同义 key 重复。若后续新增认证页再启用该命名空间。
- 复数：上游没有需要复数的文案（无 `count` 类字符串），插值 key 共 11 个，全部是 `{name}` / `{status}` / `{field}` / `{version}` 形式，见 `I18N-INVENTORY.md §3`。

### 4.1 中英文差异处理要点（保持英文逐字 + 中文自然语序）

| 场景 | 处理方式 | key |
| --- | --- | --- |
| 句子中间夹 `<Link>` | 拆成 `…Prefix` + `<Link>` + `…Suffix` 三段，英文前后缀保留原有前后空格，中文按语序重排 | `home.welcomePrefix/Suffix`、`apps.emptyPinned*`、`apps.emptyNone*`、`bookmarks.empty*`、`apps.customOrderDisabledBefore` + `apps.settingsLink`、`bookmarks.customOrderDisabledBefore` + `bookmarks.settingsLink`、`bookmarks.editingFromPrefix/Suffix`、`weather.usingPrefix`/`weather.weatherApiLink`/`weather.apiKeyHintSuffix`、`app.seeChangelog`/`app.changelogLink`、`app.seeWiki*` |
| 英文句中 `settings` 小写链接词 | 单独 key，保持小写以逐字回归 | `apps.settingsLink` / `bookmarks.settingsLink` = `settings` / `设置` |
| 结尾加空格的差异（英文句末有空格，中文句末有「过期」等收尾） | 允许 en 值为空串（`hasOwn` 判定而非真值判定） | `app.loggedInExpiresSuffix`: en `''` / zh `' 过期'` |
| 大小写不同的同一含义（`App icon` vs `App Icon`） | 两个 key，逐字保留 | `apps.appIcon` / `apps.appIconUpload` |
| 技术名词与品牌 | zh 与 en 相同（Docker/API/URL/GitHub/SQLite/Kubernetes/MDI/Flame） | 见术语表 |
| 用户数据（分类名、应用名、自定义 schema） | 不进字典，原样渲染 | — |

## 5. 语言选择 UI

`client/src/components/Settings/LanguageSettings/LanguageSettings.tsx`：

```tsx
const { lang, setLang, t } = useI18n();
<label htmlFor="language">{t('settings.language')}</label>
<select id="language" name="language" value={lang} onChange={changeHandler}>
  {LANGS.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
</select>
```

- 复用既有 UI 原子 `InputGroup`（与 `Settings/UISettings` 的写法/类名约定一致），外层 `div.LanguageSettings` 仅声明 `width: 100%`。
- 切换立即生效（模块级订阅 → 所有 `useT()` 消费组件重渲染，无需刷新）并写入 `localStorage['flame.lang']`，同时同步 `<html lang>`。
- **挂载点（属 T4 范围）**：`components/Settings/UISettings/UISettings.tsx` 表单最顶部插入 `<SettingsHeadline text={t('settings.language')} />` + `<LanguageSettings />`，保证登录后在 `/settings/interface` 可见可用；不需要新增 `settings.json` 路由（避免修改路由数据文件）。
- 语言选项标签本身用语言的自称（`English` / `简体中文`），不随当前语言变化，便于用户找回。

## 6. 默认行为与回归保证

| 行为 | 规则 |
| --- | --- |
| 未设置 `localStorage['flame.lang']` | `navigator.language` 以 `zh` 开头 → `zh-CN`；否则 → `en`（保持 Flame 原版行为） |
| 非法 localStorage 值 | 忽略并回退到 navigator 判定 |
| `<html lang>` | 由 `setLang()`（会话内切换）与 **i18n 模块初始化**（首屏加载 / 刷新，T12 修复 F-04）双路径同步；`index.html` 的静态 `lang="en"` 不改（theme 独占文件） |
| English 逐字回归 | `en.ts` 的 247 个值逐字等于上游原文；T4 阶段用 `check-en-coverage.js` 对上游 baseline AST 抽取结果做机器比对（296 命中 / 14 条为已登记豁免） |
| 语言切换后旧通知 | 通知入队时即已固化为字符串（Redux notification payload 存 title/message 文本），**已显示/已入队**的通知不随语言切换变化；切换后**新产生**的通知使用新语言。这是有意的：避免历史通知文本被追溯改写 |
| `t()` 缺失 key | 返回 key 本身并回退 en，便于发现漏 key（T4 自检脚本保证不会出现） |

## 7. 验证命令与结果（T3 阶段实测）

```bash
# 1) 类型检查（本任务文件零错误）
cd $HOME/Flame/client && npx tsc --noEmit -p tsconfig.json
# → exit 0，无输出（T3 交付时仓库尚未做 T4 文案替换，全仓库基线本就 0 error）

# 2) en / zh-CN key 集合一致性
cd $HOME/Flame/client && node src/i18n/check-keys.js
# → en.ts keys      : 247
#    zh-CN.ts keys   : 247
#    missing in zh   : 0
#    missing in en   : 0
#    duplicate keys  : en 0, zh 0
#    KEY SETS MATCH   (exit 0)

# 3) 无 Context Provider / 零依赖
grep -c createContext client/src/i18n/index.ts     # → 0

# 4) 写入范围自查
cd $HOME/Flame && git status --short
# → ?? client/src/i18n/ 与 ?? client/src/components/Settings/LanguageSettings/（本任务）
```

## 8. 已知边界与豁免

1. `client/public/index.html` 的 `<title>Flame</title>`、`<meta name="description">`、`<noscript>` 文案不翻译：品牌名 + 非页面内文案，且该文件由 theme owner 独占（T4 不写）。
2. 后端 `controllers/`、`middleware/`、`utils/` 返回的英文 `error.message` 由前端 notification 直接展示 → 保留英文，不改后端逻辑；清单见 `I18N-INVENTORY.md §5`（14 类）。
3. 品牌/技术占位符（`Bookstack`、`reddit.com`、`book-open-outline`、`my_theme`、`52.22`、`dockerHost:port`…）保留英文，见 `I18N-INVENTORY.md §4`。
4. `utility/templateObjects/{settingsTemplate,configTemplate}.ts` 的 `greetingsSchema/daySchema/monthSchema` 英文默认值是**用户配置数据**（会写回后端 config），不进字典；中文默认值在 `greeter.ts` / `getDateTime.ts` 渲染时按「是否等于内置英文默认值」判定为「未自定义」后使用，用户自定义值永远优先。实现属 T4。
5. `store/action-creators/theme.ts` 的 3 处 toast 文案：Lead 已批准纯字面量例外（仅替换字面量 + 1 行 import，禁止改 setTheme/addTheme/deleteTheme/updateTheme/fetchThemes 逻辑），实现属 T4，并在 T4 报告中附完整 `git diff`。
6. 语言字段**不**写入后端 `Config`；`localStorage['flame.lang']` 是唯一持久化位置（Lead 冻结）。

## 9. T4 实现记录与验证证据（2026-04 定稿）

### 9.1 接入方式

| 层 | 写法 | 文件数 |
| --- | --- | --- |
| 函数组件（需要随语言重渲染） | `const t = useT();` + JSX/回调里 `t('key')` | 24 |
| 非组件模块（store/utility/纯函数） | `import { t } from '.../i18n'` + `t('key')` | 8（store×5、utility×2、App.tsx×1） |
| `language` 选择 UI 挂载 | `UISettings.tsx` 表单顶部：`<SettingsHeadline text={t('settings.language')} />` + `<LanguageSettings />` | 1 |
| `settings.json` 路由名 | `Settings.tsx` 渲染时 `nav.<name.toLowerCase()>`，查不到回退原 name（json 不改） | 1 |
| 问候语/日期 | `greeter.ts`、`getDateTime.ts` 用 `t()` + 内置英文默认值比对判定“未自定义”；中文用中文问候与 `YYYY年M月D日 星期X` | 2 |
| `store/action-creators/theme.ts` | Lead 批准的纯字面量例外：+1 行 import，5 处字面量 → `t()`，零逻辑改动 | 1 |

### 9.2 验证结果（可独立复跑）

| 验证 | 命令 | 结果 |
| --- | --- | --- |
| 类型 | `cd client && npx tsc --noEmit -p tsconfig.json` | exit 0，无输出 |
| key 集合 | `cd client && node src/i18n/check-keys.js` | `247 / 247 / missing 0 / KEY SETS MATCH`（exit 0） |
| 单元测试 | `cd client && npx react-scripts test --watchAll=false --testPathPattern=i18n` | T12 后 `Test Suites: 2 passed / Tests: 8 passed`（含“切语言即时重渲染”“持久化 + `<html lang>`”“**模块初始化的 `<html lang>` 同步**”“en 逐字/回退”） |
| 生产构建 | `cd client && npx react-scripts build`（不加 `CI=true`） | `Compiled with warnings.` + exit 0 |
| ESLint 回归 | 与 `$HOME/flame-baseline/client` 同命令构建后**逐条比对警告集合** | **与上游基线警告集合逐条一致（25 行 / 16 文件，0 新增、0 消失；仅 19 处行号位移）**。证据：reviewer `build-logs/review-evidence/out/eslint-warnings.json`（`verdict: {noNewWarnings: true, sameMultiset: true}`） |
| English 逐字回归（全局） | AST 抽取上游 310 条 → 与 `en.ts` 比对 | 命中 296，未命中 14（全部为已登记豁免） |
| English 逐字回归（逐文件） | 对改动的 39 个文件，把 `t('key')` 还原为 en 值后与上游同文件字符串比对 | **263 / 263 命中，0 未解释缺失** |
| 残留英文扫描 | AST 扫描 `client/src`（排除 theme 独占） | 14 条，全部为已登记豁免（示例占位符 7、brand 2、技术占位符 3、°C/°F 2） |
| theme 冻结 key | en/zh 双字典存在性检查 | 25 / 25 齐备 |

### 9.3 主题页（`Settings/Themer/**`）文案归属与收口状态

Lead 裁决（T4 后）：scope 缝隙澄清，**Themer.tsx / AnimeStyle/** 归 theme**，**ThemeBuilder.tsx / ThemeCreator.tsx / ThemeEditor.tsx 授权给 i18n**（3 个文件，本轮已收口）。

| 文件 | owner | 使用的 key | 状态 |
| --- | --- | --- | --- |
| `Themer/Themer.tsx` | theme | `theme.appThemes` `theme.userThemes` `theme.otherSettings` `theme.defaultThemeForNewUsers` `ui.saveChanges` | ✅ theme 已接入并实测 |
| `Themer/AnimeStyle/AnimeStyle.tsx` | theme | `theme.visualStyle` `theme.visualStyleHint` `theme.animeBackground` `theme.animeBackgroundHint` `theme.default` `theme.animeLight` `theme.animeDark` `theme.backgroundOn` `theme.backgroundOff` `theme.defaultDesc` `theme.animeLightDesc` `theme.animeDarkDesc` | ✅ theme 已接入并实测 |
| `Themer/ThemeBuilder/ThemeBuilder.tsx` | i18n | `theme.createNewTheme` `theme.editUserThemes` | ✅ 本轮接入 |
| `Themer/ThemeBuilder/ThemeCreator.tsx` | i18n | `theme.themeName` `theme.primaryColor` `theme.accentColor` `theme.backgroundColor` `theme.addTheme` `theme.updateTheme` | ✅ 本轮接入（`placeholder="my_theme"` 保留英文） |
| `Themer/ThemeBuilder/ThemeEditor.tsx` | i18n | `theme.deleteThemeConfirm` + `ui.name` `ui.actions`（表头） | ✅ 本轮接入；同时把 map 回调里与翻译函数同名的局部变量 `t` 改名为 `userTheme`，消除遮蔽隐患（纯局部变量重命名，行为不变） |
| `Themer/ThemeGrid/ThemeGrid.tsx`、`Themer/ThemePreview/ThemePreview.tsx` | theme | — | 无用户可见字面量 |

收口后 `Settings/Themer/**` 残留英文仅 1 处：`placeholder="my_theme"`（已登记豁免）。逐文件英文逐字回归：该 3 个文件 12/12 命中。

### 9.5 T12 修复：启动时同步 `<html lang>`（T9 finding F-04，MINOR）

- **缺陷**：`index.ts` 只在 `setLang()` 里调用 `syncDocumentLang()`；模块初始化（`getLang()` 从 localStorage/navigator 解析出 `zh-CN`）时，静态 `index.html` 的 `<html lang="en">` 不会被更新 → 首屏 `<html lang>` 与实际语言不一致（a11y / CJK 字体选择 / SEO 受影响，中文渲染本身正常）。
- **修复（最小改动，仅 `client/src/i18n/index.ts`）**：在模块末尾（`getLang`、`syncDocumentLang` 定义之后）追加一次
  ```ts
  // Sync <html lang> once when the module is first evaluated …
  syncDocumentLang(getLang());
  ```
  保留 `syncDocumentLang()` 内的 `typeof document !== 'undefined'` 守卫（SSR/无 DOM 环境不抛错）；该调用只是写一个 DOM 属性，不触发订阅者、不构成副作用循环。API 契约不变，`client/public/index.html` 未改动。
- **新增测试**：`client/src/i18n/__tests__/html-lang.test.ts`（4 条，fresh module load / navigator zh* / navigator 非 zh / 会话内切换）。
- **验证**：
  - `npx tsc --noEmit` → exit 0；`node src/i18n/check-keys.js` → 247/247 MATCH；`npx react-scripts test --watchAll=false --testPathPattern=i18n` → **2 suites / 8 tests passed**。
  - 真实浏览器（Playwright chromium，静态伺服 `client/build`）**8/8 断言通过**：
    - locale=`zh-CN` 首屏 → `document.documentElement.lang === 'zh-CN'`，页面含「欢迎使用 Flame！前往」与 `YYYY年M月D日 星期X`；
    - 持久化 `flame.lang=zh-CN` + en-US 浏览器刷新 → `lang === 'zh-CN'`；
    - 持久化 `flame.lang=en` 刷新 → `lang === 'en'`，页面为 `Welcome to Flame! Go to …` + 英文日期（DOM 文本为 title case，`innerText` 受样式 `text-transform` 影响显示大写）。

### 9.4 有意保留英文的清单（含原因）

| 位置 | 内容 | 原因 |
| --- | --- | --- |
| 通知正文（登录失败/主题名校验/查询前缀校验/404 等） | `Invalid credentials`、`Name must be unique`、`Prefix must be unique`、`Unauthorized`、`Server Error`、`Token expired`、`App/Bookmark/Category with the id of … was not found`、`External API request failed` | 后端 `error.message` 前端原样展示；不改后端逻辑（Lead 约束） |
| `client/public/index.html` | `<title>Flame</title>`、`<meta description>`、`<noscript>` | brand / 非页面内文案；文件属 theme 独占 |
| 示例占位符 | `Bookstack`、`bookstack.example.com`、`book-open-outline`、`Reddit`、`reddit.com`、`Social Media`、`Flame`(页面标题示例)、`secret`、`52.22`、`21.01`、`dockerHost:port`、`Google`、`g`、`https://www.google.com/search?q=`、`my_theme`、`••••••` | 示例产品/URL/MDI 图标名/技术格式，翻译会误导输入 |
| 品牌与符号 | `Flame`(AppDetails 链接)、`Docker`、`Kubernetes`、`API`、`URL`、`GitHub`、`MDI`、`Weather API`、`°C`、`°F`、`+` | 技术名词/品牌/单位，术语表规定保留英文 |
| 搜索提供方品牌名 | `Deezer`…`YouTube` 共 11 个（`Local search` 已翻译） | 产品名 |
| 用户数据默认值 | `templateObjects/{settingsTemplate,configTemplate}.ts` 的 `greetingsSchema/daySchema/monthSchema` | 属于会写回后端 config 的用户数据，不属 UI 字典 |

