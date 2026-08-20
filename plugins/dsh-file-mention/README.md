# dsh-file-mention

对话输入框的 `@文件` 引用插件（双面插件：host + browser）。

## 能力

- 在 composer 输入 `@` 触发官方候选菜单（复用 `dsh-client-ui-input-trigger` 管线，与 `@子代理` 同一套交互）：
  - 候选来自**当前会话工作区**文件树（`/file-mention/list?session=<id>` 路由，根 = 会话 header `cwd`；桌面 shell 不以工作区启动宿主进程，无会话调用才退回宿主 cwd），**文件（📎）与目录（📁）都在列**，支持按查询前缀过滤；
  - 选中文件插入字面引用文本 `@plan.md `；选中目录插入 `@electron/ `，继续输入即过滤该目录内文件（如 `@electron/ma` → `electron/main.ts`）；
  - 草稿中 `@plan.md` / `@electron/` 的前缀 token 自动高亮（composer 按源 lexicon 扫描装饰，官方 `[\w-]+` token 规则限制下为 best-effort）。

## 菜单图标

候选图标按文件类型着色（16×16 内联 SVG，`scripts/make-icons.py` 生成
`src/file-icons.ts`）：目录 = 橙色文件夹、TypeScript = 蓝、JavaScript = 黄、
Markdown = 灰、Python = 蓝、Go = 青、Rust = 棕、Shell = 绿、YAML = 橙红、
CSS = 蓝、HTML = 红、JSON = 橙、数据库 = 绿、图片 = 粉、二进制 = 灰蓝、
无扩展名/未知 = 灰色文本。重新生成：`python3 scripts/make-icons.py`。

菜单行布局：名称 = basename（紧凑），副标题 = 完整相对路径（根层文件无副标题）。
图标通过 `<img src="data:image/svg+xml;base64,...">` 渲染在官方 icon 槽里。
- **方案 A 语义**：提交时引用按字面发送给模型，agent 用自带的 read/glob 工具读取文件——不做内容注入。

## 结构

| 文件 | 半边 | 职责 |
|---|---|---|
| `src/index.ts` | host（`exports "."`） | `ctx.webServer.register` 挂 `/file-mention/list`，递归列出工作区文件与目录（排除 node_modules/.git/dist 等，深度默认 3，`FILE_MENTION_ROOT` 可覆盖根） |
| `src/client.ts` | browser（`exports "./client"`，`dsh.client` manifest） | 注册 `@` 触发源：`candidates()` fetch 文件树过滤排序（按类型着色图标）、`lexicon()` 热词装饰、`onPick()` 插入 `@<path> `、`codec` 字面序列化 |
| `src/file-icons.ts` | 生成文件（`scripts/make-icons.py`） | 文件类型 SVG 图标 + 扩展名→图标映射 |

## 装配

- 开发热装配：`dsh plugin` 或超级模组注入器（`dev_install_package` 指向本目录，免重启）。
- 持久化：作为 bundle 装入 web profile（`dsh.bundle.patch` → `cordis.patch.yml` 的 insert 行），重启后自动装配。

## 局限

- 装饰高亮受官方 token 正则 `[\w-]+` 限制：`@plan.md` 只高亮 `@plan` 前缀，含 `/` 的路径不装饰（菜单与插入不受影响）。
- 文件树缓存无推送失效，candidates 每次查询重新拉取（本地路由，开销可忽略）。
- 官方菜单 icon 槽是文本 span，SVG 无法直插；用 data URL `<img>` 替代（已验证兼容）。
