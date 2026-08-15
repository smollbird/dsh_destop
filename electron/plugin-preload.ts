/**
 * plugin-preload.ts —— 插件管理窗口预加载脚本
 *
 * 在桌面桥（preload.ts）基础上，额外暴露 window.dshPlugin 插件管理 API。
 * 只被插件管理窗口使用，绝不注入 DSH Web UI（远程内容）。
 *
 * 注意：sandbox 模式下 preload 只能 require electron 等内置模块，
 * 因此本文件必须自包含 —— IPC 通道名内联为字符串字面量（与 types.ts 保持同步），
 * 类型引用一律使用 `import type`（编译期擦除，不产生运行时 require）。
 */
import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopBridge,
  PluginBridge,
  PluginListPayload,
  PluginLogEntry,
  PluginResult,
  PluginSearchResult,
  ThemeSource,
  UpdateStatus,
} from "./types";

/* IPC 通道名（必须与 electron/types.ts 的 IPC 常量保持一致）。 */
const IPC = {
  ThemeGet: "theme:get",
  ThemeSetSource: "theme:set-source",
  ThemeChanged: "theme:changed",
  WindowMinimize: "window:minimize",
  PluginList: "plugin:list",
  PluginSetProfile: "plugin:set-profile",
  PluginAdd: "plugin:add",
  PluginRemove: "plugin:remove",
  PluginSetEnabled: "plugin:set-enabled",
  PluginSearch: "plugin:search",
  PluginRestart: "plugin:restart",
  PluginLog: "plugin:log",
  UpdateCheck: "update:check",
  UpdateDownload: "update:download",
  UpdateInstall: "update:install",
  UpdateStatus: "update:status",
} as const;

/** 桌面桥（与 preload.ts 保持一致；sandbox 下无法 require 共享文件，故内联）。 */
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

function exposePluginBridge(): void {
  const bridge: PluginBridge = {
    list: () => ipcRenderer.invoke(IPC.PluginList) as Promise<PluginListPayload>,
    setProfile: (profile: string) => ipcRenderer.invoke(IPC.PluginSetProfile, profile),
    add: (pkg: string) => ipcRenderer.invoke(IPC.PluginAdd, pkg) as Promise<PluginResult>,
    remove: (pkg: string) => ipcRenderer.invoke(IPC.PluginRemove, pkg) as Promise<PluginResult>,
    setEnabled: (pkg: string, enabled: boolean) =>
      ipcRenderer.invoke(IPC.PluginSetEnabled, pkg, enabled) as Promise<PluginResult>,
    search: (query: string) =>
      ipcRenderer.invoke(IPC.PluginSearch, query) as Promise<PluginSearchResult[]>,
    restart: () => ipcRenderer.invoke(IPC.PluginRestart) as Promise<PluginResult>,
    onLog: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, entry: PluginLogEntry) => cb(entry);
      ipcRenderer.on(IPC.PluginLog, listener);
      return () => {
        ipcRenderer.removeListener(IPC.PluginLog, listener);
      };
    },
  };
  contextBridge.exposeInMainWorld("dshPlugin", bridge);
}

exposeDesktopBridge();
exposePluginBridge();
