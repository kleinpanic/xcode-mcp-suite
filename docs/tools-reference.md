# Xcode MCP Tools Reference

All 20 tools exposed by `xcrun mcpbridge` (Xcode 26.3+).

> All tools except `XcodeListWindows`, `XcodeSearchDocumentation`, and `XcodeListSimulators` require a `tab-identifier`. Always call `XcodeListWindows` first.
>
> **Source:** https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode

---

## Build & Test

### BuildProject

Build the active project or workspace.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tab-identifier` | string | ✓ | Window identifier |
| `scheme` | string | | Override active scheme |
| `configuration` | string | | e.g. "Debug", "Release" |

**Returns:** `{ success, errors[], warnings[], notes[], duration }`

**SDK:** `client.buildProject(params)` — throws `XcodeBuildError` on failure

---

### GetBuildLog

Fetch build log entries.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tab-identifier` | string | ✓ | Window identifier |
| `severity` | `"error" \| "warning" \| "all"` | | Filter by severity |
| `limit` | number | | Max entries |

**Returns:** `{ entries[], total }`

---

### RunAllTests

Run all tests in the active scheme.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tab-identifier` | string | ✓ | Window identifier |
| `scheme` | string | | Override scheme |
| `testPlan` | string | | Specific test plan |

**Returns:** `{ passed, failed, skipped, duration, failures[] }`

---

### GetTestResults

Get results from the most recent test run.

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |

**Returns:** Same as `RunAllTests`

---

### CleanBuildFolder

Clean derived data.

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |

**Returns:** `{ success }`

---

## Files & Navigation

### XcodeListWindows ⭐ (call first)

List all open Xcode windows and get their tab-identifiers.

*No params required.*

**Returns:** `{ windows: [{ "tab-identifier", title, projectPath?, workspacePath?, scheme? }] }`

---

### XcodeOpenFile

Open a file in Xcode.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tab-identifier` | string | ✓ | Window |
| `filePath` | string | ✓ | Absolute or project-relative path |
| `line` | number | | Jump to line |

---

### XcodeNavigateToSymbol

Jump to a named symbol in the editor.

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |
| `symbol` | string | ✓ |

**Returns:** `{ found, file?, line? }`

---

### XcodeGetFileContents

Read file contents through Xcode's buffer (includes unsaved edits).

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |
| `filePath` | string | ✓ |

**Returns:** `{ contents, filePath, language? }`

---

### XcodeRefreshCodeIssuesInFile

Re-run diagnostics on a specific file.

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |
| `filePath` | string | ✓ |

**Returns:** `{ issues[] }`

---

## Diagnostics & Intelligence

### XcodeGetDiagnostics

Get current diagnostics for the project or a specific file.

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |
| `filePath` | string | |

**Returns:** `{ diagnostics[] }`

---

### XcodeGetSymbolInfo

Look up type, declaration, and documentation for a symbol.

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |
| `symbol` | string | ✓ |
| `filePath` | string | |

**Returns:** `{ symbol, kind, declaration?, documentation?, file?, line? }`

---

### XcodeSearchDocumentation

Search Apple developer documentation.

| Param | Type | Required |
|-------|------|----------|
| `query` | string | ✓ |
| `limit` | number | |

**Returns:** `{ results: [{ title, url, abstract? }] }`

---

### XcodeGetCompletions

Get code completions at a cursor position.

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |
| `filePath` | string | ✓ |
| `line` | number | ✓ |
| `column` | number | ✓ |

**Returns:** `{ completions: [{ text, kind, documentation? }] }`

---

### XcodeGetReferencesForSymbol

Find all references to a symbol across the project.

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |
| `symbol` | string | ✓ |
| `filePath` | string | |

**Returns:** `{ references: [{ file, line, column, snippet? }] }`

---

## Swift REPL & Previews

### XcodeRunSwiftREPL

Execute Swift code in the REPL.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tab-identifier` | string | ✓ | |
| `code` | string | ✓ | Swift source code |
| `timeout` | number | | ms, default 10000 |

**Returns:** `{ output, error?, success }`

---

### XcodeGetSwiftUIPreview

Render a SwiftUI preview and return a base64-encoded PNG.

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |
| `filePath` | string | ✓ |
| `previewName` | string | |
| `deviceName` | string | |

**Returns:** `{ imageData? (base64 PNG), error? }`

---

### XcodeRefreshSwiftUIPreview

Refresh the preview canvas for a file.

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |
| `filePath` | string | ✓ |

**Returns:** `{ success }`

---

## Simulator

### XcodeListSimulators

List available simulators and their state.

*No params required.*

**Returns:** `{ simulators: [{ udid, name, runtime, state, deviceType }] }`

---

### XcodeRunOnSimulator

Build and run the app on a simulator.

| Param | Type | Required |
|-------|------|----------|
| `tab-identifier` | string | ✓ |
| `simulatorUdid` | string | |
| `deviceName` | string | |
| `scheme` | string | |

**Returns:** `{ success, simulatorUdid?, error? }`
