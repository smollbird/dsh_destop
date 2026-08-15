/**
 * Wrap the tsc ESM output of src/client.ts into the browser module format the
 * dsh-client-modules loader expects:
 *
 *   window.__ModuleLoader__.load({ id: "<package>", factory: (require) => {
 *     var module = { exports: {} }; var exports = module.exports;
 *     ...commonjs body...
 *     exports.apply = apply; exports.inject = inject; return module.exports;
 *   }});
 *
 * The compiled client must be fully self-contained (no runtime require): all
 * package imports are `import type` (erased by tsc), and the one runtime
 * value import (./iconfont.js — the embedded icon font base64) is inlined
 * here so the browser module never leaves the __ModuleLoader__ module table.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const clientPath = path.join(root, "lib", "client.js");
const iconfontPath = path.join(root, "lib", "iconfont.js");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const id = pkg.name;

let src = fs.readFileSync(clientPath, "utf8");
if (/window\.__ModuleLoader__\.load/.test(src)) {
  console.log("client.js already wrapped; skipping");
  process.exit(0);
}

// 1) 内联 iconfont（tsc ESM → CJS const），插到模块体顶部
let inline = "";
if (fs.existsSync(iconfontPath)) {
  const iconfont = fs
    .readFileSync(iconfontPath, "utf8")
    .replace(/^export /gm, "");
  inline = `${iconfont}\n`;
}

// 2) 去掉对 ./iconfont.js 的运行时 import（type imports 已被 tsc 擦除）
src = src.replace(/^import\s*\{[^}]*\}\s*from\s*["'][^"']+["'];\s*$/gm, "");

// 3) 剥掉顶层 `export ` 关键字（apply / inject）
const body = src.replace(/^export /gm, "");

const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(id)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${inline}${body}
\t\texports.apply = apply;
\t\texports.inject = inject;
\t\treturn module.exports;
\t}
});
`;

fs.writeFileSync(clientPath, wrapped);
console.log(`wrapped ${id} client module -> ${path.relative(root, clientPath)}`);
