/**
 * windowManager.ts —— 窗口创建与管理
 *
 * Phase 1/2：
 * - 创建主窗口（闪屏页 → DSH Web UI）
 * - 窗口状态记忆：位置 / 尺寸 / 最大化，重启后恢复（USER_DATA/window-state.json）
 * - 关闭时最小化到托盘（不退出）
 * - 导航守卫：外部链接交给系统浏览器
 * - 原生默认标题栏（各平台系统默认，拖拽 / 双击缩放等交给系统处理）
 */
import { BrowserWindow, app, nativeImage, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { APP_ICONS, APP_TITLE, DshManager, USER_DATA } from "./dshManager";
import type { WindowState } from "./types";

const LOADING_HTML = path.join(__dirname, "..", "assets", "loading.html");
const STATE_FILE = path.join(USER_DATA, "window-state.json");

const DEFAULT_STATE: WindowState = {
  width: 1440,
  height: 900,
  maximized: false,
};

/** 主窗口相关回调。 */
export interface WindowManagerCallbacks {
  /** 询问当前是否允许“关闭即隐藏到托盘”（托盘存在且未在退出）。 */
  canHideToTray: () => boolean;
  /** 窗口真正关闭（托盘退出 / 应用退出）后通知。 */
  onClosed: () => void;
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  constructor(
    private dsh: DshManager,
    private callbacks: WindowManagerCallbacks
  ) {}

  get window(): BrowserWindow | null {
    return this.mainWindow;
  }

  /* ---------------------------------------------------------------- */
  /* 窗口状态记忆                                                      */
  /* ---------------------------------------------------------------- */

  private readState(): WindowState {
    try {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as Partial<WindowState>;
      return {
        width: typeof raw.width === "number" ? raw.width : DEFAULT_STATE.width,
        height: typeof raw.height === "number" ? raw.height : DEFAULT_STATE.height,
        x: typeof raw.x === "number" ? raw.x : undefined,
        y: typeof raw.y === "number" ? raw.y : undefined,
        maximized: raw.maximized === true,
      };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  /** 保存窗口状态（拖拽/缩放/最大化/关闭时调用）。 */
  saveState(): void {
    const win = this.mainWindow;
    if (!win || win.isDestroyed() || win.isFullScreen()) return;
    try {
      const state: WindowState = {
        width: win.getBounds().width,
        height: win.getBounds().height,
        maximized: win.isMaximized(),
      };
      if (!win.isMaximized()) {
        const { x, y } = win.getBounds();
        state.x = x;
        state.y = y;
      }
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
    } catch {
      /* 状态保存失败不阻塞 */
    }
  }

  /* ---------------------------------------------------------------- */
  /* 窗口创建                                                          */
  /* ---------------------------------------------------------------- */

  private isAllowedNavigation(url: string): boolean {
    if (url.startsWith("file://")) return true;
    const origin = this.dsh.origin;
    if (origin && url.startsWith(origin)) return true;
    if (url.startsWith("http://localhost:") || url.startsWith("http://127.0.0.1:")) return true;
    return false;
  }

  create(): BrowserWindow {
    const state = this.readState();
    const win = new BrowserWindow({
      ...state,
      minWidth: 960,
      minHeight: 600,
      show: false,
      title: APP_TITLE,
      icon: this.resolveWindowIcon(),
      autoHideMenuBar: true,
      backgroundColor: "#0b0d12",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    });
    this.mainWindow = win;

    win.loadFile(LOADING_HTML).catch((err) => {
      this.dsh.showBootError("无法加载启动页", `${LOADING_HTML}\n${err.message}`);
    });
    win.once("ready-to-show", () => this.focus());
    setTimeout(() => {
      if (win && !win.isDestroyed() && !win.isVisible()) this.focus();
    }, 1500).unref();

    // 关闭 → 最小化到托盘（Phase 1）；托盘退出 / 应用退出时才真正关闭
    win.on("close", (event) => {
      this.saveState();
      if (this.callbacks.canHideToTray()) {
        event.preventDefault();
        win.hide();
      }
    });
    // 位置 / 尺寸变化时记忆
    win.on("resize", () => this.saveState());
    win.on("move", () => this.saveState());
    win.on("maximize", () => this.saveState());
    win.on("unmaximize", () => this.saveState());
    win.on("closed", () => {
      this.mainWindow = null;
      this.callbacks.onClosed();
    });

    // 只允许加载 DSH 自身页面；外部链接交给系统浏览器
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (this.isAllowedNavigation(url)) {
        return { action: "allow" };
      }
      shell.openExternal(url);
      return { action: "deny" };
    });
    win.webContents.on("will-navigate", (event, url) => {
      if (!this.isAllowedNavigation(url)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    });
    // 渲染进程加载事件日志：加载页卡住时可在 logs/dsh-web.log 定位原因
    win.webContents.on("did-finish-load", () => this.dsh.logLine("did-finish-load"));
    win.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        this.dsh.logLine(`did-fail-load ${validatedURL}: ${errorCode} ${errorDescription}`);
      }
    );

    if (state.maximized) win.maximize();
    return win;
  }

  /** 加载 DSH Web UI（服务就绪后调用）。失败自动重试，最终失败给出明确报错。 */
  loadServer(): void {
    const origin = this.dsh.origin;
    const win = this.mainWindow;
    if (!origin || !win || win.isDestroyed()) return;
    this.dsh.logLine(`loading UI from ${origin}`);

    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    const attempt = () => {
      attempts += 1;
      this.dsh.logLine(`loadURL attempt ${attempts}/${MAX_ATTEMPTS}: ${origin}`);
      win
        .loadURL(origin)
        .then(() => this.dsh.logLine(`loadURL ok: ${origin}`))
        .catch((err) => {
          this.dsh.logLine(`loadURL failed: ${err.message}`);
          if (attempts < MAX_ATTEMPTS) {
            setTimeout(attempt, 1500).unref();
          } else {
            this.dsh.showBootError(
              "加载 DSH Web UI 失败",
              `${err.message}\n\n日志：${path.join(this.dsh.logDir, "dsh-web.log")}`
            );
          }
        });
    };
    attempt();
  }

  /** 聚焦 / 恢复主窗口（托盘双击、单实例二次启动、全局快捷键）。 */
  focus(): void {
    const win = this.mainWindow;
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    if (process.platform === "darwin") app.focus({ steal: true });
  }

  private resolveWindowIcon(): Electron.NativeImage | string | undefined {
    for (const candidate of [APP_ICONS.icns, APP_ICONS.icnsLegacy, APP_ICONS.png]) {
      if (!candidate || !fs.existsSync(candidate)) continue;
      const image = nativeImage.createFromPath(candidate);
      if (!image.isEmpty()) return image;
    }
    if (fs.existsSync(APP_ICONS.ico)) return APP_ICONS.ico;
    return undefined;
  }
}
