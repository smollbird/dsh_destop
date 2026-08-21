window.__ModuleLoader__.load({
	id: "dsh-settings-tabs",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const { jsx: _jsx, jsxs: _jsxs, Fragment: _Fragment } = require("react/jsx-runtime");
const { useEffect, useMemo, useRef, useState } = require("react");
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
    skillsSync: "外部智能体同步",
    skillsSyncHint: "扫描 claude / codex / opencode / cursor / .agents / .agent（含项目根）的技能目录，一键以符号链接安装到 ~/.dsh/skills。",
    skillsSyncLoading: "正在扫描外部技能目录…",
    skillsSyncError: "暂时无法扫描外部技能目录。",
    skillsSyncEmpty: "未发现外部技能。",
    skillsSyncAgent: "来源",
    skillInstalled: "已安装",
    skillInstall: "安装",
    skillInstallAll: "一键安装",
    skillInstalling: "安装中…",
    skillInstallBusy: "安装中…",
    skillUninstall: "移除",
    skillUninstallBusy: "移除中…",
    skillInstallError: "操作失败：{error}",
    skillInstallAllEmpty: "没有可安装的外部技能。",
    skillInstallAllDone: "已安装 {installed} 项，跳过 {skipped} 项。",
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
    mcpEnv: "环境变量 / 请求头（每行 KEY=VALUE，可留空）",
    mcpEnvHint: "stdio 作为进程环境变量；streamable-http 作为请求头（兼容 cursor/claude/opencode 的 headers 配置）。",
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
    mcpToggleEnable: "启用",
    mcpToggleDisable: "禁用",
    mcpToggling: "切换中…",
    mcpToggleError: "切换失败：{error}",
    mcpConnChecking: "正在检查连通性…",
    mcpConnOk: "连通正常",
    mcpConnFail: "连接失败",
    mcpConnUnknown: "未检查",
    mcpConnDisabled: "已禁用",
    mcpConnManual: "手动检查",
    mcpApplyEnv: "自动补全环境",
    mcpApplyingEnv: "补全中…",
    mcpApplyEnvOk: "环境已补全（重启后对运行中的实例生效）",
    mcpApplyEnvFailed: "环境补全失败：{error}",
    mcpConnStopped: "自动检查已停止（连续 5 次失败）",
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
    mcpSync: "外部智能体同步",
    mcpSyncHint: "扫描 claude / opencode / codex / cursor 的 MCP 配置，一键导入（写入 profile 的 cordis.patch.yml）。",
    mcpSyncLoading: "正在扫描外部 MCP 配置…",
    mcpSyncError: "暂时无法扫描外部 MCP 配置。",
    mcpSyncEmpty: "未发现外部 MCP 配置。",
    mcpExistsInDsh: "DSH 已配置",
    mcpImport: "导入",
    mcpImportAll: "一键安装",
    mcpImporting: "导入中…",
    mcpImportBusy: "导入中…",
    mcpImportError: "导入失败：{error}",
    mcpImportAllEmpty: "没有可导入的外部 MCP 配置。",
    mcpImportAllDone: "已导入 {installed} 项，跳过 {skipped} 项。",
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
    skillsSync: "External agent sync",
    skillsSyncHint: "Scans claude / codex / opencode / cursor / .agents / .agent (incl. project root) skill directories; one click symlinks into ~/.dsh/skills.",
    skillsSyncLoading: "Scanning external skill directories…",
    skillsSyncError: "External skill directories are temporarily unavailable.",
    skillsSyncEmpty: "No external skills found.",
    skillsSyncAgent: "Source",
    skillInstalled: "Installed",
    skillInstall: "Install",
    skillInstallAll: "Install all",
    skillInstalling: "Installing…",
    skillInstallBusy: "Installing…",
    skillUninstall: "Remove",
    skillUninstallBusy: "Removing…",
    skillInstallError: "Operation failed: {error}",
    skillInstallAllEmpty: "Nothing to install.",
    skillInstallAllDone: "Installed {installed}, skipped {skipped}.",
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
    mcpEnv: "Env vars / headers (one KEY=VALUE per line, optional)",
    mcpEnvHint: "stdio: process env; streamable-http: request headers (compatible with cursor/claude/opencode headers config).",
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
    mcpToggleEnable: "Enable",
    mcpToggleDisable: "Disable",
    mcpToggling: "Toggling…",
    mcpToggleError: "Toggle failed: {error}",
    mcpConnChecking: "Checking connectivity…",
    mcpConnOk: "Reachable",
    mcpConnFail: "Unreachable",
    mcpConnUnknown: "Not checked",
    mcpConnDisabled: "Disabled",
    mcpConnManual: "Check now",
    mcpApplyEnv: "Fix environment",
    mcpApplyingEnv: "Applying…",
    mcpApplyEnvOk: "Environment fixed (live instance picks it up on next restart)",
    mcpApplyEnvFailed: "Fix environment failed: {error}",
    mcpConnStopped: "Auto-check stopped (5 consecutive failures)",
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
    mcpSync: "External agent sync",
    mcpSyncHint: "Scans claude / opencode / codex / cursor MCP configs; one click imports (writes the profile's cordis.patch.yml).",
    mcpSyncLoading: "Scanning external MCP configs…",
    mcpSyncError: "External MCP configs are temporarily unavailable.",
    mcpSyncEmpty: "No external MCP configs found.",
    mcpExistsInDsh: "In DSH",
    mcpImport: "Import",
    mcpImportAll: "Import all",
    mcpImporting: "Importing…",
    mcpImportBusy: "Importing…",
    mcpImportError: "Import failed: {error}",
    mcpImportAllEmpty: "Nothing to import.",
    mcpImportAllDone: "Imported {installed}, skipped {skipped}.",
};
/** Parse "KEY=VALUE" textarea lines into a string map (empty lines skipped). */
function parseEnvText(text) {
    const result = {};
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.length === 0)
            continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0)
            continue;
        result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
