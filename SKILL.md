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

## Model Selection for Xcode Tasks

Pick the cheapest model that can handle the job. iOS/macOS work ranges from trivial to architecturally complex.

### Sonnet 4.6 / Codex 5.3 (default — use for most work)
- File reads, glob, grep, ls — pure navigation
- Single-file edits (fix a typo, rename a variable, add a property)
- Running builds and reading build errors
- Running tests and interpreting results
- Screenshot → image analysis for simple UI checks
- Documentation searches
- Simulator interaction (tap, type, swipe) — just coordinates
- Build log parsing, issue triage
- Writing tests for existing code

### Opus 4.6 / Codex 5.4 (escalate for hard problems)
- Multi-file refactors (rename across 10+ files, move types between modules)
- Architectural decisions (choosing patterns, designing protocols, module boundaries)
- Debugging complex build failures (linker errors, module resolution, SPM dependency conflicts)
- SwiftUI layout debugging (analyzing preview images + suggesting structural fixes)
- Writing new features from scratch (new views, new data models, new networking layers)
- Test infrastructure setup (custom XCTestCase subclasses, mock frameworks)
- Performance analysis (interpreting Instruments traces, suggesting optimizations)
- Diagnosing runtime crashes from simulator logs
- Any task that requires understanding how 3+ files interact

### Rule of thumb
If the task is "read → edit one thing → build → verify" → **Sonnet/Codex-5.3**
If the task is "understand the architecture → design a solution → change multiple files → debug" → **Opus/Codex-5.4**

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
  await s.updateFile("Sources/App.swift", "old code", "new code"); // oldString, newString

  // Build & test
  const build = await s.buildProject();
  const tests = await s.runAllTests();
  const specific = await s.runSomeTests(["MyAppTests/testLogin"]);

  // Diagnostics
  const issues = await s.listNavigatorIssues();
  const fileIssues = await s.refreshCodeIssuesInFile("Sources/App.swift");

  // Execute Swift (requires source file context)
  const result = await s.executeSnippet('print([1,2,3].map { $0 * 2 })', 'Sources/App.swift');

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
xcmcp docs    --host collins-pro "SwiftUI List"  # search Apple docs + WWDC
xcmcp test-some --host collins-pro MyTests/testLogin  # run specific tests
xcmcp call    <ToolName> '<json-args>'    # call any tool directly
xcmcp windows --host collins-pro          # list windows + tabIdentifiers
xcmcp list-tools                          # show all 20 tools + TCC markers
```

## Visual See + Interact Loop

### See (capture current state)
```bash
xcmcp screenshot --host collins-pro --mode simulator --out /tmp/sim.png
# Then use `image` tool to analyze the PNG and find UI element coords
```

### Interact (control the simulator)
```bash
# Input
xcmcp ui tap   --host collins-pro 195 420     # tap at coords
xcmcp ui type  --host collins-pro "text"      # type into field
xcmcp ui swipe --host collins-pro 200 600 200 200   # scroll/swipe
xcmcp ui key   --host collins-pro 36          # Return key

# Simulator management
xcmcp ui list --host collins-pro              # list booted simulators
xcmcp ui list --host collins-pro --all        # list all available
xcmcp ui boot --host collins-pro "iPhone 16 Pro"  # boot a simulator
xcmcp ui shutdown --host collins-pro          # shut down booted sim
xcmcp ui open --host collins-pro              # open Simulator.app

# App lifecycle
xcmcp ui install --host collins-pro /path/to/MyApp.app
xcmcp ui launch --host collins-pro com.example.MyApp
xcmcp ui terminate --host collins-pro com.example.MyApp

# Logs
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

## TCC/Automation Permission (IMPORTANT)

Some tools require macOS Automation (AppleEvents/TCC) permission:

