/**
 * dsh-desktop 共享类型定义（主进程 / preload 共用）。
 */

/** DSH Web 服务就绪信息。 */
export interface DshServerInfo {
  url: string;
  reused: boolean;
}

/** 一个已安装 / 已知的插件条目。 */
export interface PluginInfo {
  /** 插件 id（= npm 包名，或 bundle 名）。 */
  id: string;
  /** npm 包名（带 scope 的完整名称）。 */
  name: string;
  /** 已解析版本号；内置 bundle 未知时为 "(bundle)"。 */
  version: string;
  /** 是否已在 profile 中安装（package.json dependencies 或 bundle）。 */
  installed: boolean;
  /** 是否在任意 patch 层 / bundle 中被启用。 */
  enabled: boolean;
  /** 来源说明：bundle（内置）/ patch（启用层）/ dependency（仅安装未启用）。 */
  source: "bundle" | "patch" | "dependency";
}

/** GitHub 社区插件搜索结果。 */
export interface PluginSearchResult {
  fullName: string;
  description: string;
  stars: number;
  url: string;
}

/** 插件操作日志条目（流式推送给插件管理 UI）。 */
export interface PluginLogEntry {
  ts: string;
  level: "info" | "success" | "error";
  text: string;
}

/** 插件操作统一返回。 */
export interface PluginResult {
  ok: boolean;
  error?: string;
}

/** 插件列表 + 可用 profile。 */
export interface PluginListPayload {
  plugins: PluginInfo[];
  profiles: string[];
  activeProfile: string;
}

/** 主题来源：跟随系统 / 强制浅色 / 强制深色。 */
export type ThemeSource = "system" | "light" | "dark";

/** 窗口状态（位置 / 尺寸 / 最大化）。 */
export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

/** 自动更新状态机。 */
export interface UpdateStatus {
  state:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error";
  version?: string;
  percent?: number;
  error?: string;
}

/** IPC 通道名集中定义，避免字符串散落各处。 */
export const IPC = {
  /* 主题 */
  ThemeGet: "theme:get",
  ThemeSetSource: "theme:set-source",
  ThemeChanged: "theme:changed",
  /* 窗口 */
  WindowMinimize: "window:minimize",
  /* 插件管理 */
  PluginList: "plugin:list",
  PluginSetProfile: "plugin:set-profile",
  PluginAdd: "plugin:add",
  PluginRemove: "plugin:remove",
  PluginSetEnabled: "plugin:set-enabled",
  PluginSearch: "plugin:search",
  PluginRestart: "plugin:restart",
  PluginLog: "plugin:log",
  /* 自动更新 */
  UpdateCheck: "update:check",
  UpdateDownload: "update:download",
  UpdateInstall: "update:install",
  UpdateStatus: "update:status",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

/** preload 暴露给渲染进程的桌面桥（window.dshDesktop）。 */
export interface DesktopBridge {
  appName: string;
  versions: { electron: string; chrome: string; node: string };
  platform: NodeJS.Platform;
  theme: {
    /** 当前生效主题（'light' | 'dark'）。 */
    get: () => Promise<"light" | "dark">;
    /** 设置主题来源。 */
    setSource: (source: ThemeSource) => Promise<void>;
    /** 订阅生效主题变化，返回取消订阅函数。 */
    onChange: (cb: (effective: "light" | "dark") => void) => () => void;
  };
  window: {
    minimize: () => void;
  };
  update: {
    check: () => Promise<UpdateStatus>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    onStatus: (cb: (status: UpdateStatus) => void) => () => void;
  };
}

/** preload 暴露给插件管理窗口的 API（window.dshPlugin）。 */
export interface PluginBridge {
  list: () => Promise<PluginListPayload>;
  setProfile: (profile: string) => Promise<void>;
  add: (pkg: string) => Promise<PluginResult>;
  remove: (pkg: string) => Promise<PluginResult>;
  setEnabled: (pkg: string, enabled: boolean) => Promise<PluginResult>;
  search: (query: string) => Promise<PluginSearchResult[]>;
  restart: () => Promise<PluginResult>;
  onLog: (cb: (entry: PluginLogEntry) => void) => () => void;
}
