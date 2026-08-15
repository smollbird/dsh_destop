/**
 * dsh-settings-tabs — browser half.
 *
 * Registers two read-only tabs into the Plugins settings section
 * (`settings.plugins.tab`, the same slot the official "configurable" and
 * "plugin list" tabs use):
 *
 *   skills — the skill catalog of the default agent preset
 *            (GET /settings-tabs/skills)
 *   mcp    — configured MCP client instances (GET /settings-tabs/mcp)
 *
 * Both datasets are served by this plugin's node half, so the tabs need no
 * session (the settings panel has none).
 */
import type { ClientContext } from "@deepseek-ai/dsh-client-runtime/client";
// Type-only imports load the Context/SlotMap augmentations (ctx.locale, the
// 'settings.plugins.tab' slot contract); all erased at compile time.
import type {} from "@deepseek-ai/dsh-client-locale/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

/** ------------------------------------------------------------------ */
/* 字典                                                               */
/* ------------------------------------------------------------------ */

/** Dictionary namespace owned by this plugin. */
const NS = "settings.skillsMcp";

/** Simplified Chinese dictionary and key source of truth. */
const zh = {
  skillsTab: "技能",
  mcpTab: "MCP",
  retry: "重试",
  search: "搜索",
  count: "共 {count} 项",
  empty: "暂无内容。",
  emptySearch: "没有匹配的内容。",
  skillsLoading: "正在读取技能…",
  skillsError: "暂时无法读取技能。",
  skillsEmpty: "未发现可用技能。",
  skillsEmptySearch: "没有匹配的技能。",
  skillsCatalog: "技能列表",
  modelInvocable: "模型可调用",
  userOnly: "仅用户可调用",
  mcpLoading: "正在读取 MCP 服务器…",
  mcpError: "暂时无法读取 MCP 服务器。",
  mcpEmpty: "未配置 MCP 服务器。用右上角的「添加 MCP 服务器」快速配置，会同步到 profile 的 cordis.patch.yml。",
  mcpEmptySearch: "没有匹配的 MCP 服务器。",
  mcpServers: "MCP 服务器",
  enabled: "已启用",
  disabled: "已停用",
  phase: "状态",
  entry: "条目",
  transport: "传输",
  target: "目标",
  unobserved: "未挂载",
  pending: "等待依赖",
  loadingPhase: "加载中",
  active: "已挂载",
  failed: "挂载失败",
  disposed: "已销毁",
  unloading: "卸载中",
  mcpAdd: "添加 MCP 服务器",
  mcpAddTitle: "添加 MCP 服务器",
  mcpAddHint: "保存后会立即生效，并同步到 profile 的 cordis.patch.yml（重启后依然存在）。",
  mcpCancel: "取消",
  mcpSave: "保存",
  mcpSaving: "保存中…",
  mcpServerName: "服务器名称",
  mcpServerNameHint: "字母 / 数字 / _ / -，最长 32 字符",
  mcpTransport: "传输方式",
  mcpTransportHint: "旧版 HTTP+SSE 已并入 streamable-http（客户端仅支持 stdio 与 streamable-http）",
  mcpCommand: "启动命令",
  mcpCommandHint: "例如 /usr/local/bin/node",
  mcpArgs: "参数（每行一个）",
  mcpArgsHint: "例如 /path/to/server.mjs",
  mcpUrl: "服务器地址",
  mcpUrlHint: "例如 https://mcp.example.com/sse",
  mcpPersisted: "已持久化",
  mcpManaged: "快速添加",
  mcpDelete: "删除",
  mcpDeleteConfirm: "确认删除？",
  mcpDeleting: "删除中…",
  mcpPendingRestart: "已从配置移除；当前会话内的实例将在重启后消失。",
  mcpErrorDuplicate: "该服务器名称已存在。",
  mcpErrorInvalidServerName: "服务器名称只能包含字母、数字、_ 和 -（最长 32 字符）。",
  mcpErrorInvalidTransport: "请选择传输方式。",
  mcpErrorInvalidCommand: "stdio 传输需要填写启动命令。",
  mcpErrorInvalidUrl: "请填写 http(s):// 开头的地址。",
  mcpErrorApplyFailed: "应用失败：{error}",
  mcpErrorPatchUnreadable: "无法改写 patch 文件（可能包含 !!js 表达式）：{error}",
  mcpErrorBadBody: "请求格式错误：{error}",
  mcpErrorRemoveFailed: "删除失败：{error}",
  mcpErrorUnknown: "操作失败：{error}",
  mcpSyncedNote: "已同步到 {path}",
};
/** English dictionary checked against the Chinese key set. */
const en: Record<keyof typeof zh, string> = {
  skillsTab: "Skills",
  mcpTab: "MCP",
  retry: "Retry",
  search: "Search",
  count: "{count} items",
  empty: "Nothing here yet.",
  emptySearch: "No matching entries.",
  skillsLoading: "Loading skills…",
  skillsError: "Skills are temporarily unavailable.",
  skillsEmpty: "No skills are available.",
  skillsEmptySearch: "No matching skills.",
  skillsCatalog: "Skill catalog",
  modelInvocable: "Model-invocable",
  userOnly: "User-only",
  mcpLoading: "Loading MCP servers…",
  mcpError: "MCP servers are temporarily unavailable.",
  mcpEmpty: "No MCP servers are configured. Use \"Add MCP server\" to configure one — it syncs to the profile's cordis.patch.yml.",
  mcpEmptySearch: "No matching MCP servers.",
  mcpServers: "MCP servers",
  enabled: "Enabled",
  disabled: "Disabled",
  phase: "Status",
  entry: "Entry",
  transport: "Transport",
  target: "Target",
  unobserved: "Not mounted",
  pending: "Waiting for dependencies",
  loadingPhase: "Loading",
  active: "Mounted",
  failed: "Mount failed",
  disposed: "Disposed",
  unloading: "Unloading",
  mcpAdd: "Add MCP server",
  mcpAddTitle: "Add MCP server",
  mcpAddHint: "Takes effect immediately and syncs to the profile's cordis.patch.yml (survives restarts).",
  mcpCancel: "Cancel",
  mcpSave: "Save",
  mcpSaving: "Saving…",
  mcpServerName: "Server name",
  mcpServerNameHint: "Letters / digits / _ / -, max 32 chars",
  mcpTransport: "Transport",
  mcpTransportHint: "Legacy HTTP+SSE was folded into streamable-http (the client supports only stdio and streamable-http)",
  mcpCommand: "Command",
  mcpCommandHint: "e.g. /usr/local/bin/node",
  mcpArgs: "Arguments (one per line)",
  mcpArgsHint: "e.g. /path/to/server.mjs",
  mcpUrl: "Server URL",
  mcpUrlHint: "e.g. https://mcp.example.com/sse",
  mcpPersisted: "Persisted",
  mcpManaged: "Quick-add",
  mcpDelete: "Delete",
  mcpDeleteConfirm: "Confirm delete?",
  mcpDeleting: "Deleting…",
  mcpPendingRestart: "Removed from config; the live instance disappears after restart.",
  mcpErrorDuplicate: "That server name already exists.",
  mcpErrorInvalidServerName: "Server name may only contain letters, digits, _ and - (max 32 chars).",
  mcpErrorInvalidTransport: "Pick a transport.",
  mcpErrorInvalidCommand: "stdio transport needs a command.",
  mcpErrorInvalidUrl: "Enter a URL starting with http(s)://.",
  mcpErrorApplyFailed: "Apply failed: {error}",
  mcpErrorPatchUnreadable: "Cannot rewrite the patch file (it may contain !!js expressions): {error}",
  mcpErrorBadBody: "Bad request: {error}",
  mcpErrorRemoveFailed: "Delete failed: {error}",
  mcpErrorUnknown: "Operation failed: {error}",
  mcpSyncedNote: "Synced to {path}",
};

