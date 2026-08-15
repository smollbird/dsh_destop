/**
 * dshManager.ts —— DSH 服务生命周期管理
 *
 * 负责：
 * - 解析/升级 dsh 内核（打包自带 → 用户数据目录内应用内升级）
 * - spawn `dsh web` 子进程、等待就绪、端口复用/回退
 * - 退出时整棵进程树回收（POSIX 进程组 / Windows taskkill）
 * - 运行 npm / dsh 命令（供内核升级、插件管理复用）
 * - 日志写入 logs/dsh-web.log（>5MB 自动轮转）
 */
import { app, dialog } from "electron";
import { ChildProcess, execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import http from "node:http";
import type { DshServerInfo } from "./types";

export const APP_NAME = "DeepSeek Harness";
export const APP_TITLE = "DeepSeek Harness 桌面版";
export const APP_USER_MODEL_ID = "com.deepseek.dsh-desktop";
export const DEFAULT_PORT = 3400;

const ROOT = path.resolve(__dirname, "..");
// 打包安装版（Program Files 等目录不可写）把工作区与日志放到用户数据目录；
// 开发模式（本项目目录）保持原样
export const USER_DATA = app.getPath("userData");
export const WORKSPACE = app.isPackaged
  ? path.join(USER_DATA, "workspace")
  : ROOT;
export const LOG_DIR = app.isPackaged
  ? path.join(USER_DATA, "logs")
  : path.join(ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "dsh-web.log");
const MAX_LOG_BYTES = 5 * 1024 * 1024;

const ICON_ICO = path.join(ROOT, "assets", "dsh-desktop.ico");
const ICON_ICNS = path.join(ROOT, "assets", "dsh-desktop.icns");
const ICON_ICNS_LEGACY = path.join(ROOT, "assets", "DeepSeek Harness.icns");
const ICON_PNG = path.join(ROOT, "assets", "icons", "icon-512.png");

const PATCH_FILE = path.join(ROOT, "config", "desktop.patch.yml");
const BOOT_TIMEOUT_MS = 120_000;
// 应用内升级的内核放在用户数据目录（可写、不随应用更新丢失）：
// USER_DATA/kernel/active.json 记录当前版本，USER_DATA/kernel/<version>/ 是
// 用随包分发的 npm 安装出来的完整内核（node_modules/@deepseek-ai/dsh/...）。
const KERNEL_DIR = path.join(USER_DATA, "kernel");
const KERNEL_STATE = path.join(KERNEL_DIR, "active.json");

/** 子进程异常退出时通知主进程（弹窗并退出）。 */
export interface DshManagerCallbacks {
  onUnexpectedExit: (code: number | null) => void;
  /** 服务重启完成（插件重启 / 内核升级）后回调，用于刷新主窗口。 */
  onRestarted?: () => void;
}

/** 命令执行结果。 */
export interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** 比较版本号（含 rc 预发布：0.1.0-rc.6 < 0.1.0-rc.7 < 0.1.0）。 */
export function compareVersions(a: string, b: string): number {
  const split = (v: string) => String(v).split("-");
  const mainA = split(a)[0].split(".").map((n) => parseInt(n, 10) || 0);
  const mainB = split(b)[0].split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(mainA.length, mainB.length);
  for (let i = 0; i < len; i++) {
    const x = mainA[i] ?? 0;
    const y = mainB[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  const preA = split(a)[1];
  const preB = split(b)[1];
  if (preA === preB) return 0;
  if (preA === undefined) return 1; // 正式版 > 预发布
  if (preB === undefined) return -1;
  const numA = parseInt(preA.replace(/^[a-z]+/i, ""), 10) || 0;
  const numB = parseInt(preB.replace(/^[a-z]+/i, ""), 10) || 0;
  return numA === numB ? (preA < preB ? -1 : 1) : numA > numB ? 1 : -1;
}

export class DshManager {
  private process: ChildProcess | null = null;
  private serverOrigin: string | null = null;
  private quitting = false;
  private kernelUpgradeBusy = false;

  constructor(private callbacks: DshManagerCallbacks) {}

  /** 当前服务地址（http://127.0.0.1:port，无尾斜杠），未就绪为 null。 */
  get origin(): string | null {
    return this.serverOrigin;
  }

  /** 当前 dsh 子进程 pid。 */
  get pid(): number | null {
    return this.process?.pid ?? null;
  }

  get workspace(): string {
    return WORKSPACE;
  }

  get logDir(): string {
    return LOG_DIR;
  }

  get upgradeBusy(): boolean {
    return this.kernelUpgradeBusy;
  }

  /* ---------------------------------------------------------------- */
  /* 日志                                                              */
  /* ---------------------------------------------------------------- */

  /** 写一行日志；超过 5MB 自动轮转（dsh-web.log → dsh-web.old.log）。 */
  logLine(line: string): void {
    const stamp = new Date().toISOString();
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      try {
        const size = fs.statSync(LOG_FILE).size;
        if (size > MAX_LOG_BYTES) {
          fs.renameSync(LOG_FILE, path.join(LOG_DIR, "dsh-web.old.log"));
        }
      } catch {
        /* 首次写入 / 轮转失败不阻塞 */
      }
      fs.appendFileSync(LOG_FILE, `[${stamp}] ${line}\n`);
    } catch {
      /* 日志失败不阻塞运行 */
    }
  }

  /* ---------------------------------------------------------------- */
  /* 内核（dsh）解析与升级                                              */
  /* ---------------------------------------------------------------- */

  /** 打包自带的 CLI 版本（基线内核）。 */
  bundledKernelVersion(): string | null {
    try {
      return require(path.join(ROOT, "node_modules", "@deepseek-ai", "dsh", "package.json"))
        .version as string;
    } catch {
      return null;
    }
  }

  /** 应用内升级过的内核版本（active.json），无则 null。 */
  installedKernelVersion(): string | null {
    try {
      const state = JSON.parse(fs.readFileSync(KERNEL_STATE, "utf8")) as {
        version?: unknown;
      };
      return typeof state.version === "string" ? state.version : null;
    } catch {
      return null;
    }
  }

  /**
   * 选出实际使用的内核目录（node_modules 的父目录）：
   * 应用内升级过的版本不低于打包自带版本时用它，否则用打包自带（基线）。
   * 升级目录损坏时自动回退并清除状态。
   */
  resolveKernelDir(): string | null {
    const installed = this.installedKernelVersion();
    if (!installed) return null;
    const dir = path.join(KERNEL_DIR, installed);
    if (fs.existsSync(path.join(dir, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"))) {
      const bundled = this.bundledKernelVersion();
      if (!bundled || compareVersions(installed, bundled) >= 0) return dir;
      return null; // 打包自带更新（应用被重新安装/覆盖）→ 用基线
    }
    this.logLine(`kernel ${installed} broken, falling back to bundled`);
    try {
      fs.rmSync(KERNEL_STATE, { force: true });
    } catch {
      /* noop */
    }
    return null;
  }

  /** 当前实际运行的内核版本。 */
  activeKernelVersion(): string | null {
    const dir = this.resolveKernelDir();
    if (dir) {
      try {
        return require(path.join(dir, "node_modules", "@deepseek-ai", "dsh", "package.json"))
          .version as string;
      } catch {
        /* fallthrough */
      }
    }
    return this.bundledKernelVersion();
  }

  /** 保留最新两个升级内核，避免磁盘无限增长。 */
  pruneKernels(): void {
    try {
      const dirs = fs
        .readdirSync(KERNEL_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => compareVersions(b, a));
      for (const name of dirs.slice(2)) {
        fs.rmSync(path.join(KERNEL_DIR, name), { recursive: true, force: true });
        this.logLine(`kernel pruned: ${name}`);
      }
    } catch {
      /* noop */
    }
  }

  /** 用户 npm 配置里的 registry（镜像），便于国内网络。 */
  userRegistry(): string | null {
    if (process.env.NPM_CONFIG_REGISTRY) return process.env.NPM_CONFIG_REGISTRY;
    const npmrcPath =
      process.platform === "win32"
        ? path.join(process.env.USERPROFILE || "", ".npmrc")
        : path.join(os.homedir(), ".npmrc");
    try {
      const line = fs
        .readFileSync(npmrcPath, "utf8")
        .split(/\r?\n/)
        .find((l) => /^\s*registry\s*=/.test(l));
      return line ? line.split("=").slice(1).join("=").trim() : null;
    } catch {
      return null;
    }
  }

  /** 用随包分发的 node + npm 执行 npm 命令（目标机无需安装 Node/npm）。 */
  async runNpm(args: string[], timeoutMs = 10 * 60_000): Promise<CommandResult> {
    const nodeExe = this.resolveNodeExe();
    const npmCli = path.join(ROOT, "node_modules", "npm", "bin", "npm-cli.js");
    const registry = this.userRegistry();
    const fullArgs = [npmCli, ...(registry ? [`--registry=${registry}`] : []), ...args];
    return this.spawnCollect(nodeExe, fullArgs, timeoutMs);
  }

  /** 用解析出的 node + dsh bin 执行 dsh 命令（插件管理等）。 */
  async runDsh(args: string[], timeoutMs = 10 * 60_000): Promise<CommandResult> {
    const nodeExe = this.resolveNodeExe();
    const dshBin = this.resolveDshBin();
    return this.spawnCollect(nodeExe, [dshBin, ...args], timeoutMs);
  }

  /** 执行任意 node 命令并收集输出（不抛错，结果统一返回）。 */
  private spawnCollect(
    nodeExe: string,
    args: string[],
    timeoutMs: number,
    cwd = WORKSPACE
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      this.logLine(`exec: ${nodeExe} ${args.join(" ")} (cwd=${cwd})`);
      const child = spawn(nodeExe, args, {
        cwd,
        env: process.env,
        windowsHide: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => {
        stdout += d.toString("utf8");
        this.logLine(d.toString("utf8").trimEnd());
      });
      child.stderr.on("data", (d) => {
        stderr += d.toString("utf8");
        this.logLine(d.toString("utf8").trimEnd());
      });
      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {
          /* noop */
        }
      }, timeoutMs);
      child.on("exit", (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({ code: -1, stdout, stderr: String(err) });
      });
    });
  }

  /**
   * 帮助菜单「检查内核更新」：对比 npm 上的最新 @deepseek-ai/dsh，
   * 用随包 npm 把新内核完整安装到 USER_DATA/kernel/<version>/，
   * 校验成功后写 active.json、清理旧内核、重启 dsh 服务并刷新窗口。
   * 仅打包安装版可用；开发模式提示手动 npm install。
   */
  async checkAndUpgradeKernel(): Promise<void> {
    if (this.kernelUpgradeBusy) return;
    if (!app.isPackaged) {
      dialog.showMessageBox({
        type: "info",
        title: APP_TITLE,
        message: "开发模式不支持应用内升级内核",
        detail:
          "请在项目目录手动升级：修改 package.json 中 @deepseek-ai/dsh 及各 @deepseek-ai/dsh-* 版本号后执行 `npm install`。",
      });
      return;
    }
    const npmCli = path.join(ROOT, "node_modules", "npm", "bin", "npm-cli.js");
    if (!fs.existsSync(npmCli)) {
      dialog.showMessageBox({
        type: "error",
        title: APP_TITLE,
        message: "当前安装包不含升级组件",
        detail: "请重新安装最新版本的安装包后再试。",
      });
      return;
    }
    const current = this.activeKernelVersion() ?? "未知";
    const check = await this.runNpm(["view", "@deepseek-ai/dsh", "version"], 60_000);
    const latest = String(check.stdout || "").trim();
    if (check.code !== 0 || !latest) {
      const tail =
        String(check.stderr || "").trim().split("\n").slice(-2).join("\n") || "网络不可达";
      dialog.showMessageBox({
        type: "error",
        title: APP_TITLE,
        message: "检查内核更新失败",
        detail: `无法连接 npm 仓库（当前内核：${current}）。\n\n${tail}\n\n日志：${LOG_FILE}`,
      });
      return;
    }
    if (compareVersions(latest, current) <= 0) {
      dialog.showMessageBox({
        type: "info",
        title: APP_TITLE,
        message: "内核已是最新版本",
        detail: `当前内核：${current}`,
      });
      return;
    }
    const { response } = await dialog.showMessageBox({
      type: "question",
      title: APP_TITLE,
      message: `发现新内核 ${latest}`,
      detail:
        `当前内核：${current}\n\n` +
        "升级将下载并安装新内核（网络依赖，约需几分钟），完成后服务自动重启，会话数据保留。",
      buttons: ["立即升级", "取消"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response !== 0) return;

    this.kernelUpgradeBusy = true;
    try {
      const target = path.join(KERNEL_DIR, latest);
      const install = await this.runNpm([
        "install",
        "--prefix",
        target,
        "--no-audit",
        "--no-fund",
        "--loglevel=error",
        `@deepseek-ai/dsh@${latest}`,
      ]);
      const bin = path.join(target, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
      if (install.code !== 0 || !fs.existsSync(bin)) {
        const tail =
          String(install.stderr || "").trim().split("\n").slice(-3).join("\n") || "未知错误";
        dialog.showMessageBox({
          type: "error",
          title: APP_TITLE,
          message: "内核升级失败",
          detail: `安装 ${latest} 失败，已回滚，继续使用当前内核 ${current}。\n\n${tail}\n\n日志：${LOG_FILE}`,
        });
        try {
          fs.rmSync(target, { recursive: true, force: true });
        } catch {
          /* noop */
        }
        return;
      }
      try {
        fs.mkdirSync(KERNEL_DIR, { recursive: true });
        fs.writeFileSync(
          KERNEL_STATE,
          JSON.stringify({ version: latest, installedAt: new Date().toISOString() }, null, 2) +
            "\n"
        );
      } catch (err) {
        dialog.showMessageBox({
          type: "error",
          title: APP_TITLE,
          message: "内核升级失败",
          detail: `写入内核状态失败：${err instanceof Error ? err.message : String(err)}（继续使用 ${current}）`,
        });
        return;
      }
      this.pruneKernels();
      dialog.showMessageBox({
        type: "info",
        title: APP_TITLE,
        message: "内核升级完成",
        detail: `已升级到 ${latest}，正在重启服务…`,
      });
      await this.restart();
    } finally {
      this.kernelUpgradeBusy = false;
    }
  }

  /** 用当前解析出的内核重启 dsh web 并刷新窗口（升级完成后调用）。 */
  async restart(): Promise<boolean> {
    this.logLine("restart: stopping dsh service");
    this.shutdown();
    this.process = null;
    // 复用模式下（服务非本应用 spawn）shutdown() 杀不掉端口占用进程：
    // 只有端口上确认是 DSH 实例时才终止它，否则 ensureServer() 会再次复用旧服务，
    // 新安装/启用的插件不会生效（“假重启”）。非 DSH 占用交给 ensureServer 的
    // --port 0 兜底，避免误杀无关进程。
    if (await this.probeIsDsh(`http://127.0.0.1:${DEFAULT_PORT}`)) {
      await this.killPortOwner(DEFAULT_PORT);
      // 等端口释放（最多 15s）
      for (let i = 0; i < 50; i++) {
        const res = await this.httpGet(`http://127.0.0.1:${DEFAULT_PORT}/`);
        if (!res) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    try {
      const result = await this.ensureServer();
      if (!result) return false;
      const url = result.url.replace(/\/$/, "");
      this.serverOrigin = url;
      await this.waitForServer(url, 30_000, this.process);
      this.logLine(`kernel reload: serving from ${url}`);
      this.callbacks.onRestarted?.();
      return true;
    } catch (err) {
      this.logLine(`restart failed: ${err instanceof Error ? err.message : String(err)}`);
      dialog.showMessageBox({
        type: "error",
        title: APP_TITLE,
        message: "重启服务失败",
        detail: `${err instanceof Error ? err.message : String(err)}\n\n日志：${LOG_FILE}`,
      });
      return false;
    }
  }

  /**
   * 终止占用指定端口的进程（POSIX: lsof + kill；Windows: netstat + taskkill）。
   * 用于 restart() 清理复用/残留的旧 dsh 进程。
   */
  private async killPortOwner(port: number): Promise<void> {
    const isWin = process.platform === "win32";
    const pids: number[] = await new Promise((resolve) => {
      if (isWin) {
        execFile("netstat", ["-ano"], (err, stdout) => {
          if (err) return resolve([]);
          const found: number[] = [];
          for (const line of String(stdout).split(/\r?\n/)) {
            // 形如:  TCP    0.0.0.0:3400   0.0.0.0:0   LISTENING   93742
            const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+:\d+\s+LISTENING\s+(\d+)\s*$/i);
            if (m && Number(m[1]) === port) {
              const pid = Number(m[2]);
              if (Number.isInteger(pid) && pid > 0) found.push(pid);
            }
          }
          resolve(found);
        });
      } else {
        // macOS / Linux：lsof -ti tcp:<port> 输出占端口的 pid 列表
        execFile("lsof", ["-ti", `tcp:${port}`], (err, stdout) => {
          if (err) return resolve([]);
          resolve(
            String(stdout)
              .split(/\s+/)
              .map((s) => Number(s.trim()))
              .filter((n) => Number.isInteger(n) && n > 0)
          );
        });
      }
    });
    if (pids.length === 0) {
      this.logLine(`killPortOwner(${port}): no owner found`);
      return;
    }
    for (const pid of pids) {
      this.logLine(`killPortOwner(${port}): killing pid ${pid}`);
      try {
        if (isWin) {
          execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => {
            /* noop */
          });
        } else {
          process.kill(pid, "SIGTERM");
          // 3 秒后仍未退出则强杀
          setTimeout(() => {
            try {
              process.kill(pid, "SIGKILL");
            } catch {
              /* 已退出 */
            }
          }, 3000).unref();
        }
      } catch {
        /* 已退出 */
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* dsh CLI 解析                                                      */
  /* ---------------------------------------------------------------- */

  /** 解析用于 boot web profile 的 dsh bin.js（按优先级：升级内核 → 项目本地 → npx 缓存）。 */
  resolveDshBin(): string {
    const kernelDir = this.resolveKernelDir();
    const candidates = [
      kernelDir ? path.join(kernelDir, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js") : null,
      path.join(ROOT, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"),
      path.join(
        process.env.LOCALAPPDATA || "",
        "npm-cache",
        "_npx",
        "1e7f6d9597241db0",
        "node_modules",
        "@deepseek-ai",
        "dsh",
        "lib",
        "bin.js"
      ),
    ];
    for (const p of candidates) {
      if (p && fs.existsSync(p)) return p;
    }
    throw new Error(
      app.isPackaged
        ? "安装包内未找到 @deepseek-ai/dsh。请重新打包（确保 electron-builder 包含 node_modules），或联系开发者。"
        : "未找到 @deepseek-ai/dsh：请先在项目目录运行 `npm install`（见 README.md），" +
            "或确认 $DSH_HOME 下已初始化过 web profile。"
    );
  }

  /** 解析 Node.js 可执行文件（Electron 主进程内 process.execPath 是 electron 自身）。
   *  打包版优先使用随应用分发的 vendor/node（electron-builder extraResources）。 */
  resolveNodeExe(): string {
    if (app.isPackaged) {
      const bundled = path.join(
        process.resourcesPath,
        "vendor",
        "node",
        process.platform === "win32" ? "node.exe" : path.join("bin", "node")
      );
      if (fs.existsSync(bundled)) return bundled;
      throw new Error(
        "安装包内未找到随包分发的 Node（vendor/node）。请重新执行 npm run build:mac 打包。"
      );
    }
    if (process.env.npm_node_execpath && fs.existsSync(process.env.npm_node_execpath)) {
      return process.env.npm_node_execpath;
    }
    const candidates =
      process.platform === "win32"
        ? ["C:\\Program Files\\nodejs\\node.exe", "C:\\Program Files (x86)\\nodejs\\node.exe"]
        : ["/opt/homebrew/bin/node", "/usr/local/bin/node"];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return "node"; // 依赖 PATH
  }

  /* ---------------------------------------------------------------- */
  /* HTTP 探测                                                         */
  /* ---------------------------------------------------------------- */

  private httpGet(url: string, timeoutMs = 3000): Promise<{ status: number; body: string } | null> {
    return new Promise((resolve) => {
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
        });
      });
      req.on("timeout", () => req.destroy());
      req.on("error", () => resolve(null));
    });
  }

  /** POST JSON 到服务地址并解析响应（不抛错，失败返回 null）。 */
  private httpPost(
    url: string,
    body: unknown,
    timeoutMs = 5000
  ): Promise<{ status: number; body: string } | null> {
    return new Promise((resolve) => {
      const req = http.request(
        url,
        {
          method: "POST",
          timeout: timeoutMs,
          headers: { "content-type": "application/json" },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c as Buffer));
          res.on("end", () => {
            resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
          });
        }
      );
      req.on("timeout", () => req.destroy());
      req.on("error", () => resolve(null));
      req.end(JSON.stringify(body));
    });
  }

  /**
   * 调用 DSH Web API（workspace.list / session.list 等，与 Web UI 相同的
   * client-request 信封协议）。成功返回 result.value，失败（未就绪 / 非 2xx /
   * 信封校验失败）返回 null，不抛错。
   */
  private async apiCall<T>(
    method: string,
    payload: unknown,
    timeoutMs = 5000
  ): Promise<T | null> {
    const origin = this.serverOrigin;
    if (!origin) return null;
    const rpcId = randomUUID();
    const res = await this.httpPost(
      `${origin}/api/${method}`,
      { type: "client-request", rpcId, method, payload },
      timeoutMs
    );
    if (!res) return null;
    try {
      const envelope = JSON.parse(res.body) as {
        rpcId?: unknown;
        result?: { ok?: unknown; value?: unknown };
      };
      if (envelope.rpcId !== rpcId || envelope.result?.ok !== true) return null;
      return (envelope.result.value ?? null) as T | null;
    } catch {
      return null;
    }
  }

  /**
   * 当前工作区目录（用户在 Web UI 里正在使用的那一个），按优先级：
   * 1) UI 当前打开的对话（主进程从页面 localStorage 读到 `dsh.sessions.current`
   *    的 sessionId）所在的 cwd —— 与用户正看着的对话严格一致；
   * 2) 回退：最近活跃的非空白、非 subagent 会话所在的 cwd
   *    （空白/子代理会话是后台噪音，不参与“用户当前在哪”的判定）；
   * 3) 再回退：工作区注册表里最近活跃的工作区（判定与 Web UI 的 recentWorkspace
   *    一致：会话 updatedAt 最新者胜出，无会话时取 createdAt，并列保持注册表顺序）。
   * 目录已不存在的会被跳过；全部落空 / 服务未就绪时返回 null（调用方回退到 WORKSPACE）。
   *
   * @param preferredSessionId - Web UI 当前打开的会话 id（可为 null）。
   */
  async currentWorkspacePath(preferredSessionId: string | null = null): Promise<string | null> {
    const sessions =
      (await this.apiCall<{
        items?: Array<{
          sessionId: string;
          updatedAt: number;
          cwd?: string;
          blank?: boolean;
          origin?: string;
        }>;
      }>("session.list", {}))?.items ?? [];
    const byId = new Map(sessions.map((s) => [s.sessionId, s]));
    // 1) UI 当前打开的对话
    if (preferredSessionId) {
      const s = byId.get(preferredSessionId);
      if (s?.cwd && this.isDirectory(s.cwd)) return s.cwd;
    }
    // 2) 最近活跃的用户会话（排除空白 / 子代理噪音）
    const ranked = [...sessions]
      .filter((s) => !s.blank && s.origin !== "subagent")
      .sort((a, b) => b.updatedAt - a.updatedAt);
    for (const s of ranked) {
      if (s.cwd && this.isDirectory(s.cwd)) return s.cwd;
    }
    // 3) 工作区注册表（recentWorkspace 判定）
    const list = await this.apiCall<{
      items?: Array<{
        workspaceId: string;
        path: string;
        createdAt: string;
        sessionIds: string[];
      }>;
    }>("workspace.list", {});
    const items = list?.items ?? [];
    const rankedWorkspaces = items
      .map((w, order) => {
        let latest = Number.NEGATIVE_INFINITY;
        for (const sid of w.sessionIds) {
          const s = byId.get(sid);
          if (s) latest = Math.max(latest, s.updatedAt);
        }
        if (latest === Number.NEGATIVE_INFINITY) {
          const created = Date.parse(w.createdAt);
          latest = Number.isNaN(created) ? Number.NEGATIVE_INFINITY : created;
        }
        return { w, latest, order };
      })
      .sort((a, b) => b.latest - a.latest || a.order - b.order);
    for (const { w } of rankedWorkspaces) {
      if (this.isDirectory(w.path)) return w.path;
    }
    return null;
  }

  /** 目录是否真实存在。 */
  private isDirectory(p: string): boolean {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  }

  /** 探测某地址是否已经是 DSH 的 Web UI。 */
  private async probeIsDsh(url: string): Promise<boolean> {
    const res = await this.httpGet(`${url}/manifest.webmanifest`);
    if (res && res.status === 200 && /DeepSeek Harness/.test(res.body)) return true;
    const home = await this.httpGet(`${url}/`);
    if (home && home.status === 200 && /DeepSeek Harness/.test(home.body)) return true;
    return false;
  }

  private waitForServer(url: string, timeoutMs: number, child: ChildProcess | null): Promise<void> {    return new Promise((resolve, reject) => {
      const started = Date.now();
      let settled = false;
      const timer = setInterval(() => {
        if (settled) return;
        this.httpGet(`${url}/`)
          .then((res) => {
            if (res && res.status === 200) {
              settled = true;
              clearInterval(timer);
              resolve();
            } else if (Date.now() - started > timeoutMs) {
              settled = true;
              clearInterval(timer);
              reject(new Error(`等待 Web 服务就绪超时（${timeoutMs}ms）`));
            }
          })
          .catch(() => {
            /* 继续轮询 */
          });
      }, 500);
      if (child) {
        child.once("exit", (code) => {
          if (!settled) {
            settled = true;
            clearInterval(timer);
            reject(new Error(`dsh web 进程提前退出，exit code=${code}`));
          }
        });
        child.once("error", (err) => {
          if (!settled) {
            settled = true;
            clearInterval(timer);
            reject(err);
          }
        });
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* dsh web 子进程管理                                                 */
  /* ---------------------------------------------------------------- */

  private spawnDsh(port: number): ChildProcess {
    const dshBin = this.resolveDshBin();
    const nodeExe = this.resolveNodeExe();
    // 注意：dsh 启动器自己的旗标（--patch）必须放在 app 旗标（--port）之前——
    // 解析器遇到第一个不认识 token 就把后续全部交给 app。
    const args = [dshBin, "web"];
    if (fs.existsSync(PATCH_FILE)) args.push("--patch", PATCH_FILE);
    args.push("--port", String(port));
    this.logLine(`spawn: ${nodeExe} ${args.join(" ")} (cwd=${WORKSPACE})`);
    const isWin = process.platform === "win32";
    try {
      fs.mkdirSync(WORKSPACE, { recursive: true });
    } catch {
      /* noop */
    }
    const child = spawn(nodeExe, args, {
      cwd: WORKSPACE,
      env: process.env,
      windowsHide: isWin,
      detached: !isWin, // POSIX: 独立进程组，便于退出时整组回收
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (d) => this.logLine(d.toString("utf8").trimEnd()));
    child.stderr.on("data", (d) => this.logLine(d.toString("utf8").trimEnd()));
    child.on("exit", (code) => {
      this.logLine(`dsh web exited: ${code}`);
      if (!this.quitting && code !== 0) {
        this.callbacks.onUnexpectedExit(code);
      }
    });
    return child;
  }

  /** 确保有一个可用的 DSH Web 服务，返回其 URL。 */
  async ensureServer(): Promise<DshServerInfo | null> {
    const defaultUrl = `http://127.0.0.1:${DEFAULT_PORT}`;
    // 1) 默认端口已有 DSH 实例（例如桌面版已运行 / 手动 dsh web）→ 直接复用
    if (await this.probeIsDsh(defaultUrl)) {
      this.logLine(`reuse existing DSH server at ${defaultUrl}`);
      this.serverOrigin = defaultUrl;
      return { url: defaultUrl, reused: true };
    }
    // 2) 启动 dsh web
    let child: ChildProcess;
    try {
      child = this.spawnDsh(DEFAULT_PORT);
    } catch (err) {
      this.showBootError(err instanceof Error ? err.message : String(err));
      return null;
    }
    try {
      await this.waitForServer(defaultUrl, BOOT_TIMEOUT_MS, child);
      this.process = child;
      this.serverOrigin = defaultUrl;
      return { url: defaultUrl, reused: false };
    } catch (err) {
      this.logLine(`primary boot failed: ${err instanceof Error ? err.message : String(err)}`);
      // 3) 兜底：默认端口被非 DSH 服务占用 → 交给系统分配端口（--port 0）
      try {
        child.kill();
      } catch {
        /* noop */
      }
      child = this.spawnDsh(0);
      const url = await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), BOOT_TIMEOUT_MS);
        child.stdout?.on("data", (d) => {
          const m = String(d).match(/dsh web:\s*(https?:\/\/\S+)/);
          if (m) {
            clearTimeout(timer);
            resolve(m[1].trim());
          }
        });
        child.once("exit", () => {
          clearTimeout(timer);
          resolve(null);
        });
      });
      if (!url) {
        this.showBootError(
          "无法启动 DeepSeek Harness 服务。",
          `默认端口 ${DEFAULT_PORT} 被占用且无法自动分配可用端口。日志见 ${LOG_FILE}`
        );
        return null;
      }
      this.process = child;
      this.serverOrigin = url;
      await this.waitForServer(url, 30_000, child);
      return { url, reused: false };
    }
  }

  /** 公开的“等待服务就绪”入口（供主进程启动流程使用）。 */
  async waitReady(url: string, timeoutMs = 30_000): Promise<void> {
    await this.waitForServer(url, timeoutMs, this.process);
  }

  /** 终止 dsh 子进程及其进程树（含复用/残留的旧服务）。 */
  shutdown(): void {
    // 本实例 spawn 的服务：终止整个进程组（spawn 时 detached 启动）
    if (this.process && !this.process.killed) {
      const pid = this.process.pid;
      if (pid !== undefined) {
        this.logLine(`shutting down dsh web (pid=${pid})`);
        try {
          if (process.platform === "win32") {
            this.process.kill();
            // Windows 上递归终止整个进程树，确保 pwsh/bash 子进程也被回收
            execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => {
              /* noop */
            });
          } else {
            // POSIX: 终止整个进程组（spawn 时 detached 启动）
            try {
              process.kill(-pid, "SIGTERM");
            } catch {
              this.process.kill("SIGTERM");
            }
            // 3 秒后仍未退出则强杀
            setTimeout(() => {
              try {
                process.kill(-pid, "SIGKILL");
              } catch {
                /* 已退出 */
              }
            }, 3000).unref();
          }
        } catch {
          /* noop */
        }
      }
    }
    // 复用/残留模式（服务非本实例 spawn，this.process 为空）：退出时不清理
    // 的话旧 dsh web 会一直占着默认端口，下次启动命中 “reuse existing” 而复用
    // 旧代码（插件 host 半不更新）。端口上确认是 DSH 实例才终止，避免误杀。
    if (!this.process || this.process.killed) {
      void (async () => {
        if (await this.probeIsDsh(`http://127.0.0.1:${DEFAULT_PORT}`)) {
          await this.killPortOwner(DEFAULT_PORT);
        }
      })();
    }
  }

  /** 标记应用正在退出（抑制“服务异常退出”弹窗）。 */
  setQuitting(): void {
    this.quitting = true;
  }

  /** 启动失败提示并退出。 */
  showBootError(message: string, detail?: string): void {
    this.logLine(`boot error: ${message}${detail ? `\n${detail}` : ""}`);
    dialog.showErrorBox(APP_TITLE, detail ? `${message}\n\n${detail}` : message);
    app.quit();
  }
}

/** 应用图标资产路径（供 windowManager / trayManager 复用）。 */
export const APP_ICONS = {
  ico: ICON_ICO,
  icns: ICON_ICNS,
  icnsLegacy: ICON_ICNS_LEGACY,
  png: ICON_PNG,
};
