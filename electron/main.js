"use strict";
/**
 * dsh-desktop — DeepSeek Harness 桌面版主进程
 *
 * 插件集成方式：以本地安装的 `@deepseek-ai/dsh` CLI 为启动器，boot `web` profile
 * （bundle 栈：@deepseek-ai/dsh-base + @deepseek-ai/dsh-web-app，即 Harness 的完整
 * 插件栈：agent / tools / hosts / client-ui / session / skills ...），
 * 然后在本机 Electron 窗口中原生呈现 Harness 的 Web UI。
 *
 * - 单实例：重复双击图标时聚焦已有窗口，而不是再起一个服务。
 * - 端口复用：默认端口已被 DSH 实例占用时直接连接（不重复启动）。
 * - 插件叠加层：config/desktop.patch.yml 存在时作为 --patch 叠加层传入，
 *   可在此声明桌面版专属的插件 / 配置。
 */
const { app, BrowserWindow, dialog, shell, Menu, nativeImage } = require("electron");
const { spawn, execFile } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");

const APP_NAME = "DeepSeek Harness";
const APP_TITLE = "DeepSeek Harness 桌面版";
const APP_USER_MODEL_ID = "com.deepseek.dsh-desktop";
const DEFAULT_PORT = 3141;
const ROOT = path.resolve(__dirname, "..");
// 打包安装版（Program Files 等目录不可写）把工作区与日志放到用户数据目录；
// 开发模式（本项目目录）保持原样
const USER_DATA = app.getPath("userData");
const WORKSPACE = app.isPackaged ? path.join(USER_DATA, "workspace") : ROOT;
const LOG_DIR = app.isPackaged ? path.join(USER_DATA, "logs") : path.join(ROOT, "logs");
const ICON_ICO = path.join(ROOT, "assets", "dsh-desktop.ico");
const ICON_ICNS = path.join(ROOT, "assets", "dsh-desktop.icns");
const ICON_ICNS_LEGACY = path.join(ROOT, "assets", "DeepSeek Harness.icns");
const ICON_PNG = path.join(ROOT, "assets", "icons", "icon-512.png");
const LOADING_HTML = path.join(ROOT, "assets", "loading.html");
const PATCH_FILE = path.join(ROOT, "config", "desktop.patch.yml");
const BOOT_TIMEOUT_MS = 120_000;

let mainWindow = null;
let dshProcess = null;
let serverOrigin = null;
let quitting = false;

/* ------------------------------------------------------------------ */
/* dsh CLI 解析                                                        */
/* ------------------------------------------------------------------ */

