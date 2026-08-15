"use strict";
/**
 * 打包前确保 vendor/node 存在（随包分发的 Node，用于 spawn dsh web）。
 * 开发模式仍可直接用系统 node；打包版必须自带 node。
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";
const dest = path.join(
  ROOT,
  "vendor",
  "node",
  isWin ? "node.exe" : path.join("bin", "node")
);

if (fs.existsSync(dest)) {
  console.log(`[ensure-vendor-node] 已存在: ${path.relative(ROOT, dest)}`);
  process.exit(0);
}

const nodeFromPath = execFileSync(isWin ? "where" : "which", ["node"], {
  encoding: "utf8",
}).trim().split(/\r?\n/)[0];

if (!nodeFromPath || !fs.existsSync(nodeFromPath)) {
  console.error(
    "[ensure-vendor-node] 未找到系统 node。请先安装 Node.js，或手动复制到 vendor/node。"
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(nodeFromPath, dest);
if (!isWin) fs.chmodSync(dest, 0o755);

console.log(`[ensure-vendor-node] 已复制 ${nodeFromPath} -> ${path.relative(ROOT, dest)}`);
