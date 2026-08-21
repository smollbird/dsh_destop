/**
 * dsh-settings-tabs — host half.
 *
 * Serves the datasets and mutations the Web Settings tabs render:
 *
 *   GET    /settings-tabs/skills — the skill catalog of the default preset
 *           (`ctx.skills` + `agentPresets.standingKeyFor()`), resolved against
 *           the host process cwd.
 *   GET    /settings-tabs/mcp    — every configured MCP client instance from
 *           the Cordis Loader entries, plus persistence flags.
 *   POST   /settings-tabs/mcp    — quick-add one MCP server: writes the
 *           `- insert:` row into the profile's user patch layer
 *           (`<profile dir>/cordis.patch.yml`) for the next boot AND hot
 *           creates the loader entry so it works immediately (the web
 *           profile ships with HMR disabled, so there is no live watcher;
 *           this mirrors the super-injector's dual-path assembly).
 *   DELETE /settings-tabs/mcp?serverName=… — remove the patch row and, when
 *           the live entry lives at loader root, stop it now. Entries that
 *           came from the patch layer (id contains ":") cannot be removed
 *           live without materializing the whole composed tree into the base
 *           cordis.yml, so those stay until the next restart (the response
 *           reports `pendingRestart: true`).
 *
 * MCP servers are loader plugin instances — NOT settings namespaces — so the
 * quick-add syncs to cordis.patch.yml, never to settings.yaml.
 */
import type { Context } from "@deepseek-ai/cordis";
/** Public projection of one skill catalog row. */
export interface SkillView {
    /** Kebab-case identifier the user references as `/name` in the composer. */
    name: string;
    /** Short routing description. */
    description: string;
    /** Optional extra routing guidance. */
    whenToUse?: string;
    /** Whether the model catalog may invoke the skill. */
    modelInvocable: boolean;
    /** Whether the user may invoke the skill (`/name` in the composer). */
    userInvocable: boolean;
    /** Skill source label (filesystem, runtime, …). */
    source: string;
}
/** Public projection of one configured MCP client instance. */
export interface McpServerView {
    /** Loader entry id (the `mcp-<name>` row at loader root, or `include:…` from the patch layer). */
    entryId: string;
    /** Unique server namespace owning the `mcp__<serverName>__*` tools. */
    serverName: string;
    /** Transport: `stdio` or `streamable-http`. */
    transport: string;
    /** Human-readable target: URL for streamable-http, `command args…` for stdio. */
    target: string;
    /** Whether the loader entry is enabled (never `disabled` in config). */
    enabled: boolean;
    /** Fiber phase label (pending/loading/active/failed/disposed/unloading) or null when unobserved. */
    phase: string | null;
    /** Whether a matching row exists in the profile patch layer (survives restarts). */
    persistent: boolean;
    /** Whether this entry was created by the quick-add (id `mcp-<name>` at loader root). */
    managed: boolean;
    /** Extra environment variables / response headers carried by the config. */
    env?: Record<string, string>;
}
/** Required host services: the web route registry and the loader (entry enumeration + hot create/remove). */
export declare const inject: string[];
/**
 * Mount the /settings-tabs routes.
 * @param ctx - host context carrying the webServer and loader services.
 */
export declare function apply(ctx: Context): void;
