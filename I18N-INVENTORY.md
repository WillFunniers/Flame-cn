# I18N-INVENTORY.md — Flame 用户可见英文字符串全量盘点

> 任务：T2（task-2）用户可见英文 UI 全量盘点。本文件只做盘点与方案输入，**不修改任何源码**。
> 基线：`pawelmalak/flame` @ `3e03c25138df4321143c4fbd1a99468ff375ebb2`（v2.4.0），前端 `client/`。
> 盘点方法：对 `client/src/**/*.{ts,tsx}` 用 TypeScript Compiler API 做 AST 扫描（`JsxText`、`JsxAttribute`、条件表达式子节点、`window.confirm`、对象字面量 `title`/`message`/`headers`、模板字符串、变量声明字面量），再逐文件人工核对 `client/public/index.html`、`client/src/**/*.css`（`content:`）、`utility/searchQueries.json`、`utility/templateObjects/*` 与后端 `controllers/`、`middleware/`、`utils/`。

## 0. 统计

| 指标 | 数值 |
| --- | --- |
| 需接入 i18n 的字典 key 总数 | **247** |
| 其中含插值占位符的 key | 11 |
| 明确标注“第一阶段不覆盖”的条目 | 39 |
| en / zh-CN key 集合一致性要求 | 完全一致（构建期自检） |
| 新增 npm 依赖 | 0 |

按区域（namespace）分组计数：

| namespace | key 数 | 覆盖 UI 区域 |
| --- | --- | --- |
| `settings.*` | 44 | Settings / GeneralSettings / UISettings / WeatherSettings / StyleSettings / DockerSettings / AppDetails |
| `bookmarks.*` | 42 | Bookmarks.tsx / BookmarkCard / BookmarkGrid / Form / Table |
| `apps.*` | 32 | Apps.tsx / AppCard / AppForm / AppGrid / AppTable |
| `theme.*` | 27 | 设置-主题（Themer 目录由 theme owner 接入这些 key） |
| `app.*` | 20 | AppDetails / AuthForm |
| `ui.*` | 19 | Button/Headline/Spinner/Table/Modal/表单提示 |
| `weather.*` | 18 | 设置-天气 |
| `home.*` | 10 | 首页、页眉 Header、greeter.ts、getDateTime.ts |
| `error.*` | 9 | Toast / window.confirm / 表单校验 |
| `nav.*` | 8 | 设置页左侧导航、页面 Headline |
| `docker.*` | 6 | 设置-Docker（仅文案，不改产品逻辑） |
| `notify.*` | 6 | NotificationCenter |
| `queries.*` | 5 | 设置-通用-CustomQueries |
| `search.*` | 1 | 搜索栏、搜索提供方 |
| **合计** | **247** | |

不覆盖条目分布（共 39 条登记）：

| 类别 | 条数 | 原因摘要 |
| --- | --- | --- |
| `client/public/index.html`（html lang / meta description / title / noscript） | 4 | 非页面内 UI 文案或品牌名；index.html 由 theme owner 独占，本阶段不改；`<html lang>` 由 `setLang()` 运行时同步 |
| 示例占位符（Bookstack / reddit.com / my_theme / secret / 52.22 / dockerHost:port / Google / g / MDI 图标名 等） | 14 | 示例产品名、示例 URL、MDI 图标名、技术格式示例，翻译反而误导用户 |
| 品牌与无语言符号（Flame / °C / °F / `+` / 密码掩码） | 4 | 品牌名保留英文；温度符号与标记符号无语言 |
| 品牌搜索提供方名 | 12 个中的 11 个 | searchQueries.json 共 12 个提供方：Deezer/Disroot/DuckDuckGo/Google/IMDb/Reddit/Spotify/The Movie Database/Tidal/Wikipedia/YouTube 共 11 个产品名保留英文；`Local search` 走 `search.localSearch`（渲染时映射，json 不改） |
| 模板默认数据（settingsTemplate.ts / configTemplate.ts 的 greetingsSchema、daySchema、monthSchema 英文默认值） | 2 类 | 属于**用户配置数据**（会写回后端 config），不是 UI 字典；中文默认值在 `greeter.ts` / `getDateTime.ts` 渲染时按“是否被用户自定义”判定后使用 |
| 后端返回错误的英文文案（controllers / middleware / utils） | 14 | 前端 notification 直接展示 `error.message`；本阶段**不改后端逻辑**，保留英文 |

## 1. 统一术语表（强制）

| 英文 | 中文 | 备注 |
| --- | --- | --- |
| Application | 应用 | 含 apps.* 与 settings.appsSection，统一“应用”，不使用“程序/应用程序” |
| App | 应用 | 同上 |
| Bookmark | 书签 | bookmarks.* 全量统一 |
| Category | 分类 | 书签分类，不使用“类别” |
| Settings | 设置 | nav.settings / settings.* / ui.goBack 上下文 |
| Theme | 主题 | theme.*；Themer 目录由 theme owner 接入同一批 key |
| Search | 搜索 | search.* / settings.searchSection；不译作“检索” |
| Save | 保存 | ui.saveChanges=保存更改、settings.saveCss=保存 CSS |
| Cancel | 取消 | 当前上游无 Cancel 按钮；保留词条以备 Modal 复用 |
| Delete | 删除 | confirm 文案统一“确定要删除…吗？” |
| Edit | 编辑 | apps.edit / bookmarks.editCategories / theme.editUserThemes |
| Add | 添加 | apps.add=添加、addNewXxx=添加新… |
| Update | 更新 | updateApplication=更新应用 等 |
| Password | 密码 | app.password；placeholder 掩码不翻译 |
| Username | 用户名 | 当前上游无用户名输入；保留词条 |
| Authentication | 身份验证 | app.authentication；不使用“认证/鉴权” |
| Visible | 可见 | apps.visible / bookmarks.visible |
| Hidden | 隐藏 | apps.hidden / bookmarks.hidden |
| Language | 语言 | settings.language（新增语言切换） |
| Confirm | 确定 | window.confirm 一律“确定要…吗？” |
| True / False | 是 / 否 | ui.true / ui.false（设置页布尔下拉） |
| Docker | Docker | 技术名词，保留英文 |
| Docker host | Docker 主机 | Docker 保留英文 + 中文“主机” |
| Kubernetes | Kubernetes | 技术名词，保留英文 |
| API | API | 技术名词，保留英文；API key=API 密钥 |
| URL | URL | 技术名词，保留英文 |
| GitHub | GitHub | 技术名词，保留英文；changelog/wiki 链接 URL 不改 |
| SQLite | SQLite | 技术名词，保留英文；前端不出现、后端不改 |
| MDI | MDI | 图标库名，保留英文；book-open-outline 等图标名不翻译 |
| toast | 通知 | 文档内描述用词，不出现在 UI |
| empty state | 空状态 | 文档内描述用词，不出现在 UI |

## 2. 逐条盘点清单

字段说明：**类型** 取自任务书要求的分类；**复现路径** 为该字符串在 UI 中可见的层级（首页 / 搜索 / 应用页 / 书签页 / 设置-xx / 身份验证 / 主题 / 通知中心）。

### 1. 导航与页面标题（nav.*）

覆盖范围：设置页左侧导航、页面 Headline（8 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `nav.settings` | `client/src/components/Settings/Settings.tsx:38` | Settings | 页面标题 | 设置 | 设置页顶部标题 |
| 2 | `nav.theme` | `client/src/components/Settings/settings.json:4` | Theme | 导航项 | 主题 | 设置左侧导航 |
| 3 | `nav.general` | `client/src/components/Settings/settings.json:9` | General | 导航项 | 通用 | 设置左侧导航 |
| 4 | `nav.interface` | `client/src/components/Settings/settings.json:14` | Interface | 导航项 | 界面 | 设置左侧导航 |
| 5 | `nav.weather` | `client/src/components/Settings/settings.json:19` | Weather | 导航项 | 天气 | 设置左侧导航 |
| 6 | `nav.docker` | `client/src/components/Settings/settings.json:24` | Docker | 导航项 | Docker | 设置左侧导航（技术名词保留英文） |
| 7 | `nav.css` | `client/src/components/Settings/settings.json:29` | CSS | 导航项 | CSS | 设置左侧导航（技术名词保留英文） |
| 8 | `nav.app` | `client/src/components/Settings/settings.json:34` | App | 导航项 | 应用 | 设置左侧导航 |

### 2. 首页与问候/日期（home.*）

