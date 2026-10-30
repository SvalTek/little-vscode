# Little for VS Code

Language support for [Little](https://github.com/SvalTek/little), backed by the
`little-ls` language server.

## Features

- Syntax highlighting for `.little` files
- Diagnostics as you type (parse errors with exact ranges)
- Document symbols for functions, variables, classes and class members

## Requirements

The extension does not bundle the server. Build it from the `little-ls` project:

```powershell
pwsh -File ../little-ls/build.ps1
```

Then point the extension at the executable:

```json
"little.server.path": "X:/SRC/little-language/little-ls/build/little-ls.exe"
```

When the setting is empty, `LITTLE_LS_PATH` is checked next, then `little-ls`
on `PATH`.

## Packaging

```powershell
npm run package
```

This compiles the client and writes `out/little-vscode.vsix`. The VSIX includes
the compiled client and its runtime `node_modules`, the grammar and the
language configuration.

## Testing

```powershell
npm test
```

The test CLI downloads VS Code on first use and runs the integration suite from
`client/out/test`. The suites drive the real language server: diagnostics for
invalid source, clearing after a fix, and document symbols for declarations and
class members. `LITTLE_LS_PATH` defaults to `../little-ls/build/little-ls.exe`.

## Developing

```powershell
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host, then open a
`.little` file.

The client only speaks the language server protocol over stdio; all language
semantics live in the `little-ls` binary.
