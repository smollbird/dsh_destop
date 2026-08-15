# DeepSeek Harness 桌面版（dsh-desktop）

以 Electron 原生窗口承载 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI 的桌面外壳。
启动时自动 boot `dsh web`（web profile = `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app` 两个 bundle，
即 Harness 的完整插件栈：agent、tools、hosts（webserver / API 网关 / 前端静态）、client-ui、
session、skills、goal、subagent、workflow 等），随后在桌面窗口中直接使用，无需浏览器。

## 特性

- **插件集成**：以项目内安装的 `@deepseek-ai/dsh` CLI 作为启动器 boot web profile，
  插件清单见 `dsh web --dump-default-config`；额外插件可通过 `config/desktop.patch.yml` 叠加层启用。
- **单实例**：重复双击图标只会聚焦已打开的窗口，不会重复启动服务。
- **端口复用**：默认端口 `3400` 已被 DSH 实例占用时直接连接该实例。
- **原生体验**：官方 DSH logo 系统图标（任务栏/固定图标通过 `System.AppUserModel.ID` 关联）、
  外部链接交给系统浏览器、退出时自动回收 dsh 进程树。
- **跨平台**：Windows / macOS 均可运行（macOS 见下文）。
- **日志**：dsh web 运行日志写入 `logs/dsh-web.log`，方便排查启动问题。

## 安装

```powershell
cd D:\project\dsh-destop
npm install
```

> 首次运行会通过 `~/.dsh`（即 `$DSH_HOME`）下的 `web` profile 启动服务；
> 若 profile 不存在会自动初始化。模型凭据沿用 `~/.dsh/.credentials.yaml` 中已有的配置。

## 运行

```powershell
npm start
```

或直接双击桌面快捷方式「DeepSeek Harness 桌面版」（安装时自动创建，
指向 `node_modules\electron\dist\electron.exe`，无控制台窗口）。

也可以双击项目根目录的 `dsh-desktop.cmd`。

## 任务栏 / 固定图标

Windows 任务栏（含「固定到任务栏」）的图标由进程的 **AppUserModelID** 决定。
本应用已做以下关联，全部指向官方 DSH logo（`assets/dsh-desktop.ico`）：

1. 主进程启动时调用 `app.setAppUserModelId("com.deepseek.dsh-desktop")`；
2. 桌面快捷方式写入相同的 `System.AppUserModel.ID` 属性（由
   `scripts/create-shortcut.ps1` 完成并通过 shell 属性系统校验）。

如果你之前固定过任务栏图标（当时还是旧图标），请先**取消固定**，
再从桌面快捷方式或运行中的应用重新固定一次即可。

## macOS 支持

代码与图标资产均为跨平台（macOS 分支：进程回收用进程组 SIGTERM、
Dock 图标加载 `assets/DeepSeek Harness.icns`、Node 解析 Homebrew 路径）。

**在 Mac 上直接运行：**

```bash
cd dsh-destop
npm install
npm start
```

依赖：Node.js 18+（Homebrew：`brew install node`）、macOS 自带的 WebView 不需要——Electron 自带 Chromium。

**打包成 .app / .dmg（需在 Mac 上执行，electron-builder 不支持跨平台打 mac 包）：**

```bash
npm install --save-dev electron-builder
npx electron-builder --mac
```

产物在 `dist/`。图标源文件：`assets/DeepSeek Harness.iconset`（标准 10 文件，
也可在 Mac 上用 `iconutil -c icns` 重新生成 `DeepSeek Harness.icns`）。

## 目录结构

```
dsh-destop/
├─ electron/
│  ├─ main.js          # 主进程：boot dsh web、等待就绪、原生窗口、进程回收（跨平台）
│  └─ preload.js       # 最小 preload（不暴露 Node 能力）
├─ assets/
│  ├─ dsh-desktop.ico  # Windows 应用图标（官方 DSH logo，16–256 多尺寸）
│  ├─ DeepSeek Harness.icns / .iconset  # macOS 图标
│  ├─ dsh-logo.svg     # 官方 logo 源文件
│  ├─ icons/           # 各尺寸 PNG（16–1024）
│  └─ loading.html     # 启动等待页
├─ config/
│  └─ desktop.patch.yml  # 桌面版插件叠加层（--patch），默认空
├─ scripts/
│  ├─ make-icon.js     # 重新生成全部图标（npm run make:icon）
│  └─ create-shortcut.ps1  # 创建桌面快捷方式（含 AppUserModelID）
├─ electron-builder.yml   # 可选：打包配置（win nsis / mac dmg）
├─ logs/               # dsh web 运行日志（自动创建）
└─ package.json
```

