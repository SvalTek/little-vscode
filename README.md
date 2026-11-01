# Little for VS Code

Language support for [Little](https://github.com/SvalTek/little) through the
[`little-ls`](https://github.com/SvalTek/little-ls) language server.

The extension is a thin LSP client: it launches the server over stdio, while all
parsing and analysis stay in `little-ls`. The server is not bundled.

## Features

- Syntax highlighting for `.little` files, including `;;` doc-comment
  annotations.
- Diagnostics as you type, with exact source ranges.
- Hover with signatures, inferred types, and doc-comment details (`@param`,
  `@return`, `@field`, `@class`).
- Go to definition, find references, document highlights, and rename.
- Completion and signature help, including members of classes and imported
  modules.
- Document symbols for functions, variables, classes, and class members,
  including documented virtual classes.

## Requirements

Build the language server from the `little-ls` repository:

```powershell
pwsh -File ../little-ls/build.ps1
```

The extension resolves the executable in this order:

1. The `little.server.path` setting.
2. The `LITTLE_LS_PATH` environment variable.
3. `little-ls` on `PATH`.

For a local build, point the setting at the binary:

```json
"little.server.path": "X:/SRC/little-language/little-ls/build/little-ls.exe"
```

## Install

Package the extension, then install the generated VSIX from the Extensions view
(… → **Install from VSIX…**) or with the VS Code CLI:

```powershell
npm run package
code --install-extension out/little-vscode.vsix
```

## Configuration

| setting | default | description |
|---|---|---|
| `little.server.path` | `""` | Path to the `little-ls` executable. When empty, `LITTLE_LS_PATH` or `little-ls` on `PATH` is used. |

## Developing

```powershell
npm install
npm run compile
```

Press `F5` to launch an Extension Development Host and open a `.little` file.
`npm run watch` rebuilds the client on changes; the language server is a
separate process, so restart the host after rebuilding `little-ls`.

## Testing

```powershell
npm test
```

The test CLI downloads VS Code on first use and runs the integration suite from
`client/out/test` against `test-fixtures`, driving the real language server:
diagnostics and their clearing, document symbols, and hover documentation.

When `LITTLE_LS_PATH` is unset, the suite uses
`../little-ls/build/little-ls.exe` if it exists; otherwise the extension falls
back to `little-ls` on `PATH`.