| Needs TCC | Tools |
|-----------|-------|
| **YES** | `BuildProject`, `RunAllTests`, `RunSomeTests`, `GetTestList`, `ExecuteSnippet`, `RenderPreview` |
| **NO** | `XcodeRead`, `XcodeWrite`, `XcodeUpdate`, `XcodeGlob`, `XcodeGrep`, `XcodeLS`, `XcodeMakeDir`, `XcodeRM`, `XcodeMV`, `XcodeListNavigatorIssues`, `XcodeRefreshCodeIssuesInFile`, `DocumentationSearch`, `XcodeListWindows` |

**Over SSH (our setup):** The TCC dialog appears on the Mac's physical display, not in SSH.
To fix: sit at collins-pro once, run any TCC tool (e.g. `BuildProject`), click "Allow" in the
macOS dialog. After that, SSH sessions work without further prompts.

If the tool hangs indefinitely, the TCC dialog was never accepted — someone needs to
physically click "Allow" on the Mac.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No Xcode windows found" | Open a project in Xcode on collins-pro |
| MCP error -32600 "output schema" | Update to Xcode 26.3 RC2+ (structuredContent fix) |
| Bridge fails to connect | Check Settings → Intelligence → Xcode Tools toggle ON |
| SSH timeout | Run `ssh collins-pro echo ok` to verify connectivity |
| Empty tabIdentifier | Always call XcodeListWindows first |
| Build/Test/Preview hangs forever | TCC dialog not accepted — physically click "Allow" on Mac |
| "claude-code" not in Automation list | CLI tools lack bundle IDs; TCC may not persist. Re-accept on each CLI version update |
| Permission dialog reappears | Known macOS limitation with CLI tools — accept again |

## IMPORTANT: Correct Parameter Names (from Apple's API)

Some parameters have non-obvious names. These are verified against the actual `tools/list` output:

| Tool | Parameter | Correct name | WRONG guesses |
|------|-----------|-------------|---------------|
| `XcodeUpdate` | old text | `oldString` | ~~oldText~~ |
| `XcodeUpdate` | new text | `newString` | ~~newText~~ |
| `ExecuteSnippet` | code | `codeSnippet` | ~~code~~ |
| `ExecuteSnippet` | file context | `sourceFilePath` (REQUIRED) | ~~filePath~~ |
| `XcodeMakeDir` | path | `directoryPath` | ~~path~~ |
| `XcodeMV` | source | `sourcePath` | ~~from~~ |
| `XcodeMV` | destination | `destinationPath` | ~~to~~ |
| `DocumentationSearch` | results | `documents[]` | ~~results[]~~ |
| `DocumentationSearch` | url field | `uri` | ~~url~~ |

Full verified schemas: `~/codeWS/GitHub/kleinpanic/xcode-mcp-suite/docs/schemas/tools-list-rc1.json`

## Known Issues

### mcpbridge v24582 (Xcode 26.3 build 17C529) — stdio bug
**Status:** Confirmed. mcpbridge only responds to `initialize`, then ignores ALL subsequent messages (tools/list, tools/call).
**Affects:** Both SSH and local connections on collins-pro.
**Workaround:** Use Claude Code or Codex directly on collins-pro (they work through the MCP SDK). The SSH proxy approach doesn't work until Apple fixes mcpbridge.
**Tested:** Node.js spawn, Python subprocess, bash pipe — all only get 1 response.

### XcodeBuildMCP alternative
For simulator management, debugging, and additional features not in Apple's 20 tools, see [XcodeBuildMCP](https://github.com/nicklama/xcode-mcp-server) — a third-party MCP server that wraps `xcodebuild` directly (no mcpbridge dependency).

## Reference

- [Tools Reference](~/codeWS/GitHub/kleinpanic/xcode-mcp-suite/docs/tools-reference.md) — all 20 tools with full params
- [Agent Integration Guide](~/codeWS/GitHub/kleinpanic/xcode-mcp-suite/docs/agent-integration.md)
- [Apple Official Docs](~/codeWS/GitHub/kleinpanic/xcode-mcp-suite/docs/apple-official.md)
