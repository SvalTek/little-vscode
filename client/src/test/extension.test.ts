import * as assert from "assert";
import * as vscode from "vscode";

function fixture(name: string): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders;
  assert.ok(folder && folder.length > 0, "expected a workspace folder");
  return vscode.Uri.joinPath(folder[0].uri, name);
}

async function open(uri: vscode.Uri): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument(uri);
  return vscode.window.showTextDocument(document);
}

function waitForDiagnostics(
  uri: vscode.Uri,
  predicate: (diagnostics: vscode.Diagnostic[]) => boolean,
  timeout = 20000
): Promise<vscode.Diagnostic[]> {
  return new Promise((resolve, reject) => {
    const current = vscode.languages.getDiagnostics(uri);
    if (predicate(current)) {
      resolve(current);
      return;
    }

    let subscription: vscode.Disposable | undefined;
    const timer = setTimeout(() => {
      subscription?.dispose();
      reject(new Error("timed out waiting for diagnostics"));
    }, timeout);

    subscription = vscode.languages.onDidChangeDiagnostics((event) => {
      if (!event.uris.some((changed) => changed.toString() === uri.toString())) return;

      const diagnostics = vscode.languages.getDiagnostics(uri);
      if (!predicate(diagnostics)) return;

      clearTimeout(timer);
      subscription?.dispose();
      resolve(diagnostics);
    });
  });
}

async function documentSymbols(uri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
  // Activation awaits client.start(), so the provider is registered once this
  // resolves; no polling or timers are needed.
  await vscode.extensions.getExtension("SvalTek.little-vscode")?.activate();

  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    uri
  );
  assert.ok(symbols && symbols.length > 0, "no document symbols were returned");
  return symbols;
}

suite("Little language", () => {
  test("reports parse diagnostics with source ranges", async () => {
    const uri = fixture("broken.little");
    const editor = await open(uri);

    assert.strictEqual(editor.document.languageId, "little");

    const diagnostics = await waitForDiagnostics(uri, (list) => list.length > 0);
    assert.strictEqual(diagnostics.length, 1, "expected exactly one diagnostic");
    assert.match(diagnostics[0].message, /Expected identifier/);
    assert.strictEqual(diagnostics[0].source, "little");
    assert.strictEqual(diagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    assert.strictEqual(diagnostics[0].range.start.line, 0);
    assert.strictEqual(diagnostics[0].range.start.character, 4);
    assert.strictEqual(diagnostics[0].range.end.character, 5);
  });

  test("clears diagnostics after the source is fixed", async () => {
    const uri = fixture("broken.little");
    const editor = await open(uri);
    await waitForDiagnostics(uri, (list) => list.length > 0);

    const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
    await editor.edit((builder) => {
      builder.replace(new vscode.Range(0, 0, lastLine.range.end.line, lastLine.range.end.character), "var x = 1\n");
    });

    const diagnostics = await waitForDiagnostics(uri, (list) => list.length === 0);
    assert.strictEqual(diagnostics.length, 0);
  });

  test("provides document symbols for declarations and class members", async () => {
    const uri = fixture("sample.little");
    await open(uri);

    const symbols = await documentSymbols(uri);
    assert.deepStrictEqual(
      symbols.map((symbol) => [symbol.name, symbol.kind]),
      [
        ["Point", vscode.SymbolKind.Class],
        ["main", vscode.SymbolKind.Function],
      ]
    );

    const point = symbols.find((symbol) => symbol.name === "Point");
    assert.ok(point);
    assert.deepStrictEqual(
      point!.children.map((child) => [child.name, child.kind]),
      [
        ["x", vscode.SymbolKind.Field],
        ["length", vscode.SymbolKind.Method],
      ]
    );
  });
});
