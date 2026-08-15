/**
 * main.ts —— dsh-desktop 主进程入口
 *
 * 装配各管理器：
 * - dshManager：DSH 服务生命周期 / 内核升级
 * - windowManager：主窗口（含状态记忆、关闭到托盘、导航守卫）
 * - trayManager：系统托盘
 * - pluginManager：插件管理（Phase 3）+ 插件管理窗口
 * - updaterManager：应用自动更新（Phase 4）
 *
 * 功能：单实例、主题同步（Phase 2）、全局快捷键（Phase 6）、菜单。
 */
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  shell,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import {
  APP_ICONS,
  APP_TITLE,
  APP_USER_MODEL_ID,
  DshManager,
  WORKSPACE,
} from "./dshManager";
import { WindowManager } from "./windowManager";
import { TrayManager } from "./trayManager";
import { PluginManager } from "./pluginManager";
import { UpdaterManager } from "./updater";
import { IPC, type ThemeSource } from "./types";

const ROOT = path.resolve(__dirname, "..");
const PLUGIN_UI = path.join(ROOT, "src", "plugin-ui", "index.html");

/* ------------------------------------------------------------------ */
/* 管理器实例                                                          */
/* ------------------------------------------------------------------ */

const dsh = new DshManager({
  onUnexpectedExit: (code) => {
    dialog
      .showMessageBox({
        type: "error",
        title: APP_TITLE,
        message: "DeepSeek Harness 服务已退出",
        detail: `dsh web 进程异常退出（code=${code}）。日志见 ${path.join(dsh.logDir, "dsh-web.log")}`,
      })
      .then(() => app.quit());
  },
  onRestarted: () => {
    // 服务重启完成（插件安装/启停/内核升级后）：重新加载主窗口，让新插件 UI 生效
    windowManager.loadServer();
  },
});

const windowManager = new WindowManager(dsh, {
  canHideToTray: () => trayManager.exists && !quitting,
  onClosed: () => {
    /* 窗口真正关闭：无操作（退出流程由 before-quit 负责） */
  },
});

const trayManager = new TrayManager(dsh, {
  onShowMain: () => windowManager.focus(),
  onOpenWorkspace: () => void openCurrentWorkspace(),
  onNewTask: () => {
    // 聚焦主窗口并广播事件；preload 会把它翻译为点击 DSH Web UI 的「新建会话」按钮
    windowManager.focus();
    const win = windowManager.window;
    if (win && !win.isDestroyed()) win.webContents.send("dsh-desktop:new-task");
  },
  onQuit: () => app.quit(),
});

const pluginManager = new PluginManager(dsh);
const updater = new UpdaterManager(dsh);

let quitting = false;

/* ------------------------------------------------------------------ */
/* 主题同步（Phase 2）                                                  */
/* ------------------------------------------------------------------ */

function effectiveTheme(): "light" | "dark" {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function broadcastTheme(): void {
  const theme = effectiveTheme();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.ThemeChanged, theme);
  }
}

/* ------------------------------------------------------------------ */
/* IPC 注册                                                            */
/* ------------------------------------------------------------------ */

function registerIpc(): void {
  /* 主题 */
  ipcMain.handle(IPC.ThemeGet, () => effectiveTheme());
  ipcMain.handle(IPC.ThemeSetSource, (_e, source: ThemeSource) => {
    if (source === "system" || source === "light" || source === "dark") {
      nativeTheme.themeSource = source;
    }
    broadcastTheme();
  });
  nativeTheme.on("updated", broadcastTheme);

  /* 窗口 */
  ipcMain.on(IPC.WindowMinimize, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  /* 插件管理 */
  ipcMain.handle(IPC.PluginList, () => pluginManager.list());
  ipcMain.handle(IPC.PluginSetProfile, (_e, profile: string) => {
    pluginManager.profile = profile;
  });
  ipcMain.handle(IPC.PluginAdd, (_e, pkg: string) => pluginManager.add(pkg));
  ipcMain.handle(IPC.PluginRemove, (_e, pkg: string) => pluginManager.remove(pkg));
  ipcMain.handle(IPC.PluginSetEnabled, (_e, pkg: string, enabled: boolean) =>
    pluginManager.setEnabled(pkg, enabled)
  );
  ipcMain.handle(IPC.PluginSearch, (_e, query: string) => pluginManager.search(query));
  ipcMain.handle(IPC.PluginRestart, () => pluginManager.restart());
  pluginManager.on("log", (entry) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.PluginLog, entry);
    }
  });

  /* 自动更新 */
  ipcMain.handle(IPC.UpdateCheck, () => updater.check());
  ipcMain.handle(IPC.UpdateDownload, () => updater.download());
  ipcMain.handle(IPC.UpdateInstall, () => {
    updater.install();
  });
  updater.on("status", (status) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.UpdateStatus, status);
    }
  });
}