覆盖范围：首页、页眉 Header、greeter.ts、getDateTime.ts（10 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `home.goToSettings` | `client/src/components/Home/Header/Header.tsx:42` | Go to Settings | 链接 | 前往设置 | 首页-页眉 |
| 2 | `home.applicationsSection` | `client/src/components/Home/Home.tsx:119` | Applications | 小节标题 | 应用 | 首页-应用区块标题 |
| 3 | `home.bookmarksSection` | `client/src/components/Home/Home.tsx:142` | Bookmarks | 小节标题 | 书签 | 首页-书签区块标题 |
| 4 | `home.searchResults` | `client/src/components/Home/Home.tsx:77` | Search Results | 动态分类名 | 搜索结果 | 首页-本地搜索结果分类名 |
| 5 | `home.welcomePrefix` | `client/src/components/Home/Home.tsx:110` | Welcome to Flame! Go to  | empty state | 欢迎使用 Flame！前往  | 首页-未登录引导 |
| 6 | `home.welcomeSuffix` | `client/src/components/Home/Home.tsx:110` | , login and start customizing your new homepage | empty state | ，登录后即可开始定制你的新主页 | 首页-未登录引导 |
| 7 | `home.greetingsDefault` | `client/src/components/Home/Header/functions/greeter.ts:7` | Good evening!;Good afternoon!;Good morning!;Good night! | date-greeting | 晚上好！;下午好！;早上好！;晚安！ | 首页-问候语默认值 |
| 8 | `home.greetingHello` | `client/src/components/Home/Header/functions/greeter.ts:14` | Hello! | date-greeting | 你好！ | 首页-问候语兜底 |
| 9 | `home.daysDefault` | `client/src/components/Home/Header/functions/getDateTime.ts:4` | Sunday;Monday;Tuesday;Wednesday;Thursday;Friday;Saturday | date-greeting | 星期日;星期一;星期二;星期三;星期四;星期五;星期六 | 首页-星期默认值 |
| 10 | `home.monthsDefault` | `client/src/components/Home/Header/functions/getDateTime.ts:14` | January;February;March;April;May;June;July;August;September;October;November;December | date-greeting | 一月;二月;三月;四月;五月;六月;七月;八月;九月;十月;十一月;十二月 | 首页-月份默认值 |

### 3. 搜索（search.*）

覆盖范围：搜索栏、搜索提供方（1 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `search.localSearch` | `client/src/utility/searchQueries.json:44` | Local search | select option | 本地搜索 | 通用设置-搜索提供方下拉（渲染时映射） |

### 4. 应用页（apps.*）

覆盖范围：Apps.tsx / AppCard / AppForm / AppGrid / AppTable（32 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `apps.allApplications` | `client/src/components/Apps/Apps.tsx:81` | All Applications | 页面标题 | 全部应用 | 应用页标题 |
| 2 | `apps.add` | `client/src/components/Apps/Apps.tsx:88` | Add | button | 添加 | 应用页-操作按钮 |
| 3 | `apps.edit` | `client/src/components/Apps/Apps.tsx:95` | Edit | button | 编辑 | 应用页-操作按钮 |
| 4 | `apps.appName` | `client/src/components/Apps/AppForm/AppForm.tsx:110` | App name | label | 应用名称 | 应用页-新增/编辑 Modal |
| 5 | `apps.appUrl` | `client/src/components/Apps/AppForm/AppForm.tsx:124` | App URL | label | 应用 URL | 应用页-新增/编辑 Modal |
| 6 | `apps.appDescription` | `client/src/components/Apps/AppForm/AppForm.tsx:138` | App description | label | 应用描述 | 应用页-新增/编辑 Modal |
| 7 | `apps.placeholderDescription` | `client/src/components/Apps/AppForm/AppForm.tsx:143` | My self-hosted app | placeholder | 我的自托管应用 | 应用页-新增/编辑 Modal |
| 8 | `apps.descriptionHint` | `client/src/components/Apps/AppForm/AppForm.tsx:148` | Optional - If description is not set, app URL will be displayed | 提示文本 | 可选 - 若未填写描述，将显示应用 URL | 应用页-新增/编辑 Modal |
| 9 | `apps.appIcon` | `client/src/components/Apps/AppForm/AppForm.tsx:156` | App icon | label | 应用图标 | 应用页-新增/编辑 Modal |
| 10 | `apps.appIconUpload` | `client/src/components/Apps/AppForm/AppForm.tsx:183` | App Icon | label | 应用图标 | 应用页-新增/编辑 Modal（自定义上传） |
| 11 | `apps.appVisibility` | `client/src/components/Apps/AppForm/AppForm.tsx:206` | App visibility | label | 应用可见性 | 应用页-新增/编辑 Modal |
| 12 | `apps.addNewApplication` | `client/src/components/Apps/AppForm/AppForm.tsx:219` | Add new application | button | 添加新应用 | 应用页-Modal 提交 |
| 13 | `apps.updateApplication` | `client/src/components/Apps/AppForm/AppForm.tsx:221` | Update application | button | 更新应用 | 应用页-Modal 提交 |
| 14 | `apps.noMatch` | `client/src/components/Apps/AppGrid/AppGrid.tsx:19` | No apps match your search criteria | empty state | 没有符合搜索条件的应用 | 首页/应用页-搜索无结果 |
| 15 | `apps.emptyPinnedPrefix` | `client/src/components/Apps/AppGrid/AppGrid.tsx:33` | There are no pinned applications. You can pin them from the  | empty state | 没有已固定的应用。你可以前往  | 首页-应用区块空状态 |
| 16 | `apps.emptyPinnedSuffix` | `client/src/components/Apps/AppGrid/AppGrid.tsx:34` |  menu | empty state |  菜单固定它们 | 首页-应用区块空状态 |
| 17 | `apps.emptyNonePrefix` | `client/src/components/Apps/AppGrid/AppGrid.tsx:40` | You don't have any applications. You can add a new one from  | empty state | 你还没有任何应用。你可以前往  | 首页-应用区块空状态 |
| 18 | `apps.emptyNoneSuffix` | `client/src/components/Apps/AppGrid/AppGrid.tsx:41` |  menu | empty state |  菜单添加新应用 | 首页-应用区块空状态 |
| 19 | `apps.dragReorderHint` | `client/src/components/Apps/AppTable/AppTable.tsx:93` | You can drag and drop single rows to reorder application | 提示文本 | 你可以拖拽单行来重新排序应用 | 应用页-表格视图 |
| 20 | `apps.customOrderDisabledBefore` | `client/src/components/Apps/AppTable/AppTable.tsx:96` | Custom order is disabled. You can change it in the  | 提示文本 | 自定义排序已禁用。你可以在  | 应用页-表格视图 |
| 21 | `apps.settingsLink` | `client/src/components/Apps/AppTable/AppTable.tsx:97` | settings | 行内链接 | 设置 | 应用页-表格视图内链 |
| 22 | `apps.deleteConfirm` | `client/src/components/Apps/AppTable/AppTable.tsx:67` | Are you sure you want to delete {name}? | confirm | 确定要删除 {name} 吗？ | 应用页-删除确认 |
| 23 | `apps.visible` | `client/src/components/Apps/AppTable/AppTable.tsx:136` | Visible | 表格单元格 | 可见 | 应用页-表格可见性列 |
| 24 | `apps.hidden` | `client/src/components/Apps/AppTable/AppTable.tsx:136` | Hidden | 表格单元格 | 隐藏 | 应用页-表格可见性列 |
| 25 | `apps.iconAlt` | `client/src/components/Apps/AppCard/AppCard.tsx:27` | {name} icon | aria-label/alt | {name} 图标 | 应用卡片图片 alt |
| 26 | `apps.runSteamApp` | `client/src/utility/urlParser.ts:14` | Run Steam App | 表格单元格 | 运行 Steam 应用 | steam:// 应用卡片描述 |
| 27 | `apps.added` | `client/src/store/action-creators/app.ts:84` | App added | toast(notification) | 应用已添加 | 通知中心 |
| 28 | `apps.updated` | `client/src/store/action-creators/app.ts:140` | App updated | toast(notification) | 应用已更新 | 通知中心 |
| 29 | `apps.deleted` | `client/src/store/action-creators/app.ts:111` | App deleted | toast(notification) | 应用已删除 | 通知中心 |
| 30 | `apps.pinnedStatus` | `client/src/store/action-creators/app.ts:54` | pinned to Homescreen | toast(notification) | 已固定到主页 | 通知中心-固定 |
| 31 | `apps.unpinnedStatus` | `client/src/store/action-creators/app.ts:53` | unpinned from Homescreen | toast(notification) | 已从主页取消固定 | 通知中心-取消固定 |
| 32 | `apps.pinMessage` | `client/src/store/action-creators/app.ts:60` | App {name} {status} | toast(notification) | 应用 {name} {status} | 通知中心-固定/取消固定 |

