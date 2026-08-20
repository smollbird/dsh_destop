/**
 * dsh-file-mention — browser half.
 *
 * Registers the '@' input-trigger source (same pattern as the official
 * ui-subagent '@' source): candidates come from the host /file-mention/list
 * route (the workspace tree — files AND directories), a pick inserts the
 * literal `@<path> ` plain-text reference (chip visuals are derived by the
 * composer scanning the draft against this source's lexicon), and the codec
 * serializes the reference verbatim on submit — the agent reads the file or
 * globs the directory with its own workspace tools (方案 A: reference
 * semantics, no content injection).
 *
 * Every fetch carries `?session=<id>` (the per-session projection the
 * pipeline hands to sources); the host resolves that session's workspace
 * cwd, so the tree follows the active workspace even though the host
 * process cwd does not.
 */
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import type { InputTriggerSource } from "@deepseek-ai/dsh-client-ui-input-trigger/client";
import { FILE_ICONS, EXT_TO_ICON } from "./file-icons.js";

/** 文件类型图标 data URL 缓存。 */
const iconUrlCache = new Map<string, string>();
function fileIconUrl(ext: string | undefined, kind: "file" | "dir"): string {
  const iconKey = kind === "dir" ? "dir" : (ext && EXT_TO_ICON[ext]) || "text";
  let url = iconUrlCache.get(iconKey);
  if (!url) {
    url = `data:image/svg+xml;base64,${btoa(FILE_ICONS[iconKey].svg)}`;
    iconUrlCache.set(iconKey, url);
  }
  return url;
}

/** 待处理的 icon DOM 替换队列（icon 槽 innerHTML → <img> data URL）。 */
const pendingIcons = new Map<string, string>();

/**
 * 注入菜单样式 + MutationObserver（把 icon 槽里的文本 data URL 替换为 <img>）。
 * 官方菜单的 icon 槽用 `children: item.icon`（文本子节点）渲染，React 不会
 * 解析 HTML 字符串，因此需要 DOM 层替换。
 */
