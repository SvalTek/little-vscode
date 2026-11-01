import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@vscode/test-cli";

const root = path.dirname(fileURLToPath(import.meta.url));
const sibling = path.resolve(root, "../little-ls/build/little-ls.exe");

// Prefer a local build, but leave LITTLE_LS_PATH unset when it is absent so the
// extension can fall back to `little-ls` on PATH.
if (!process.env.LITTLE_LS_PATH && existsSync(sibling)) {
  process.env.LITTLE_LS_PATH = sibling;
}

export default defineConfig({
  files: "client/out/test/**/*.test.js",
  workspaceFolder: "./test-fixtures",
  mocha: {
    ui: "tdd",
    timeout: 60000,
  },
});
