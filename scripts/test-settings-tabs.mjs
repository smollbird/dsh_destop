// Host-half route test: run apply() from the built lib against a fake cordis
// context (stub services: webServer capture, loader with create/remove
// recording, skills registry, agentPresets, include entry) and assert the
// /settings-tabs/* GET/POST/DELETE responses, including the patch-file sync.
import { apply, inject } from "../plugins/dsh-settings-tabs/lib/index.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// --- fixtures ------------------------------------------------------------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stt-test-"));
const baseFile = path.join(tmp, "cordis.yml");
const patchFile = path.join(tmp, "cordis.patch.yml");
fs.writeFileSync(
  patchFile,
  `# test patch layer
[]`,
);

const fakeSkills = {
  list: async ({ cwd, scope }) => {
    assert.equal(cwd, process.cwd());
    assert.ok(scope !== undefined, "scope must be passed");
    return [
      {
        name: "find-skills",
        description: "Discover skills",
        whenToUse: "When the user asks how to do X",
        invocation: { modelInvocable: true, userInvocable: true },
        source: "user-agents",
      },
    ];
  },
};

const fakePresets = {
  standingKeyFor: async () => ({ standing: "standard" }),
};

const created = [];
const removed = [];
const liveEntries = [
  {
    id: "include",
    options: {
      name: "@deepseek-ai/dsh-app-boot",
      config: { path: pathToFileURL(baseFile).href },
    },
    disabled: false,
    fiber: undefined,
    subtree: {},
  },
  {
    id: "mcp-runtime",
    options: {
      name: "@deepseek-ai/dsh-mcp-client",
      config: { transport: "stdio", serverName: "runtime", command: "npx" },
    },
    disabled: false,
    fiber: { state: 2 },
  },
  {
    id: "include:mcp-persisted",
    options: {
      name: "@deepseek-ai/dsh-mcp-client",
      config: { transport: "streamable-http", serverName: "persisted", url: "https://mcp.example.com/sse" },
    },
    disabled: false,
    fiber: { state: 2 },
  },
];
const fakeLoader = {
  entries: () => liveEntries,
  create: async (options) => {
    created.push(options);
    liveEntries.push({
      id: options.id ?? "generated",
      options: { name: options.name, config: options.config },
      disabled: false,
      fiber: { state: 2 },
    });
    return options.id ?? "generated";
  },
  remove: async (id) => {
    removed.push(id);
    const index = liveEntries.findIndex((entry) => entry.id === id);
    if (index >= 0) liveEntries.splice(index, 1);
  },
};

let capturedHandler = null;
const fakeCtx = {
  get(name) {
    if (name === "skills") return fakeSkills;
    if (name === "agentPresets") return fakePresets;
    if (name === "fs") return {};
    return undefined;
  },
  webServer: {
    register(route) {
      capturedHandler = route.handler;
    },
  },
  loader: fakeLoader,
  effect(fn) {
    fn();
  },
};

// --- helpers -------------------------------------------------------------

function response() {
  const res = { status: 0, body: "", headers: {} };
  res.writeHead = (status, headers) => {
    res.status = status;
    res.headers = headers ?? {};
  };
  res.end = (body) => {
    res.body = body;
  };
  return res;
}
async function request(method, pathname, body) {
  const res = response();
  const req = {
    method,
    url: pathname,
    on: (event, handler) => {
      if (event === "data" && body !== undefined) handler(Buffer.from(JSON.stringify(body)));
      if (event === "end") handler();
    },
    destroy() {},
  };
  await capturedHandler(req, res);
  await new Promise((resolve) => setTimeout(resolve, 30)); // flush fire-and-forget skills
  return { status: res.status, body: res.body === "" ? null : JSON.parse(res.body) };
}
const get = (url) => request("GET", url);
const post = (url, body) => request("POST", url, body);
const del = (url) => request("DELETE", url);

// --- run -----------------------------------------------------------------

apply(fakeCtx);
assert.deepEqual(inject, ["webServer", "loader"], "host inject list");

// skills
const skills = await get("/settings-tabs/skills");
assert.equal(skills.body.ok, true);
assert.equal(skills.body.skills.length, 1);
assert.equal(skills.body.skills[0].name, "find-skills");

// list with persistence flags
const list1 = await get("/settings-tabs/mcp");
assert.equal(list1.body.ok, true);
assert.equal(list1.body.patchFile, patchFile);
const byName = Object.fromEntries(list1.body.servers.map((s) => [s.serverName, s]));
assert.equal(byName.runtime.persistent, false);
assert.equal(byName.runtime.managed, true);
assert.equal(byName.runtime.phase, "active");
assert.equal(byName.persisted.persistent, false, "no patch row yet");
assert.equal(byName.persisted.transport, "streamable-http");

// add (stdio)
const add = await post("/settings-tabs/mcp", {
  serverName: "echo",
  transport: "stdio",
  command: "/usr/local/bin/node",
  args: ["/tmp/echo.mjs", "extra"],
});
assert.equal(add.body.ok, true, JSON.stringify(add.body));
assert.equal(add.body.server.persistent, true);
assert.deepEqual(created, [
  {
    id: "mcp-echo",
    name: "@deepseek-ai/dsh-mcp-client",
    config: { transport: "stdio", serverName: "echo", command: "/usr/local/bin/node", args: ["/tmp/echo.mjs", "extra"] },
  },
]);
const patchText = fs.readFileSync(patchFile, "utf8");
assert.ok(patchText.startsWith("# test patch layer"), "header preserved");
assert.ok(patchText.includes("serverName: echo"), "patch row written");

// list now flags it persistent
const list2 = await get("/settings-tabs/mcp");
assert.equal(list2.body.servers.find((s) => s.serverName === "echo").persistent, true);

// duplicate rejected
const dup = await post("/settings-tabs/mcp", { serverName: "echo", transport: "stdio", command: "/bin/echo" });
assert.equal(dup.body.ok, false);
assert.equal(dup.body.code, "duplicate");

// validation
const badName = await post("/settings-tabs/mcp", { serverName: "bad name!", transport: "stdio", command: "/bin/echo" });
assert.equal(badName.body.code, "invalid-server-name");
const badUrl = await post("/settings-tabs/mcp", { serverName: "httpy", transport: "streamable-http", url: "nope" });
assert.equal(badUrl.body.code, "invalid-url");
const noCmd = await post("/settings-tabs/mcp", { serverName: "cmdless", transport: "stdio", command: "  " });
assert.equal(noCmd.body.code, "invalid-command");

// delete root-level entry
const delRoot = await del("/settings-tabs/mcp?serverName=echo");
assert.equal(delRoot.body.ok, true);
assert.equal(delRoot.body.pendingRestart, false);
assert.deepEqual(removed, ["mcp-echo"]);
assert.ok(!fs.readFileSync(patchFile, "utf8").includes("serverName: echo"), "patch row removed");

// delete include-level entry -> pendingRestart, no live removal
const delInclude = await del("/settings-tabs/mcp?serverName=persisted");
assert.equal(delInclude.body.ok, true);
assert.equal(delInclude.body.pendingRestart, true);
assert.deepEqual(removed, ["mcp-echo"], "include-level entry not removed live");

// 404
const nf = await get("/settings-tabs/nope");
assert.equal(nf.status, 404);

console.log("host route tests (GET/POST/DELETE + patch sync): PASS");