/* ------------------------------------------------------------------ */
/* 插件管理窗口（Phase 3）                                              */
/* ------------------------------------------------------------------ */

function openPluginWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 780,
    minHeight: 540,
    title: `插件管理 — ${APP_TITLE}`,
    icon: resolveWindowIcon(),
    backgroundColor: "#0b0d12",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "plugin-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  win.loadFile(PLUGIN_UI).catch((err) => {
    dialog.showErrorBox(APP_TITLE, `无法加载插件管理界面：${err.message}`);
  });
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
}

function resolveWindowIcon(): Electron.NativeImage | string | undefined {
  for (const candidate of [APP_ICONS.icns, APP_ICONS.icnsLegacy, APP_ICONS.png]) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) return image;
  }
  if (fs.existsSync(APP_ICONS.ico)) return APP_ICONS.ico;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* 工作区（托盘 / 菜单「打开工作区」共用）                                */
/* ------------------------------------------------------------------ */

/**
 * 从 Web UI 页面读取「当前打开的对话」id：
 * Web UI 客户端把当前会话持久化在 localStorage 的 `dsh.sessions.current`
 * （{ sessionId, subagentAddress? }），跟随用户在界面里的切换实时更新 ——
 * 这是"用户现在正在看哪个对话"的唯一权威来源。
 * 窗口还在启动页 / 服务尚未就绪时读取不到，稍等重试。
 */
async function readCurrentSessionId(win: BrowserWindow | null): Promise<string | null> {
  if (!win || win.isDestroyed()) return null;
  const read = async (): Promise<string | null> => {
    try {
      const raw = await win.webContents.executeJavaScript(
        `(() => { try { const v = localStorage.getItem("dsh.sessions.current"); if (!v) return null; const o = JSON.parse(v); return typeof o?.sessionId === "string" ? o.sessionId : null; } catch { return null; } })()`
      );
      return typeof raw === "string" ? raw : null;
    } catch {
      return null;
    }
  };
  let id = await read();
  if (id) return id;
  // UI 尚未加载（启动页 / 服务启动中）：等它就绪后再读，最多约 5 秒
  const origin = dsh.origin;
  for (let i = 0; i < 5 && !id; i++) {
    if (origin && win.webContents.getURL().startsWith(origin)) break; // UI 已加载但无当前会话
    await new Promise((resolve) => setTimeout(resolve, 1000));
    id = await read();
  }
  return id;
}

/**
 * 在 Finder / 资源管理器中打开当前工作区目录：
 * 优先打开 Web UI 中「当前打开的对话」所在的工作区（见 DshManager.currentWorkspacePath），
 * 全部回退落空时打开服务工作目录 WORKSPACE。
 */
