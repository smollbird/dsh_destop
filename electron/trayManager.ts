/**
 * trayManager.ts —— 系统托盘（Phase 2）
 *
 * - 右键菜单：显示主界面 / 打开工作区 / 新建任务 / 退出
 * - 双击托盘图标恢复主窗口
 * - 托盘存在期间，关闭主窗口 = 隐藏到托盘（不退出）
 */
import { Menu, Tray, nativeImage } from "electron";
import fs from "node:fs";
import { APP_ICONS, APP_TITLE, DshManager } from "./dshManager";

/** 托盘回调（由主进程注入动作）。 */
export interface TrayManagerCallbacks {
  onShowMain: () => void;
  onOpenWorkspace: () => void;
  onNewTask: () => void;
  onQuit: () => void;
}

export class TrayManager {
  private tray: Tray | null = null;

  constructor(
    private dsh: DshManager,
    private callbacks: TrayManagerCallbacks
  ) {}

  get exists(): boolean {
    return this.tray !== null;
  }

  private resolveTrayIcon(): Electron.NativeImage | string {
    for (const candidate of [APP_ICONS.png, APP_ICONS.icns, APP_ICONS.ico]) {
      if (!candidate || !fs.existsSync(candidate)) continue;
      const image = nativeImage.createFromPath(candidate);
      if (!image.isEmpty()) {
        // macOS 托盘图标需要小尺寸模板图；非 mac 平台直接用原图
        if (process.platform === "darwin") {
          return image.resize({ width: 18, height: 18 });
        }
        return image;
      }
    }
    return nativeImage.createEmpty();
  }

  create(): void {
    if (this.tray) return;
    const tray = new Tray(this.resolveTrayIcon());
    tray.setToolTip(APP_TITLE);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "显示主界面", click: () => this.callbacks.onShowMain() },
        { type: "separator" },
        { label: "打开工作区", click: () => this.callbacks.onOpenWorkspace() },
        { label: "新建任务", click: () => this.callbacks.onNewTask() },
        { type: "separator" },
        { label: "退出", click: () => this.callbacks.onQuit() },
      ])
    );
    // 双击托盘图标恢复主窗口（Windows / Linux；macOS 单击通常已展开菜单）
    tray.on("double-click", () => this.callbacks.onShowMain());
    this.tray = tray;
    this.dsh.logLine("tray created");
  }

  destroy(): void {
    if (!this.tray) return;
    this.tray.destroy();
    this.tray = null;
  }
}