/** ------------------------------------------------------------------ */
/* 数据                                                               */
/* ------------------------------------------------------------------ */

/** One skill row as served by /settings-tabs/skills. */
interface SkillRow {
  name: string;
  description: string;
  whenToUse?: string;
  modelInvocable: boolean;
  userInvocable: boolean;
  source: string;
}

/** One MCP server row as served by /settings-tabs/mcp. */
interface McpServerRow {
  entryId: string;
  serverName: string;
  transport: string;
  target: string;
  enabled: boolean;
  phase: string | null;
  persistent: boolean;
  managed: boolean;
}

/** The /settings-tabs/mcp listing envelope. */
interface McpListData {
  servers: McpServerRow[];
  patchFile?: string;
}

/** Mutation result envelope from POST/DELETE /settings-tabs/mcp. */
interface McpMutationData {
  ok: boolean;
  code?: string;
  error?: string;
  pendingRestart?: boolean;
  note?: string;
}

/** One server to add (POST body). */
interface McpAddPayload {
  serverName: string;
  transport: "stdio" | "streamable-http";
  command?: string;
  args?: string[];
  url?: string;
}

interface Envelope<T> {
  ok: boolean;
  error?: string;
}

async function loadJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  const data = (await res.json()) as T & Envelope<unknown>;
  if (!data.ok) throw new Error(data.error ?? `GET ${url} returned not-ok`);
  return data;
}

