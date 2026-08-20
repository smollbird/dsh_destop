好的，已将“插件管理器”整合进原计划。以下是完整的 `dsh-desktop` 开发计划，涵盖从基础框架到功能完备的桌面应用，包含插件管理器、自动更新等核心特性。

---

## 📋 完整开发计划（v2.0）

### 一、项目定位与架构

- **定位**：独立桌面壳应用，管理 DSH 服务并提供原生桌面体验。
- **架构**：Electron 主进程管理 DSH 子进程，BrowserWindow 承载 DSH Web UI，插件管理器作为内置功能模块。
- **与 DSH 的关系**：`@deepseek-ai/dsh` 作为 npm 依赖，通过 `child_process` 调用。

---

### 二、技术选型

| 组件                    | 版本     | 用途                                               |
| ----------------------- | -------- | -------------------------------------------------- |
| **Electron**            | 41.x     | 跨平台桌面框架                                     |
| **electron-builder**    | 26.10.x  | 打包工具                                           |
| **electron-updater**    | 6.8.x    | 自动更新                                           |
| **TypeScript**          | 5.x      | 类型安全                                           |
| **React / Vue**（可选） | 最新     | 构建插件管理器的 UI（可内嵌在 WebView 或单独窗口） |
| **@deepseek-ai/dsh**    | 最新稳定 | DSH 核心                                           |

---

### 三、目录结构

```
dsh-desktop/
├── package.json
├── tsconfig.json
├── electron/
│   ├── main.ts                # 主进程入口
│   ├── preload.ts             # 预加载脚本（暴露安全 API）
│   ├── dshManager.ts          # DSH 服务生命周期管理
│   ├── windowManager.ts       # 窗口创建与管理
│   ├── trayManager.ts         # 系统托盘
│   ├── pluginManager.ts       # 插件管理（调用 dsh plugin 命令）
│   ├── updater.ts             # 自动更新逻辑
│   └── types.ts               # 类型定义
├── src/
│   └── plugin-ui/             # 插件管理器 UI（单独页面）
│       ├── index.html
│       ├── app.jsx            # React 或 Vue 组件
│       └── style.css
├── assets/
│   ├── icon.icns              # macOS 图标
│   ├── icon.ico               # Windows 图标
│   ├── icon.png               # Linux 图标
│   └── tray-icon.png          # 托盘图标
├── dist/                      # 打包输出
└── resources/                 # 额外资源（如 splash 画面）
```

---

### 四、核心功能开发（按阶段）

#### 🟢 Phase 1：MVP（基础框架）

**目标**：可启动、显示 DSH Web UI、退出时清理进程。

**功能点**：

- 单例模式（防止多开）
- 启动 DSH 服务（`spawn('npx', ['dsh', 'web'])`）
- 监听服务就绪（输出 `Server running` 后创建窗口）
- 创建 BrowserWindow 加载 `http://127.0.0.1:3080`
- 窗口关闭时最小化到托盘（不退出）
- 应用退出时终止 DSH 子进程

**关键代码**：

```typescript
// dshManager.ts
export function startDSH(): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["dsh", "web"], { stdio: "pipe" });
    child.stdout.on("data", (data) => {
      if (data.toString().includes("Server running on")) {
        resolve();
      }
    });
    // 存储进程引用以便退出时 kill
    global.dshProcess = child;
  });
}
```

---

#### 🟡 Phase 2：桌面增强体验

**目标**：提供原生桌面应用应有的交互细节。

**功能点**：

- **系统托盘**：右键菜单含「显示主界面 / 打开工作区 / 新建任务 / 退出」；双击恢复窗口
- **窗口状态记忆**：记住窗口大小、位置、最大化状态，重启后恢复
- **主题同步**：监听系统浅色/深色模式，通过 IPC 通知渲染进程，与 DSH Web UI 主题联动
- **窗口美化**：macOS 无边框标题栏（`titleBarStyle: 'hiddenInset'`），Windows 自定义标题栏
- **启动闪屏**（可选）：加载时显示自定义 Splash 画面

**核心实现**：

```typescript
// windowManager.ts
export function saveWindowState() {
  const bounds = mainWindow.getBounds();
  const maximized = mainWindow.isMaximized();
  // 写入用户数据目录
  fs.writeFileSync(statePath, JSON.stringify({ bounds, maximized }));
}
```

---

#### 🟠 Phase 3：插件管理器（核心新增）

**目标**：在桌面应用内提供图形化插件管理界面，简化插件安装、卸载、启用/停用操作。

**设计**：

- 在菜单栏添加「插件管理」入口，或集成到 DSH 的设置页面（通过注入脚本）
- 更好方案：在应用内开辟一个独立窗口或侧边栏，专门用于插件管理
- 调用底层 `dsh plugin` 命令，并通过 stdout 解析结果

**功能清单**：

1. **已安装插件列表**：展示插件名称、版本、状态（启用/停用）
2. **一键安装**：支持输入 npm 包名或 GitHub 仓库地址，自动执行 `dsh plugin add`
3. **一键卸载**：执行 `dsh plugin remove`
4. **启用/停用**：执行 `dsh plugin enable/disable`（如果支持）
5. **刷新列表**：重新读取配置
6. **搜索社区插件**：可调用 GitHub API 搜索 `topic:dsh-plugin` 仓库（可选）

**技术实现**：

