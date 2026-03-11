---
name: xcode-mcp-suite
description: >
  Build, test, preview, and inspect Xcode projects on collins-pro via the
  Xcode 26.3 MCP bridge (xcrun mcpbridge). Provides all 20 Xcode MCP tools
  over SSH stdio. Use when doing iOS/macOS development: building, running
  tests, debugging Swift, capturing SwiftUI previews, or navigating code.
  Full SDK and CLI available at ~/codeWS/GitHub/kleinpanic/xcode-mcp-suite.
---

# Xcode MCP Suite — Dev Skill

Connect the dev agent to Xcode 26.3 on collins-pro via `xcrun mcpbridge` over SSH.

**GitHub:** https://github.com/kleinpanic/xcode-mcp-suite  
**Apple Docs:** https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode

## Prerequisites

- Xcode running on `collins-pro` with a project open
- **Xcode → Settings → Intelligence → Model Context Protocol → Xcode Tools: ON**
- SSH alias `collins-pro` reachable

## Quick Connection (CLI)

```bash
# Preflight check
xcmcp doctor --host collins-pro

# Or install from repo
cd ~/codeWS/GitHub/kleinpanic/xcode-mcp-suite
pnpm install && pnpm build
```

## MCP Proxy — Register with Claude Code / Codex

```bash
# Claude Code (one-time setup)
claude mcp add --transport stdio xcode -- npx @kleinpanic/xcode-mcp-proxy

# Codex
codex mcp add xcode -- npx @kleinpanic/xcode-mcp-proxy

# Set host
export XCODE_HOST=collins-pro
```

## All 20 Xcode MCP Tools

### Build & Test
| Tool | What it does |
|------|-------------|
| `BuildProject` | Build active scheme; returns errors/warnings |
| `GetBuildLog` | Fetch build log (filter: error/warning/all) |
| `RunAllTests` | Run all tests in active scheme |
| `GetTestResults` | Results from most recent test run |
| `CleanBuildFolder` | Clean derived data |

### Files & Navigation
| Tool | What it does |
|------|-------------|
| `XcodeListWindows` | **⭐ Call first** — get `tab-identifier` for all other tools |
| `XcodeOpenFile` | Open file in Xcode editor |
| `XcodeNavigateToSymbol` | Jump to named symbol |
| `XcodeGetFileContents` | Read file via Xcode buffer (includes unsaved edits) |
| `XcodeRefreshCodeIssuesInFile` | Re-run diagnostics on a file |

### Diagnostics & Intelligence
| Tool | What it does |
|------|-------------|
| `XcodeGetDiagnostics` | All current errors/warnings |
| `XcodeGetSymbolInfo` | Type, declaration, docs for a symbol |
| `XcodeSearchDocumentation` | Search Apple developer docs |
| `XcodeGetCompletions` | Code completions at cursor position |
| `XcodeGetReferencesForSymbol` | All references to a symbol |

### Swift REPL & Previews
| Tool | What it does |
|------|-------------|
| `XcodeRunSwiftREPL` | Execute Swift code in REPL |
| `XcodeGetSwiftUIPreview` | Render SwiftUI preview → base64 PNG |
| `XcodeRefreshSwiftUIPreview` | Refresh preview canvas |

### Simulator
| Tool | What it does |
|------|-------------|
| `XcodeListSimulators` | List simulators and boot state |
| `XcodeRunOnSimulator` | Build and run on simulator |

## Typical Dev Workflow

```
1. xcmcp doctor --host collins-pro           # verify everything works
2. XcodeListWindows                          # get tab-identifier
3. BuildProject {tab-identifier}             # build → check errors
4. GetBuildLog {tab-identifier, severity: "error"}  # see what's broken
5. <fix files>
6. BuildProject again                        # iterate until clean
7. RunAllTests {tab-identifier}              # run test suite
8. XcodeGetSwiftUIPreview {tab, filePath}    # visual audit
9. XcodeRunSwiftREPL {tab, code}             # spot-check logic
```

## SDK Usage (TypeScript)

```typescript
import { withXcodeSession } from "@kleinpanic/xcode-mcp-sdk";

await withXcodeSession({ host: "collins-pro" }, async (session) => {
  // tab-identifier managed automatically
  const build = await session.buildProject({ scheme: "MyApp" });
  const tests = await session.runAllTests();
  const preview = await session.getSwiftUIPreview({
    filePath: "Sources/Views/ContentView.swift"
  });
});
```

## CLI Commands