async function openCurrentWorkspace(): Promise<void> {
  const sessionId = await readCurrentSessionId(windowManager.window);
  const target = (await dsh.currentWorkspacePath(sessionId)) ?? WORKSPACE;
  try {
    fs.mkdirSync(target, { recursive: true });
  } catch {
    /* noop */
  }
  const error = await shell.openPath(target);
  if (error) {
    dsh.logLine(`open workspace failed (${target}): ${error}`);
    if (target !== WORKSPACE) {
      try {
        fs.mkdirSync(WORKSPACE, { recursive: true });
      } catch {
        /* noop */
      }
      await shell.openPath(WORKSPACE);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 菜单                                                                */
/* ------------------------------------------------------------------ */

function buildMenu(): Menu {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { label: `关于 ${APP_TITLE}`, role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { label: "隐藏", role: "hide" as const },
              { label: "隐藏其他", role: "hideOthers" as const },
              { label: "全部显示", role: "unhide" as const },
              { type: "separator" as const },
              { label: "退出", accelerator: "CmdOrCtrl+Q", role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "文件",
      submenu: [
        {
          label: "插件管理…",
          accelerator: "CmdOrCtrl+P",
          click: () => openPluginWindow(),
        },
        { type: "separator" },
        { label: "重新加载", accelerator: "CmdOrCtrl+R", role: "reload" as const },
        { label: "开发者工具", accelerator: "CmdOrCtrl+Shift+I", role: "toggleDevTools" as const },
        ...(process.platform === "win32"
          ? ([
              { type: "separator" as const },
              { label: "退出", accelerator: "Alt+F4", role: "quit" as const },
            ] as Electron.MenuItemConstructorOptions[])
          : []),
      ],
    },
    {
      label: "编辑",
      submenu: [
        { label: "撤销", role: "undo" as const },
        { label: "重做", role: "redo" as const },
        { type: "separator" as const },
        { label: "剪切", role: "cut" as const },
        { label: "复制", role: "copy" as const },
        { label: "粘贴", role: "paste" as const },
        { label: "粘贴并匹配样式", role: "pasteAndMatchStyle" as const },
        { label: "删除", role: "delete" as const },
        { type: "separator" as const },
        { label: "全选", role: "selectAll" as const },
      ],
    },
    {
      label: "视图",
      submenu: [
        { label: "全屏", accelerator: "F11", role: "togglefullscreen" as const },
        { type: "separator" as const },
        { label: "放大", role: "zoomIn" as const },
        { label: "缩小", role: "zoomOut" as const },
        { label: "实际大小", role: "resetZoom" as const },
      ],
    },
    {
      label: "外观",
      submenu: [
        {
          label: "跟随系统",
          type: "radio",
          checked: nativeTheme.themeSource === "system",
          click: () => {
            nativeTheme.themeSource = "system";
          },
        },
        {
          label: "浅色",
          type: "radio",
          checked: nativeTheme.themeSource === "light",
          click: () => {
            nativeTheme.themeSource = "light";
          },
        },
        {
          label: "深色",
          type: "radio",
          checked: nativeTheme.themeSource === "dark",
          click: () => {
            nativeTheme.themeSource = "dark";
          },
        },
        { type: "separator" },
        {
          label: "显示主界面",
          accelerator: "CmdOrCtrl+Shift+Space",
          click: () => windowManager.focus(),
        },
      ],
    },
    {
      label: "帮助",
      submenu: [
        { label: "检查内核更新…", click: () => void dsh.checkAndUpgradeKernel() },
        { label: "检查应用更新…", click: () => void updater.check() },
        { type: "separator" },
        {
          label: "打开工作区目录",
          click: () => void openCurrentWorkspace(),
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

/* ------------------------------------------------------------------ */
/* 启动流程                                                            */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    windowManager.focus();
  });

  app.whenReady().then(async () => {
    if (process.platform === "win32") {
      // 与桌面快捷方式的 System.AppUserModel.ID 保持一致：
      // 决定运行中/固定到任务栏时 Windows 使用哪个图标
      app.setAppUserModelId(APP_USER_MODEL_ID);
    } else if (process.platform === "darwin") {
      const image = resolveWindowIcon();
      if (image && typeof image !== "string" && app.dock) {
        try {
          app.dock.setIcon(image);
        } catch (err) {
          dsh.logLine(`dock icon skipped: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    Menu.setApplicationMenu(buildMenu());
    registerIpc();
    updater.init();
    trayManager.create();

    // 全局快捷键（Phase 6）：呼出主窗口
    globalShortcut.register("CommandOrControl+Shift+Space", () => windowManager.focus());

    windowManager.create();
    dsh.logLine(`app ready (packaged=${app.isPackaged}, userData=${app.getPath("userData")})`);

    try {
      const result = await dsh.ensureServer();
      if (!result) return; // 错误弹窗已展示
      await dsh.waitReady(result.url, 30_000);
      windowManager.loadServer();
    } catch (err) {
      dsh.showBootError(`启动失败：${err instanceof Error ? err.message : String(err)}`);
    }
  });

  app.on("before-quit", () => {
    dsh.logLine(`before-quit triggered\n${new Error("trace").stack ?? ""}`);
    quitting = true;
    dsh.setQuitting();
    dsh.shutdown();
    globalShortcut.unregisterAll();
    trayManager.destroy();
    windowManager.saveState();
  });

  app.on("window-all-closed", () => {
    dsh.logLine(`window-all-closed (quitting=${quitting})`);
    if (process.platform !== "darwin") app.quit();
  });

  process.on("uncaughtException", (err) => {
    dsh.logLine(`uncaughtException: ${err.stack ?? String(err)}`);
  });
}