const listExternalSkills = (signal) => loadJson("/settings-tabs/sync/skills", signal).then((d) => d.skills);
const listExternalMcpServers = (signal) => loadJson("/settings-tabs/sync/mcp", signal).then((d) => d.servers);
/** POST/DELETE one external skill symlink; resolves with the mutation envelope. */
async function mutateSkillInstall(name, remove) {
    const res = await fetch(`/settings-tabs/skills/install?name=${encodeURIComponent(name)}`, {
        method: remove ? "DELETE" : "POST",
    });
    if (!res.ok)
        throw new Error(`/settings-tabs/skills/install failed: ${res.status}`);
    return (await res.json());
}
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
/** POST one connectivity probe for a server. */
async function checkMcpServer(serverName) {
    const res = await fetch(`/settings-tabs/mcp/check?serverName=${encodeURIComponent(serverName)}`, { method: "POST" });
    if (!res.ok)
        throw new Error(`POST /settings-tabs/mcp/check failed: ${res.status}`);
    return (await res.json());
}
/** POST one "apply env fix" for a failed stdio server. */
async function applyMcpEnv(serverName) {
    const res = await fetch(`/settings-tabs/mcp/env?serverName=${encodeURIComponent(serverName)}`, { method: "POST" });
    if (!res.ok)
        throw new Error(`POST /settings-tabs/mcp/env failed: ${res.status}`);
    return (await res.json());
}
/** POST one enable/disable toggle. */
async function toggleMcpServer(serverName, enabled) {
    const res = await fetch(`/settings-tabs/mcp/toggle?serverName=${encodeURIComponent(serverName)}&enabled=${enabled}`, { method: "POST" });
    if (!res.ok)
        throw new Error(`POST /settings-tabs/mcp/toggle failed: ${res.status}`);
    return (await res.json());
}
/**
 * Periodic connectivity checker for a set of enabled MCP servers.
 * Auto-checks every `intervalMs`; after `maxAutoFails` consecutive failures a
 * server is marked failed and its auto-checking stops (manual "check now" only).
 */
