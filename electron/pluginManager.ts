/**
 * pluginManager.ts —— 插件管理（Phase 3）
 *
 * 底层调用 `dsh plugin --profile <name> <add|remove|list>`（转发给 profile 目录的
 * pnpm），启用/停用通过编辑 profile 的 cordis.patch.yml（dsh 的插件加载层）实现。
 *
 * - list():   已安装插件 + 启用状态 + 可用 profile
 * - add/remove:   dsh plugin add/remove
 * - setEnabled(): 在 cordis.patch.yml 中增删 `- id: <pkg>` 条目
 * - search():      GitHub API 搜索 topic:dsh-plugin 仓库
 */
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseDocument, isSeq, isMap, isScalar, type YAMLSeq } from "yaml";
import type { DshManager } from "./dshManager";
import type {
  PluginInfo,
  PluginListPayload,
  PluginLogEntry,
  PluginResult,
  PluginSearchResult,
} from "./types";

const ROOT = path.resolve(__dirname, "..");
const DESKTOP_PATCH = path.join(ROOT, "config", "desktop.patch.yml");

/** cordis.patch.yml 中的一个条目（id + 可选 config/disabled）。 */
interface PatchEntry {
  id: string;
  disabled?: boolean;
}

/** npm 包名 / GitHub 仓库名的白名单（防注入：只允许这些字符）。 */
const SAFE_PKG_RE = /^[A-Za-z0-9@._\-/:#]+$/;

export class PluginManager extends EventEmitter {
  private activeProfile = "web";
  /** 合并去重后的输出日志（供 UI 重连后补拉）。 */
  private logBuffer: PluginLogEntry[] = [];

  constructor(private dsh: DshManager) {
    super();
  }

  /* ---------------------------------------------------------------- */
  /* 基础路径                                                          */
  /* ---------------------------------------------------------------- */

  /** $DSH_HOME（默认 ~/.dsh）。 */
  private dshHome(): string {
    return process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
  }

  private profileDir(profile: string): string {
    return path.join(this.dshHome(), "profiles", profile);
  }

  private profilePatchPath(profile: string): string {
    return path.join(this.profileDir(profile), "cordis.patch.yml");
  }

  /** 可用 profile 列表（$DSH_HOME/profiles 下的目录）。 */
  listProfiles(): string[] {
    try {
      const dir = path.join(this.dshHome(), "profiles");
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((name) => fs.existsSync(path.join(dir, name, "package.json")));
    } catch {
      return [];
    }
  }

  /** 当前 profile（供 UI 显示 / 切换）。 */
  get profile(): string {
    return this.activeProfile;
  }

  set profile(name: string) {
    if (this.listProfiles().includes(name)) this.activeProfile = name;
  }

  /* ---------------------------------------------------------------- */
  /* 日志                                                              */
  /* ---------------------------------------------------------------- */

  private emitLog(level: PluginLogEntry["level"], text: string): void {
    const entry: PluginLogEntry = { ts: new Date().toISOString(), level, text };
    this.logBuffer.push(entry);
    if (this.logBuffer.length > 500) this.logBuffer = this.logBuffer.slice(-500);
    this.dsh.logLine(`[plugin:${level}] ${text}`);
    this.emit("log", entry);
  }

  /** UI 重连时补拉最近日志。 */
  drainLog(): PluginLogEntry[] {
    return [...this.logBuffer];
  }

  /* ---------------------------------------------------------------- */
  /* patch 层读写（yaml 保留注释与顺序）                                */
  /* ---------------------------------------------------------------- */

  private readPatchEntries(file: string): PatchEntry[] {
    try {
      if (!fs.existsSync(file)) return [];
      const doc = parseDocument(fs.readFileSync(file, "utf8"));
      if (!isSeq(doc.contents)) return [];
      const out: PatchEntry[] = [];
      for (const item of doc.contents.items) {
        if (!isMap(item)) continue;
        const idNode = item.get("id", true);
        const id = isScalar(idNode) ? String(idNode.value) : "";
        if (!id) continue;
        const disabledNode = item.get("disabled", true);
        const disabled = isScalar(disabledNode) ? (disabledNode.value as unknown) === true : false;
        out.push({ id, disabled });
      }
      return out;
    } catch {
      return [];
    }
  }

  /** 修改 profile 的 cordis.patch.yml 中某个插件条目的存在性（保留注释）。 */
  private setPatchEntry(profile: string, pkg: string, present: boolean): void {
    const file = this.profilePatchPath(profile);
    const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "[]\n";
    const doc = parseDocument(raw);
    if (!isSeq(doc.contents)) {
      doc.contents = doc.createNode([]) as unknown as typeof doc.contents;
    }
    const seq = doc.contents as YAMLSeq;
    let index = -1;
    seq.items.forEach((item, i) => {
      if (isMap(item)) {
        const idNode = item.get("id", true);
        if (isScalar(idNode) && String(idNode.value) === pkg) index = i;
      }
    });
    if (present && index === -1) {
      seq.add({ id: pkg });
    } else if (!present && index !== -1) {
      seq.delete(index);
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${doc.toString().trimEnd()}\n`);
    this.emitLog(present ? "info" : "info", `已${present ? "启用" : "停用"}插件 ${pkg}（${path.basename(file)}）`);
  }

  /* ---------------------------------------------------------------- */
  /* 插件命令                                                          */
  /* ---------------------------------------------------------------- */

  /** 校验并清洗用户输入的包名 / GitHub 地址。 */
  private sanitizePkg(input: string): string {
    const raw = input.trim();
    if (!raw) throw new Error("请输入 npm 包名或 GitHub 仓库地址");
    if (!SAFE_PKG_RE.test(raw)) {
      throw new Error("输入包含非法字符（仅允许 npm 包名 / GitHub owner/repo 形式）");
    }
    // GitHub 完整 URL → owner/repo
    const m = raw.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/);
    if (m) return m[1];
    return raw;
  }

  async add(input: string): Promise<PluginResult> {
    let pkg: string;
    try {
      pkg = this.sanitizePkg(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emitLog("error", message);
      return { ok: false, error: message };
    }
    this.emitLog("info", `安装插件 ${pkg}（profile: ${this.activeProfile}）…`);
    const res = await this.dsh.runDsh(["plugin", "--profile", this.activeProfile, "add", pkg], 10 * 60_000);
    if (res.code !== 0) {
      const tail = `${res.stderr || res.stdout}`.trim().split("\n").slice(-3).join("\n") || "未知错误";
      this.emitLog("error", `安装失败：${tail}`);
      return { ok: false, error: tail };
    }
    this.emitLog("success", `安装成功：${pkg}（已写入 profile 依赖，需启用并重启服务生效）`);
    return { ok: true };
  }

  async remove(pkg: string): Promise<PluginResult> {
    this.emitLog("info", `卸载插件 ${pkg}（profile: ${this.activeProfile}）…`);
    const res = await this.dsh.runDsh(["plugin", "--profile", this.activeProfile, "remove", pkg], 10 * 60_000);
    if (res.code !== 0) {
      const tail = `${res.stderr || res.stdout}`.trim().split("\n").slice(-3).join("\n") || "未知错误";
      this.emitLog("error", `卸载失败：${tail}`);
      return { ok: false, error: tail };
    }
    // 卸载后同时从启用层移除，避免残留条目
    try {
      this.setPatchEntry(this.activeProfile, pkg, false);
    } catch {
      /* noop */
    }
    this.emitLog("success", `卸载成功：${pkg}（重启服务后生效）`);
    return { ok: true };
  }

  async setEnabled(pkg: string, enabled: boolean): Promise<PluginResult> {
    try {
      this.setPatchEntry(this.activeProfile, pkg, enabled);
      this.emitLog("success", `插件 ${pkg} 已${enabled ? "启用" : "停用"}，重启服务后生效`);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emitLog("error", `修改启用状态失败：${message}`);
      return { ok: false, error: message };
    }
  }

  /* ---------------------------------------------------------------- */
  /* 列表                                                              */
  /* ---------------------------------------------------------------- */

  async list(): Promise<PluginListPayload> {
    const profile = this.activeProfile;
    const dir = this.profileDir(profile);
    const plugins = new Map<string, PluginInfo>();
    const add = (info: PluginInfo) => {
      const prev = plugins.get(info.id);
      if (!prev) {
        plugins.set(info.id, info);
        return;
      }
      // 合并：bundle 信息优先，状态取或（任一启用即启用）
      prev.enabled = prev.enabled || info.enabled;
      prev.installed = prev.installed || info.installed;
      if (info.version !== "(bundle)") prev.version = info.version;
    };

    // 1) bundle（内置，来自 package.json dsh.profile.bundles）
    let bundles: string[] = [];
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as {
        dsh?: { profile?: { bundles?: string[] } };
      };
      bundles = pkg.dsh?.profile?.bundles ?? [];
      for (const id of bundles) {
        add({ id, name: id, version: "(bundle)", installed: true, enabled: true, source: "bundle" });
      }
    } catch {
      /* profile 未初始化 */
    }

    // 2) 依赖（dsh plugin add 安装的包）
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as {
        dependencies?: Record<string, string>;
      };
      for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
        if (bundles.includes(name)) continue;
        add({ id: name, name, version: range, installed: true, enabled: false, source: "dependency" });
      }
    } catch {
      /* noop */
    }

    // 3) 启用状态：profile 层 + $DSH_HOME 层 + 桌面叠加层
    const enabledIds = new Set<string>();
    for (const file of [
      this.profilePatchPath(profile),
      path.join(this.dshHome(), "cordis.patch.yml"),
      DESKTOP_PATCH,
    ]) {
      for (const entry of this.readPatchEntries(file)) {
        if (!entry.disabled) enabledIds.add(entry.id);
      }
    }
    for (const info of plugins.values()) {
      if (enabledIds.has(info.id)) {
        info.enabled = true;
        if (info.source === "dependency") info.source = "patch";
      }
    }

    // 4) 解析真实版本（pnpm list --depth 0），失败则回退到 ranges
    const resolved = await this.resolveVersions(profile);
    for (const [id, version] of resolved) {
      const info = plugins.get(id);
      if (info) info.version = version;
    }

    return {
      plugins: [...plugins.values()].sort((a, b) => a.id.localeCompare(b.id)),
      profiles: this.listProfiles(),
      activeProfile: profile,
    };
  }

  /** 通过 `dsh plugin --profile <p> list --depth 0` 解析已解析版本。 */
  private async resolveVersions(profile: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      const res = await this.dsh.runDsh(
        ["plugin", "--profile", profile, "list", "--depth", "0"],
        60_000
      );
      const stdout = res.stdout || "";
      // pnpm list 输出形如：`@deepseek-ai/dsh-fs 0.1.0-rc.6`（或带路径/箭头）
      for (const line of stdout.split(/\r?\n/)) {
        const m = line.match(/^([@\w.\-~/]+)\s+([^\s]+)/);
        if (m) map.set(m[1], m[2]);
      }
    } catch {
      /* 解析失败静默回退 */
    }
    return map;
  }

  /* ---------------------------------------------------------------- */
  /* 社区搜索（可选，GitHub API）                                       */
  /* ---------------------------------------------------------------- */

  async search(query: string): Promise<PluginSearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    try {
      const url = new URL("https://api.github.com/search/repositories");
      url.searchParams.set("q", `topic:dsh-plugin ${q}`);
      url.searchParams.set("sort", "stars");
      url.searchParams.set("per_page", "10");
      const res = await fetch(url, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "dsh-desktop" },
      });
      if (!res.ok) {
        this.emitLog("error", `GitHub 搜索失败（HTTP ${res.status}）`);
        return [];
      }
      const data = (await res.json()) as {
        items?: Array<{ full_name: string; description: string | null; stargazers_count: number; html_url: string }>;
      };
      return (data.items ?? []).map((item) => ({
        fullName: item.full_name,
        description: item.description ?? "",
        stars: item.stargazers_count ?? 0,
        url: item.html_url,
      }));
    } catch (err) {
      this.emitLog("error", `GitHub 搜索失败：${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /** 重启 DSH 服务（安装/启用插件后调用）。 */
  async restart(): Promise<PluginResult> {
    this.emitLog("info", "正在重启 DSH 服务…");
    const ok = await this.dsh.restart();
    this.emitLog(ok ? "success" : "error", ok ? "服务已重启" : "服务重启失败");
    return { ok };
  }
}
