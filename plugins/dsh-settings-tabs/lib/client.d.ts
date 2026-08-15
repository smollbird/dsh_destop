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
/** Required client services: the slot registry and the locale service. */
export declare const inject: string[];
/**
 * Client plugin body: register the Skills and MCP tabs into the Plugins
 * settings section.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
