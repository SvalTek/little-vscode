import * as vscode from "vscode";

type InlineDiagnostic = {
  line: number;
  severity: vscode.DiagnosticSeverity.Error | vscode.DiagnosticSeverity.Warning;
  message: string;
  hover: string;
};

/** Group Little diagnostics by their first line, keeping the most severe first. */
export function inlineDiagnostics(diagnostics: readonly vscode.Diagnostic[]): InlineDiagnostic[] {
  const lines = new Map<number, vscode.Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.source !== "little" ||
        (diagnostic.severity !== vscode.DiagnosticSeverity.Error && diagnostic.severity !== vscode.DiagnosticSeverity.Warning)) continue;
    const line = diagnostic.range.start.line;
    const group = lines.get(line) ?? [];
    group.push(diagnostic);
    lines.set(line, group);
  }
  return [...lines].map(([line, group]) => {
    group.sort((a, b) => a.severity - b.severity);
    const first = group[0];
    const message = first.message.split(/\r?\n/, 1)[0].trim();
    return {
      line,
      severity: first.severity as InlineDiagnostic["severity"],
      message: group.length > 1 ? `${message} (+${group.length - 1})` : message,
      hover: group.map((item) => item.message).join("\n\n"),
    };
  });
}

export function inlineDecorations(document: vscode.TextDocument, diagnostics: readonly vscode.Diagnostic[]) {
  const errors: vscode.DecorationOptions[] = [];
  const warnings: vscode.DecorationOptions[] = [];
  for (const diagnostic of inlineDiagnostics(diagnostics)) {
    if (diagnostic.line >= document.lineCount) continue;
    const line = document.lineAt(diagnostic.line);
    const decoration: vscode.DecorationOptions = {
      // Empty lines, including an empty document, have no non-empty line range.
      range: line.range,
      hoverMessage: new vscode.MarkdownString().appendText(diagnostic.hover),
      renderOptions: { after: { contentText: `${diagnostic.severity === vscode.DiagnosticSeverity.Error ? "✖" : "⚠"} ${diagnostic.message}` } },
    };
    (diagnostic.severity === vscode.DiagnosticSeverity.Error ? errors : warnings).push(decoration);
  }
  return { errors, warnings };
}

/** Paint diagnostics in every visible Little editor and keep them in sync. */
export function registerInlineDiagnostics(context: vscode.ExtensionContext): void {
  const error = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(244, 67, 54, 0.10)",
    after: { color: new vscode.ThemeColor("editorError.foreground"), margin: "0 0 0 3em" },
  });
  const warning = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(255, 193, 7, 0.10)",
    after: { color: new vscode.ThemeColor("editorWarning.foreground"), margin: "0 0 0 3em" },
  });

  const update = (editor: vscode.TextEditor) => {
    if (editor.document.languageId !== "little") return;
    const enabled = vscode.workspace.getConfiguration("little", editor.document.uri)
      .get<boolean>("diagnostics.inline", true);
    const { errors, warnings } = inlineDecorations(editor.document,
      enabled ? vscode.languages.getDiagnostics(editor.document.uri) : []);
    editor.setDecorations(error, errors);
    editor.setDecorations(warning, warnings);
  };

  const updateVisible = () => vscode.window.visibleTextEditors.forEach(update);
  context.subscriptions.push(
    error, warning,
    vscode.languages.onDidChangeDiagnostics((event) => {
      for (const editor of vscode.window.visibleTextEditors) {
        if (event.uris.some((uri) => uri.toString() === editor.document.uri.toString())) update(editor);
      }
    }),
    vscode.window.onDidChangeVisibleTextEditors(updateVisible),
    vscode.workspace.onDidChangeTextDocument((event) => {
      for (const editor of vscode.window.visibleTextEditors) if (editor.document === event.document) update(editor);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("little.diagnostics.inline")) updateVisible();
    }),
  );
  updateVisible();
}
