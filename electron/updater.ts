/**
 * updater.ts —— 应用自动更新（Phase 4）
 *
 * 基于 electron-updater（GitHub Releases 发布源，见 electron-builder.yml publish）：
 * - 启动后静默检查更新（仅打包版）
 * - 发现新版本弹窗提示 → 下载（带进度）→ 安装后重启
 * - 帮助菜单提供手动「检查应用更新…」
 */
import { EventEmitter } from "node:events";
import { app, dialog } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import { APP_TITLE, DshManager } from "./dshManager";
import type { UpdateStatus } from "./types";

export class UpdaterManager extends EventEmitter {
  private status: UpdateStatus = { state: "idle" };
  private quietCheck = false;

  constructor(private dsh: DshManager) {
    super();
  }

  get current(): UpdateStatus {
    return { ...this.status };
  }

  /** 初始化：只在打包版生效；dev 模式下所有操作都会提示。 */
  init(): void {
    if (!app.isPackaged) return;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = {
      info: (msg) => this.dsh.logLine(`updater: ${String(msg)}`),
      warn: (msg) => this.dsh.logLine(`updater warn: ${String(msg)}`),
      error: (msg) => this.dsh.logLine(`updater error: ${String(msg)}`),
      debug: (msg) => this.dsh.logLine(`updater debug: ${String(msg)}`),
    };

    autoUpdater.on("checking-for-update", () => {
      this.setStatus({ state: "checking" });
    });
    autoUpdater.on("update-available", (info: UpdateInfo) => {
      this.dsh.logLine(`update available: ${info.version}`);
      this.setStatus({ state: "available", version: info.version });
      this.promptAvailable(info.version);
    });
    autoUpdater.on("update-not-available", (info: UpdateInfo) => {
      this.dsh.logLine(`update not available (current ${info.version})`);
      this.setStatus({ state: "not-available" });
      if (!this.quietCheck) {
        dialog.showMessageBox({
          type: "info",
          title: APP_TITLE,
          message: "应用已是最新版本",
          detail: `当前版本：${app.getVersion()}`,
        });
      }
    });
    autoUpdater.on("download-progress", (progress) => {
      const percent = Math.round(progress.percent);
      this.setStatus({ state: "downloading", version: this.status.version, percent });
    });
    autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
      this.dsh.logLine(`update downloaded: ${info.version}`);
      this.setStatus({ state: "downloaded", version: info.version, percent: 100 });
      this.promptInstall(info.version);
    });
    autoUpdater.on("error", (err) => {
      this.dsh.logLine(`updater error: ${err.message}`);
      this.setStatus({ state: "error", error: err.message });
      if (!this.quietCheck) {
        const detail = this.friendlyError(err);
        dialog.showMessageBox({
          type: "error",
          title: APP_TITLE,
          message: "检查更新失败",
          detail: `${detail}\n\n可稍后从「帮助 → 检查应用更新…」重试。`,
        });
      }
    });

    // 启动后延迟静默检查（不打扰首次使用）
    setTimeout(() => {
      if (app.isPackaged) {
        this.quietCheck = true;
        void this.check();
      }
    }, 15_000).unref();
  }

  private setStatus(status: UpdateStatus): void {
    this.status = status;
    this.emit("status", { ...status });
  }

  /**
   * 把 electron-updater 的原始报错转成可操作的提示。
   * GitHub 对「私有仓库匿名访问」和「不存在的仓库」都返回 404 ——
   * 这里识别典型场景（404 / 找不到更新元数据）并给出指引。
   */
  private friendlyError(err: Error): string {
    const raw = err.message || String(err);
    if (/404|releases\.atom|Not Found|not found/i.test(raw) && raw.includes("github.com")) {
      return (
        "无法访问 GitHub 发布源（404）。\n\n" +
        "可能原因：\n" +
        "1. 发布仓库不存在、被删除或为私有（匿名访问返回 404 是 GitHub 的隐私保护）；\n" +
        "2. 网络无法访问 GitHub（可稍后重试）。\n\n" +
        "请确认仓库「smollbird/dsh_destop」存在且为公开，或联系开发者配置正确的发布源。\n\n" +
        `原始错误：${raw}`
      );
    }
    if (/latest\.yml|latest-mac\.yml|Cannot find|no such file/i.test(raw)) {
      return (
        "发布源可用，但仓库中还没有可用的更新版本。\n\n" +
        "请先在 GitHub Releases 发布一个包含更新元数据（latest.yml / latest-mac.yml）" +
        "的版本，之后即可正常检查更新。\n\n" +
        `原始错误：${raw}`
      );
    }
    return raw;
  }

  private promptAvailable(version: string): void {
    if (this.quietCheck) return; // 启动时静默检查：仅更新状态栏/日志，不弹窗
    void dialog
      .showMessageBox({
        type: "info",
        title: APP_TITLE,
        message: `发现新版本 ${version}`,
        detail: `当前版本：${app.getVersion()}。是否现在下载更新？`,
        buttons: ["下载更新", "稍后"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) void this.download();
      });
  }

  private promptInstall(version: string): void {
    void dialog
      .showMessageBox({
        type: "info",
        title: APP_TITLE,
        message: `新版本 ${version} 已下载完成`,
        detail: "重启应用后即可完成安装。",
        buttons: ["立即重启", "稍后"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) this.install();
      });
  }

  /** 手动检查更新（帮助菜单）。 */
  async check(): Promise<UpdateStatus> {
    if (!app.isPackaged) {
      dialog.showMessageBox({
        type: "info",
        title: APP_TITLE,
        message: "开发模式不支持自动更新",
        detail: "请从 git 拉取最新代码后重新 `npm install` 并打包分发。",
      });
      this.setStatus({ state: "error", error: "dev mode" });
      return this.current;
    }
    this.quietCheck = false;
    this.setStatus({ state: "checking" });
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus({ state: "error", error: message });
    }
    return this.current;
  }

  /** 开始下载（需先 available）。 */
  async download(): Promise<void> {
    if (!app.isPackaged) return;
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      this.setStatus({ state: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  /** 安装并重启。 */
  install(): void {
    if (!app.isPackaged) return;
    autoUpdater.quitAndInstall();
  }
}