### 5. 书签页（bookmarks.*）

覆盖范围：Bookmarks.tsx / BookmarkCard / BookmarkGrid / Form / Table（42 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `bookmarks.allBookmarks` | `client/src/components/Bookmarks/Bookmarks.tsx:146` | All Bookmarks | 页面标题 | 全部书签 | 书签页标题 |
| 2 | `bookmarks.addCategory` | `client/src/components/Bookmarks/Bookmarks.tsx:151` | Add Category | button | 添加分类 | 书签页-操作按钮 |
| 3 | `bookmarks.addBookmark` | `client/src/components/Bookmarks/Bookmarks.tsx:156` | Add Bookmark | button | 添加书签 | 书签页-操作按钮 |
| 4 | `bookmarks.editCategories` | `client/src/components/Bookmarks/Bookmarks.tsx:161` | Edit Categories | button | 编辑分类 | 书签页-操作按钮 |
| 5 | `bookmarks.finishEditing` | `client/src/components/Bookmarks/Bookmarks.tsx:167` | Finish Editing | button | 完成编辑 | 书签页-操作按钮 |
| 6 | `bookmarks.clickCategoryHint` | `client/src/components/Bookmarks/Bookmarks.tsx:177` | Click on category name to edit its bookmarks | 提示文本 | 点击分类名称即可编辑其中的书签 | 书签页-网格视图 |
| 7 | `bookmarks.noMatch` | `client/src/components/Bookmarks/BookmarkGrid/BookmarkGrid.tsx:29` | No bookmarks match your search criteria | empty state | 没有符合搜索条件的书签 | 首页/书签页-搜索无结果 |
| 8 | `bookmarks.emptyPinnedPrefix` | `client/src/components/Bookmarks/BookmarkGrid/BookmarkGrid.tsx:49` | There are no pinned categories. You can pin them from the  | empty state | 没有已固定的分类。你可以前往  | 首页-书签区块空状态 |
| 9 | `bookmarks.emptyPinnedSuffix` | `client/src/components/Bookmarks/BookmarkGrid/BookmarkGrid.tsx:50` |  menu | empty state |  菜单固定它们 | 首页-书签区块空状态 |
| 10 | `bookmarks.emptyNonePrefix` | `client/src/components/Bookmarks/BookmarkGrid/BookmarkGrid.tsx:56` | You don't have any bookmarks. You can add a new one from  | empty state | 你还没有任何书签。你可以前往  | 首页-书签区块空状态 |
| 11 | `bookmarks.emptyNoneSuffix` | `client/src/components/Bookmarks/BookmarkGrid/BookmarkGrid.tsx:57` |  menu | empty state |  菜单添加新书签 | 首页-书签区块空状态 |
| 12 | `bookmarks.bookmarkName` | `client/src/components/Bookmarks/Form/BookmarksForm.tsx:161` | Bookmark Name | label | 书签名称 | 书签页-Modal |
| 13 | `bookmarks.bookmarkUrl` | `client/src/components/Bookmarks/Form/BookmarksForm.tsx:175` | Bookmark URL | label | 书签 URL | 书签页-Modal |
| 14 | `bookmarks.bookmarkCategory` | `client/src/components/Bookmarks/Form/BookmarksForm.tsx:189` | Bookmark Category | label | 书签分类 | 书签页-Modal |
| 15 | `bookmarks.bookmarkIconOptional` | `client/src/components/Bookmarks/Form/BookmarksForm.tsx:212` | Bookmark Icon (optional) | label | 书签图标（可选） | 书签页-Modal |
| 16 | `bookmarks.bookmarkVisibility` | `client/src/components/Bookmarks/Form/BookmarksForm.tsx:260` | Bookmark visibility | label | 书签可见性 | 书签页-Modal |
| 17 | `bookmarks.updateBookmark` | `client/src/components/Bookmarks/Form/BookmarksForm.tsx:272` | Update bookmark | button | 更新书签 | 书签页-Modal 提交 |
| 18 | `bookmarks.addNewBookmark` | `client/src/components/Bookmarks/Form/BookmarksForm.tsx:272` | Add new bookmark | button | 添加新书签 | 书签页-Modal 提交 |
| 19 | `bookmarks.categoryName` | `client/src/components/Bookmarks/Form/CategoryForm.tsx:72` | Category Name | label | 分类名称 | 书签页-分类 Modal |
| 20 | `bookmarks.categoryVisibility` | `client/src/components/Bookmarks/Form/CategoryForm.tsx:85` | Category visibility | label | 分类可见性 | 书签页-分类 Modal |
| 21 | `bookmarks.updateCategory` | `client/src/components/Bookmarks/Form/CategoryForm.tsx:97` | Update category | button | 更新分类 | 书签页-分类 Modal 提交 |
| 22 | `bookmarks.addNewCategory` | `client/src/components/Bookmarks/Form/CategoryForm.tsx:97` | Add new category | button | 添加新分类 | 书签页-分类 Modal 提交 |
| 23 | `bookmarks.dragReorderCategoriesHint` | `client/src/components/Bookmarks/Table/CategoryTable.tsx:101` | You can drag and drop single rows to reorder categories | 提示文本 | 你可以拖拽单行来重新排序分类 | 书签页-分类表格 |
| 24 | `bookmarks.customOrderDisabledBefore` | `client/src/components/Bookmarks/Table/CategoryTable.tsx:104` | Custom order is disabled. You can change it in the  | 提示文本 | 自定义排序已禁用。你可以在  | 书签页-分类表格 |
| 25 | `bookmarks.settingsLink` | `client/src/components/Bookmarks/Table/CategoryTable.tsx:105` | settings | 行内链接 | 设置 | 书签页-表格内链 |
| 26 | `bookmarks.deleteConfirm` | `client/src/components/Bookmarks/Table/BookmarksTable.tsx:78` | Are you sure you want to delete {name}? | confirm | 确定要删除 {name} 吗？ | 书签页-删除确认 |
| 27 | `bookmarks.deleteCategoryConfirm` | `client/src/components/Bookmarks/Table/CategoryTable.tsx:73` | Are you sure you want to delete {name}? It will delete ALL assigned bookmarks | confirm | 确定要删除 {name} 吗？该分类下的所有书签都将被删除 | 书签页-分类删除确认 |
| 28 | `bookmarks.switchToGridHint` | `client/src/components/Bookmarks/Table/BookmarksTable.tsx:109` | Switch to grid view and click on the name of category you want to edit | 提示文本 | 切换到网格视图，然后点击你想要编辑的分类名称 | 书签页-书签表格 |
| 29 | `bookmarks.editingFromPrefix` | `client/src/components/Bookmarks/Table/BookmarksTable.tsx:113` | Editing bookmarks from | 提示文本 | 正在编辑分类 | 书签页-书签表格 |
| 30 | `bookmarks.editingFromSuffix` | `client/src/components/Bookmarks/Table/BookmarksTable.tsx:114` | category | 提示文本 | 中的书签 | 书签页-书签表格 |
| 31 | `bookmarks.visible` | `client/src/components/Bookmarks/Table/CategoryTable.tsx:142` | Visible | 表格单元格 | 可见 | 书签页-表格可见性列 |
| 32 | `bookmarks.hidden` | `client/src/components/Bookmarks/Table/CategoryTable.tsx:142` | Hidden | 表格单元格 | 隐藏 | 书签页-表格可见性列 |
| 33 | `bookmarks.iconAlt` | `client/src/components/Bookmarks/BookmarkCard/BookmarkCard.tsx:64` | {name} icon | aria-label/alt | {name} 图标 | 书签图标 alt |
| 34 | `bookmarks.categoryCreated` | `client/src/store/action-creators/bookmark.ts:67` | Category {name} created | toast(notification) | 分类 {name} 已创建 | 通知中心 |
| 35 | `bookmarks.categoryUpdated` | `client/src/store/action-creators/bookmark.ts:180` | Category {name} updated | toast(notification) | 分类 {name} 已更新 | 通知中心 |
| 36 | `bookmarks.categoryDeleted` | `client/src/store/action-creators/bookmark.ts:153` | Category deleted | toast(notification) | 分类已删除 | 通知中心 |
| 37 | `bookmarks.bookmarkCreated` | `client/src/store/action-creators/bookmark.ts:96` | Bookmark created | toast(notification) | 书签已创建 | 通知中心 |
| 38 | `bookmarks.bookmarkUpdated` | `client/src/store/action-creators/bookmark.ts:248` | Bookmark updated | toast(notification) | 书签已更新 | 通知中心 |
| 39 | `bookmarks.bookmarkDeleted` | `client/src/store/action-creators/bookmark.ts:207` | Bookmark deleted | toast(notification) | 书签已删除 | 通知中心 |
| 40 | `bookmarks.pinMessage` | `client/src/store/action-creators/bookmark.ts:129` | Category {name} {status} | toast(notification) | 分类 {name} {status} | 通知中心-固定/取消固定 |
| 41 | `bookmarks.pinnedStatus` | `client/src/store/action-creators/bookmark.ts:122` | pinned to Homescreen | toast(notification) | 已固定到主页 | 通知中心-固定 |
| 42 | `bookmarks.unpinnedStatus` | `client/src/store/action-creators/bookmark.ts:121` | unpinned from Homescreen | toast(notification) | 已从主页取消固定 | 通知中心-取消固定 |

