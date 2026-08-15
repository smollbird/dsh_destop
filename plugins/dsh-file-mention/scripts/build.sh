#!/usr/bin/env bash
# Build the dual-face plugin:
#   - host half: tsc ESM -> lib/index.js (loaded by the cordis loader)
#   - browser half: tsc ESM -> wrapped into the __ModuleLoader__.load format
#     -> lib/client.js (loaded by dsh-client-modules in the web GUI)
# Types resolve against the desktop app's node_modules (peer packages).
set -euo pipefail
cd "$(dirname "$0")/.."

TSC="$(node -e "console.log(require.resolve('typescript/bin/tsc', { paths: [process.cwd() + '/../../node_modules'] }))" 2>/dev/null || echo "../../node_modules/typescript/bin/tsc")"

node "$TSC" -p tsconfig.json
node scripts/wrap-client.mjs
echo "built: lib/index.js lib/client.js"
