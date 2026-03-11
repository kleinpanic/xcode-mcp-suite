# Apple Official Documentation

> Source: https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode
> Verified tool names from: https://gist.github.com/keith/d8aca9661002388650cf2fdc5eac9f3b

## Overview

Xcode 26.3 exposes 20 MCP tools via `xcrun mcpbridge`, a STDIO bridge between
MCP clients and Xcode's internal tool service. Enable in:

**Xcode → Settings → Intelligence → Model Context Protocol → Xcode Tools: ON**

## Setup

### Claude Code (on the Mac)
```bash
claude mcp add --transport stdio xcode -- xcrun mcpbridge
```

### Codex (on the Mac)
Add to `.codex/config.json`:
```json
{
  "mcpServers": {
    "xcode": { "command": "xcrun", "args": ["mcpbridge"] }
  }
}
```

### Remote (SSH)
```bash
# Use xcode-mcp-proxy
npx @kleinpanic/xcode-mcp-proxy
# Set XCODE_HOST=your-mac
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MCP_XCODE_PID` | Target a specific Xcode process (auto-detected by default) |
| `MCP_XCODE_SESSION_ID` | UUID for session persistence |

## All 20 Tools (Verified Names)

### File Operations (9)
| Tool | Description |
|------|-------------|
| `XcodeRead` | Read file from project (includes unsaved Xcode buffer changes) |
| `XcodeWrite` | Create or overwrite files |
| `XcodeUpdate` | str_replace-style edits (oldString → newString) |
| `XcodeGlob` | Find files by glob pattern |
| `XcodeGrep` | Search file contents (regex, with context lines) |
| `XcodeLS` | List directory contents |
| `XcodeMakeDir` | Create directories/groups |
| `XcodeRM` | Remove files/directories |
| `XcodeMV` | Move, rename, or copy files |

### Build & Test (5)
| Tool | Description |
|------|-------------|
| `BuildProject` | Build the active scheme [TCC] |
| `GetBuildLog` | Fetch build log (filter by severity/glob/regex) |
| `RunAllTests` | Run all tests [TCC] |
| `RunSomeTests` | Run specific tests by identifier [TCC] |
| `GetTestList` | List all available tests [TCC] |

### Diagnostics (2)
| Tool | Description |
|------|-------------|
| `XcodeListNavigatorIssues` | All project errors/warnings from Issue Navigator |
| `XcodeRefreshCodeIssuesInFile` | Live diagnostics for a specific file |

### Code Execution (1)
| Tool | Description |
|------|-------------|
| `ExecuteSnippet` | Run Swift code in project context (codeSnippet + sourceFilePath) [TCC] |

### Preview (1)
| Tool | Description |
|------|-------------|
| `RenderPreview` | Render SwiftUI preview as base64 PNG image [TCC] |

### Documentation (1)
| Tool | Description |
|------|-------------|
| `DocumentationSearch` | Search Apple docs + WWDC transcripts (MLX semantic search) |

### Windowing (1)
| Tool | Description |
|------|-------------|
| `XcodeListWindows` | List open Xcode windows — **call first** to get `tabIdentifier` |

[TCC] = requires macOS Automation permission (TCC dialog on first use)

## Key Parameter Names

These are non-obvious and differ from what you'd guess:

- `ExecuteSnippet`: `codeSnippet` (not `code`), `sourceFilePath` (REQUIRED)
- `XcodeUpdate`: `oldString`/`newString` (not `oldText`/`newText`)
- `XcodeMakeDir`: `directoryPath` (not `path`)
- `XcodeMV`: `sourcePath`/`destinationPath` (not `from`/`to`)
- `DocumentationSearch`: returns `documents[]` with `uri`/`contents`/`score`