### 6. 设置页（settings.*）

覆盖范围：Settings / GeneralSettings / UISettings / WeatherSettings / StyleSettings / DockerSettings / AppDetails（44 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `settings.language` | `client/src/components/Settings/UISettings/UISettings.tsx (新增)` | Language | label | 语言 | 设置-界面-语言选择 |
| 2 | `settings.updated` | `client/src/store/action-creators/config.ts:62` | Settings updated | toast(notification) | 设置已更新 | 通知中心 |
| 3 | `settings.general` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:87` | General | 小节标题 | 通用 | 设置-通用 |
| 4 | `settings.appsSection` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:104` | Apps | 小节标题 | 应用 | 设置-通用 |
| 5 | `settings.bookmarksSection` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:136` | Bookmarks | 小节标题 | 书签 | 设置-通用 |
| 6 | `settings.searchSection` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:170` | Search | 小节标题 | 搜索 | 设置-通用/界面 |
| 7 | `settings.customSearchProviders` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:238` | Custom search providers | 小节标题 | 自定义搜索提供方 | 设置-通用 |
| 8 | `settings.sortingType` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:90` | Sorting type | label | 排序方式 | 设置-通用 |
| 9 | `settings.sortByCreationDate` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:97` | By creation date | select option | 按创建日期 | 设置-通用 |
| 10 | `settings.sortAlphabetical` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:98` | Alphabetical order | select option | 按字母顺序 | 设置-通用 |
| 11 | `settings.sortCustomOrder` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:99` | Custom order | select option | 自定义顺序 | 设置-通用 |
| 12 | `settings.pinAppsByDefault` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:108` | Pin new applications by default | label | 默认固定新应用 | 设置-通用 |
| 13 | `settings.openAppsSameTab` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:123` | Open applications in the same tab | label | 在同一标签页中打开应用 | 设置-通用 |
| 14 | `settings.pinCategoriesByDefault` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:140` | Pin new categories by default | label | 默认固定新分类 | 设置-通用 |
| 15 | `settings.openBookmarksSameTab` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:156` | Open bookmarks in the same tab | label | 在同一标签页中打开书签 | 设置-通用 |
| 16 | `settings.primarySearchProvider` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:172` | Primary search provider | label | 主搜索提供方 | 设置-通用 |
| 17 | `settings.secondarySearchProvider` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:194` | Secondary search provider | label | 备用搜索提供方 | 设置-通用 |
| 18 | `settings.secondarySearchHint` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:213` | Will be used when "Local search" is primary search provider and there are not any local results | 提示文本 | 当“本地搜索”为主搜索提供方且没有本地结果时使用 | 设置-通用 |
| 19 | `settings.openSearchResultsSameTab` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:221` | Open search results in the same tab | label | 在同一标签页中打开搜索结果 | 设置-通用 |
| 20 | `settings.miscellaneous` | `client/src/components/Settings/UISettings/UISettings.tsx:61` | Miscellaneous | 小节标题 | 其他 | 设置-界面 |
| 21 | `settings.customPageTitle` | `client/src/components/Settings/UISettings/UISettings.tsx:64` | Custom page title | label | 自定义页面标题 | 设置-界面 |
| 22 | `settings.hideSearchBar` | `client/src/components/Settings/UISettings/UISettings.tsx:79` | Hide search bar | label | 隐藏搜索栏 | 设置-界面 |
| 23 | `settings.disableAutofocus` | `client/src/components/Settings/UISettings/UISettings.tsx:93` | Disable search bar autofocus | label | 禁用搜索栏自动聚焦 | 设置-界面 |
| 24 | `settings.headerSection` | `client/src/components/Settings/UISettings/UISettings.tsx:106` | Header | 小节标题 | 页眉 | 设置-界面 |
| 25 | `settings.hideHeadline` | `client/src/components/Settings/UISettings/UISettings.tsx:110` | Hide headline (greetings and weather) | label | 隐藏标题栏（问候语与天气） | 设置-界面 |
| 26 | `settings.hideDate` | `client/src/components/Settings/UISettings/UISettings.tsx:125` | Hide date | label | 隐藏日期 | 设置-界面 |
| 27 | `settings.hideTime` | `client/src/components/Settings/UISettings/UISettings.tsx:139` | Hide time | label | 隐藏时间 | 设置-界面 |
| 28 | `settings.dateFormatting` | `client/src/components/Settings/UISettings/UISettings.tsx:153` | Date formatting | label | 日期格式 | 设置-界面 |
| 29 | `settings.dateFormatUs` | `client/src/components/Settings/UISettings/UISettings.tsx:160` | Friday, October 22 2021 | select option | 2021年10月22日 星期五 | 设置-界面 |
| 30 | `settings.dateFormatIntl` | `client/src/components/Settings/UISettings/UISettings.tsx:161` | Friday, 22 October 2021 | select option | 2021年10月22日 星期五 | 设置-界面 |
| 31 | `settings.customGreetings` | `client/src/components/Settings/UISettings/UISettings.tsx:167` | Custom greetings | label | 自定义问候语 | 设置-界面 |
| 32 | `settings.placeholderGreetings` | `client/src/components/Settings/UISettings/UISettings.tsx:172` | Good day;Hi;Bye! | placeholder | 你好;早上好;再见! | 设置-界面 |
| 33 | `settings.customGreetingsHint` | `client/src/components/Settings/UISettings/UISettings.tsx:177` | Greetings must be separated with semicolon. All 4 messages must be filled, even if they are the same | 提示文本 | 问候语需用分号分隔。4 条消息都必须填写，即使内容相同 | 设置-界面 |
| 34 | `settings.customWeekdayNames` | `client/src/components/Settings/UISettings/UISettings.tsx:184` | Custom weekday names | label | 自定义星期名称 | 设置-界面 |
| 35 | `settings.placeholderWeekdays` | `client/src/components/Settings/UISettings/UISettings.tsx:189` | Sunday;Monday;Tuesday | placeholder | 星期日;星期一;星期二 | 设置-界面 |
| 36 | `settings.customMonthNames` | `client/src/components/Settings/UISettings/UISettings.tsx:198` | Custom month names | label | 自定义月份名称 | 设置-界面 |
| 37 | `settings.placeholderMonths` | `client/src/components/Settings/UISettings/UISettings.tsx:203` | January;February;March | placeholder | 一月;二月;三月 | 设置-界面 |
| 38 | `settings.namesSeparatedHint` | `client/src/components/Settings/UISettings/UISettings.tsx:193` | Names must be separated with semicolon | 提示文本 | 名称需用分号分隔 | 设置-界面 |
| 39 | `settings.sections` | `client/src/components/Settings/UISettings/UISettings.tsx:211` | Sections | 小节标题 | 板块 | 设置-界面 |
| 40 | `settings.hideApplications` | `client/src/components/Settings/UISettings/UISettings.tsx:214` | Hide applications | label | 隐藏应用 | 设置-界面 |
| 41 | `settings.hideBookmarks` | `client/src/components/Settings/UISettings/UISettings.tsx:228` | Hide bookmarks | label | 隐藏书签 | 设置-界面 |
| 42 | `settings.customCss` | `client/src/components/Settings/StyleSettings/StyleSettings.tsx:55` | Custom CSS | label | 自定义 CSS | 设置-CSS |
| 43 | `settings.saveCss` | `client/src/components/Settings/StyleSettings/StyleSettings.tsx:64` | Save CSS | button | 保存 CSS | 设置-CSS |
| 44 | `settings.cssSaved` | `client/src/components/Settings/StyleSettings/StyleSettings.tsx:46` | CSS saved. Reload page to see changes | toast(notification) | CSS 已保存。刷新页面以查看更改 | 通知中心 |

### 7. 通用 UI 原子与表格（ui.*）

覆盖范围：Button/Headline/Spinner/Table/Modal/表单提示（19 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `ui.saveChanges` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:234` | Save changes | button | 保存更改 | 设置页通用提交按钮 |
| 2 | `ui.goBack` | `client/src/components/Settings/Settings.tsx:38` | Go back | 链接 | 返回 | 页面标题副标题 |
| 3 | `ui.loading` | `client/src/components/UI/Spinner/Spinner.tsx:6` | Loading... | loading | 加载中... | 全局加载中 |
| 4 | `ui.true` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:116` | True | select option | 是 | 设置页布尔选项 |
| 5 | `ui.false` | `client/src/components/Settings/GeneralSettings/GeneralSettings.tsx:117` | False | select option | 否 | 设置页布尔选项 |
| 6 | `ui.actions` | `client/src/components/Apps/AppTable/AppTable.tsx:106` | Actions | table header | 操作 | 所有表格 |
| 7 | `ui.name` | `client/src/components/Apps/AppTable/AppTable.tsx:106` | Name | table header | 名称 | 所有表格 |
| 8 | `ui.url` | `client/src/components/Apps/AppTable/AppTable.tsx:106` | URL | table header | URL | 所有表格（技术名词保留英文） |
| 9 | `ui.icon` | `client/src/components/Apps/AppTable/AppTable.tsx:106` | Icon | table header | 图标 | 所有表格 |
| 10 | `ui.visibility` | `client/src/components/Apps/AppTable/AppTable.tsx:106` | Visibility | table header | 可见性 | 所有表格 |
| 11 | `ui.category` | `client/src/components/Bookmarks/Table/BookmarksTable.tsx:128` | Category | table header | 分类 | 书签表格 |
| 12 | `ui.prefix` | `client/src/components/Settings/GeneralSettings/CustomQueries/CustomQueries.tsx:69` | Prefix | table header | 前缀 | 自定义搜索提供方表格/表单 |
| 13 | `ui.iconHint` | `client/src/components/Apps/AppForm/AppForm.tsx:167` | Use icon name from MDI or pass a valid URL. | 提示文本 | 使用 MDI 图标名称，或传入有效的 URL。 | 应用/书签 Modal |
| 14 | `ui.clickForReference` | `client/src/components/Apps/AppForm/AppForm.tsx:170` | Click here for reference | 行内链接 | 点击此处查看参考 | 应用/书签 Modal |
| 15 | `ui.switchToCustomIcon` | `client/src/components/Apps/AppForm/AppForm.tsx:177` | Switch to custom icon upload | 链接 | 切换为自定义图标上传 | 应用/书签 Modal |
| 16 | `ui.switchToMdi` | `client/src/components/Apps/AppForm/AppForm.tsx:199` | Switch to MDI | 链接 | 切换为 MDI | 应用/书签 Modal |
| 17 | `ui.visibleOption` | `client/src/components/Apps/AppForm/AppForm.tsx:213` | Visible (anyone can access it) | select option | 可见（任何人均可访问） | 应用/书签 Modal |
| 18 | `ui.hiddenOption` | `client/src/components/Apps/AppForm/AppForm.tsx:214` | Hidden (authentication required) | select option | 隐藏（需要身份验证） | 应用/书签 Modal |
| 19 | `ui.selectCategory` | `client/src/components/Bookmarks/Form/BookmarksForm.tsx:197` | Select category | select option | 选择分类 | 书签 Modal |

### 8. 自定义搜索提供方（queries.*）

覆盖范围：设置-通用-CustomQueries（5 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `queries.queryTemplate` | `client/src/components/Settings/GeneralSettings/CustomQueries/QueriesForm.tsx:101` | Query Template | label | 查询模板 | 设置-通用-自定义搜索提供方 Modal |
| 2 | `queries.addNewProvider` | `client/src/components/Settings/GeneralSettings/CustomQueries/CustomQueries.tsx:95` | Add new search provider | button | 添加新的搜索提供方 | 设置-通用 |
| 3 | `queries.addProvider` | `client/src/components/Settings/GeneralSettings/CustomQueries/QueriesForm.tsx:113` | Add provider | button | 添加提供方 | 设置-通用-Modal |
| 4 | `queries.updateProvider` | `client/src/components/Settings/GeneralSettings/CustomQueries/QueriesForm.tsx:113` | Update provider | button | 更新提供方 | 设置-通用-Modal |
| 5 | `queries.deleteProviderConfirm` | `client/src/components/Settings/GeneralSettings/CustomQueries/CustomQueries.tsx:45` | Are you sure you want to delete this provider? | confirm | 确定要删除该提供方吗？ | 设置-通用-删除确认 |

### 9. Docker 集成（docker.*）

覆盖范围：设置-Docker（仅文案，不改产品逻辑）（6 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `docker.section` | `client/src/components/Settings/DockerSettings/DockerSettings.tsx:59` | Docker | 小节标题 | Docker | 设置-Docker（技术名词保留英文） |
| 2 | `docker.host` | `client/src/components/Settings/DockerSettings/DockerSettings.tsx:62` | Docker host | label | Docker 主机 | 设置-Docker |
| 3 | `docker.useApi` | `client/src/components/Settings/DockerSettings/DockerSettings.tsx:75` | Use Docker API | label | 使用 Docker API | 设置-Docker |
| 4 | `docker.unpinStopped` | `client/src/components/Settings/DockerSettings/DockerSettings.tsx:90` | Unpin stopped containers / other apps | label | 取消固定已停止的容器 / 其他应用 | 设置-Docker |
| 5 | `docker.kubernetes` | `client/src/components/Settings/DockerSettings/DockerSettings.tsx:104` | Kubernetes | 小节标题 | Kubernetes | 设置-Docker（技术名词保留英文） |
| 6 | `docker.useKubernetesIngress` | `client/src/components/Settings/DockerSettings/DockerSettings.tsx:107` | Use Kubernetes Ingress API | label | 使用 Kubernetes Ingress API | 设置-Docker |

### 10. 天气（weather.*）

覆盖范围：设置-天气（18 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `weather.apiSection` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:100` | API | 小节标题 | API | 设置-天气（技术名词保留英文） |
| 2 | `weather.apiKey` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:103` | API key | label | API 密钥 | 设置-天气 |
| 3 | `weather.usingPrefix` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:113` | Using | 提示文本 | 使用 | 设置-天气 |
| 4 | `weather.weatherApiLink` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:116` |  Weather API | 行内链接 |  Weather API | 设置-天气（产品名保留英文） |
| 5 | `weather.apiKeyHintSuffix` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:118` | . Key is required for weather module to work. | 提示文本 | 。天气模块需要密钥才能正常工作。 | 设置-天气 |
| 6 | `weather.locationSection` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:122` | Location | 小节标题 | 位置 | 设置-天气 |
| 7 | `weather.latitude` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:125` | Latitude | label | 纬度 | 设置-天气 |
| 8 | `weather.longitude` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:143` | Longitude | label | 经度 | 设置-天气 |
| 9 | `weather.getCurrentLocation` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:137` | Click to get current location | 行内链接 | 点击获取当前位置 | 设置-天气 |
| 10 | `weather.otherSection` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:156` | Other | 小节标题 | 其他 | 设置-天气 |
| 11 | `weather.temperatureUnit` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:159` | Temperature unit | label | 温度单位 | 设置-天气 |
| 12 | `weather.celsius` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:166` | Celsius | select option | 摄氏度 | 设置-天气 |
| 13 | `weather.fahrenheit` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:167` | Fahrenheit | select option | 华氏度 | 设置-天气 |
| 14 | `weather.additionalData` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:173` | Additional weather data | label | 附加天气数据 | 设置-天气 |
| 15 | `weather.cloudCoverage` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:180` | Cloud coverage | select option | 云量 | 设置-天气 |
| 16 | `weather.humidity` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:181` | Humidity | select option | 湿度 | 设置-天气 |
| 17 | `weather.updated` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:61` | Weather updated | toast(notification) | 天气已更新 | 通知中心 |
| 18 | `weather.apiKeyMissing` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:48` | API key is missing. Weather Module will NOT work | toast(notification) | 缺少 API 密钥。天气模块将无法工作 | 通知中心 |

### 11. 通知标题与版本提示（notify.*）

覆盖范围：NotificationCenter（6 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `notify.success` | `client/src/store/action-creators/config.ts:61` | Success | toast 标题 | 成功 | 通知中心标题 |
| 2 | `notify.error` | `client/src/store/action-creators/theme.ts:71` | Error | toast 标题 | 错误 | 通知中心标题 |
| 3 | `notify.info` | `client/src/App.tsx:47` | Info | toast 标题 | 提示 | 通知中心标题 |
| 4 | `notify.warning` | `client/src/components/Settings/WeatherSettings/WeatherSettings.tsx:47` | Warning | toast 标题 | 警告 | 通知中心标题 |
| 5 | `notify.newVersionAvailable` | `client/src/utility/checkVersion.ts:19` | New version is available! | toast(notification) | 有新版本可用！ | 通知中心 |
| 6 | `notify.latestVersion` | `client/src/utility/checkVersion.ts:27` | You are using the latest version! | toast(notification) | 你正在使用最新版本！ | 通知中心 |

### 12. 错误与校验（error.*）

覆盖范围：Toast / window.confirm / 表单校验（9 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `error.sessionExpired` | `client/src/App.tsx:48` | Session expired. You have been logged out | error | 会话已过期，你已退出登录 | 通知中心 |
| 2 | `error.prefixNotFound` | `client/src/components/SearchBar/SearchBar.tsx:86` | Prefix not found | error | 未找到该搜索前缀 | 通知中心 |
| 3 | `error.customOrderDisabled` | `client/src/components/Apps/AppTable/AppTable.tsx:48` | Custom order is disabled | error | 自定义排序已禁用 | 通知中心 |
| 4 | `error.fieldEmpty` | `client/src/components/Apps/AppForm/AppForm.tsx:63` | Field cannot be empty: {field} | error | 字段不能为空：{field} | 通知中心 |
| 5 | `error.selectCategory` | `client/src/components/Bookmarks/Form/BookmarksForm.tsx:100` | Please select category | error | 请选择分类 | 通知中心 |
| 6 | `error.cannotDeleteActiveProvider` | `client/src/components/Settings/GeneralSettings/CustomQueries/CustomQueries.tsx:42` | Cannot delete active provider | error | 无法删除当前正在使用的提供方 | 通知中心 |
| 7 | `error.fieldName` | `client/src/components/Apps/AppForm/AppForm.tsx:63` | name | error 插值 | 名称 | error.fieldEmpty 插值 |
| 8 | `error.fieldUrl` | `client/src/components/Apps/AppForm/AppForm.tsx:63` | url | error 插值 | URL | error.fieldEmpty 插值 |
| 9 | `error.fieldIcon` | `client/src/components/Apps/AppForm/AppForm.tsx:63` | icon | error 插值 | 图标 | error.fieldEmpty 插值 |

### 13. 设置-应用与身份验证（app.*）

覆盖范围：AppDetails / AuthForm（20 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `app.authentication` | `client/src/components/Settings/AppDetails/AppDetails.tsx:20` | Authentication | 小节标题 | 身份验证 | 设置-应用 |
| 2 | `app.appVersion` | `client/src/components/Settings/AppDetails/AppDetails.tsx:28` | App version | 小节标题 | 应用版本 | 设置-应用 |
| 3 | `app.version` | `client/src/components/Settings/AppDetails/AppDetails.tsx:37` | version {version} | 文本 | 版本 {version} | 设置-应用 |
| 4 | `app.seeChangelog` | `client/src/components/Settings/AppDetails/AppDetails.tsx:41` | See changelog  | 文本 | 查看更新日志  | 设置-应用 |
| 5 | `app.changelogLink` | `client/src/components/Settings/AppDetails/AppDetails.tsx:47` | here | 行内链接 | 此处 | 设置-应用 |
| 6 | `app.checkForUpdates` | `client/src/components/Settings/AppDetails/AppDetails.tsx:51` | Check for updates | button | 检查更新 | 设置-应用 |
| 7 | `app.password` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:54` | Password | label | 密码 | 设置-应用-身份验证 |
| 8 | `app.seeWikiPrefix` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:68` | See | 文本 | 请参阅 | 设置-应用-身份验证 |
| 9 | `app.seeWikiLink` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:73` |  project wiki  | 行内链接 |  项目 Wiki  | 设置-应用-身份验证 |
| 10 | `app.seeWikiSuffix` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:75` | to read more about authentication | 文本 | 以了解更多关于身份验证的内容 | 设置-应用-身份验证 |
| 11 | `app.sessionDuration` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:80` | Session duration | label | 会话时长 | 设置-应用-身份验证 |
| 12 | `app.duration1h` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:89` | 1 hour | select option | 1 小时 | 设置-应用-身份验证 |
| 13 | `app.duration1d` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:90` | 1 day | select option | 1 天 | 设置-应用-身份验证 |
| 14 | `app.duration2w` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:91` | 2 weeks | select option | 2 周 | 设置-应用-身份验证 |
| 15 | `app.duration1m` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:92` | 1 month | select option | 1 个月 | 设置-应用-身份验证 |
| 16 | `app.duration1y` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:93` | 1 year | select option | 1 年 | 设置-应用-身份验证 |
| 17 | `app.login` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:97` | Login | button | 登录 | 设置-应用-身份验证 |
| 18 | `app.loggedInExpiresPrefix` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:102` | You are logged in. Your session will expire  | 文本 | 你已登录。会话将于  | 设置-应用-身份验证 |
| 19 | `app.loggedInExpiresSuffix` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:102` | *(空串)* | 文本 |  过期 | 设置-应用-身份验证（en 为空串以保持逐字回归） |
| 20 | `app.logout` | `client/src/components/Settings/AppDetails/AuthForm/AuthForm.tsx:105` | Logout | button | 退出登录 | 设置-应用-身份验证 |

