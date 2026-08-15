/**
 * Slot/locale contract declarations for dsh-settings-tabs.
 *
 * The settings domain owns the `settings.plugins.tab` slot type (declared by
 * `@deepseek-ai/dsh-client-ui-settings/client`); this plugin only needs to
 * declare its own locale namespace so `ctx.locale.register(NS, …)` and the
 * registration's `locale:` seat typecheck. Script file on purpose.
 */

/** Key union of the dsh-settings-tabs locale dictionary. */
type SkillsMcpLocaleKey =
  | "skillsTab"
  | "mcpTab"
  | "retry"
  | "search"
  | "count"
  | "empty"
  | "emptySearch"
  | "skillsLoading"
  | "skillsError"
  | "skillsEmpty"
  | "skillsEmptySearch"
  | "skillsCatalog"
  | "modelInvocable"
  | "userOnly"
  | "mcpLoading"
  | "mcpError"
  | "mcpEmpty"
  | "mcpEmptySearch"
  | "mcpServers"
  | "enabled"
  | "disabled"
  | "phase"
  | "entry"
  | "transport"
  | "target"
  | "unobserved"
  | "pending"
  | "loadingPhase"
  | "active"
  | "failed"
  | "disposed"
  | "unloading";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    /** dsh-settings-tabs tab copy (Skills + MCP tabs). */
    "settings.skillsMcp": SkillsMcpLocaleKey;
  }
}