function useMcpConnectivity(servers, intervalMs, maxAutoFails) {
    const [status, setStatus] = useState({});
    const [autoStopped, setAutoStopped] = useState({});
    const failsRef = useRef({});
    const stoppedRef = useRef({});
    const serversRef = useRef(servers);
    serversRef.current = servers;
    const setOne = (serverName, value) => setStatus((prev) => ({ ...prev, [serverName]: value }));
    const runOne = async (server) => {
        if (!server.enabled) {
            setOne(server.serverName, "disabled");
            return;
        }
        setOne(server.serverName, "checking");
        try {
            const result = await checkMcpServer(server.serverName);
            if (result.reachable) {
                failsRef.current[server.serverName] = 0;
                setOne(server.serverName, "ok");
            }
            else {
                failsRef.current[server.serverName] = (failsRef.current[server.serverName] ?? 0) + 1;
                setOne(server.serverName, "fail");
            }
        }
        catch {
            failsRef.current[server.serverName] = (failsRef.current[server.serverName] ?? 0) + 1;
            setOne(server.serverName, "fail");
        }
    };
    const checkNow = (server) => void runOne(server);
    // One round over all servers we are still auto-checking.
    const runRound = async () => {
        for (const server of serversRef.current) {
            if (!server.enabled)
                continue;
            if (stoppedRef.current[server.serverName])
                continue;
            await runOne(server);
        }
        // After the round, stop auto-checking any server that has failed maxAutoFails in a row.
        let changed = false;
        for (const server of serversRef.current) {
            const fails = failsRef.current[server.serverName] ?? 0;
            if (!stoppedRef.current[server.serverName] && fails >= maxAutoFails) {
                stoppedRef.current[server.serverName] = true;
                changed = true;
            }
        }
        if (changed)
            setAutoStopped({ ...stoppedRef.current });
    };
    useEffect(() => {
        void runRound();
        const timer = window.setInterval(() => void runRound(), intervalMs);
        return () => window.clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return { status, autoStopped, checkNow };
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
/** Shared section wrapper: title + hint + async content. */
function SectionShell(props) {
    const { t, state, retry } = props;
    return (_jsxs("section", { className: "stt-section", children: [_jsxs("div", { className: "stt-sectionHeader", children: [_jsx("h3", { children: t(props.titleKey) }), _jsx("span", { children: t(props.hintKey) })] }), state.status === "loading" ? _jsx("p", { className: "stt-status", children: t(props.loadingKey) }) : null, state.status === "error" ? (_jsxs("div", { className: "stt-failure", children: [_jsx("p", { role: "alert", children: t(props.errorKey) }), _jsx("button", { type: "button", className: "stt-retry", onClick: retry, children: t("retry") })] })) : null, state.status === "ready" ? props.children : null] }));
}
/** The external-agent skill sync section (scan + one-click symlink install). */
function SkillsSyncSection(props) {
    const { state, retry } = useAsyncData(props.list);
    const [busy, setBusy] = useState(null);
    const [allBusy, setAllBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    const t = props.t;
    const rows = state.status === "ready" ? state.data : [];
    const alreadyInstalled = rows.length - rows.filter((row) => !row.installed).length;
    const installAll = async () => {
        if (allBusy)
            return;
        const targets = rows.filter((row) => !row.installed);
        if (targets.length === 0) {
            setNotice(t("skillInstallAllEmpty"));
            return;
        }
        setAllBusy(true);
        setNotice(null);
        let installed = 0;
        for (const row of targets) {
            try {
                const result = await mutateSkillInstall(row.name, false);
                if (result.ok)
                    installed += 1;
            }
            catch {
                // counted as not-installed below
            }
        }
        setAllBusy(false);
        setNotice(t("skillInstallAllDone")
            .replace("{installed}", String(installed))
            .replace("{skipped}", String(alreadyInstalled + (targets.length - installed))));
        window.setTimeout(retry, 300);
    };
    const toggle = async (row) => {
        setBusy(row.name);
        try {
            const result = await mutateSkillInstall(row.name, row.installed);
            if (!result.ok) {
                window.alert(t("skillInstallError").replace("{error}", result.error ?? ""));
                return;
            }
            window.setTimeout(retry, 200);
        }
        catch (error) {
            window.alert(t("skillInstallError").replace("{error}", String(error)));
        }
        finally {
            setBusy(null);
        }
    };
    return (_jsx(SectionShell, { t: t, titleKey: "skillsSync", hintKey: "skillsSyncHint", state: state, retry: retry, loadingKey: "skillsSyncLoading", errorKey: "skillsSyncError", children: rows.length === 0 ? _jsx("p", { className: "stt-status", children: t("skillsSyncEmpty") }) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "stt-toolbar", children: [_jsx("button", { type: "button", className: "stt-primary", disabled: busy !== null || allBusy, onClick: () => void installAll(), children: allBusy ? t("skillInstalling") : t("skillInstallAll") }), notice !== null ? (_jsx("span", { className: "stt-note", role: "status", children: notice })) : null] }), _jsx("ul", { className: "stt-cards stt-compact", children: rows.map((row) => {
                        const rowBusy = busy === row.name;
                        return (_jsxs("li", { className: "stt-card stt-syncCard", "data-skill-sync": row.name, children: [_jsxs("div", { className: "stt-cardHeader", children: [_jsx("strong", { className: "stt-cardTitle", children: row.name }), _jsxs("span", { className: "stt-tag", "data-tone": "agent", title: row.agentDir, children: [t("skillsSyncAgent"), ": ", row.agent] }), row.installed ? (_jsx("span", { className: "stt-tag", "data-tone": "persisted", children: t("skillInstalled") })) : null, _jsx("button", { type: "button", className: "stt-import", "data-armed": row.installed ? "true" : undefined, disabled: busy !== null, onClick: () => void toggle(row), children: rowBusy ? (row.installed ? t("skillUninstallBusy") : t("skillInstallBusy")) : row.installed ? t("skillUninstall") : t("skillInstall") })] }), row.description.length > 0 ? _jsx("p", { className: "stt-cardBody", children: row.description }) : null] }, `${row.agent}:${row.name}`));
                    }) })] })) }));
}
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
    return (_jsxs(_Fragment, { children: [_jsx(SkillsSyncSection, { list: listExternalSkills, t: props.t }), _jsx(TabShell, { t: props.t, state: state, retry: retry, loadingKey: "skillsLoading", errorKey: "skillsError", query: query, onQuery: setQuery, titleKey: "skillsCatalog", count: rows.length, total: total, emptyKey: "skillsEmpty", emptySearchKey: "skillsEmptySearch", children: _jsx("ul", { className: "stt-cards", children: rows.map((skill) => (_jsxs("li", { className: "stt-card", "data-skill": skill.name, children: [_jsxs("div", { className: "stt-cardHeader", children: [_jsx("strong", { className: "stt-cardTitle", children: skill.name }), _jsx("span", { className: "stt-tag", "data-tone": skill.modelInvocable ? "model" : "user", title: skill.source, children: props.t(skill.modelInvocable ? "modelInvocable" : "userOnly") })] }), _jsx("p", { className: "stt-cardBody", children: skill.description }), skill.whenToUse !== undefined ? (_jsx("p", { className: "stt-cardHint", children: skill.whenToUse })) : null] }, skill.name))) }) })] }));
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
/** The external-agent MCP sync section (scan configs + one-click import). */
function McpSyncSection(props) {
    const { state, retry } = useAsyncData(props.list);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const t = props.t;
    const rows = state.status === "ready" ? state.data : [];
    const [allBusy, setAllBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    const doImport = async (row) => {
        const payload = row.transport === "stdio"
            ? { serverName: row.serverName, transport: "stdio", command: row.command ?? "", args: row.args ?? [], ...(row.env !== undefined ? { env: row.env } : {}) }
            : { serverName: row.serverName, transport: "streamable-http", url: row.url ?? "", ...(row.env !== undefined ? { env: row.env } : {}) };
        try {
            const result = await addMcpServer(payload);
            if (!result.ok) {
                if (result.code !== "duplicate") {
                    setError(t(mutationErrorKey(result.code)).replace("{error}", result.error ?? ""));
                }
                return result.code === "duplicate";
            }
            return true;
        }
        catch (err) {
            setError(t("mcpErrorUnknown").replace("{error}", String(err)));
            return false;
        }
    };
    const importSingle = async (row) => {
        setBusy(`${row.agent}:${row.serverName}`);
        setError(null);
        try {
            const imported = await doImport(row);
            if (imported) {
                props.onImported();
                window.setTimeout(retry, 300);
            }
        }
        finally {
            setBusy(null);
        }
    };
    const alreadyInDsh = rows.filter((row) => row.existsInDsh).length;
    const importAll = async () => {
        if (allBusy)
            return;
        // Dedupe by serverName: the DSH namespace is per-serverName, so keep the
        // first external entry per name and skip rows whose name already resolves
        // to DSH (existsInDsh) or to an earlier row in this batch.
        const seen = new Set();
        const targets = [];
        for (const row of rows) {
            if (seen.has(row.serverName))
                continue;
            seen.add(row.serverName);
            if (row.existsInDsh)
                continue;
            targets.push(row);
        }
        if (targets.length === 0) {
            setNotice(t("mcpImportAllEmpty"));
            return;
        }
        setAllBusy(true);
        setNotice(null);
        let imported = 0;
        for (const row of targets) {
            if (await doImport(row))
                imported += 1;
        }
        setAllBusy(false);
        setNotice(t("mcpImportAllDone")
            .replace("{installed}", String(imported))
            .replace("{skipped}", String(alreadyInDsh + (targets.length - imported))));
        props.onImported();
        window.setTimeout(retry, 300);
    };
    return (_jsx(SectionShell, { t: t, titleKey: "mcpSync", hintKey: "mcpSyncHint", state: state, retry: retry, loadingKey: "mcpSyncLoading", errorKey: "mcpSyncError", children: rows.length === 0 ? _jsx("p", { className: "stt-status", children: t("mcpSyncEmpty") }) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "stt-toolbar", children: [_jsx("button", { type: "button", className: "stt-primary", disabled: busy !== null || allBusy, onClick: () => void importAll(), children: allBusy ? t("mcpImporting") : t("mcpImportAll") }), notice !== null ? (_jsx("span", { className: "stt-note", role: "status", children: notice })) : null] }), error !== null ? (_jsx("p", { className: "stt-error", role: "alert", children: error })) : null, _jsx("ul", { className: "stt-cards stt-compact", children: rows.map((row) => {
                        const key = `${row.agent}:${row.serverName}`;
                        const rowBusy = busy === key;
                        return (_jsxs("li", { className: "stt-card stt-syncCard", "data-mcp-sync": row.serverName, children: [_jsxs("div", { className: "stt-cardHeader", children: [_jsx("strong", { className: "stt-cardTitle", children: row.serverName }), _jsxs("span", { className: "stt-tag", "data-tone": "agent", title: row.configPath, children: [t("skillsSyncAgent"), ": ", row.agent] }), _jsx("span", { className: "stt-tag", "data-tone": "transport", children: row.transport }), row.existsInDsh ? (_jsx("span", { className: "stt-tag", "data-tone": "persisted", children: t("mcpExistsInDsh") })) : null, _jsx("button", { type: "button", className: "stt-import", disabled: row.existsInDsh || busy !== null || allBusy, onClick: () => void importSingle(row), children: rowBusy ? t("mcpImportBusy") : t("mcpImport") })] }), row.transport === "stdio" && row.command !== undefined ? (_jsx("p", { className: "stt-cardBody stt-monospace", children: [row.command, ...(row.args ?? [])].join(" ") })) : row.url !== undefined ? (_jsx("p", { className: "stt-cardBody stt-monospace", children: row.url })) : null] }, key));
                    }) })] })) }));
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
    const [envText, setEnvText] = useState("");
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
            const env = parseEnvText(envText);
            const payload = transport === "stdio"
                ? {
                    serverName: name,
                    transport,
                    command: command.trim(),
                    args: argsText
                        .split(/\r?\n/)
                        .map((arg) => arg.trim())
                        .filter((arg) => arg.length > 0),
                    ...(env !== undefined ? { env } : {}),
                }
                : { serverName: name, transport, url: url.trim(), ...(env !== undefined ? { env } : {}) };
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
            setEnvText("");
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
    return (_jsxs("div", { className: "stt-tab", children: [_jsx(McpSyncSection, { list: listExternalMcpServers, t: t, onImported: retry }), _jsxs("div", { className: "stt-toolbar", children: [_jsx("button", { type: "button", className: "stt-primary", onClick: openForm, children: t("mcpAdd") }), notice !== null ? (_jsx("span", { className: "stt-note", role: "status", children: notice })) : null] }), formOpen ? (_jsxs("form", { className: "stt-form", onSubmit: (event) => {
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
                                } }), _jsx("span", { className: "stt-fieldHint", children: t("mcpUrlHint") })] })), _jsxs("label", { className: "stt-field", children: [_jsx("span", { className: "stt-fieldLabel", children: t("mcpEnv") }), _jsx("textarea", { rows: 2, value: envText, placeholder: "API_KEY=sk-...\nAUTH_TOKEN=abc", onChange: (event) => setEnvText(event.currentTarget.value) }), _jsx("span", { className: "stt-fieldHint", children: t("mcpEnvHint") })] }), formError !== null ? (_jsx("p", { className: "stt-error", role: "alert", children: formError })) : null, _jsxs("div", { className: "stt-formActions", children: [_jsx("button", { type: "button", className: "stt-retry", onClick: closeForm, disabled: saving, children: t("mcpCancel") }), _jsx("button", { type: "submit", className: "stt-primary", disabled: saving, children: saving ? t("mcpSaving") : t("mcpSave") })] })] })) : null, _jsx(TabShell, { t: t, state: state, retry: retry, loadingKey: "mcpLoading", errorKey: "mcpError", query: query, onQuery: setQuery, titleKey: "mcpServers", count: rows.length, total: total, emptyKey: "mcpEmpty", emptySearchKey: "mcpEmptySearch", children: _jsx(McpServerList, { rows: rows, t: t, deleteArm: deleteArm, setDeleteArm: setDeleteArm, deleting: deleting, confirmDelete: confirmDelete, onToggled: () => window.setTimeout(retry, 200) }) })] }));
}
/** One main-list MCP card with connectivity dot, enable/disable toggle, delete. */
function McpServerList(props) {
    const { rows, t } = props;
    const { status: connStatus, autoStopped, checkNow } = useMcpConnectivity(rows, 30_000, 5);
    const [toggling, setToggling] = useState(null);
    const [applying, setApplying] = useState(null);
    const [applyNotice, setApplyNotice] = useState(null);
    const applyEnv = async (server) => {
        setApplying(server.serverName);
        setApplyNotice(null);
        try {
            const result = await applyMcpEnv(server.serverName);
            if (result.ok) {
                setApplyNotice(result.pendingRestart ? t("mcpApplyEnvOk") : String(result.detail ?? t("mcpApplyEnvOk")));
            }
            else {
                setApplyNotice(t("mcpApplyEnvFailed").replace("{error}", String(result.error ?? "unknown")));
            }
        }
        catch (error) {
            setApplyNotice(t("mcpApplyEnvFailed").replace("{error}", String(error)));
        }
        finally {
            setApplying(null);
        }
    };
    const [toggleError, setToggleError] = useState({});
    const doToggle = async (server) => {
        setToggling(server.serverName);
        setToggleError((prev) => {
            const next = { ...prev };
            delete next[server.serverName];
            return next;
        });
        try {
            const result = await toggleMcpServer(server.serverName, !server.enabled);
            if (!result.ok) {
                setToggleError((prev) => ({ ...prev, [server.serverName]: t("mcpToggleError").replace("{error}", result.error ?? "") }));
                return;
            }
            props.onToggled();
        }
        catch (error) {
            setToggleError((prev) => ({ ...prev, [server.serverName]: t("mcpToggleError").replace("{error}", String(error)) }));
        }
        finally {
            setToggling(null);
        }
    };
    const connLabel = (server) => {
        if (!server.enabled)
            return t("mcpConnDisabled");
        const s = connStatus[server.serverName];
        if (s === "ok")
            return t("mcpConnOk");
        if (s === "fail") {
            return autoStopped[server.serverName] ? t("mcpConnStopped") : t("mcpConnFail");
        }
        if (s === "checking")
            return t("mcpConnChecking");
        return t("mcpConnUnknown");
    };
    return (_jsx("ul", { className: "stt-cards", children: rows.map((server) => {
            const status = phaseLabel(server.phase, t);
            const armed = props.deleteArm === server.serverName;
            const busy = props.deleting === server.serverName;
            const isToggling = toggling === server.serverName;
            const s = connStatus[server.serverName];
            const connState = !server.enabled ? "disabled" : s === "ok" ? "ok" : s === "fail" ? "fail" : s === "checking" ? "checking" : "unknown";
            return (_jsxs("li", { className: "stt-card", "data-mcp-server": server.entryId, children: [_jsxs("div", { className: "stt-cardHeader", children: [_jsx("strong", { className: "stt-cardTitle", children: server.serverName }), server.persistent ? (_jsx("span", { className: "stt-tag", "data-tone": "persisted", children: t("mcpPersisted") })) : null, server.managed ? (_jsx("span", { className: "stt-tag", "data-tone": "managed", children: t("mcpManaged") })) : null, _jsx("span", { className: "stt-tag", "data-tone": "transport", children: server.transport }), _jsx("span", { className: "stt-tag", "data-enabled": server.enabled ? "true" : "false", children: t(server.enabled ? "enabled" : "disabled") }), _jsx("button", { type: "button", className: `stt-dot${connState === "checking" ? " stt-dot-pulse" : ""}`, "data-conn": connState, role: "img", "aria-label": connLabel(server), title: connLabel(server), onClick: () => {
                                    if (connState === "fail" && autoStopped[server.serverName])
                                        checkNow(server);
                                } }), connState === "fail" && server.transport === "stdio" ? (_jsx("button", { type: "button", className: "stt-applyenv", disabled: applying === server.serverName, onClick: () => void applyEnv(server), children: applying === server.serverName ? t("mcpApplyingEnv") : t("mcpApplyEnv") })) : null, applyNotice ? (_jsx("span", { className: "stt-applyenvNotice", role: "status", children: applyNotice })) : null, _jsx("button", { type: "button", className: "stt-toggle", "data-enabled": server.enabled ? "true" : "false", disabled: isToggling || busy, onClick: () => void doToggle(server), children: isToggling ? t("mcpToggling") : server.enabled ? t("mcpToggleDisable") : t("mcpToggleEnable") }), _jsx("button", { type: "button", className: "stt-delete", "data-armed": armed ? "true" : undefined, disabled: busy, onClick: () => props.confirmDelete(server), children: busy ? t("mcpDeleting") : armed ? t("mcpDeleteConfirm") : t("mcpDelete") })] }), toggleError[server.serverName] !== undefined ? (_jsx("p", { className: "stt-error", role: "alert", children: toggleError[server.serverName] })) : null, server.target.length > 0 ? (_jsx("p", { className: "stt-cardBody stt-monospace", children: server.target })) : null, server.env !== undefined && Object.keys(server.env).length > 0 ? (_jsx("p", { className: "stt-cardHint stt-monospace", title: JSON.stringify(server.env), children: Object.keys(server.env).join(", ") })) : null, _jsxs("dl", { className: "stt-details", children: [_jsxs("div", { children: [_jsx("dt", { children: t("entry") }), _jsx("dd", { className: "stt-monospace", children: server.entryId })] }), _jsxs("div", { children: [_jsx("dt", { children: t("phase") }), _jsx("dd", { children: status })] })] })] }, server.entryId));
        }) }));
}
/** ------------------------------------------------------------------ */
/* 插件装配                                                            */
/* ------------------------------------------------------------------ */
/** Inject the tab stylesheet once. */
function injectStyles() {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-settings-tabs";
    style.textContent = `
.stt-tab{max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:20px;display:flex}
.stt-section{border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-base) 55%,transparent);border-radius:12px;flex-direction:column;gap:10px;padding:12px;display:flex}
.stt-sectionHeader{flex-direction:column;gap:2px;display:flex}
.stt-sectionHeader h3{margin:0;font-size:13px;font-weight:600}
.stt-sectionHeader span{color:var(--dsw-alias-label-tertiary);font-size:12px}
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
.stt-tag[data-tone=transport]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);color:var(--dsw-alias-state-success-primary)}
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
.stt-delete{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-tertiary);cursor:pointer;flex:none;border-radius:999px;margin-left:auto;padding:3px 12px;font-size:12px;line-height:20px}
.stt-delete:hover{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.stt-delete[data-armed=true]{background:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-bg-base)}
.stt-delete:disabled{opacity:.6;cursor:default}
.stt-tag[data-tone=persisted]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent);color:var(--dsw-alias-state-success-primary)}
.stt-tag[data-tone=managed]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent);color:var(--dsw-alias-state-business-primary)}
.stt-tag[data-tone=agent]{background:var(--dsw-alias-badge-bg-l2);color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font-markdown-code-block)}
.stt-cards.stt-compact{max-height:320px;overflow-y:auto;padding-right:4px}
.stt-syncCard{padding:8px 12px}
.stt-import{border:1px solid var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-bg-base);cursor:pointer;flex:none;border-radius:999px;margin-left:auto;padding:3px 12px;font-size:12px;line-height:20px}
.stt-import:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent)}
.stt-import[data-armed=true]{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.stt-import[data-armed=true]:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent)}
.stt-import:disabled{opacity:.5;cursor:default}
.stt-dot{width:10px;height:10px;border-radius:50%;border:0;flex:none;margin-left:auto;cursor:default;padding:0}
.stt-dot[data-conn=ok]{background:var(--dsw-alias-state-success-primary)}
.stt-dot[data-conn=fail]{background:var(--dsw-alias-state-error-primary)}
.stt-dot[data-conn=disabled]{background:var(--dsw-alias-label-caption)}
.stt-dot[data-conn=unknown]{background:var(--dsw-alias-border-l2)}
.stt-dot[data-conn=fail]{cursor:pointer}
.stt-dot.stt-dot-pulse{animation:stt-dot-pulse 1.1s ease-in-out infinite}
.stt-applyenv{margin-left:8px;padding:2px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.4));background:transparent;color:var(--dsw-alias-label-secondary,inherit);font-size:12px;cursor:pointer;flex:none}
.stt-applyenv:hover:not(:disabled){border-color:var(--dsw-alias-state-success-primary,#4caf50);color:var(--dsw-alias-state-success-primary,#4caf50)}
.stt-applyenv:disabled{opacity:.5;cursor:wait}
.stt-applyenvNotice{font-size:11px;color:var(--dsw-alias-label-caption,inherit);margin-left:8px}
@keyframes stt-dot-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.stt-toggle{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);cursor:pointer;flex:none;border-radius:999px;padding:3px 12px;font-size:12px;line-height:20px}
.stt-toggle[data-enabled=true]{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 50%,transparent)}
.stt-toggle[data-enabled=true]:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 14%,transparent)}
.stt-toggle[data-enabled=false]{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 50%,transparent)}
.stt-toggle[data-enabled=false]:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent)}
.stt-toggle:disabled{opacity:.6;cursor:default}
@media (prefers-reduced-motion:reduce){.stt-tab{transition:none}.stt-dot.stt-dot-pulse{animation:none}}
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