function injectMenuStyles(): () => void {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-file-mention";
  style.textContent = `
/* 隐藏 "file" 分组标题（源 name 即 "file"） */
[data-source="file"] {
  display: none;
}
/* icon 槽：16×16 */
button[role="option"] > span[aria-hidden="true"]:first-child {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex: none;
  overflow: hidden;
}
button[role="option"] > span[aria-hidden="true"]:first-child img {
  width: 16px;
  height: 16px;
}
`;
  document.head.appendChild(style);

  // MutationObserver：扫描 menu 里的 icon 槽，把 data URL 文本替换为 <img>
  const observer = new MutationObserver((mutations) => {
    for (let mi = 0; mi < mutations.length; mi++) {
      const added = mutations[mi].addedNodes;
      for (let ni = 0; ni < added.length; ni++) {
        const node = added[ni];
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        // 只处理 menu 里的 option 行
        if (!el.matches?.('button[role="option"]')) continue;
        const slots = el.querySelectorAll('span[aria-hidden="true"]');
        for (let i = 0; i < slots.length; i++) {
          const iconSlot = slots[i];
          const text = iconSlot.textContent?.trim();
          if (!text || text.startsWith("<img")) continue;
          // 检查是否是 data URL（pendingIcons 里存过的，或直接以 data: 开头）
          const url = pendingIcons.get(text) ?? (text.startsWith("data:") ? text : null);
          if (!url) continue;
          const img = document.createElement("img");
          img.src = url;
          img.alt = "";
          iconSlot.innerHTML = "";
          iconSlot.appendChild(img);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    style.remove();
    pendingIcons.clear();
  };
}

interface TreeEntry {
  /** Posix relative path from the workspace root; directories end with "/". */
  path: string;
  kind: "file" | "dir";
  /** Lowercased extension without dot ("" for no extension / dirs). */
  ext?: string;
}

/** Hot cache fed by warm()/candidates(); lexicon() must stay synchronous.
 * Keyed by root so a workspace switch invalidates the stale roll. */
let cache: { root: string; entries: TreeEntry[] } = { root: "", entries: [] };

async function loadTree(sessionId: string | undefined, signal: AbortSignal): Promise<TreeEntry[]> {
  const qs = sessionId ? `?session=${encodeURIComponent(sessionId)}` : "";
  const res = await fetch(`/file-mention/list${qs}`, { signal });
  if (!res.ok) throw new Error(`file-mention list failed: ${res.status}`);
  const data = (await res.json()) as { ok: boolean; root: string; entries: TreeEntry[] };
  if (!data.ok) throw new Error("file-mention list: not ok");
  cache = { root: data.root, entries: data.entries };
  return cache.entries;
}

/** Basename of a tree row (for display); full path stays in the data attr. */
function basename(p: string): string {
  const trimmed = p.endsWith("/") ? p.slice(0, -1) : p;
  return trimmed.slice(trimmed.lastIndexOf("/") + 1);
}

const MAX_CANDIDATES = 30;

const source: InputTriggerSource = {
  trigger: "@",
  name: "file",
  order: 20,

  async candidates(session, { query, signal }) {
    const entries = await loadTree(session.sessionId, signal);
    const q = query.trim().toLowerCase();
    const scored = entries
      .filter((e) => !q || e.path.toLowerCase().includes(q))
      .map((e) => {
        const trimmed = e.path.endsWith("/") ? e.path.slice(0, -1) : e.path;
        const base = trimmed.slice(trimmed.lastIndexOf("/") + 1).toLowerCase();
        const starts = q && base.startsWith(q) ? 0 : 1;
        const depth = e.path.split("/").length - 1;
        return { e, starts, depth };
      })
      .sort((a, b) => a.starts - b.starts || a.depth - b.depth || a.e.path.localeCompare(b.e.path))
      .slice(0, MAX_CANDIDATES);
    return scored.map(({ e }) => {
      const url = fileIconUrl(e.ext, e.kind);
      // 注册到 pendingIcons：MutationObserver 会把 icon 槽里的文本替换为 <img>
      pendingIcons.set(url, url);
      return {
        name: basename(e.path),
        description: e.path.includes("/") ? e.path : undefined,
        icon: url, // 官方 icon 槽渲染为文本，observer 会替换为 <img>
      };
    });
  },

  /** Prefetch so the first '@' keystroke already has a hot lexicon/cache. */
  warm(session) {
    void loadTree(session.sessionId, new AbortController().signal).catch(() => {});
  },

  /**
   * Hot name roll for the composer's plain-text decoration scan. The scanner
   * matches `[\w-]+` tokens only (no dots or slashes), so a full `plan.md`
   * never matches; offering root-level basenames without extensions gives the
   * common case (`@plan.md` → `@plan` highlighted, `@electron/` → `@electron`)
   * without directory noise.
   */
  lexicon() {
    const roll = new Set<string>();
    for (const e of cache.entries) {
      const trimmed = e.path.endsWith("/") ? e.path.slice(0, -1) : e.path;
      if (trimmed.includes("/")) continue; // root-level rows only
      const base = e.kind === "dir" ? trimmed : trimmed.replace(/\.[^.]+$/, "");
      if (/^[\w-]+$/.test(base)) roll.add(base);
    }
    return [...roll];
  },

  subscribeLexicon() {
    return () => {}; // tree changes are picked up on the next fetch
  },

  /**
   * 选中候选后插入 `@<fullPath> `。
   * 显示名是 basename（菜单紧凑），但插入/序列化必须用完整相对路径
   * （agent 按路径 read/glob）。fullPath 存在 description 字段里
   * （根层文件无 description，此时 name 本身就是完整路径）。
   */
  onPick({ candidate }) {
    const fullPath = candidate.description ?? candidate.name;
    return { text: `@${fullPath} ` };
  },

  codec: {
    clipboardText: (ref) => `@${ref}`,
    serialize: (ref) => Promise.resolve(`@${ref}`),
  },
};

/** Required client services: the input-trigger roster. */
export const inject = ["inputTriggers"];

/**
 * Client plugin body: register the '@' file source.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => injectMenuStyles(),
    "dsh-file-mention: menu styles",
  );
  ctx.effect(
    () => ctx.inputTriggers.registerSource(source),
    "dsh-file-mention: @ file source",
  );
}
