# dsh-settings-tabs

给 DSH Web GUI 设置面板（侧边栏齿轮 → 设置）的「插件」区块新增两个 tab：
**技能（Skills）** 与 **MCP**。双面插件（host + browser）。

## 能力

- **技能 tab**（`settings.plugins.tab` id=`skills`）：展示默认 agent preset 的
  技能目录（`ctx.skills` + `agentPresets.standingKeyFor()` 的 standing scope
  ——即 GUI 会话看到的同一份目录）——名称、描述、适用场景（whenToUse）、
  「模型可调用 / 仅用户可调用」徽标与来源；支持搜索与加载/失败/空态。
  > 技能来源：`dsh-skill-filesystem` 只扫描 `.dsh/skills`、`.agents/skills`、
  > `~/.dsh/skills`、`~/.agents/skills`（以及 `customSkillDirs` / `bundledSkillDir`
  > 配置项）。**不读取 `.claude`**；如需收录 Claude 的技能目录，可在
  > `skill-filesystem` 条目配置 `customSkillDirs` 指向其绝对路径。
- **MCP tab**（id=`mcp`）：
  - 枚举 Cordis Loader 中所有 `mcp-client` 实例——serverName、transport
    （stdio / streamable-http）、目标（url 或 command args）、启用状态与
    Fiber 阶段；支持搜索与加载/失败/空态。
  - **快速添加**：内联表单（serverName + transport + command/args 或 url），
    客户端/服务端双重校验；保存后**立即生效**并**持久化**。
  - **删除**：两步确认；条目上的「已持久化 / 快速添加」徽标标明来源。

## 同步目标：cordis.patch.yml（不是 settings.yaml）

MCP 服务器是 **loader 插件实例**（`mcp-client`），不是 settings 命名空间——
`settings.yaml` 只服务 settings 提供者的命名空间文档，没有任何组件会从它
读取 mcp 配置，写进去不会生效。正确的位置是 **profile 的用户 patch 层**
（`~/.dsh/profiles/web/cordis.patch.yml`）：

- 写入格式为顶层 `- insert:` 行（普通 id 补丁对不存在的条目会被跳过）；
- web profile 的 HMR 是禁用的（`dsh-web-app` patch 里 `hmr disabled: true`），
  所以快速添加采用**双路径**（与 super-injector 装配插件一致）：
  1. 写 patch 行 → 下次启动由 loader 装配（持久）；
  2. `ctx.loader.create()` 在 loader 根层热建条目 → 当前会话立即生效
     （Loader 根层 `write()` 是 no-op，不会污染 base 的 cordis.yml）。
- 删除：移除 patch 行 + `ctx.loader.remove()` 停掉根层实例；来自 patch 层
  （id 含 `:`）的实例不能安全地热删（会物化整个组合树进 cordis.yml），
  删除响应标记 `pendingRestart`，重启后消失。

## 结构

| 文件 | 半边 | 职责 |
|---|---|---|
| `src/index.ts` | host（`exports "."`） | `/settings-tabs/skills`（技能目录）、`/settings-tabs/mcp` GET/POST/DELETE（列表 / 快速添加 / 删除，patch 文件读写 + loader 热装配） |
| `src/client.tsx` | browser（`exports "./client"`，`dsh.client` manifest） | 两个 tab 注册；MCP tab 的快速添加表单与删除交互 |
| `src/react-shim.d.ts` | 类型 | react / react/jsx-runtime 与环境 JSX 命名空间的极简类型（桌面 node_modules 无 @types/react） |
| `src/slots-contract.d.ts` | 类型 | `settings.skillsMcp` locale 命名空间声明 |
| `scripts/mcp-echo-server.mjs` | 演示 | 极简 MCP stdio 服务器（echo/now 两个工具），用于测试快速添加 |

## 装配

- 开发热装配：`dev_install_package` 指向本目录（免重启，profile package.json
  加 link + bundles，node_modules 建 junction，loader.create 动态加载）。
- 持久化：作为 bundle 装入 web profile（`dsh.bundle.patch` →
  `cordis.patch.yml` 的 insert 行），重启后自动装配。
- 客户端发现：`dsh-client-modules` 增量扫描 Loader 条目中的 `dsh.client`
  声明，热装配后浏览器刷新页面即可看到新 tab。

## 测试

- `node scripts/test-settings-tabs.mjs`（仓库根）：对 built host 半做桩上下文
  回归——skills 路由（scope 传递）、mcp 列表（persistent/managed/phase 标志）、
  POST 添加（loader.create 参数 + patch 文件写入 + 头注释保留）、重复/校验
  错误码、DELETE（根层热删 + include 层 pendingRestart）、404。
- 浏览器环境 smoke：`window.__ModuleLoader__` + react 桩下执行 wrapped
  client.js，断言注册与两个 tab 的槽位声明。

## 局限

- 技能列表取默认 preset 的 standing scope（`agentPresets.standingKeyFor()`），
  与 GUI 会话一致；若默认 preset 不可用则退化为全局层（可能为空）。
- patch 文件若包含 `!!js` 表达式，快速添加会拒绝改写（报错提示手动编辑）。
- MCP 列表仅识别模块名匹配 `mcp-client` 的 Loader 条目；配置以 loader 条目的
  原始 config 为准。
- 传输方式只有 **stdio** 与 **streamable-http**（与 `dsh-mcp-client` 的
  Config schema 一致）：旧版 HTTP+SSE 传输已被 streamable-http 取代，客户端
  不支持；只提供旧版 SSE 端点的服务器需先经代理转换或改用其 streamable-http
  端点。
- 删除来自 patch 层（重启后装配）的实例：当前会话内仍存活，重启后消失
  （响应 `pendingRestart: true`，UI 有提示）。
