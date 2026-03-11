# xcode-mcp-suite

[![CI](https://github.com/kleinpanic/xcode-mcp-suite/actions/workflows/ci.yml/badge.svg)](https://github.com/kleinpanic/xcode-mcp-suite/actions/workflows/ci.yml)
[![npm: SDK](https://img.shields.io/npm/v/@kleinpanic/xcode-mcp-sdk?label=sdk)](https://www.npmjs.com/package/@kleinpanic/xcode-mcp-sdk)
[![npm: CLI](https://img.shields.io/npm/v/@kleinpanic/xcmcp?label=cli)](https://www.npmjs.com/package/@kleinpanic/xcmcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**SDK, CLI, and MCP proxy for Xcode's agentic coding bridge (`xcrun mcpbridge`).**

Xcode 26.3+ exposes [20 MCP tools](docs/tools-reference.md) that let AI coding agents build projects, run tests, execute Swift REPL sessions, capture SwiftUI previews, navigate symbols, and control simulators — all via the [Model Context Protocol](https://modelcontextprotocol.io).

This suite makes those tools easy to use from any agent or script:

| Package | What it does |
|---------|-------------|
| [`@kleinpanic/xcode-mcp-sdk`](packages/sdk) | TypeScript SDK — fully typed `XcodeClient` & `XcodeSession` |
| [`@kleinpanic/xcmcp`](packages/cli) | CLI — `xcmcp build`, `test`, `repl`, `screenshot`, `preview`… |
| [`@kleinpanic/xcode-mcp-proxy`](packages/mcp-proxy) | Standalone MCP proxy — `npx` it into any MCP client |

> **Official Apple docs:** [Giving external agentic coding tools access to Xcode](https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode)

---

## Prerequisites

1. **Xcode 26.3+** on the target macOS host
2. Enable the bridge: **Xcode → Settings → Intelligence → Model Context Protocol → Xcode Tools: ON**
3. SSH access to the host (for remote use)

---

## Quick Start

### CLI

```bash
npm install -g @kleinpanic/xcmcp

# Check everything works
xcmcp doctor --host collins-pro

# Build, test, repl
xcmcp build --host collins-pro
xcmcp test --host collins-pro
xcmcp repl --host collins-pro 'print("Hello from Swift")'

# Screenshot a booted simulator
xcmcp screenshot --host collins-pro --mode simulator --out /tmp/ui.png
```

### SDK

```bash
npm install @kleinpanic/xcode-mcp-sdk
```

```typescript
import { withXcodeSession } from "@kleinpanic/xcode-mcp-sdk";

await withXcodeSession({ host: "collins-pro" }, async (session) => {
  // tabIdentifier is managed automatically
  const result = await session.buildProject();
  console.log(`Build: ${result.success ? "✓" : "✗"}`);

  const tests = await session.runAllTests();
  console.log(`Tests: ${tests.passed} passed, ${tests.failed} failed`);
});
```

### MCP Proxy (plug into any MCP client)

```bash
# Claude Code
claude mcp add --transport stdio xcode -- npx @kleinpanic/xcode-mcp-proxy

# Codex CLI
codex mcp add xcode -- npx @kleinpanic/xcode-mcp-proxy

# OpenClaw (mcporter)
mcporter add stdio xcode "npx @kleinpanic/xcode-mcp-proxy"
```

Set `XCODE_HOST=collins-pro` in your environment and it connects via SSH automatically.

---

## All 20 Xcode MCP Tools

| Category | Tools |
|----------|-------|
| **File Operations** | `XcodeRead` · `XcodeWrite` · `XcodeUpdate` · `XcodeGlob` · `XcodeGrep` · `XcodeLS` · `XcodeMakeDir` · `XcodeRM` · `XcodeMV` |
| **Build & Test** | `BuildProject` · `GetBuildLog` · `RunAllTests` · `RunSomeTests` · `GetTestList` |
| **Diagnostics** | `XcodeListNavigatorIssues` · `XcodeRefreshCodeIssuesInFile` |
| **Code Execution** | `ExecuteSnippet` |
| **Preview** | `RenderPreview` |
| **Documentation** | `DocumentationSearch` |
| **Windowing** | `XcodeListWindows` ⭐ *(call first)* |

---

## SDK Usage

### `XcodeClient` — direct, low-level access

```typescript
import { XcodeClient } from "@kleinpanic/xcode-mcp-sdk";

const client = new XcodeClient({ host: "collins-pro" });
await client.connect();

// Always get tabIdentifier first
const { windows } = await client.listWindows();
const tabId = windows[0]["tabIdentifier"];

// Build
const build = await client.buildProject({ "tabIdentifier": tabId });

// Swift REPL
const repl = await client.runSwiftREPL({
  "tabIdentifier": tabId,
  code: 'let arr = [1,2,3].map { $0 * 2 }; print(arr)',
});
console.log(repl.output); // [2, 4, 6]

// SwiftUI preview → base64 PNG
const preview = await client.getSwiftUIPreview({
  "tabIdentifier": tabId,
  filePath: "Sources/Views/ContentView.swift",
});

await client.disconnect();
```

### `XcodeSession` — managed session (recommended)

```typescript
import { XcodeSession, XcodeConnectionError } from "@kleinpanic/xcode-mcp-sdk";

const session = new XcodeSession({
  host: "collins-pro",
  projectPath: "MyApp",   // auto-selects matching window
});

await session.connect();

// No tabIdentifier needed — managed automatically
const result = await session.buildProject({ scheme: "MyApp" });
const refs = await session.getReferencesForSymbol({ symbol: "ContentView" });
const info = await session.getSymbolInfo({ symbol: "body" });

session.disconnect();
```

### Error handling

```typescript
import { XcodeBuildError, XcodeConnectionError, XcodeToolError } from "@kleinpanic/xcode-mcp-sdk";

try {
  await session.buildProject();
} catch (e) {
  if (e instanceof XcodeBuildError) {
    for (const issue of e.issues) {
      console.error(`${issue.file}:${issue.line} — ${issue.message}`);
    }
  } else if (e instanceof XcodeConnectionError) {
    console.error("Xcode not reachable — is it running?");
  }
}
```

---

## CLI Reference

```
xcmcp <command> [options]

Commands:
  connect    Verify SSH + Xcode availability
  doctor     Full preflight check
  list-tools List all 20 MCP tools
  call       Call any tool with JSON args
  build      Build the active project
  test       Run all tests
  clean      Clean build folder
  screenshot Capture simulator or screen PNG
  repl       Run Swift code in REPL
  preview    Render SwiftUI preview to PNG
  windows    List open Xcode windows

Options:
  --host <h>     Remote macOS host (default: $XCODE_HOST)
  --scheme <s>   Xcode scheme override
  --mode         screenshot mode: simulator|screen
  --out <path>   Output path for PNG files
  --file <path>  Swift file for preview command
  --json         Raw JSON output
```

Full man page: `man xcmcp` (after install) or [man/xcmcp.1](man/xcmcp.1)

---

## Agent Integration Guide

### AGENTS.md / CLAUDE.md snippet

Add this to your agent's bootstrap file:

```markdown
## Xcode MCP Tools

Xcode MCP tools are available when XCODE_HOST is set.
Use `xcmcp doctor` to verify connectivity before starting iOS/macOS work.
Always call XcodeListWindows first to get a tabIdentifier.
See: https://github.com/kleinpanic/xcode-mcp-suite
```

### Typical agentic workflow

```
1. xcmcp doctor --host $XCODE_HOST          # preflight
2. xcmcp windows --host $XCODE_HOST         # get tabIdentifier
3. xcmcp build --host $XCODE_HOST           # build → fix errors
4. xcmcp test --host $XCODE_HOST            # run tests
5. xcmcp preview --file ContentView.swift   # visual audit
6. xcmcp repl 'MyModel().validate()'        # spot-check logic
```

---

## Examples

See [examples/](examples/) for complete runnable scripts:

- [`build-and-test.ts`](examples/build-and-test.ts) — full CI-style build + test cycle
- [`swiftui-audit.ts`](examples/swiftui-audit.ts) — render preview + AI analysis loop
- [`repl-session.ts`](examples/repl-session.ts) — interactive Swift REPL session

---

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

---

## Documentation

- [Apple Official Docs](docs/apple-official.md) — verbatim Apple documentation (local copy)
- [Tools Reference](docs/tools-reference.md) — all 20 tools with params and return types
- [Quickstart](docs/quickstart.md)
- [Agent Integration Guide](docs/agent-integration.md)
- [Man page](man/xcmcp.1) — `man -l man/xcmcp.1`

---

## License

MIT © kleinpanic

## Visual Interaction (Simulator)

The CLI includes a `ui` subcommand for seeing and interacting with the running simulator — enabling a full visual agent loop:

```bash
# See: capture simulator state
xcmcp screenshot --host collins-pro --mode simulator --out /tmp/snap.png
# → feed PNG to image/vision tool for coordinate analysis

# Interact: tap, type, swipe
xcmcp ui tap   --host collins-pro 195 420
xcmcp ui type  --host collins-pro "hello world"
xcmcp ui swipe --host collins-pro 200 600 200 200
xcmcp ui key   --host collins-pro 36        # Return

# Log: stream live app output
xcmcp ui log --host collins-pro
```

The loop: **screenshot → analyze coordinates → interact → screenshot → verify**
