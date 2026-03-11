---
name: xcode-mcp-suite
description: >
  Build, test, edit files, preview, and inspect Xcode projects on collins-pro via
  Xcode 26.3's MCP bridge (xcrun mcpbridge). All 20 Xcode MCP tools over SSH stdio.
  Use for iOS/macOS development: building, running tests, editing Swift files,
  capturing SwiftUI previews, navigating code, searching Apple docs, and visually
  interacting with the simulator. Full SDK and CLI at ~/codeWS/GitHub/kleinpanic/xcode-mcp-suite.
---

# Xcode MCP Suite — Dev Skill

Connect to Xcode 26.3 on collins-pro via `xcrun mcpbridge` over SSH.

**GitHub:** https://github.com/kleinpanic/xcode-mcp-suite
**Apple Docs:** https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode

## Prerequisites

- Xcode running on `collins-pro` with a project open
- **Xcode → Settings → Intelligence → Model Context Protocol → Xcode Tools: ON**
- SSH alias `collins-pro` reachable

## All 20 Xcode MCP Tools (Correct Names)

### File Operations (9 tools)
| Tool | What it does | SDK method |
|------|-------------|------------|
| `XcodeRead` | Read file from project (includes unsaved buffer) | `readFile(path)` |
| `XcodeWrite` | Write full file content (create/overwrite) | `writeFile(path, content)` |
| `XcodeUpdate` | str_replace patch (oldText → newText) | `updateFile(path, old, new)` |
| `XcodeGlob` | Find files by glob pattern (`**/*.swift`) | `glob(pattern)` |
| `XcodeGrep` | Search file contents | `grep(pattern)` |
| `XcodeLS` | List directory contents | `ls(path)` |
| `XcodeMakeDir` | Create directories | `mkdir(path)` |
| `XcodeRM` | Remove files/directories | `rm(path)` |
| `XcodeMV` | Move/rename files | `mv(from, to)` |

### Build & Test (5 tools)
| Tool | What it does | SDK method |
|------|-------------|------------|
| `BuildProject` | Build active scheme | `buildProject()` |
| `GetBuildLog` | Get build output (filter by severity) | `getBuildLog()` |
| `RunAllTests` | Run all tests in active scheme | `runAllTests()` |
| `RunSomeTests` | Run specific tests by identifier | `runSomeTests(["MyTests/testX"])` |
| `GetTestList` | List all available tests | `getTestList()` |

### Diagnostics (2 tools)
| Tool | What it does | SDK method |
|------|-------------|------------|
| `XcodeListNavigatorIssues` | All project errors/warnings | `listNavigatorIssues()` |
| `XcodeRefreshCodeIssuesInFile` | Live diagnostics for one file | `refreshCodeIssuesInFile(path)` |

### Code Execution (1 tool)
| Tool | What it does | SDK method |
|------|-------------|------------|
| `ExecuteSnippet` | Run Swift code in REPL-like env | `executeSnippet(code)` |

### Preview (1 tool)
| Tool | What it does | SDK method |
|------|-------------|------------|
| `RenderPreview` | SwiftUI preview → base64 PNG image | `renderPreview(path)` |

### Documentation (1 tool)
| Tool | What it does | SDK method |
|------|-------------|------------|
| `DocumentationSearch` | Search Apple docs + WWDC transcripts (MLX semantic) | `searchDocumentation(query)` |

### Windowing (1 tool)
| Tool | What it does | SDK method |
|------|-------------|------------|
| `XcodeListWindows` | **⭐ Call first** — get `tabIdentifier` for all tools | `listWindows()` |

## CRITICAL: Always Start With XcodeListWindows

Every tool (except DocumentationSearch) requires a `tabIdentifier`. Get it from XcodeListWindows first:

```
→ XcodeListWindows()
← { "message": "* tabIdentifier: windowtab1, workspacePath: /Users/you/MyApp.xcodeproj" }
```

Then pass `tabIdentifier: "windowtab1"` to every subsequent call.

## Typical Dev Workflow