### 14. 主题（theme.*）

覆盖范围：设置-主题（Themer 目录由 theme owner 接入这些 key）（27 条）

| # | key | 文件:行 | 原文（en，逐字） | 类型 | 建议中文 | 复现路径 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `theme.appThemes` | `client/src/components/Settings/Themer/Themer.tsx:76` | App themes | 小节标题 | 应用主题 | 设置-主题 |
| 2 | `theme.userThemes` | `client/src/components/Settings/Themer/Themer.tsx:69` | User themes | 小节标题 | 用户主题 | 设置-主题 |
| 3 | `theme.otherSettings` | `client/src/components/Settings/Themer/Themer.tsx:83` | Other settings | 小节标题 | 其他设置 | 设置-主题 |
| 4 | `theme.defaultThemeForNewUsers` | `client/src/components/Settings/Themer/Themer.tsx:85` | Default theme for new users | label | 新用户默认主题 | 设置-主题 |
| 5 | `theme.visualStyle` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | Visual style | label | 视觉风格 | 设置-主题-二次元风格 |
| 6 | `theme.visualStyleHint` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | Choose the visual style of the interface | 提示文本 | 选择界面的视觉风格 | 设置-主题-二次元风格 |
| 7 | `theme.animeBackground` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | Anime background | label | 二次元背景 | 设置-主题-二次元风格 |
| 8 | `theme.animeBackgroundHint` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | Show the anime-style background image | 提示文本 | 显示二次元风格背景图 | 设置-主题-二次元风格 |
| 9 | `theme.default` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | Default | select option | 默认 | 设置-主题-二次元风格 |
| 10 | `theme.animeLight` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | Anime Light | select option | 二次元浅色 | 设置-主题-二次元风格 |
| 11 | `theme.animeDark` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | Anime Dark | select option | 二次元深色 | 设置-主题-二次元风格 |
| 12 | `theme.backgroundOn` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | On | select option | 开启 | 设置-主题-二次元风格 |
| 13 | `theme.backgroundOff` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | Off | select option | 关闭 | 设置-主题-二次元风格 |
| 14 | `theme.defaultDesc` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | The original Flame appearance | 提示文本 | Flame 原版外观 | 设置-主题-二次元风格 |
| 15 | `theme.animeLightDesc` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | Soft light anime style | 提示文本 | 柔和的浅色二次元风格 | 设置-主题-二次元风格 |
| 16 | `theme.animeDarkDesc` | `client/src/components/Settings/Themer/AnimeStyle (新增)` | Soft dark anime style | 提示文本 | 柔和的深色二次元风格 | 设置-主题-二次元风格 |
| 17 | `theme.added` | `client/src/store/action-creators/theme.ts:62` | Theme added | toast(notification) | 主题已添加 | 通知中心 |
| 18 | `theme.deleted` | `client/src/store/action-creators/theme.ts:95` | Theme deleted | toast(notification) | 主题已删除 | 通知中心 |
| 19 | `theme.createNewTheme` | `client/src/components/Settings/Themer/ThemeBuilder/ThemeBuilder.tsx:76` | Create new theme | button | 创建新主题 | 设置-主题 |
| 20 | `theme.editUserThemes` | `client/src/components/Settings/Themer/ThemeBuilder/ThemeBuilder.tsx:86` | Edit user themes | button | 编辑用户主题 | 设置-主题 |
| 21 | `theme.themeName` | `client/src/components/Settings/Themer/ThemeBuilder/ThemeCreator.tsx:95` | Theme name | label | 主题名称 | 设置-主题-Modal |
| 22 | `theme.primaryColor` | `client/src/components/Settings/Themer/ThemeBuilder/ThemeCreator.tsx:109` | Primary color | label | 主色 | 设置-主题-Modal |
| 23 | `theme.accentColor` | `client/src/components/Settings/Themer/ThemeBuilder/ThemeCreator.tsx:121` | Accent color | label | 强调色 | 设置-主题-Modal |
| 24 | `theme.backgroundColor` | `client/src/components/Settings/Themer/ThemeBuilder/ThemeCreator.tsx:133` | Background color | label | 背景色 | 设置-主题-Modal |
| 25 | `theme.addTheme` | `client/src/components/Settings/Themer/ThemeBuilder/ThemeCreator.tsx:146` | Add theme | button | 添加主题 | 设置-主题-Modal |
| 26 | `theme.updateTheme` | `client/src/components/Settings/Themer/ThemeBuilder/ThemeCreator.tsx:148` | Update theme | button | 更新主题 | 设置-主题-Modal |
| 27 | `theme.deleteThemeConfirm` | `client/src/components/Settings/Themer/ThemeBuilder/ThemeEditor.tsx:33` | Are you sure you want to delete this theme? | confirm | 确定要删除该主题吗？ | 设置-主题-删除确认 |