```bash
xcmcp build   --host collins-pro [--scheme MyApp]
xcmcp test    --host collins-pro [--scheme MyApp]
xcmcp clean   --host collins-pro
xcmcp repl    --host collins-pro '<swift code>'
xcmcp preview --host collins-pro --file Sources/Views/ContentView.swift
xcmcp screenshot --host collins-pro --mode simulator --out /tmp/ui.png
xcmcp call    <ToolName> '<json-args>'    # call any tool directly
xcmcp windows --host collins-pro          # list windows + tab-identifiers
xcmcp list-tools                          # show all 20 tools
```

## Visual See + Interact Loop

The dev agent can **see** AND **interact** with the running simulator on collins-pro.

### See (capture current state)

```bash
# Capture booted simulator screen → PNG
xcmcp screenshot --host collins-pro --mode simulator --out /tmp/sim.png
# Then use the `image` tool to analyze the PNG visually

# SwiftUI preview direct from Xcode (no simulator needed)
xcmcp call XcodeGetSwiftUIPreview '{"tab-identifier":"<id>","filePath":"Sources/Views/ContentView.swift"}'
# Returns base64 PNG — decode and pass to image tool

# Full macOS display (e.g. Xcode itself)
xcmcp screenshot --host collins-pro --mode screen --out /tmp/screen.png
```

### Interact (control the simulator)

```bash
# Tap at screen coordinates (get coords from screenshot analysis)
xcmcp ui tap --host collins-pro 195 420

# Type text into focused field
xcmcp ui type --host collins-pro "hello@example.com"

# Swipe (e.g. scroll down)
xcmcp ui swipe --host collins-pro 200 600 200 200

# Key press (36=Return, 51=Delete, 53=Escape, 123-126=arrows)
xcmcp ui key --host collins-pro 36

# List booted simulators
xcmcp ui list --host collins-pro

# Stream app logs in real time
xcmcp ui log --host collins-pro
```

### Full visual agent loop

```bash
# 1. Build and launch
xcmcp build --host collins-pro
xcmcp ui list --host collins-pro          # find booted simulator

# 2. See initial state
xcmcp screenshot --host collins-pro --mode simulator --out /tmp/s1.png
# → analyze /tmp/s1.png with `image` tool to find UI element coords

# 3. Interact
xcmcp ui tap --host collins-pro 195 420   # tap button at analyzed coords
xcmcp ui type --host collins-pro "test input"

# 4. See result
xcmcp screenshot --host collins-pro --mode simulator --out /tmp/s2.png
# → analyze /tmp/s2.png to verify UI changed correctly

# 5. Check logs
xcmcp ui log --host collins-pro           # stream live logs
```

### In TypeScript (SDK)

```typescript
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Helper: screenshot → base64 for image analysis
function snap(host: string, out: string): string {
  execSync(`xcmcp screenshot --host ${host} --mode simulator --out ${out}`);
  return readFileSync(out).toString("base64");
}

// Helper: tap on simulator
function tap(host: string, x: number, y: number) {
  execSync(`xcmcp ui tap --host ${host} ${x} ${y}`);
}

// Visual loop
const img1 = snap("collins-pro", "/tmp/before.png");
// pass img1 to image tool for analysis → get coords
tap("collins-pro", 195, 420);
const img2 = snap("collins-pro", "/tmp/after.png");
// pass img2 to verify interaction worked
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No Xcode windows found" | Open a project in Xcode on collins-pro |
| Bridge fails to connect | Check Settings → Intelligence → Xcode Tools toggle is ON |
| SSH timeout | Run `ssh collins-pro echo ok` to verify connectivity |
| Empty tab-identifier | Always call `XcodeListWindows` first |
| Simulator screenshot fails | Boot a simulator or use `--mode screen` |

## Local Development

```bash
cd ~/codeWS/GitHub/kleinpanic/xcode-mcp-suite
pnpm install
pnpm build           # build all packages
pnpm test            # run unit tests (6 tests)
pnpm typecheck       # TypeScript strict check
man -l man/xcmcp.1   # read man page
```

## Reference Docs

- [Tools Reference](~/codeWS/GitHub/kleinpanic/xcode-mcp-suite/docs/tools-reference.md)
- [Agent Integration Guide](~/codeWS/GitHub/kleinpanic/xcode-mcp-suite/docs/agent-integration.md)
- [Apple Official Docs](~/codeWS/GitHub/kleinpanic/xcode-mcp-suite/docs/apple-official.md)
- [Quickstart](~/codeWS/GitHub/kleinpanic/xcode-mcp-suite/docs/quickstart.md)
