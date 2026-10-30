import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@vscode/test-cli";

const root = path.dirname(fileURLToPath(import.meta.url));

// The extension resolves the language server from LITTLE_LS_PATH during tests.
if (!process.env.LITTLE_LS_PATH) {
  process.env.LITTLE_LS_PATH = path.resolve(root, "../little-ls/build/little-ls.exe");
}

export default defineConfig({
  files: "client/out/test/**/*.test.js",
  workspaceFolder: "./test-fixtures",
  mocha: {
    ui: "tdd",
    timeout: 60000,
  },
});
