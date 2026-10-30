import { workspace, ExtensionContext } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

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

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
