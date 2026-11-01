import * as assert from "assert";
import * as vscode from "vscode";
import { inlineDecorations, inlineDiagnostics } from "../inlineDiagnostics";

/**
 * Resolves a fixture file inside the opened test workspace.
 *
 * @param name File name inside the workspace folder.
 * @returns The URI of the fixture.
 */
function fixture(name: string): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders;
  assert.ok(folder && folder.length > 0, "expected a workspace folder");
  return vscode.Uri.joinPath(folder[0].uri, name);
}

/**
 * Opens a document and shows it in an editor so providers can run.
 *
 * @param uri Document to open.
 * @returns The active editor for the document.
 */
async function open(uri: vscode.Uri): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument(uri);
  return vscode.window.showTextDocument(document);
}

/**
 * Waits until the diagnostics for a document satisfy a predicate.
 *
 * @param uri Document whose diagnostics are observed.
 * @param predicate Check applied to the current diagnostics.
 * @param timeout Maximum wait in milliseconds.
 * @returns The diagnostics that satisfied the predicate.
 */
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

/**
 * Activates the extension and asks VS Code for a document's symbols.
 *
 * @param uri Document to inspect.
 * @returns The symbols reported by the language server.
 */
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
  test("groups inline errors and warnings by line", () => {
    const diagnostic = (line: number, severity: vscode.DiagnosticSeverity, message: string, source = "little") => {
      const result = new vscode.Diagnostic(new vscode.Range(line, 0, line, 1), message, severity);
      result.source = source;
      return result;
    };
    const result = inlineDiagnostics([
      diagnostic(1, vscode.DiagnosticSeverity.Warning, "Warning detail"),
      diagnostic(1, vscode.DiagnosticSeverity.Error, "Error detail\nMore information"),
      diagnostic(2, vscode.DiagnosticSeverity.Warning, "Other warning"),
      diagnostic(3, vscode.DiagnosticSeverity.Information, "Information"),
      diagnostic(4, vscode.DiagnosticSeverity.Error, "Other extension", "other"),
    ]);
    assert.deepStrictEqual(result.map(({ line, severity, message }) => ({ line, severity, message })), [
      { line: 1, severity: vscode.DiagnosticSeverity.Error, message: "Error detail (+1)" },
      { line: 2, severity: vscode.DiagnosticSeverity.Warning, message: "Other warning" },
    ]);
    assert.match(result[0].hover, /More information/);
    assert.deepStrictEqual(inlineDiagnostics([]), []);
  });
  test("keeps diagnostics anchored on an empty final line", async () => {
    const document = await vscode.workspace.openTextDocument({ language: "little", content: "var x = 1\n" });
    const diagnostic = new vscode.Diagnostic(new vscode.Range(1, 0, 1, 0), "Expected expression", vscode.DiagnosticSeverity.Error);
    diagnostic.source = "little";
    const decorations = inlineDecorations(document, [diagnostic]);
    assert.strictEqual(decorations.errors.length, 1);
    assert.ok(decorations.errors[0].range.isEqual(document.lineAt(1).range));
    assert.match(decorations.errors[0].renderOptions?.after?.contentText ?? "", /Expected expression/);
  });
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
    const decorations = inlineDecorations(editor.document, diagnostics);
    assert.strictEqual(decorations.errors.length, 1);
    assert.ok(decorations.errors[0].range.isEqual(editor.document.lineAt(0).range));
    assert.ok(!decorations.errors[0].range.isEmpty);
    assert.match(decorations.errors[0].renderOptions?.after?.contentText ?? "", /Expected identifier/);
    assert.deepStrictEqual(inlineDecorations(editor.document, []).errors, []);
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

  test("shows documentation on hover", async () => {
    const uri = fixture("sample.little");
    await open(uri);

    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      uri,
      new vscode.Position(2, 6)
    );
    assert.ok(hovers && hovers.length > 0, "no hover was returned");

    const contents = hovers
      .flatMap((hover) => hover.contents)
      .map((content) => (typeof content === "string" ? content : content.value))
      .join("\n");

    assert.match(contents, /class Point/);
    assert.match(contents, /A point in 2D/);
    assert.match(contents, /the horizontal position/);
  });
});