/** 解析用于 boot web profile 的 dsh bin.js（按优先级：项目本地 → $DSH_HOME → npx 缓存 → PATH）。 */
function resolveDshBin() {
  const candidates = [
    path.join(ROOT, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"),
    path.join(process.env.DSH_HOME || path.join(os.homedir(), ".dsh"), "profiles", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"),
    path.join(process.env.LOCALAPPDATA || "", "npm-cache", "_npx", "1e7f6d9597241db0", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"),
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
function resolveNodeExe() {
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

/* ------------------------------------------------------------------ */
/* HTTP 探测                                                           */
/* ------------------------------------------------------------------ */

function httpGet(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

/** 探测某地址是否已经是 DSH 的 Web UI。 */
async function probeIsDsh(url) {
  const res = await httpGet(`${url}/manifest.webmanifest`);
  if (res && res.status === 200 && /DeepSeek Harness/.test(res.body)) return true;
  const home = await httpGet(`${url}/`);
  if (home && home.status === 200 && /DeepSeek Harness/.test(home.body)) return true;
  return false;
}

function waitForServer(url, timeoutMs, child) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let settled = false;
    const timer = setInterval(async () => {
      if (settled) return;
      const res = await httpGet(`${url}/`);
      if (res && res.status === 200) {
        settled = true;
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        settled = true;
        clearInterval(timer);
        reject(new Error(`等待 Web 服务就绪超时（${timeoutMs}ms）`));
      }
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

/* ------------------------------------------------------------------ */
/* dsh web 子进程管理                                                  */
/* ------------------------------------------------------------------ */

function logLine(line) {
  const stamp = new Date().toISOString();
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, "dsh-web.log"), `[${stamp}] ${line}\n`);
  } catch { /* 日志失败不阻塞运行 */ }
}

function spawnDsh(port) {
  const dshBin = resolveDshBin();
  const nodeExe = resolveNodeExe();
  // 注意：dsh 启动器自己的旗标（--patch）必须放在 app 旗标（--port）之前——
  // 解析器遇到第一个不认识 token 就把后续全部交给 app。
  const args = [dshBin, "web"];
  if (fs.existsSync(PATCH_FILE)) args.push("--patch", PATCH_FILE);
  args.push("--port", String(port));
  logLine(`spawn: ${nodeExe} ${args.join(" ")} (cwd=${WORKSPACE})`);
  const isWin = process.platform === "win32";
  try {
    fs.mkdirSync(WORKSPACE, { recursive: true });
  } catch { /* noop */ }
  const child = spawn(nodeExe, args, {
    cwd: WORKSPACE,
    env: process.env,
    windowsHide: isWin,
    detached: !isWin, // POSIX: 独立进程组，便于退出时整组回收
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => logLine(d.toString("utf8").trimEnd()));
  child.stderr.on("data", (d) => logLine(d.toString("utf8").trimEnd()));
  child.on("exit", (code) => {
    logLine(`dsh web exited: ${code}`);
    if (!quitting && code !== 0) {
      dialog
        .showMessageBox({
          type: "error",
          title: APP_TITLE,
          message: "DeepSeek Harness 服务已退出",
          detail: `dsh web 进程异常退出（code=${code}）。日志见 ${path.join(LOG_DIR, "dsh-web.log")}`,
        })
        .then(() => app.quit());
    }
  });
  return child;
}

/** 确保有一个可用的 DSH Web 服务，返回其 URL。 */
async function ensureServer() {
  const defaultUrl = `http://127.0.0.1:${DEFAULT_PORT}`;
  // 1) 默认端口已有 DSH 实例（例如桌面版已运行 / 手动 dsh web）→ 直接复用
  if (await probeIsDsh(defaultUrl)) {
    logLine(`reuse existing DSH server at ${defaultUrl}`);
    return { url: defaultUrl, reused: true };
  }
  // 2) 启动 dsh web
  let child;
  try {
    child = spawnDsh(DEFAULT_PORT);
  } catch (err) {
    showBootError(err.message);
    return null;
  }
  try {
    await waitForServer(defaultUrl, BOOT_TIMEOUT_MS, child);
    dshProcess = child;
    return { url: defaultUrl, reused: false };
  } catch (err) {
    logLine(`primary boot failed: ${err.message}`);
    // 3) 兜底：默认端口被非 DSH 服务占用 → 交给系统分配端口（--port 0）
    try {
      child.kill();
    } catch { /* noop */ }
    child = spawnDsh(0);
    const url = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), BOOT_TIMEOUT_MS);
      child.stdout.on("data", (d) => {
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
      showBootError(
        "无法启动 DeepSeek Harness 服务。",
        `默认端口 ${DEFAULT_PORT} 被占用且无法自动分配可用端口。日志见 ${path.join(LOG_DIR, "dsh-web.log")}`
      );
      return null;
    }
    dshProcess = child;
    await waitForServer(url, 30_000, child);
    return { url, reused: false };
  }
}

function shutdownDsh() {
  if (!dshProcess || dshProcess.killed) return;
  const pid = dshProcess.pid;
  logLine(`shutting down dsh web (pid=${pid})`);
  try {
    if (process.platform === "win32") {
      dshProcess.kill();
      // Windows 上递归终止整个进程树，确保 pwsh/bash 子进程也被回收
      execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => {});
    } else {
      // POSIX: 终止整个进程组（spawn 时 detached 启动）
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        dshProcess.kill("SIGTERM");
      }
      // 3 秒后仍未退出则强杀
      setTimeout(() => {
        try {
          process.kill(-pid, "SIGKILL");
        } catch { /* 已退出 */ }
      }, 3000).unref();
    }
  } catch { /* noop */ }
}

/* ------------------------------------------------------------------ */
/* 窗口                                                                */
/* ------------------------------------------------------------------ */

function resolveAppIconImage() {
  for (const candidate of [ICON_ICNS, ICON_ICNS_LEGACY, ICON_PNG]) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) return image;
  }
  return null;
}

function applyDockIcon() {
  if (process.platform !== "darwin" || !app.dock) return;
  const image = resolveAppIconImage();
  if (!image) {
    logLine("dock icon skipped: no loadable icon asset found");
    return;
  }
  try {
    app.dock.setIcon(image);
  } catch (err) {
    logLine(`dock icon skipped: ${err.message}`);
  }
}

function resolveWindowIcon() {
  const image = resolveAppIconImage();
  if (image) return image;
  if (fs.existsSync(ICON_ICO)) return ICON_ICO;
  return undefined;
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (process.platform === "darwin") app.focus({ steal: true });
}

function showBootError(message, detail) {
  logLine(`boot error: ${message}${detail ? `\n${detail}` : ""}`);
  focusMainWindow();
  dialog.showErrorBox(APP_TITLE, detail ? `${message}\n\n${detail}` : message);
  app.quit();
}

function isAllowedNavigation(url) {
  if (url.startsWith("file://")) return true;
  if (serverOrigin && url.startsWith(serverOrigin)) return true;
  if (url.startsWith("http://localhost:") || url.startsWith("http://127.0.0.1:")) return true;
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: APP_TITLE,
    icon: resolveWindowIcon(),
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

  mainWindow.loadFile(LOADING_HTML).catch((err) => {
    showBootError("无法加载启动页", `${LOADING_HTML}\n${err.message}`);
  });
  mainWindow.once("ready-to-show", () => focusMainWindow());
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      focusMainWindow();
    }
  }, 1500).unref();

  // 只允许加载 DSH 自身页面；外部链接交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const editSubmenu = [
    { label: "撤销", role: "undo" },
    { label: "重做", role: "redo" },
    { type: "separator" },
    { label: "剪切", role: "cut" },
    { label: "复制", role: "copy" },
    { label: "粘贴", role: "paste" },
    { label: "粘贴并匹配样式", role: "pasteAndMatchStyle" },
    { label: "删除", role: "delete" },
    { type: "separator" },
    { label: "全选", role: "selectAll" },
  ];

  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { label: `关于 ${APP_TITLE}`, role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { label: "隐藏", role: "hide" },
              { label: "隐藏其他", role: "hideOthers" },
              { label: "全部显示", role: "unhide" },
              { type: "separator" },
              { label: "退出", accelerator: "CmdOrCtrl+Q", role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "文件",
      submenu: [
        { label: "重新加载", accelerator: "CmdOrCtrl+R", role: "reload" },
        { label: "开发者工具", accelerator: "CmdOrCtrl+Shift+I", role: "toggleDevTools" },
        ...(process.platform === "win32"
          ? [
              { type: "separator" },
              { label: "退出", accelerator: "Alt+F4", role: "quit" },
            ]
          : []),
      ],
    },
    {
      label: "编辑",
      submenu: editSubmenu,
    },
    {
      label: "视图",
      submenu: [
        { label: "全屏", accelerator: "F11", role: "togglefullscreen" },
        { type: "separator" },
        { label: "放大", role: "zoomIn" },
        { label: "缩小", role: "zoomOut" },
        { label: "实际大小", role: "resetZoom" },
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
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    if (process.platform === "win32") {
      // 与桌面快捷方式的 System.AppUserModel.ID 保持一致：
      // 决定运行中/固定到任务栏时 Windows 使用哪个图标
      app.setAppUserModelId(APP_USER_MODEL_ID);
    } else if (process.platform === "darwin") {
      applyDockIcon();
    }
    Menu.setApplicationMenu(buildMenu());
    createWindow();

    try {
      const result = await ensureServer();
      if (!result) return; // 错误弹窗已展示
      const { url } = result;
      serverOrigin = url.replace(/\/$/, "");
      await waitForServer(serverOrigin, 30_000, dshProcess);
      logLine(`loading UI from ${serverOrigin}`);
      if (mainWindow) mainWindow.loadURL(serverOrigin);
    } catch (err) {
      showBootError(`启动失败：${err.message}`);
    }
  });

  app.on("before-quit", () => {
    quitting = true;
    shutdownDsh();
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
