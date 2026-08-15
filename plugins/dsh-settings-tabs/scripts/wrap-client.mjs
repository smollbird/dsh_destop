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
 * The compiled client must be fully self-contained: every package import is
 * `import type` (erased by tsc) except `react` / `react/jsx-runtime`, which
 * are rewritten here into `require(...)` calls against the loader's static
 * module table (the shell seeds both words), so the browser module never
 * leaves the __ModuleLoader__ module table.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const clientPath = path.join(root, "lib", "client.js");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const id = pkg.name;

let src = fs.readFileSync(clientPath, "utf8");
if (/window\.__ModuleLoader__\.load/.test(src)) {
  console.log("client.js already wrapped; skipping");
  process.exit(0);
}

// 1) react 运行时导入 → 模块表 require（loader 的 factory 参数提供 require）。
//    `import { jsx as _jsx }` 必须改写为解构的 `{ jsx: _jsx }`——`as` 只属于
//    import 语法，直接照抄会产出非法的解构模式。
src = src.replace(
  /^import\s*\{([\s\S]*?)\}\s*from\s*["'](react(?:\/jsx-runtime)?)["'];\s*$/gm,
  (_match, names, spec) => {
    const destructured = names
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/\s+as\s+/, ": "))
      .join(", ");
    return `const { ${destructured} } = require("${spec}");`;
  },
);

// 2) 剩余的运行时 import（应有且仅有 type imports，已被 tsc 擦除）——残留即构建错误
const leftover = src.match(/^import\s/m);
if (leftover) {
  console.error(`wrap-client: unexpected runtime import remains in ${clientPath}:`);
  console.error(src.slice(leftover.index, leftover.index + 200));
  process.exit(1);
}

// 3) 剥掉顶层 `export ` 关键字（apply / inject / 类型擦除后不应再有其他导出）
const body = src.replace(/^export /gm, "");

const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(id)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
\t\texports.apply = apply;
\t\texports.inject = inject;
\t\treturn module.exports;
\t}
});
`;

fs.writeFileSync(clientPath, wrapped);
console.log(`wrapped ${id} client module -> ${path.relative(root, clientPath)}`);
