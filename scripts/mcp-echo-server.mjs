#!/usr/bin/env node
/**
 * mcp-echo-server — 极简 MCP stdio 服务器（JSON-RPC 2.0，换行分隔），
 * 用于在 dsh 设置面板「MCP」tab 的快速添加入口里测试 mcp-client 装配。
 *
 * 提供两个工具：
 *   echo <message>     原样回显
 *   now                当前 UTC 时间
 *
 * 用法（cordis.patch.yml 中的 mcp-client 条目示例）：
 *   - insert:
 *       - id: mcp-echo
 *         name: '@deepseek-ai/dsh-mcp-client'
 *         config:
 *           transport: stdio
 *           serverName: echo
 *           command: /usr/local/bin/node
 *           args: ['<本文件绝对路径>']
 */
import { createInterface } from "node:readline";

const tools = [
  {
    name: "echo",
    description: "Echo the message back verbatim.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
  {
    name: "now",
    description: "Current UTC time.",
    inputSchema: { type: "object", properties: {} },
  },
];

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = request;
  try {
    if (method === "initialize") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "mcp-echo-server", version: "0.1.0" },
        },
      });
      return;
    }
    if (method === "notifications/initialized" || method.startsWith("notifications/")) return;
    if (method === "ping") {
      send({ jsonrpc: "2.0", id, result: {} });
      return;
    }
    if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools } });
      return;
    }
    if (method === "tools/call") {
      const name = params?.name;
      const args = params?.arguments ?? {};
      if (name === "echo") {
        send({
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: `echo: ${args.message ?? ""}` }] },
        });
      } else if (name === "now") {
        send({
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: new Date().toISOString() }] },
        });
      } else {
        send({ jsonrpc: "2.0", id, error: { code: -32602, message: `unknown tool ${name}` } });
      }
      return;
    }
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } });
  } catch (error) {
    send({ jsonrpc: "2.0", id, error: { code: -32603, message: String(error) } });
  }
});