```
1. XcodeListWindows                          # get tabIdentifier
2. XcodeGlob { pattern: "**/*.swift" }       # discover project files
3. XcodeRead { filePath: "..." }             # read source code
4. XcodeUpdate { filePath, oldText, newText } # edit with str_replace
5. BuildProject { tabIdentifier }            # build → check errors
6. GetBuildLog { severity: "error" }         # see what's broken
7. XcodeListNavigatorIssues                  # all project issues
8. RunAllTests                               # run test suite
9. RenderPreview { filePath }                # visual audit → PNG
10. ExecuteSnippet { code: "..." }           # spot-check Swift logic
11. DocumentationSearch { query: "..." }     # look up Apple APIs + WWDC
```

## SDK Usage (TypeScript)

```typescript
import { withXcodeSession } from "@kleinpanic/xcode-mcp-sdk";

await withXcodeSession({ host: "collins-pro" }, async (s) => {
  // tabIdentifier managed automatically by XcodeSession

  // File operations
  const files = await s.glob("**/*.swift");
  const source = await s.readFile("Sources/App.swift");
  await s.updateFile("Sources/App.swift", "old code", "new code");

  // Build & test
  const build = await s.buildProject();
  const tests = await s.runAllTests();
  const specific = await s.runSomeTests(["MyAppTests/testLogin"]);

  // Diagnostics
  const issues = await s.listNavigatorIssues();
  const fileIssues = await s.refreshCodeIssuesInFile("Sources/App.swift");

  // Execute Swift
  const result = await s.executeSnippet('print([1,2,3].map { $0 * 2 })');

  // Preview → base64 PNG
  const preview = await s.renderPreview("Sources/Views/ContentView.swift");

  // Search Apple docs + WWDC transcripts
  const docs = await s.searchDocumentation("SwiftUI List");
});
```

## CLI Commands

```bash
xcmcp build   --host collins-pro [--scheme MyApp]
xcmcp test    --host collins-pro [--scheme MyApp]
xcmcp repl    --host collins-pro '<swift code>'
xcmcp preview --host collins-pro --file Sources/Views/ContentView.swift
xcmcp screenshot --host collins-pro --mode simulator --out /tmp/ui.png
xcmcp call    <ToolName> '<json-args>'    # call any tool directly
xcmcp windows --host collins-pro          # list windows + tabIdentifiers
xcmcp list-tools                          # show all 20 tools
```

## Visual See + Interact Loop

### See (capture current state)
```bash
xcmcp screenshot --host collins-pro --mode simulator --out /tmp/sim.png
# Then use `image` tool to analyze the PNG and find UI element coords
```

### Interact (control the simulator)
```bash
xcmcp ui tap   --host collins-pro 195 420     # tap at coords
xcmcp ui type  --host collins-pro "text"      # type into field
xcmcp ui swipe --host collins-pro 200 600 200 200   # scroll/swipe
xcmcp ui key   --host collins-pro 36          # Return key
xcmcp ui log   --host collins-pro             # stream app logs
```

### Full visual loop
```bash
# build → screenshot → analyze → interact → screenshot → verify
xcmcp build --host collins-pro
xcmcp screenshot --host collins-pro --mode simulator --out /tmp/s1.png
# → analyze with `image` tool → get button coords
xcmcp ui tap --host collins-pro 195 420
xcmcp screenshot --host collins-pro --mode simulator --out /tmp/s2.png
# → analyze to verify UI changed correctly
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No Xcode windows found" | Open a project in Xcode on collins-pro |
| MCP error -32600 "output schema" | Update to Xcode 26.3 RC2+ (structuredContent fix) |
| Bridge fails to connect | Check Settings → Intelligence → Xcode Tools toggle ON |
| SSH timeout | Run `ssh collins-pro echo ok` to verify connectivity |
| Empty tabIdentifier | Always call XcodeListWindows first |
| Permission dialog | Click "Allow" in Xcode when first connecting |

## Reference

- [Tools Reference](~/codeWS/GitHub/kleinpanic/xcode-mcp-suite/docs/tools-reference.md) — all 20 tools with full params
- [Agent Integration Guide](~/codeWS/GitHub/kleinpanic/xcode-mcp-suite/docs/agent-integration.md)
- [Apple Official Docs](~/codeWS/GitHub/kleinpanic/xcode-mcp-suite/docs/apple-official.md)
