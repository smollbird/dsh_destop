# dsh-file-mention

对话输入框的 `@文件` 引用插件（双面插件：host + browser）。

## 能力

- 在 composer 输入 `@` 触发官方候选菜单（复用 `dsh-client-ui-input-trigger` 管线，与 `@子代理` 同一套交互）：
  - 候选来自宿主进程工作区文件树（`/file-mention/list` 路由），根 = 宿主 cwd（桌面端即工作区根目录），**文件（📎）与目录（📁）都在列**，支持按查询前缀过滤；
  - 选中文件插入字面引用文本 `@plan.md `；选中目录插入 `@electron/ `，继续输入即过滤该目录内文件（如 `@electron/ma` → `electron/main.ts`）；
  - 草稿中 `@plan.md` / `@electron/` 的前缀 token 自动高亮（composer 按源 lexicon 扫描装饰，官方 `[\w-]+` token 规则限制下为 best-effort）。

## 菜单图标

候选图标复制自内核设计系统 `@deepseek-ai/dsh-client-ui-primitives`（ic_ds_* 集）：
目录 = `IconFolderClose16`、文件 = `IconPaperclipOutline16`。官方候选菜单的 icon 槽是
文本渲染（`<span>{icon}</span>`，SVG 组件无法直插），因此用 `scripts/make-iconfont.mjs`
把两个内核 SVG path 生成内嵌 TTF 字体（与官方 DshChipCell 内嵌字体同款模式），
client 半注入 `@font-face` 并以私有码点（U+E001/U+E002）渲染，随菜单 `--dsw-alias-label-tertiary`
单色着色。重新生成字体：`cd /tmp/iconfont-build && npm i svg2ttf` 后跑 `node scripts/make-iconfont.mjs`。
- **方案 A 语义**：提交时引用按字面发送给模型，agent 用自带的 read/glob 工具读取文件——不做内容注入。

## 结构

| 文件 | 半边 | 职责 |
|---|---|---|
| `src/index.ts` | host（`exports "."`） | `ctx.webServer.register` 挂 `/file-mention/list`，递归列出工作区文件与目录（排除 node_modules/.git/dist 等，深度默认 3，`FILE_MENTION_ROOT` 可覆盖根） |
| `src/client.ts` | browser（`exports "./client"`，`dsh.client` manifest） | 注册 `@` 触发源：`candidates()` fetch 文件树过滤排序（目录 📁/文件 📄）、`lexicon()` 热词装饰、`onPick()` 插入 `@<path> `、`codec` 字面序列化 |

## 装配

- 开发热装配：`dsh plugin` 或超级模组注入器（`dev_install_package` 指向本目录，免重启）。
- 持久化：作为 bundle 装入 web profile（`dsh.bundle.patch` → `cordis.patch.yml` 的 insert 行），重启后自动装配。

## 局限

- 装饰高亮受官方 token 正则 `[\w-]+` 限制：`@plan.md` 只高亮 `@plan` 前缀，含 `/` 的路径不装饰（菜单与插入不受影响）。
- 文件树缓存无推送失效，candidates 每次查询重新拉取（本地路由，开销可忽略）。