## 插件管理

- 查看当前 profile 已装插件与配置树：
  ```powershell
  npx dsh web --dump-config
  ```
- 向 `web` profile 安装 / 移除插件（forward 到 pnpm，profile 自动初始化）：
  ```powershell
  npx dsh plugin --profile web add <package>
  npx dsh plugin --profile web remove <package>
  ```
- **桌面版专属插件叠加层**：编辑 `config/desktop.patch.yml`（存在即作为 `--patch`
  传给 `dsh web`，顺序在所有 bundle 与用户层之后），例如：

  ```yaml
  - id: my-plugin
    config:
      foo: bar
  ```

  重启桌面版生效。叠加层语法与 `dsh --patch` 一致（loader patch 条目数组）。

## 更新与同步

本仓库以 GitHub 为远端（`origin` = `git@github.com:smollbird/dsh_destop.git`），
在其他电脑 / 服务器上改完推上去后，在本机同步：

```bash
git pull              # 拉取最新代码（含 plugins/、config/、electron/ 等改动）
npm install           # 必须：同步依赖（file: 本地插件等）
```

- 本机有未提交改动时先 `git status` 确认，或 `git stash` 暂存后再 pull。
- 改完本机代码要发出去：`git add -A && git commit -m "..." && git push`。
- **改完代码必须重新打包**，安装包不会自动更新：`npm run build:mac`（Mac）
  或 `npm run build:win`（Windows，需在 Windows 机器上执行）。
- 升级 DeepSeek Harness 内核：修改 `package.json` 里 `@deepseek-ai/dsh` 及
  各 `@deepseek-ai/dsh-*` 的版本号后 `npm install`，再重新打包。
  当前 npm 最新版为 `0.1.0-rc.6`（本项目已是最新）。
- **安装后的应用内内核升级（无需重新打包）**：打包安装版打开
  「帮助 → 检查内核更新…」，应用会用随包分发的 npm 从仓库下载新内核，
  安装到用户数据目录 `USER_DATA/kernel/<版本>/`，成功后自动重启服务。
  内核文件在用户数据目录，卸载/覆盖安装应用不影响；若升级目录损坏或
  打包自带内核更新，会自动回退到打包自带版本。
- **应用自动更新（electron-updater）**：已配置 GitHub Releases 发布源
  （`electron-builder.yml` 的 `publish`，公开仓库 `smollbird/dsh_destop`）。
  首次检查前需先在 GitHub Releases 发布一个版本，产物需包含更新元数据
  （`latest.yml` / `latest-mac.yml`）和安装包 —— 可用 `npm run build:mac`
  等命令打包后上传 Release。公开仓库无需 token。
- **分发给终端用户的更新**：重新打包后把新安装包发给用户覆盖安装即可
  （用户数据在 `%APPDATA%` / `~/Library/Application Support` 下，不会被覆盖）。
  用户也可以在应用内用「检查内核更新」升级内核功能。

## 配置

- **端口**：默认 `3400`。若被占用且不是 DSH 实例，自动回退到系统分配端口。
  可通过修改 `electron/main.js` 中的 `DEFAULT_PORT` 调整。
- **工作目录**：开发模式 = 项目根目录；打包安装版 = 用户数据目录下的
  `workspace`（`%APPDATA%\DeepSeek Harness Desktop\workspace` 或
  `~/Library/Application Support/DeepSeek Harness Desktop/workspace`），
  与安装目录无关。托盘「打开工作区」/ 菜单「帮助 → 打开工作区目录」
  会打开 Web UI 中**当前打开的对话**所在的工作区目录（读取 UI 的当前会话，
  与界面里正在看的对话严格一致）；UI 未就绪时回退到最近活跃的工作区，
  最后才回退到上面的服务工作目录。
- **DSH_HOME**：默认 `~/.dsh`，可用环境变量覆盖。

## 打包分发（给其他电脑安装）

打包版与开发版的行为差异（已在 `electron/main.js` 处理）：

- 工作区与日志放到用户数据目录（`%APPDATA%\dsh-desktop\workspace`、`...\logs`），
  不依赖安装目录可写（Program Files 也可安装）；
- 随包分发 `vendor/node`（node.exe + MIT LICENSE），**目标电脑无需安装 Node.js**；
- dsh 及全部插件随包打包（`asar: false`，普通 node 进程才能读取）。

