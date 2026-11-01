import { workspace, ExtensionContext } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

/**
 * Starts the Little language client, launching `little-ls` over stdio.
 *
 * The executable comes from `little.server.path`, then `LITTLE_LS_PATH`, and
 * finally `little-ls` on `PATH`.
 *
 * @param context Extension context supplied by VS Code.
 */
export async function activate(context: ExtensionContext) {
  // The language server is a separate executable built from little-ls. Use the
  // setting when developing against a local build, otherwise resolve it from PATH.
  const configured = (workspace.getConfiguration("little").get<string>("server.path") ?? "").trim();
  const command = configured.length > 0 ? configured : process.env.LITTLE_LS_PATH || "little-ls";

  const serverOptions: ServerOptions = {
    command,
    args: [],
    transport: TransportKind.stdio,
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "little" }],
    outputChannelName: "Little Language Server",
  };

  client = new LanguageClient("little", "Little Language Server", serverOptions, clientOptions);
  await client.start();
}

/**
 * Stops the language client when the extension is deactivated.
 *
 * @returns A promise that settles once the client has stopped, or undefined
 * when the extension was never activated.
 */
export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