## 3. 插值（占位符）清单

`t(key, vars)` 使用 `{name}` 形式插值；英文回归基准要求插值后与上游渲染结果逐字一致。

| key | 占位符 | en 模板 | zh 模板 |
| --- | --- | --- | --- |
| `apps.deleteConfirm` | {`name`} | Are you sure you want to delete {name}? | 确定要删除 {name} 吗？ |
| `apps.iconAlt` | {`name`} | {name} icon | {name} 图标 |
| `apps.pinMessage` | {`name`}, {`status`} | App {name} {status} | 应用 {name} {status} |
| `bookmarks.deleteConfirm` | {`name`} | Are you sure you want to delete {name}? | 确定要删除 {name} 吗？ |
| `bookmarks.deleteCategoryConfirm` | {`name`} | Are you sure you want to delete {name}? It will delete ALL assigned bookmarks | 确定要删除 {name} 吗？该分类下的所有书签都将被删除 |
| `bookmarks.iconAlt` | {`name`} | {name} icon | {name} 图标 |
| `bookmarks.categoryCreated` | {`name`} | Category {name} created | 分类 {name} 已创建 |
| `bookmarks.categoryUpdated` | {`name`} | Category {name} updated | 分类 {name} 已更新 |
| `bookmarks.pinMessage` | {`name`}, {`status`} | Category {name} {status} | 分类 {name} {status} |
| `error.fieldEmpty` | {`field`} | Field cannot be empty: {field} | 字段不能为空：{field} |
| `app.version` | {`version`} | version {version} | 版本 {version} |

