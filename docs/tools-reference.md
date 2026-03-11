# Xcode MCP Tools Reference

All 20 tools exposed by `xcrun mcpbridge` (Xcode 26.3+).

> Most tools require a `tabIdentifier` to target a specific Xcode window.
> Always call `XcodeListWindows` first. `DocumentationSearch` does not require one.
>
> **Source:** https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode

---

## File Operations (9 tools)

### XcodeRead

Read a file from the project (includes unsaved Xcode buffer changes).

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `filePath` | string | ✓ |

**Returns:** `{ content, filePath }`

---

### XcodeWrite

Write full content to a file (creates or overwrites).

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `filePath` | string | ✓ |
| `content` | string | ✓ |

**Returns:** `{ success }`

---

### XcodeUpdate

Apply a str_replace-style patch to a file. The `oldText` must match exactly.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `filePath` | string | ✓ |
| `oldText` | string | ✓ |
| `newText` | string | ✓ |

**Returns:** `{ success, replacements? }`

---

### XcodeGlob

Find files by glob pattern.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `pattern` | string | ✓ |

**Returns:** `{ files: string[] }`

**Example:** `{ "tabIdentifier": "windowtab1", "pattern": "**/*.swift" }`

---

### XcodeGrep

Search file contents.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `pattern` | string | ✓ |
| `include` | string | |

**Returns:** `{ matches: [{ file, line, text }] }`

---

### XcodeLS

List directory contents.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `path` | string | ✓ |

**Returns:** `{ entries: [{ name, type, size? }] }`

---

### XcodeMakeDir

Create a directory.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `path` | string | ✓ |

---

### XcodeRM

Remove a file or directory.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `path` | string | ✓ |

---

### XcodeMV

Move or rename a file.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `from` | string | ✓ |
| `to` | string | ✓ |

---

## Build & Test (5 tools)

### BuildProject

Build the active project or workspace.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `scheme` | string | |
| `configuration` | string | |

**Returns:** `{ buildResult, elapsedTime?, errors[], warnings?[] }`

---

### GetBuildLog

Fetch build log output.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `severity` | `"error"` \| `"warning"` \| `"all"` | |

**Returns:** `{ log, entries?[] }`

---

### RunAllTests

Run all tests in the active scheme.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `scheme` | string | |

**Returns:** `{ testResult, passed?, failed?, duration?, failures?[] }`

---

### RunSomeTests

Run specific tests by identifier.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `tests` | string[] | ✓ |
| `scheme` | string | |

**Returns:** Same as `RunAllTests`

**Example:** `{ "tabIdentifier": "windowtab1", "tests": ["MyAppTests/testLogin"] }`

---

### GetTestList

List all available tests.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `scheme` | string | |

**Returns:** `{ tests: [{ name, suite, identifier }] }`

---

## Diagnostics (2 tools)

### XcodeListNavigatorIssues

Get all current issues (errors, warnings) from the Issue Navigator.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |

**Returns:** `{ issues: [{ message, file?, line?, severity, category? }] }`

---

### XcodeRefreshCodeIssuesInFile

Refresh and return live diagnostics for a specific file.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `filePath` | string | ✓ |

**Returns:** `{ issues[] }`

---

## Code Execution (1 tool)

### ExecuteSnippet

Execute Swift code in a REPL-like environment.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `code` | string | ✓ |
| `timeout` | number | |

**Returns:** `{ output, error?, success }`

**Example:** `{ "tabIdentifier": "windowtab1", "code": "print([1,2,3].map { $0 * 2 })" }`

---

## Preview (1 tool)

### RenderPreview

Render a SwiftUI preview as a PNG image. The agent can literally see what the UI looks like.

| Param | Type | Required |
|-------|------|----------|
| `tabIdentifier` | string | ✓ |
| `filePath` | string | ✓ |
| `previewName` | string | |

**Returns:** `{ imageData? (base64 PNG), error? }`

---

## Documentation (1 tool)

### DocumentationSearch

Search Apple developer documentation and WWDC video transcripts.
Uses Apple's MLX-accelerated semantic search ("Squirrel MLX") on Apple Silicon.

| Param | Type | Required |
|-------|------|----------|
| `query` | string | ✓ |

**Returns:** `{ results: [{ title, url, abstract?, source? }] }`

**Note:** `source` is "documentation" or "wwdc" (WWDC video transcripts). Covers iOS 15 through iOS 26.

---

## Windowing (1 tool)

### XcodeListWindows ⭐ (call first)

List all open Xcode windows and get their tabIdentifiers.

*No params required.*

**Returns:** `{ message: "* tabIdentifier: windowtab1, workspacePath: /path/to/project" }`

**Important:** The `tabIdentifier` from this response is required by all other tools (except `DocumentationSearch`).

---

## Typical Workflow

```
1. XcodeListWindows → get tabIdentifier
2. XcodeGlob { pattern: "**/*.swift" } → discover project files
3. XcodeRead { filePath: "..." } → read source
4. XcodeUpdate { filePath, oldText, newText } → edit source
5. BuildProject → check for errors
6. GetBuildLog { severity: "error" } → inspect failures
7. XcodeListNavigatorIssues → see all project issues
8. RunAllTests → run test suite
9. RenderPreview { filePath: "ContentView.swift" } → visual audit
10. ExecuteSnippet { code: "..." } → spot-check logic
11. DocumentationSearch { query: "SwiftUI List" } → look up APIs
```
