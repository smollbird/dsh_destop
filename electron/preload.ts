/**
 * preload.ts —— 主窗口预加载脚本
 *
 * 以最小表面暴露桌面环境信息与主题/窗口/更新能力
 * （contextIsolation + sandbox，不向页面开放任何 Node 能力）。
 *
 * 注意：sandbox 模式下 preload 只能 require electron 等内置模块，
 * 因此本文件必须自包含 —— IPC 通道名内联为字符串字面量（与 types.ts 保持同步），
 * 类型引用一律使用 `import type`（编译期擦除，不产生运行时 require）。
 *
 * 另负责把主进程的桌面意图翻译成页面动作：
 * - 托盘「新建任务」(dsh-desktop:new-task) → 点击 DSH Web UI 的「新建会话」按钮
 */
import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge, ThemeSource, UpdateStatus } from "./types";

/* IPC 通道名（必须与 electron/types.ts 的 IPC 常量保持一致）。 */
const IPC = {
  ThemeGet: "theme:get",
  ThemeSetSource: "theme:set-source",
  ThemeChanged: "theme:changed",
  WindowMinimize: "window:minimize",
  UpdateCheck: "update:check",
  UpdateDownload: "update:download",
  UpdateInstall: "update:install",
  UpdateStatus: "update:status",
} as const;

/** DSH Web UI「新建会话」按钮的选择器（zh / en 两套文案，防未来改名）。 */
const NEW_SESSION_SELECTORS = [
  'button[aria-label="新建会话"]',
  'button[aria-label="新会话"]',
  'button[aria-label="New session"]',
];

/** 点击 DSH Web UI 的「新建会话」按钮；找不到返回 false。 */
function clickNewSessionButton(): boolean {
  for (const selector of NEW_SESSION_SELECTORS) {
    const btn = document.querySelector<HTMLButtonElement>(selector);
    if (btn) {
      btn.click();
      return true;
    }
  }
  return false;
}

/**
 * 托盘「新建任务」→ 页面动作。
 * DSH Web UI 是远程内容（无内置监听），因此在这里转发为点击其侧边栏
 * 「新建会话」按钮；UI 尚未挂载时最多重试 NEW_SESSION_RETRIES 次。
 */
function wireNewTask(): void {
  const RETRY_INTERVAL_MS = 500;
  const MAX_RETRIES = 40; // 最多 20s，覆盖服务启动 / UI 加载
  ipcRenderer.on("dsh-desktop:new-task", () => {
    if (clickNewSessionButton()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (clickNewSessionButton() || tries >= MAX_RETRIES) clearInterval(timer);
    }, RETRY_INTERVAL_MS);
  });
}

function exposeDesktopBridge(): void {
  const bridge: DesktopBridge = {
    appName: "DeepSeek Harness 桌面版",
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
    platform: process.platform,
    theme: {
      get: () => ipcRenderer.invoke(IPC.ThemeGet) as Promise<"light" | "dark">,
      setSource: (source: ThemeSource) => ipcRenderer.invoke(IPC.ThemeSetSource, source),
      onChange: (cb) => {
        const listener = (_e: Electron.IpcRendererEvent, effective: "light" | "dark") =>
          cb(effective);
        ipcRenderer.on(IPC.ThemeChanged, listener);
        return () => {
          ipcRenderer.removeListener(IPC.ThemeChanged, listener);
        };
      },
    },
    window: {
      minimize: () => ipcRenderer.send(IPC.WindowMinimize),
    },
    update: {
      check: () => ipcRenderer.invoke(IPC.UpdateCheck) as Promise<UpdateStatus>,
      download: () => ipcRenderer.invoke(IPC.UpdateDownload),
      install: () => ipcRenderer.invoke(IPC.UpdateInstall),
      onStatus: (cb) => {
        const listener = (_e: Electron.IpcRendererEvent, status: UpdateStatus) => cb(status);
        ipcRenderer.on(IPC.UpdateStatus, listener);
        return () => {
          ipcRenderer.removeListener(IPC.UpdateStatus, listener);
        };
      },
    },
  };
  contextBridge.exposeInMainWorld("dshDesktop", bridge);
}

exposeDesktopBridge();
wireNewTask();
