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
 */
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
import type { InputTriggerSource } from "@deepseek-ai/dsh-client-ui-input-trigger/client";
import { MENTION_ICON_FONT_TTF_B64 } from "./iconfont.js";

/** 菜单图标（内核 ic_ds_* 复制进插件字体，见 scripts/make-iconfont.mjs）。 */
const ICON_DIR = "\uE001"; // 文件夹（IconFolderClose16）
const ICON_FILE = "\uE002"; // 回形针（IconPaperclipOutline16）

/** 注入图标字体 + 菜单 icon 槽渲染规则（按官方菜单语义选择，不依赖 hashed 类名）。 */
function injectIconFont(ctx: ClientContext): () => void {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-file-mention";
  style.textContent = `
@font-face {
  font-family: "DshMentionIcons";
  src: url(data:font/ttf;base64,${MENTION_ICON_FONT_TTF_B64}) format("truetype");
  font-display: block;
}
button[role="option"] > span[aria-hidden="true"]:first-child {
  font-family: "DshMentionIcons";
  font-size: 14px;
  line-height: 1;
}
`;
  document.head.appendChild(style);
  return () => style.remove();
}

interface TreeEntry {
  /** Posix relative path from the workspace root; directories end with "/". */
  path: string;
  kind: "file" | "dir";
}

/** Hot cache fed by warm()/candidates(); lexicon() must stay synchronous. */
let cache: TreeEntry[] = [];

async function loadTree(signal: AbortSignal): Promise<TreeEntry[]> {
  const res = await fetch("/file-mention/list", { signal });
  if (!res.ok) throw new Error(`file-mention list failed: ${res.status}`);
  const data = (await res.json()) as { ok: boolean; entries: TreeEntry[] };
  if (!data.ok) throw new Error("file-mention list: not ok");
  cache = data.entries;
  return cache;
}

/** Parent directory of a tree row ("" for root-level rows; keeps trailing "/"). */
function parentDir(p: string): string {
  const trimmed = p.endsWith("/") ? p.slice(0, -1) : p;
  const i = trimmed.lastIndexOf("/");
  return i < 0 ? "" : trimmed.slice(0, i + 1);
}

const MAX_CANDIDATES = 30;

const source: InputTriggerSource = {
  trigger: "@",
  name: "file",
  order: 20,

  async candidates(_session, { query, signal }) {
    const entries = await loadTree(signal);
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
    return scored.map(({ e }) => ({
      name: e.path,
      description: parentDir(e.path) || "workspace root",
      icon: e.kind === "dir" ? ICON_DIR : ICON_FILE,
    }));
  },

  /** Prefetch so the first '@' keystroke already has a hot lexicon/cache. */
  warm() {
    void loadTree(new AbortController().signal).catch(() => {});
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
    for (const e of cache) {
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

  onPick({ candidate }) {
    return { text: `@${candidate.name} ` };
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
    () => injectIconFont(ctx),
    "dsh-file-mention: icon font",
  );
  ctx.effect(
    () => ctx.inputTriggers.registerSource(source),
    "dsh-file-mention: @ file source",
  );
}
