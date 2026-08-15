window.__ModuleLoader__.load({
	id: "dsh-settings-tabs",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const { jsx: _jsx, jsxs: _jsxs, Fragment: _Fragment } = require("react/jsx-runtime");
const { useEffect, useMemo, useState } = require("react");
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
const en = {
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
async function loadJson(url, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok)
        throw new Error(`GET ${url} failed: ${res.status}`);
    const data = (await res.json());
    if (!data.ok)
        throw new Error(data.error ?? `GET ${url} returned not-ok`);
    return data;
}
const listSkills = (signal) => loadJson("/settings-tabs/skills", signal).then((d) => d.skills);
const listMcpServers = (signal) => loadJson("/settings-tabs/mcp", signal).then((d) => d.servers);
/** POST one server; resolves with the mutation envelope (never throws on business codes). */
async function addMcpServer(payload) {
    const res = await fetch("/settings-tabs/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok)
        throw new Error(`POST /settings-tabs/mcp failed: ${res.status}`);
    return (await res.json());
}
/** DELETE one server by serverName; resolves with the mutation envelope. */
async function removeMcpServer(serverName) {
    const res = await fetch(`/settings-tabs/mcp?serverName=${encodeURIComponent(serverName)}`, {
        method: "DELETE",
    });
    if (!res.ok)
        throw new Error(`DELETE /settings-tabs/mcp failed: ${res.status}`);
    return (await res.json());
}
/** Load once per `request` bump; aborts on unmount and on retry. */
function useAsyncData(loader) {
    const [request, setRequest] = useState(0);
    const [state, setState] = useState({ status: "loading" });
    useEffect(() => {
        const controller = new AbortController();
        let current = true;
        Promise.resolve()
            .then(() => loader(controller.signal))
            .then((data) => {
            if (current)
                setState({ status: "ready", data });
        }, (error) => {
            if (current && !controller.signal.aborted)
                setState({ status: "error" });
        });
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
/** Shared loading/error/empty/search scaffolding for both tabs. */
function TabShell(props) {
    const { t, state, retry } = props;
    return (_jsxs("div", { className: "stt-tab", "aria-busy": state.status === "loading", children: [state.status === "loading" ? _jsx("p", { className: "stt-status", children: t(props.loadingKey) }) : null, state.status === "error" ? (_jsxs("div", { className: "stt-failure", children: [_jsx("p", { role: "alert", children: t(props.errorKey) }), _jsx("button", { type: "button", className: "stt-retry", onClick: retry, children: t("retry") })] })) : null, state.status === "ready" ? (_jsxs("div", { className: "stt-ready", children: [_jsxs("label", { className: "stt-search", children: [_jsx("span", { className: "stt-visuallyHidden", children: t("search") }), _jsx("input", { type: "search", value: props.query, placeholder: t("search"), "aria-label": t("search"), onChange: (event) => props.onQuery(event.currentTarget.value) })] }), _jsxs("div", { className: "stt-heading", children: [_jsx("h3", { children: t(props.titleKey) }), _jsx("span", { "data-count": props.count, children: t("count").replace("{count}", String(props.count)) })] }), props.total === 0 ? _jsx("p", { className: "stt-status", children: t(props.emptyKey) }) : null, props.total > 0 && props.count === 0 ? (_jsx("p", { className: "stt-status", children: t(props.emptySearchKey) })) : null, props.count > 0 ? props.children : null] })) : null] }));
}
/** ------------------------------------------------------------------ */
/* 技能 tab                                                           */
/* ------------------------------------------------------------------ */
/** Render the read-only skill catalog. */
function SkillsTab(props) {
    const { state, retry } = useAsyncData(props.list);
    const [query, setQuery] = useState("");
    const normalized = query.trim().toLocaleLowerCase();
    const rows = useMemo(() => state.status === "ready"
        ? state.data.filter((skill) => normalized.length === 0 ||
            skill.name.toLocaleLowerCase().includes(normalized) ||
            skill.description.toLocaleLowerCase().includes(normalized))
        : [], [normalized, state]);
    const total = state.status === "ready" ? state.data.length : 0;
    return (_jsx(TabShell, { t: props.t, state: state, retry: retry, loadingKey: "skillsLoading", errorKey: "skillsError", query: query, onQuery: setQuery, titleKey: "skillsCatalog", count: rows.length, total: total, emptyKey: "skillsEmpty", emptySearchKey: "skillsEmptySearch", children: _jsx("ul", { className: "stt-cards", children: rows.map((skill) => (_jsxs("li", { className: "stt-card", "data-skill": skill.name, children: [_jsxs("div", { className: "stt-cardHeader", children: [_jsx("strong", { className: "stt-cardTitle", children: skill.name }), _jsx("span", { className: "stt-tag", "data-tone": skill.modelInvocable ? "model" : "user", title: skill.source, children: props.t(skill.modelInvocable ? "modelInvocable" : "userOnly") })] }), _jsx("p", { className: "stt-cardBody", children: skill.description }), skill.whenToUse !== undefined ? (_jsx("p", { className: "stt-cardHint", children: skill.whenToUse })) : null] }, skill.name))) }) }));
}
/** ------------------------------------------------------------------ */
/* MCP tab                                                            */
/* ------------------------------------------------------------------ */
const PHASE_KEYS = {
    pending: "pending",
    loading: "loadingPhase",
    active: "active",
    failed: "failed",
    disposed: "disposed",
    unloading: "unloading",
};
function phaseLabel(phase, t) {
    return phase === null ? t("unobserved") : t(PHASE_KEYS[phase] ?? "unobserved");
}
/** Map a mutation business code to a locale key. */
function mutationErrorKey(code) {
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
function McpTab(props) {
    const { state, retry } = useAsyncData(props.list);
    const [query, setQuery] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [serverName, setServerName] = useState("");
    const [transport, setTransport] = useState("stdio");
    const [command, setCommand] = useState("");
    const [argsText, setArgsText] = useState("");
    const [url, setUrl] = useState("");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);
    const [formNote, setFormNote] = useState(null);
    const [deleteArm, setDeleteArm] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [notice, setNotice] = useState(null);
    const t = props.t;
    const normalized = query.trim().toLocaleLowerCase();
    const rows = useMemo(() => state.status === "ready"
        ? state.data.filter((server) => normalized.length === 0 ||
            server.serverName.toLocaleLowerCase().includes(normalized) ||
            server.entryId.toLocaleLowerCase().includes(normalized) ||
            server.target.toLocaleLowerCase().includes(normalized))
        : [], [normalized, state]);
    const total = state.status === "ready" ? state.data.length : 0;
    const openForm = () => {
        setFormOpen(true);
        setFormError(null);
        setFormNote(null);
    };
    const closeForm = () => {
        if (saving)
            return;
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
            const payload = transport === "stdio"
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
        }
        catch (error) {
            setFormError(t("mcpErrorUnknown").replace("{error}", String(error)));
        }
        finally {
            setSaving(false);
        }
    };
    const confirmDelete = async (server) => {
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
            setNotice(result.pendingRestart === true ? t("mcpPendingRestart") : null);
            window.setTimeout(retry, 200);
        }
        catch (error) {
            setNotice(t("mcpErrorUnknown").replace("{error}", String(error)));
        }
        finally {
            setDeleting(null);
        }
    };
    return (_jsxs("div", { className: "stt-tab", children: [_jsxs("div", { className: "stt-toolbar", children: [_jsx("button", { type: "button", className: "stt-primary", onClick: openForm, children: t("mcpAdd") }), notice !== null ? (_jsx("span", { className: "stt-note", role: "status", children: notice })) : null] }), formOpen ? (_jsxs("form", { className: "stt-form", onSubmit: (event) => {
                    event.preventDefault();
                    void submit();
                }, children: [_jsxs("div", { className: "stt-formHeader", children: [_jsx("strong", { children: t("mcpAddTitle") }), _jsx("span", { children: t("mcpAddHint") })] }), _jsxs("label", { className: "stt-field", children: [_jsx("span", { className: "stt-fieldLabel", children: t("mcpServerName") }), _jsx("input", { type: "text", value: serverName, autoFocus: true, placeholder: "my-server", onChange: (event) => {
                                    setServerName(event.currentTarget.value);
                                    setFormError(null);
                                } }), _jsx("span", { className: "stt-fieldHint", children: t("mcpServerNameHint") })] }), _jsxs("label", { className: "stt-field", children: [_jsx("span", { className: "stt-fieldLabel", children: t("mcpTransport") }), _jsxs("select", { value: transport, onChange: (event) => {
                                    setTransport(event.currentTarget.value === "streamable-http" ? "streamable-http" : "stdio");
                                    setFormError(null);
                                }, children: [_jsx("option", { value: "stdio", children: "stdio" }), _jsx("option", { value: "streamable-http", children: "streamable-http" })] }), _jsx("span", { className: "stt-fieldHint", children: t("mcpTransportHint") })] }), transport === "stdio" ? (_jsxs(_Fragment, { children: [_jsxs("label", { className: "stt-field", children: [_jsx("span", { className: "stt-fieldLabel", children: t("mcpCommand") }), _jsx("input", { type: "text", value: command, placeholder: "/usr/local/bin/node", onChange: (event) => {
                                            setCommand(event.currentTarget.value);
                                            setFormError(null);
                                        } }), _jsx("span", { className: "stt-fieldHint", children: t("mcpCommandHint") })] }), _jsxs("label", { className: "stt-field", children: [_jsx("span", { className: "stt-fieldLabel", children: t("mcpArgs") }), _jsx("textarea", { rows: 3, value: argsText, placeholder: "/path/to/server.mjs", onChange: (event) => setArgsText(event.currentTarget.value) }), _jsx("span", { className: "stt-fieldHint", children: t("mcpArgsHint") })] })] })) : (_jsxs("label", { className: "stt-field", children: [_jsx("span", { className: "stt-fieldLabel", children: t("mcpUrl") }), _jsx("input", { type: "text", value: url, placeholder: "https://mcp.example.com/sse", onChange: (event) => {
                                    setUrl(event.currentTarget.value);
                                    setFormError(null);
                                } }), _jsx("span", { className: "stt-fieldHint", children: t("mcpUrlHint") })] })), formError !== null ? (_jsx("p", { className: "stt-error", role: "alert", children: formError })) : null, _jsxs("div", { className: "stt-formActions", children: [_jsx("button", { type: "button", className: "stt-retry", onClick: closeForm, disabled: saving, children: t("mcpCancel") }), _jsx("button", { type: "submit", className: "stt-primary", disabled: saving, children: saving ? t("mcpSaving") : t("mcpSave") })] })] })) : null, _jsx(TabShell, { t: t, state: state, retry: retry, loadingKey: "mcpLoading", errorKey: "mcpError", query: query, onQuery: setQuery, titleKey: "mcpServers", count: rows.length, total: total, emptyKey: "mcpEmpty", emptySearchKey: "mcpEmptySearch", children: _jsx("ul", { className: "stt-cards", children: rows.map((server) => {
                        const status = phaseLabel(server.phase, t);
                        const armed = deleteArm === server.serverName;
                        const busy = deleting === server.serverName;
                        return (_jsxs("li", { className: "stt-card", "data-mcp-server": server.entryId, children: [_jsxs("div", { className: "stt-cardHeader", children: [_jsx("strong", { className: "stt-cardTitle", children: server.serverName }), server.persistent ? (_jsx("span", { className: "stt-tag", "data-tone": "persisted", children: t("mcpPersisted") })) : null, server.managed ? (_jsx("span", { className: "stt-tag", "data-tone": "managed", children: t("mcpManaged") })) : null, _jsx("span", { className: "stt-tag", "data-tone": "transport", children: server.transport }), _jsx("span", { className: "stt-tag", "data-enabled": server.enabled ? "true" : "false", children: t(server.enabled ? "enabled" : "disabled") }), _jsx("span", { className: "stt-phase", "data-phase": server.phase ?? "unobserved", role: "img", "aria-label": status, title: status }), _jsx("button", { type: "button", className: "stt-delete", "data-armed": armed ? "true" : undefined, disabled: busy, onClick: () => void confirmDelete(server), children: busy ? t("mcpDeleting") : armed ? t("mcpDeleteConfirm") : t("mcpDelete") })] }), server.target.length > 0 ? (_jsx("p", { className: "stt-cardBody stt-monospace", children: server.target })) : null, _jsxs("dl", { className: "stt-details", children: [_jsxs("div", { children: [_jsx("dt", { children: t("entry") }), _jsx("dd", { className: "stt-monospace", children: server.entryId })] }), _jsxs("div", { children: [_jsx("dt", { children: t("phase") }), _jsx("dd", { children: status })] })] })] }, server.entryId));
                    }) }) })] }));
}
/** ------------------------------------------------------------------ */
/* 插件装配                                                            */
/* ------------------------------------------------------------------ */
/** Inject the tab stylesheet once. */
function injectStyles() {
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
const inject = ["slots", "locale"];
/**
 * Client plugin body: register the Skills and MCP tabs into the Plugins
 * settings section.
 * @param ctx - client root context.
 */
function apply(ctx) {
    ctx.effect(() => injectStyles(), "dsh-settings-tabs: styles");
    ctx.effect(() => ctx.locale.register(NS, {
        zh,
        en,
    }), "dsh-settings-tabs: dictionaries");
    const t = ctx.locale.bind(NS);
    ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
        name: "settings.plugins.tab",
        id: "skills",
        order: 20,
        label: () => t("skillsTab"),
        locale: NS,
        inject: () => ({ list: listSkills }),
    }, SkillsTab));
    ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
        name: "settings.plugins.tab",
        id: "mcp",
        order: 30,
        label: () => t("mcpTab"),
        locale: NS,
        inject: () => ({ list: listMcpServers }),
    }, McpTab));
}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