const listSkills = (signal: AbortSignal) =>
  loadJson<{ skills: SkillRow[] }>("/settings-tabs/skills", signal).then((d) => d.skills);

const listMcpServers = (signal: AbortSignal) =>
  loadJson<McpListData>("/settings-tabs/mcp", signal).then((d) => d.servers);

/** POST one server; resolves with the mutation envelope (never throws on business codes). */
async function addMcpServer(payload: McpAddPayload): Promise<McpMutationData> {
  const res = await fetch("/settings-tabs/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`POST /settings-tabs/mcp failed: ${res.status}`);
  return (await res.json()) as McpMutationData;
}

/** DELETE one server by serverName; resolves with the mutation envelope. */
async function removeMcpServer(serverName: string): Promise<McpMutationData> {
  const res = await fetch(`/settings-tabs/mcp?serverName=${encodeURIComponent(serverName)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`DELETE /settings-tabs/mcp failed: ${res.status}`);
  return (await res.json()) as McpMutationData;
}

/** ------------------------------------------------------------------ */
/* 通用异步列表骨架                                                    */
/* ------------------------------------------------------------------ */

type AsyncState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: T };

/** Load once per `request` bump; aborts on unmount and on retry. */
function useAsyncData<T>(loader: (signal: AbortSignal) => Promise<T>): {
  state: AsyncState<T>;
  retry: () => void;
} {
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    Promise.resolve()
      .then(() => loader(controller.signal))
      .then(
        (data) => {
          if (current) setState({ status: "ready", data });
        },
        (error: unknown) => {
          if (current && !controller.signal.aborted) setState({ status: "error" });
        },
      );
    return () => {
      current = false;
      controller.abort();
    };
  }, [loader, request]);
  const retry = () => {
    setState({ status: "loading" });
    setRequest((value) => value + 1);
  };
  return { state, retry };
}

/** Translate function seat as injected by the slots system. */
type T = (key: string) => string;

/** Shared loading/error/empty/search scaffolding for both tabs. */
function TabShell(props: {
  t: T;
  state: AsyncState<unknown>;
  retry: () => void;
  loadingKey: string;
  errorKey: string;
  query: string;
  onQuery: (value: string) => void;
  titleKey: string;
  count: number;
  total: number;
  emptyKey: string;
  emptySearchKey: string;
  children: ReactNode;
}) {
  const { t, state, retry } = props;
  return (
    <div className="stt-tab" aria-busy={state.status === "loading"}>
      {state.status === "loading" ? <p className="stt-status">{t(props.loadingKey)}</p> : null}
      {state.status === "error" ? (
        <div className="stt-failure">
          <p role="alert">{t(props.errorKey)}</p>
          <button type="button" className="stt-retry" onClick={retry}>
            {t("retry")}
          </button>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <div className="stt-ready">
          <label className="stt-search">
            <span className="stt-visuallyHidden">{t("search")}</span>
            <input
              type="search"
              value={props.query}
              placeholder={t("search")}
              aria-label={t("search")}
              onChange={(event: { currentTarget: { value: string } }) =>
                props.onQuery(event.currentTarget.value)
              }
            />
          </label>
          <div className="stt-heading">
            <h3>{t(props.titleKey)}</h3>
            <span data-count={props.count}>{t("count").replace("{count}", String(props.count))}</span>
          </div>
          {props.total === 0 ? <p className="stt-status">{t(props.emptyKey)}</p> : null}
          {props.total > 0 && props.count === 0 ? (
            <p className="stt-status">{t(props.emptySearchKey)}</p>
          ) : null}
          {props.count > 0 ? props.children : null}
        </div>
      ) : null}
    </div>
  );
}

/** ------------------------------------------------------------------ */
/* 技能 tab                                                           */
/* ------------------------------------------------------------------ */

/** Render the read-only skill catalog. */
function SkillsTab(props: { list: typeof listSkills; t: T }) {
  const { state, retry } = useAsyncData(props.list);
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const rows = useMemo(
    () =>
      state.status === "ready"
        ? state.data.filter(
            (skill) =>
              normalized.length === 0 ||
              skill.name.toLocaleLowerCase().includes(normalized) ||
              skill.description.toLocaleLowerCase().includes(normalized),
          )
        : [],
    [normalized, state],
  );
  const total = state.status === "ready" ? state.data.length : 0;
  return (
    <TabShell
      t={props.t}
      state={state}
      retry={retry}
      loadingKey="skillsLoading"
      errorKey="skillsError"
      query={query}
      onQuery={setQuery}
      titleKey="skillsCatalog"
      count={rows.length}
      total={total}
      emptyKey="skillsEmpty"
      emptySearchKey="skillsEmptySearch"
    >
      <ul className="stt-cards">
        {rows.map((skill) => (
          <li className="stt-card" key={skill.name} data-skill={skill.name}>
            <div className="stt-cardHeader">
              <strong className="stt-cardTitle">{skill.name}</strong>
              <span
                className="stt-tag"
                data-tone={skill.modelInvocable ? "model" : "user"}
                title={skill.source}
              >
                {props.t(skill.modelInvocable ? "modelInvocable" : "userOnly")}
              </span>
            </div>
            <p className="stt-cardBody">{skill.description}</p>
            {skill.whenToUse !== undefined ? (
              <p className="stt-cardHint">{skill.whenToUse}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </TabShell>
  );
}

/** ------------------------------------------------------------------ */
/* MCP tab                                                            */
/* ------------------------------------------------------------------ */

const PHASE_KEYS: Record<string, string> = {
  pending: "pending",
  loading: "loadingPhase",
  active: "active",
  failed: "failed",
  disposed: "disposed",
  unloading: "unloading",
};

function phaseLabel(phase: string | null, t: T): string {
  return phase === null ? t("unobserved") : t(PHASE_KEYS[phase] ?? "unobserved");
}

/** Map a mutation business code to a locale key. */
function mutationErrorKey(code: string | undefined): string {
  switch (code) {
    case "duplicate":
      return "mcpErrorDuplicate";
    case "invalid-server-name":
      return "mcpErrorInvalidServerName";
    case "invalid-transport":
      return "mcpErrorInvalidTransport";
    case "invalid-command":
      return "mcpErrorInvalidCommand";
    case "invalid-url":
      return "mcpErrorInvalidUrl";
    case "apply-failed":
      return "mcpErrorApplyFailed";
    case "patch-unreadable":
      return "mcpErrorPatchUnreadable";
    case "bad-body":
      return "mcpErrorBadBody";
    case "remove-failed":
      return "mcpErrorRemoveFailed";
    default:
      return "mcpErrorUnknown";
  }
}

/** Render the configured MCP client instances with a quick-add form and delete. */
function McpTab(props: { list: typeof listMcpServers; t: T }) {
  const { state, retry } = useAsyncData(props.list);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [serverName, setServerName] = useState("");
  const [transport, setTransport] = useState<"stdio" | "streamable-http">("stdio");
  const [command, setCommand] = useState("");
  const [argsText, setArgsText] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNote, setFormNote] = useState<string | null>(null);
  const [deleteArm, setDeleteArm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const t = props.t;
  const normalized = query.trim().toLocaleLowerCase();
  const rows = useMemo(
    () =>
      state.status === "ready"
        ? state.data.filter(
            (server) =>
              normalized.length === 0 ||
              server.serverName.toLocaleLowerCase().includes(normalized) ||
              server.entryId.toLocaleLowerCase().includes(normalized) ||
              server.target.toLocaleLowerCase().includes(normalized),
          )
        : [],
    [normalized, state],
  );
  const total = state.status === "ready" ? state.data.length : 0;

  const openForm = () => {
    setFormOpen(true);
    setFormError(null);
    setFormNote(null);
  };
  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setFormError(null);
    setFormNote(null);
  };

  const submit = async () => {
    const name = serverName.trim();
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(name)) {
      setFormError(t("mcpErrorInvalidServerName"));
      return;
    }
    if (transport === "stdio" && command.trim() === "") {
      setFormError(t("mcpErrorInvalidCommand"));
      return;
    }
    if (transport === "streamable-http" && !/^https?:\/\/.+/.test(url.trim())) {
      setFormError(t("mcpErrorInvalidUrl"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: McpAddPayload =
        transport === "stdio"
          ? {
              serverName: name,
              transport,
              command: command.trim(),
              args: argsText
                .split(/\r?\n/)
                .map((arg) => arg.trim())
                .filter((arg) => arg.length > 0),
            }
          : { serverName: name, transport, url: url.trim() };
      const result = await addMcpServer(payload);
      if (!result.ok) {
        setFormError(t(mutationErrorKey(result.code)).replace("{error}", result.error ?? ""));
        return;
      }
      setFormOpen(false);
      setServerName("");
      setCommand("");
      setArgsText("");
      setUrl("");
      setFormNote(null);
      setNotice(result.note !== undefined ? t("mcpSyncedNote").replace("{path}", result.note) : null);
      window.setTimeout(retry, 300); // let the new entry surface in the loader
    } catch (error) {
      setFormError(t("mcpErrorUnknown").replace("{error}", String(error)));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (server: McpServerRow) => {
    if (deleteArm !== server.serverName) {
      setDeleteArm(server.serverName);
      return;
    }
    setDeleteArm(null);
    setDeleting(server.serverName);
    try {
      const result = await removeMcpServer(server.serverName);
      if (!result.ok) {
        setNotice(t(mutationErrorKey(result.code)).replace("{error}", result.error ?? ""));
        return;
      }
      setNotice(
        result.pendingRestart === true ? t("mcpPendingRestart") : null,
      );
      window.setTimeout(retry, 200);
    } catch (error) {
      setNotice(t("mcpErrorUnknown").replace("{error}", String(error)));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="stt-tab">
      <div className="stt-toolbar">
        <button type="button" className="stt-primary" onClick={openForm}>
          {t("mcpAdd")}
        </button>
        {notice !== null ? (
          <span className="stt-note" role="status">
            {notice}
          </span>
        ) : null}
      </div>
      {formOpen ? (
        <form
          className="stt-form"
          onSubmit={(event: { preventDefault(): void }) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="stt-formHeader">
            <strong>{t("mcpAddTitle")}</strong>
            <span>{t("mcpAddHint")}</span>
          </div>
          <label className="stt-field">
            <span className="stt-fieldLabel">{t("mcpServerName")}</span>
            <input
              type="text"
              value={serverName}
              autoFocus
              placeholder="my-server"
              onChange={(event: { currentTarget: { value: string } }) => {
                setServerName(event.currentTarget.value);
                setFormError(null);
              }}
            />
            <span className="stt-fieldHint">{t("mcpServerNameHint")}</span>
          </label>
          <label className="stt-field">
            <span className="stt-fieldLabel">{t("mcpTransport")}</span>
            <select
              value={transport}
              onChange={(event: { currentTarget: { value: string } }) => {
                setTransport(event.currentTarget.value === "streamable-http" ? "streamable-http" : "stdio");
                setFormError(null);
              }}
            >
              <option value="stdio">stdio</option>
              <option value="streamable-http">streamable-http</option>
            </select>
            <span className="stt-fieldHint">{t("mcpTransportHint")}</span>
          </label>
          {transport === "stdio" ? (
            <>
              <label className="stt-field">
                <span className="stt-fieldLabel">{t("mcpCommand")}</span>
                <input
                  type="text"
                  value={command}
                  placeholder="/usr/local/bin/node"
                  onChange={(event: { currentTarget: { value: string } }) => {
                    setCommand(event.currentTarget.value);
                    setFormError(null);
                  }}
                />
                <span className="stt-fieldHint">{t("mcpCommandHint")}</span>
              </label>
              <label className="stt-field">
                <span className="stt-fieldLabel">{t("mcpArgs")}</span>
                <textarea
                  rows={3}
                  value={argsText}
                  placeholder={"/path/to/server.mjs"}
                  onChange={(event: { currentTarget: { value: string } }) =>
                    setArgsText(event.currentTarget.value)
                  }
                />
                <span className="stt-fieldHint">{t("mcpArgsHint")}</span>
              </label>
            </>
          ) : (
            <label className="stt-field">
              <span className="stt-fieldLabel">{t("mcpUrl")}</span>
              <input
                type="text"
                value={url}
                placeholder="https://mcp.example.com/sse"
                onChange={(event: { currentTarget: { value: string } }) => {
                  setUrl(event.currentTarget.value);
                  setFormError(null);
                }}
              />
              <span className="stt-fieldHint">{t("mcpUrlHint")}</span>
            </label>
          )}
          {formError !== null ? (
            <p className="stt-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="stt-formActions">
            <button type="button" className="stt-retry" onClick={closeForm} disabled={saving}>
              {t("mcpCancel")}
            </button>
            <button type="submit" className="stt-primary" disabled={saving}>
              {saving ? t("mcpSaving") : t("mcpSave")}
            </button>
          </div>
        </form>
      ) : null}
      <TabShell
        t={t}
        state={state}
        retry={retry}
        loadingKey="mcpLoading"
        errorKey="mcpError"
        query={query}
        onQuery={setQuery}
        titleKey="mcpServers"
        count={rows.length}
        total={total}
        emptyKey="mcpEmpty"
        emptySearchKey="mcpEmptySearch"
      >
        <ul className="stt-cards">
          {rows.map((server) => {
            const status = phaseLabel(server.phase, t);
            const armed = deleteArm === server.serverName;
            const busy = deleting === server.serverName;
            return (
              <li className="stt-card" key={server.entryId} data-mcp-server={server.entryId}>
                <div className="stt-cardHeader">
                  <strong className="stt-cardTitle">{server.serverName}</strong>
                  {server.persistent ? (
                    <span className="stt-tag" data-tone="persisted">
                      {t("mcpPersisted")}
                    </span>
                  ) : null}
                  {server.managed ? (
                    <span className="stt-tag" data-tone="managed">
                      {t("mcpManaged")}
                    </span>
                  ) : null}
                  <span className="stt-tag" data-tone="transport">
                    {server.transport}
                  </span>
                  <span className="stt-tag" data-enabled={server.enabled ? "true" : "false"}>
                    {t(server.enabled ? "enabled" : "disabled")}
                  </span>
                  <span
                    className="stt-phase"
                    data-phase={server.phase ?? "unobserved"}
                    role="img"
                    aria-label={status}
                    title={status}
                  />
                  <button
                    type="button"
                    className="stt-delete"
                    data-armed={armed ? "true" : undefined}
                    disabled={busy}
                    onClick={() => void confirmDelete(server)}
                  >
                    {busy ? t("mcpDeleting") : armed ? t("mcpDeleteConfirm") : t("mcpDelete")}
                  </button>
                </div>
                {server.target.length > 0 ? (
                  <p className="stt-cardBody stt-monospace">{server.target}</p>
                ) : null}
                <dl className="stt-details">
                  <div>
                    <dt>{t("entry")}</dt>
                    <dd className="stt-monospace">{server.entryId}</dd>
                  </div>
                  <div>
                    <dt>{t("phase")}</dt>
                    <dd>{status}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      </TabShell>
    </div>
  );
}

/** ------------------------------------------------------------------ */
/* 插件装配                                                            */
/* ------------------------------------------------------------------ */

/** Inject the tab stylesheet once. */
function injectStyles(): () => void {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-settings-tabs";
  style.textContent = `
.stt-tab{max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}
.stt-status{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px}
.stt-failure{color:var(--dsw-alias-state-error-primary);flex-direction:column;align-items:flex-start;gap:8px;margin:0;font-size:13px;display:flex}
.stt-retry{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;padding:2px 10px;font-size:12px;line-height:20px}
.stt-retry:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}
.stt-ready{flex-direction:column;gap:10px;display:flex}
.stt-search{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;align-items:center;padding:0 10px;display:flex}
.stt-search input{border:0;background:0 0;color:inherit;font:inherit;min-width:0;width:100%;padding:6px 0;outline:none}
.stt-search input::placeholder{color:var(--dsw-alias-label-tertiary)}
.stt-heading{color:var(--dsw-alias-label-secondary);align-items:baseline;gap:8px;display:flex}
.stt-heading h3{margin:0;font-size:13px;font-weight:600}
.stt-heading span{color:var(--dsw-alias-label-tertiary);font-size:12px}
.stt-cards{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}
.stt-card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:12px;flex-direction:column;gap:6px;padding:10px 12px;display:flex}
.stt-cardHeader{align-items:center;gap:8px;display:flex}
.stt-cardTitle{min-width:0;color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stt-tag{border-radius:999px;flex:none;padding:0 8px;font-size:11px;line-height:18px}
.stt-tag[data-tone=model]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent);color:var(--dsw-alias-state-business-primary)}
.stt-tag[data-tone=user]{background:var(--dsw-alias-badge-bg-l2);color:var(--dsw-alias-label-tertiary)}
.stt-tag[data-tone=transport]{background:var(--dsw-alias-badge-bg-l2);color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font-markdown-code-block)}
.stt-tag[data-enabled=true]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);color:var(--dsw-alias-state-success-primary)}
.stt-tag[data-enabled=false]{background:var(--dsw-alias-badge-bg-l2);color:var(--dsw-alias-label-tertiary)}
.stt-phase{width:8px;height:8px;border-radius:50%;flex:none;margin-left:auto}
.stt-phase[data-phase=active]{background:var(--dsw-alias-state-success-primary)}
.stt-phase[data-phase=loading],.stt-phase[data-phase=pending]{background:var(--dsw-alias-state-business-primary)}
.stt-phase[data-phase=failed]{background:var(--dsw-alias-state-error-primary)}
.stt-phase[data-phase=unobserved],.stt-phase[data-phase=disposed],.stt-phase[data-phase=unloading]{background:var(--dsw-alias-label-caption)}
.stt-cardBody{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:20px}
.stt-cardHint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}
.stt-monospace{font:var(--dsw-font-markdown-code-block);overflow-wrap:anywhere}
.stt-details{color:var(--dsw-alias-label-tertiary);gap:4px 16px;margin:0;font-size:12px;display:flex;flex-wrap:wrap}
.stt-details div{display:flex;gap:6px}
.stt-details dt{margin:0}
.stt-details dd{margin:0;color:var(--dsw-alias-label-secondary)}
.stt-visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}
.stt-toolbar{align-items:center;gap:10px;display:flex}
.stt-primary{border:1px solid var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-bg-base);cursor:pointer;border-radius:999px;padding:3px 12px;font-size:12px;line-height:20px}
.stt-primary:hover{filter:brightness(1.08)}
.stt-primary:disabled{opacity:.6;cursor:default}
.stt-note{color:var(--dsw-alias-state-success-primary);margin:0;font-size:12px}
.stt-form{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:12px;flex-direction:column;gap:10px;padding:12px;display:flex}
.stt-formHeader{flex-direction:column;gap:2px;display:flex}
.stt-formHeader strong{color:var(--dsw-alias-label-primary);font-size:14px}
.stt-formHeader span{color:var(--dsw-alias-label-tertiary);font-size:12px}
.stt-field{flex-direction:column;gap:4px;display:flex}
.stt-fieldLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600}
.stt-field input,.stt-field select,.stt-field textarea{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;min-width:0;padding:6px 10px;outline:none}
.stt-field input:focus,.stt-field select:focus,.stt-field textarea:focus{border-color:var(--dsw-alias-state-business-primary)}
.stt-field textarea{resize:vertical;font-family:var(--dsw-font-markdown-code-block)}
.stt-fieldHint{color:var(--dsw-alias-label-tertiary);font-size:11px}
.stt-error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px}
.stt-formActions{justify-content:flex-end;gap:8px;display:flex}
.stt-delete{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);cursor:pointer;flex:none;border-radius:999px;margin-left:auto;padding:1px 8px;font-size:11px;line-height:18px}
.stt-delete:hover{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.stt-delete[data-armed=true]{background:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-bg-base)}
.stt-delete:disabled{opacity:.6;cursor:default}
.stt-tag[data-tone=persisted]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);color:var(--dsw-alias-state-success-primary)}
.stt-tag[data-tone=managed]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent);color:var(--dsw-alias-state-business-primary)}
@media (prefers-reduced-motion:reduce){.stt-tab{transition:none}}
`;
  document.head.appendChild(style);
  return () => style.remove();
}

/** Required client services: the slot registry and the locale service. */
export const inject = ["slots", "locale"];

/**
 * Client plugin body: register the Skills and MCP tabs into the Plugins
 * settings section.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => injectStyles(), "dsh-settings-tabs: styles");
  ctx.effect(
    () =>
      ctx.locale.register(NS, {
        zh,
        en,
      }),
    "dsh-settings-tabs: dictionaries",
  );
  const t = ctx.locale.bind(NS);
  ctx.slots.inject("settings.plugins.tab", () =>
    ctx.slots.register({
      name: "settings.plugins.tab",
      id: "skills",
      order: 20,
      label: () => t("skillsTab"),
      locale: NS,
      inject: () => ({ list: listSkills }),
    }, SkillsTab),
  );
  ctx.slots.inject("settings.plugins.tab", () =>
    ctx.slots.register({
      name: "settings.plugins.tab",
      id: "mcp",
      order: 30,
      label: () => t("mcpTab"),
      locale: NS,
      inject: () => ({ list: listMcpServers }),
    }, McpTab),
  );
}
