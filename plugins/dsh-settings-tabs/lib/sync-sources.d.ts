/** One skill discovered in an external agent directory. */
export interface ExternalSkill {
    /** Which agent directory the skill was found in. */
    agent: string;
    /** Directory (skill folder) the skill lives in. */
    agentDir: string;
    /** Skill folder name (becomes the DSH skill name). */
    name: string;
    /** Absolute path of the skill folder. */
    dir: string;
    /** SKILL.md frontmatter description, if present. */
    description: string;
    /** Whether a DSH install location for this skill already exists. */
    installed: boolean;
}
/** Resolve `~/.dsh/skills` (or the env override) without touching the loader. */
export declare function dshSkillRoot(): string;
/** Whether a DSH skill with this name is already present (symlink or directory). */
export declare function isSkillInstalled(name: string): boolean;
/** Scan every external skill root; missing roots are skipped silently. */
export declare function listExternalSkills(): ExternalSkill[];
/** Install one external skill as a symlink into the DSH skill root. */
export declare function installSkill(name: string): {
    ok: boolean;
    error?: string;
};
/** Uninstall a previously symlinked skill (real directories are refused). */
export declare function uninstallSkill(name: string): {
    ok: boolean;
    error?: string;
};
/** One MCP server discovered in an external agent config. */
export interface ExternalMcpServer {
    agent: string;
    /** The external config file it came from. */
    configPath: string;
    serverName: string;
    /** Normalized transport; `remote` maps to streamable-http on import. */
    transport: "stdio" | "streamable-http";
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    /** Whether this server is already configured in DSH (by serverName). */
    existsInDsh?: boolean;
}
/** Scan every external MCP config; missing files are skipped silently. */
export declare function listExternalMcpServers(existsInDsh: (serverName: string) => boolean): ExternalMcpServer[];