- 在 `pluginManager.ts` 中封装命令执行函数：

```typescript
// pluginManager.ts
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

export async function listPlugins(profile = "web") {
  const { stdout } = await execAsync(`dsh plugin --profile ${profile} list`);
  return parsePluginList(stdout);
}

export async function addPlugin(packageName: string, profile = "web") {
  await execAsync(`dsh plugin --profile ${profile} add ${packageName}`);
}

export async function removePlugin(packageName: string, profile = "web") {
  await execAsync(`dsh plugin --profile ${profile} remove ${packageName}`);
}

// 可能需要重启服务
export async function restartDSH() {
  await stopDSH();
  await startDSH();
}
```

- **UI 实现**：使用 React/Vue 构建一个独立页面，通过 `webPreferences.preload` 暴露 `window.pluginAPI` 供渲染进程调用

**用户体验**：

- 安装插件后自动提示重启服务，并提供「立即重启」按钮
- 显示操作日志，方便排查错误

---

#### 🔵 Phase 4：自动更新

**目标**：应用自身可自动下载并安装新版本。

**功能点**：

- 使用 `electron-updater` 配置更新源（GitHub Releases 或自建服务器）
- 启动时检查更新，发现新版本时弹窗提示
- 支持静默下载、进度显示、安装后重启
- 设置中提供「检查更新」手动按钮

**配置示例**：

```json
// package.json build.publish
"publish": {
  "provider": "github",
  "owner": "your-github-username",
  "repo": "dsh-desktop",
  "private": false
}
```

---

#### 🟣 Phase 5：打包与发布

**目标**：生成各平台安装包，发布到 GitHub Releases 并配置更新元数据。

**命令**：

```bash
npm run build:mac   # 生成 .dmg 和 .zip
npm run build:win   # 生成 NSIS 安装包 .exe
npm run build:linux # 生成 AppImage 和 .deb
```

**配置要点**：

- 代码签名（macOS 和 Windows 需要开发者证书）
- 图标、应用名称、描述等信息填写完整
- 包含 `electron-updater` 所需的 `latest.yml` / `latest-mac.yml`

---

#### 🟤 Phase 6：优化与迭代

**目标**：根据用户反馈持续完善。

**可能的方向**：

- 支持自定义 DSH 配置文件路径
- 多 profile 切换（`web` / `cli` 等）
- 全局快捷键（如 `Cmd+Shift+Space` 呼出窗口）
- 插件安装源收藏（快速安装常用插件）
- 错误日志收集与上报

---

#### 🟤 Phase 7：托盘能力增强

**功能清单**：

1. 展示当前正在进行的对话(可多个)，点击打开界面并定位到对应的对话中
2. 系统级通知功能，当对话出现需要用户手动操作进行通知，如需要用户授权，执行命令，等中断，暂停情况，如当轮对话模型回答完毕时等情况。

### 五、开发里程碑

| 阶段                    | 周期   | 核心产出                                    |
| ----------------------- | ------ | ------------------------------------------- |
| **Phase 1: MVP**        | 1 周   | 基础窗口 + DSH 启动/停止 + 退出清理         |
| **Phase 2: 桌面增强**   | 1 周   | 托盘、窗口状态、主题同步、闪屏（可选）      |
| **Phase 3: 插件管理器** | 1.5 周 | UI 界面 + 底层命令封装 + 安装/卸载/列表功能 |
| **Phase 4: 自动更新**   | 1 周   | electron-updater 集成 + 更新服务器配置      |
| **Phase 5: 打包发布**   | 3-5 天 | 多平台打包 + 签名 + GitHub Releases 部署    |
| **Phase 6: 优化迭代**   | 持续   | 收集反馈，修复问题，增加新特性              |

**总预估工期**：约 5-6 周（单人全职开发）

---

### 六、注意事项与最佳实践

1. **DSH 启动检测**：准确捕获 `Server running on` 日志，或轮询端口 `3080` 是否可访问，确保窗口加载时服务已就绪。
2. **进程清理**：使用 `tree-kill` 或 `kill(pid, 'SIGTERM')` 彻底终止子进程及其子孙进程，避免残留。
3. **插件命令执行环境**：确保 `dsh` 可执行文件在 PATH 中，或使用 `npx dsh`（需 Node.js 环境）。建议捆绑 Node.js 或提示用户安装。
4. **安全性**：插件管理器执行的命令来自用户输入，需防范注入风险（如参数转义）。
5. **异步操作反馈**：所有长时间操作（安装插件、检查更新）需提供进度指示或 loading 状态。
6. **日志记录**：将关键操作（启动、安装插件、更新）写入日志文件，便于排错。

---

### 七、用户使用流程

1. 用户下载并安装 `dsh-desktop.dmg` / `.exe`
2. 双击启动，应用自动拉起 DSH 服务并显示 Web 界面
3. 在菜单栏或设置中找到「插件管理器」
4. 浏览已安装插件列表，可通过输入框输入 npm 包名或 GitHub 地址安装新插件
5. 安装后点击「重启服务」使插件生效
6. 后续有新版桌面应用时，自动提示更新并一键安装

---

以上为完整的开发计划。如果你对插件管理器的 UI 框架选择或具体实现有进一步偏好（如是否与 DSH Web UI 集成还是独立窗口），可以进一步细化。是否开始编写 Phase 1 的代码？我可以提供详细实现。