## 4. 第一阶段不覆盖清单（含原因）

| 文件:行 | 原文 | 不覆盖原因 |
| --- | --- | --- |
| `client/public/index.html:2` | lang="en" | HTML 根属性；由 setLang() 同步为当前语言，不翻译 |
| `client/public/index.html:53` | Flame - self-hosted startpage for your server | meta description：非页面内 UI 文案；index.html 为 theme 独占文件，本阶段不改 |
| `client/public/index.html:56` | Flame | 品牌名；index.html 为 theme 独占文件 |
| `client/public/index.html:59` | You need to enable JavaScript to run this app. | noscript：仅在禁用 JS 时可见；index.html 为 theme 独占文件 |
| `components/Settings/settings.json:4-36` | Theme/General/Interface/Weather/Docker/CSS/App | 路由数据文件保持上游同步，渲染时通过 nav.* 映射翻译 |
| `components/Apps/AppForm/AppForm.tsx:115` | Bookstack | placeholder：示例产品名，保留英文 |
| `components/Apps/AppForm/AppForm.tsx:129` | bookstack.example.com | placeholder：示例 URL，保留英文 |
| `components/Apps/AppForm/AppForm.tsx:161` | book-open-outline | placeholder：MDI 图标名，必须保留英文 |
| `components/Bookmarks/Form/BookmarksForm.tsx:166` | Reddit | placeholder：示例站点名，保留英文 |
| `components/Bookmarks/Form/BookmarksForm.tsx:180` | reddit.com | placeholder：示例 URL，保留英文 |
| `components/Bookmarks/Form/BookmarksForm.tsx:217` | book-open-outline | placeholder：MDI 图标名 |
| `components/Bookmarks/Form/CategoryForm.tsx:77` | Social Media | placeholder：示例分类名，保留英文 |
| `components/Settings/UISettings/UISettings.tsx:69` | Flame | placeholder：品牌名/默认页面标题 |
| `components/Settings/WeatherSettings/WeatherSettings.tsx:108` | secret | placeholder：示例密钥，保留英文 |
| `components/Settings/WeatherSettings/WeatherSettings.tsx:130` | 52.22 | placeholder：示例纬度，保留英文 |
| `components/Settings/WeatherSettings/WeatherSettings.tsx:148` | 21.01 | placeholder：示例经度，保留英文 |
| `components/Settings/DockerSettings/DockerSettings.tsx:67` | dockerHost:port | placeholder：技术格式示例，保留英文 |
| `components/Settings/GeneralSettings/CustomQueries/QueriesForm.tsx:80` | Google | placeholder：示例提供方名，保留英文 |
| `components/Settings/GeneralSettings/CustomQueries/QueriesForm.tsx:93` | g | placeholder：示例前缀，保留英文 |
| `components/Settings/GeneralSettings/CustomQueries/QueriesForm.tsx:106` | https://www.google.com/search?q= | placeholder：示例 URL 模板，保留英文 |
| `components/Settings/AppDetails/AuthForm/AuthForm.tsx:59` | •••••• | placeholder：密码掩码，无语言 |
| `components/Settings/Themer/ThemeBuilder/ThemeCreator.tsx:100` | my_theme | placeholder：示例主题名，保留英文 |
| `components/Settings/AppDetails/AppDetails.tsx:35` | Flame | 品牌名，保留英文 |
| `components/Widgets/WeatherWidget/WeatherWidget.tsx:72,74` | °C / °F | 温度单位符号，无语言 |
| `components/Settings/GeneralSettings/GeneralSettings.tsx:184,207` | + | 自定义提供方标记符号，无语言 |
| `utility/searchQueries.json:5-53` | Deezer/Disroot/DuckDuckGo/Google/IMDb/Reddit/Spotify/The Movie Database/Tidal/Wikipedia/YouTube | 产品/品牌名，保留英文（Local search 单独走 search.localSearch） |
| `utility/templateObjects/settingsTemplate.ts:15-18` | greetingsSchema/daySchema/monthSchema 英文默认值 | 用户配置数据默认值（会写入后端 config）；中文默认值由 greeter.ts/getDateTime.ts 在渲染时判定“未自定义”后使用，避免修改用户数据 |
| `utility/templateObjects/configTemplate.ts:27-30` | greetingsSchema/daySchema/monthSchema 英文默认值 | 同上：Redux 初始 state 的配置数据默认值，不属 UI 字典 |
| `controllers/auth/login.js:14` | Invalid credentials | 后端错误文案（前端 notification 原样展示）；本阶段不改后端逻辑 |
| `controllers/auth/validate.js:17` | Token expired | 后端错误文案；不改后端 |
| `controllers/themes/addTheme.js:15` | Name must be unique | 后端错误文案；不改后端 |
| `controllers/queries/addQuery.js:15` | Prefix must be unique | 后端错误文案；不改后端 |
| `middleware/requireAuth.js:5` | Unauthorized | 后端错误文案；不改后端 |
| `middleware/requireBody.js:7` | '{field}' is required | 后端错误文案；不改后端 |
| `middleware/errorHandler.js:22` | Server Error | 后端错误文案兜底；不改后端 |
| `controllers/apps/getSingleApp.js:18 / updateApp.js:15` | App with the id of {id} was not found | 后端错误文案；不改后端 |
| `controllers/bookmarks/getSingleBookmark.js:18 / updateBookmark.js:16` | Bookmark with the id of {id} was not found | 后端错误文案；不改后端 |
| `controllers/categories/getSingleCategory.js:36 / updateCategory.js:16 / deleteCategory.js:23` | Category with id of {id} was not found | 后端错误文案；不改后端 |
| `utils/getExternalWeather.js:30` | External API request failed | 后端错误文案；不改后端 |