### Windows（已在本机完成构建）

**打包命令**（在项目目录 `D:\project\dsh-destop` 下执行，已写入 `package.json` scripts）：

```powershell
# 首次（只需一次）：安装 electron-builder
npm install --save-dev electron-builder

# 每次打包：一条命令
npm run build:win
```

| npm script | 等价命令 | 产物 |
|---|---|---|
| `npm run build:win` | `electron-builder --win` | 安装包 + 便携 zip |
| `npm run build:win:nsis` | `electron-builder --win nsis` | 仅安装包 |
| `npm run build:win:zip` | `electron-builder --win zip` | 仅便携 zip |
| `npm run build:mac` | `electron-builder --mac` | mac 包（需在 Mac 上执行） |

产物输出到 `dist\`：

| 文件 | 用途 |
|---|---|
| `DeepSeek Harness Desktop Setup 1.0.0.exe` | NSIS 安装包（推荐，含开始菜单/桌面快捷方式/卸载器） |
| `DeepSeek Harness Desktop-1.0.0-win.zip` | 免安装便携版（解压即用，双击 `DeepSeek Harness Desktop.exe`） |

**常用变体：**

| 需求 | 命令 |
|---|---|
| 只要安装包 | `npm run build:win:nsis` |
| 只要便携 zip | `npm run build:win:zip` |
| 改版本号 | 修改 `package.json` 的 `"version"` 字段后再打包（产物文件名跟随版本号） |

**网络慢 / 下载失败时的处理**（electron-builder 需下载 NSIS 工具链，走 GitHub 易断线）：

```powershell
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
npm run build:win
```

若 `npm install` 也报 `ECONNRESET`，加镜像重试：

```powershell
npm install --save-dev electron-builder --registry https://registry.npmmirror.com
```

打包配置全部在 `electron-builder.yml`（已设置：复用本地 electron 免重复下载、打包自带
`vendor/node`、`asar: false`、`npmRebuild: false` 等），直接运行命令即可，无需额外参数。

**发给其他 Windows 电脑**：直接拷贝安装包过去双击安装即可。注意：

- 安装包**未做代码签名**，目标电脑首次运行会提示 SmartScreen「未知发布者」——
  点「更多信息 → 仍要运行」即可（正式分发建议购买代码签名证书后重新打包）；
- 目标电脑首次启动会自动初始化 `~/.dsh` profile（约几秒），
  之后在应用「设置」里配置自己的模型凭据；
- 目标电脑无需安装 Node.js / pnpm。

### macOS（需在 Mac 上构建）

electron-builder 不支持跨平台打 mac 包，**mac 的 .app/.dmg 必须在 Mac 上执行**：

```bash
# 1) 拷贝本项目到 Mac（含 vendor/node 需先放入 mac 版 node）：
mkdir -p vendor/node
cp "$(which node)" vendor/node/bin/node        # 或 brew 安装的 node
# 2) 安装依赖并打包：
npm install
npm install --save-dev electron-builder
npx electron-builder --mac
```

产物在 `dist/`：`DeepSeek Harness Desktop-1.0.0.dmg`（拖入 Applications 安装）与 `.zip`。
macOS 首次打开未签名应用：右键 → 打开 → 确认（或 `xattr -dr com.apple.quarantine`）。
首次运行同样会自动初始化 `~/.dsh` profile 并可在设置中配置凭据。

> 不打包也能在 Mac 上直接用：`npm install && npm start`（见「macOS 支持」）。

## 常见问题

| 现象 | 处理 |
|---|---|
| 窗口长时间停在加载页 | 查看 `logs/dsh-web.log`；确认 `~/.dsh/profiles/web` 初始化正常 |
| 提示端口被占用 | 关闭其它 DSH 实例（如 `dsh web` 进程）后重试 |
| 任务栏/固定图标是 Electron 默认图标 | 取消固定后重新固定（见「任务栏 / 固定图标」）；或重跑 `scripts/create-shortcut.ps1` |
| 模型无法使用 | 在设置中检查模型凭据（沿用 `~/.dsh` 中的配置） |
| 重新生成图标 | `npm run make:icon`（需要 sharp，可从 dsh 安装中获得） |

## 卸载

删除本项目目录与桌面快捷方式即可。`~/.dsh` 中的数据不受影响。

---

基于 MIT 协议开源。DeepSeek Harness 官方仓库：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