## 5. 后端返回给前端的错误文案（仅盘点）

前端在 `store/action-creators/auth.ts:78`、`config.ts:111`、`theme.ts:72`、`components/Settings/WeatherSettings/WeatherSettings.tsx:67` 等处直接把 `error.response.data.error` 作为通知正文展示。这些文案由后端产生：

| 文件:行 | 文案 | 前端展示位置 | 第一阶段处理 |
| --- | --- | --- | --- |
| `controllers/auth/login.js:14` | Invalid credentials | 通知中心（登录失败） | 不覆盖（不改后端） |
| `controllers/auth/validate.js:17` | Token expired | 通知中心（自动登录失败，不弹通知） | 不覆盖 |
| `middleware/requireAuth.js:5` | Unauthorized | 通知中心（受保护接口） | 不覆盖 |
| `middleware/requireBody.js:7` | '{field}' is required | 通知中心 | 不覆盖 |
| `middleware/errorHandler.js:22` | Server Error | 通知中心（兜底） | 不覆盖 |
| `controllers/themes/addTheme.js:15` | Name must be unique | 通知中心（新增主题） | 不覆盖 |
| `controllers/queries/addQuery.js:15` | Prefix must be unique | 通知中心（新增提供方） | 不覆盖 |
| `controllers/apps/getSingleApp.js:18 / updateApp.js:15` | App with the id of {id} was not found | 通知中心 | 不覆盖 |
| `controllers/bookmarks/getSingleBookmark.js:18 / updateBookmark.js:16` | Bookmark with the id of {id} was not found | 通知中心 | 不覆盖 |
| `controllers/categories/getSingleCategory.js:36 / updateCategory.js:16 / deleteCategory.js:23` | Category with id of {id} was not found | 通知中心 | 不覆盖 |
| `utils/getExternalWeather.js:30` | External API request failed | 通知中心（天气更新） | 不覆盖 |

> 说明：若后续需要后端文案中文化，应在**展示层**做“错误码 → 文案”映射，而不是修改后端字符串；本阶段为控制 diff 与风险不做映射，属已知豁免并已在 T4 报告与 REVIEW 的“仍为英文”清单中登记。

## 6. 命名空间与 theme 冻结 key 校验

Lead 冻结的、theme owner 会直接 import 的 key，本盘点已全部提供：

| key | en | zh-CN | 状态 |
| --- | --- | --- | --- |
| `theme.appThemes` | App themes | 应用主题 | ✅ 已列出 |
| `theme.userThemes` | User themes | 用户主题 | ✅ 已列出 |
| `theme.otherSettings` | Other settings | 其他设置 | ✅ 已列出 |
| `theme.defaultThemeForNewUsers` | Default theme for new users | 新用户默认主题 | ✅ 已列出 |
| `theme.visualStyle` | Visual style | 视觉风格 | ✅ 已列出 |
| `theme.visualStyleHint` | Choose the visual style of the interface | 选择界面的视觉风格 | ✅ 已列出 |
| `theme.animeBackground` | Anime background | 二次元背景 | ✅ 已列出 |
| `theme.animeBackgroundHint` | Show the anime-style background image | 显示二次元风格背景图 | ✅ 已列出 |
| `theme.default` | Default | 默认 | ✅ 已列出 |
| `theme.animeLight` | Anime Light | 二次元浅色 | ✅ 已列出 |
| `theme.animeDark` | Anime Dark | 二次元深色 | ✅ 已列出 |
| `theme.backgroundOn` | On | 开启 | ✅ 已列出 |
| `theme.backgroundOff` | Off | 关闭 | ✅ 已列出 |
| `theme.animeLightDesc` | Soft light anime style | 柔和的浅色二次元风格 | ✅ 已列出 |
| `theme.animeDarkDesc` | Soft dark anime style | 柔和的深色二次元风格 | ✅ 已列出 |
| `theme.defaultDesc` | The original Flame appearance | Flame 原版外观 | ✅ 已列出 |
| `ui.saveChanges` | Save changes | 保存更改 | ✅ 已列出 |
| `settings.language` | Language | 语言 | ✅ 已列出 |
| `nav.theme` | Theme | 主题 | ✅ 已列出 |
| `nav.general` | General | 通用 | ✅ 已列出 |
| `nav.interface` | Interface | 界面 | ✅ 已列出 |
| `nav.weather` | Weather | 天气 | ✅ 已列出 |
| `nav.docker` | Docker | Docker | ✅ 已列出 |
| `nav.css` | CSS | CSS | ✅ 已列出 |
| `nav.app` | App | 应用 | ✅ 已列出 |

缺失：无

## 7. Lead 在 T1 之后追加的硬约束 → 本盘点对应关系

| 约束（来自 Lead / AUDIT.md） | 本盘点的处理 | 影响 key 数 |
| --- | --- | --- |
| 语言状态只用前端 `localStorage.'flame.lang'`，**不**给后端 `Config.ts` / `config.ts` / `initialConfig.json` 增加 `language` 字段 | 本盘点不含任何后端配置字段；`settings.language` 是纯前端 UI 文案 key；`getLang()`/`setLang()` 零后端改动 | 0（无后端改动） |
| 禁止触碰 `store/action-creators/theme.ts`、`store/reducers/theme.ts`、`utility/parseTheme.ts`、`index.css:44-46`、`ThemeGrid/ThemePreview`、`package.json` + 两个 lockfile、`.docker/**`、`k8s/**`、`skaffold.yaml`、`.env`、后端 `controllers/routes/models/db/middleware` | 主题页 27 个 key 由 theme owner 在 Themer 目录内 import 使用，i18n 只负责提供字典；`store/action-creators/theme.ts` 保持不动 → 其内 3 处英文 toast 无法接入 t() | 27 个 key 正常提供；**3 条 toast 仍为英文（见下表，已向 Lead 申请最小例外）** |
| 0 新增 npm 依赖；验证只用 `npx tsc --noEmit` + `npx react-scripts build`（不加 CI=true） | 本方案零依赖、纯 TypeScript；验证命令已按此固定 | 0 |

### 7.1 受“禁止触碰 store/action-creators/theme.ts”影响、需 Lead 裁决的条目

| 文件:行 | 原文 | 影响 | 最小例外建议 |
| --- | --- | --- | --- |
| `store/action-creators/theme.ts:61-62` | `Success` / `Theme added` | 新增自定义主题成功 toast，中文模式下会显示英文 | 仅替换这 2 个字面量为 `t('notify.success')` / `t('theme.added')`，新增 1 行 import，不改任何逻辑 |
| `store/action-creators/theme.ts:71` | `Error` | 新增主题失败 toast 标题 | 替换为 `t('notify.error')` |
| `store/action-creators/theme.ts:94-95` | `Success` / `Theme deleted` | 删除自定义主题成功 toast | 替换为 `t('notify.success')` / `t('theme.deleted')` |

> 该文件不在 theme owner 的写入范围内（theme 只写 `components/Settings/Themer/**`、`styles/`、`assets/backgrounds/`、`utility/animeTheme.ts`、`index.css`、`public/index.html`），因此不存在写冲突；若 Lead 不批准，这 3 条将登记进 T4 报告的“仍为英文”清单并说明原因。

## 8. 复核与验证方法（供 reviewer 独立复跑）

```bash
# 1) 残留英文扫描（排除 className/import/技术名词后可读性抽查）
cd $HOME/Flame/client && grep -rnE '>[A-Z][a-z]+ ?[a-zA-Z ]*<' src/components --include=*.tsx

# 2) en / zh-CN key 集合一致性（T3 提供脚本）
cd $HOME/Flame/client && node src/i18n/check-keys.js   # 或在 __tests__ 中执行

# 3) 英文逐字回归：把 en.ts 的值与本次盘点“原文（en，逐字）”列逐条比对
cd $HOME/Flame && python3 build-logs/../tools/check-en-regression.py  # T4 阶段临时脚本，见 T4 报告
```

---

盘点完成时间点：T2；总计 **247** 个 key + **39** 条不覆盖登记；覆盖首页/搜索/应用/书签/设置-通用/设置-界面/设置-天气/设置-Docker/设置-CSS/设置-应用/身份验证/主题/通知中心，无遗漏区域。

> 基线上游工作树并非 100% clean：`client/package-lock.json` 存在 35 insertions / 70 deletions 的本地改动（依赖安装产生），与本次 i18n 无关，T2 未触碰任何源码文件。
