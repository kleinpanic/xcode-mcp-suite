# Quickstart

Get started with `xcode-mcp-suite` in under 5 minutes.

## Prerequisites

- **Xcode 26.3+** running on macOS with a project open
- **Xcode Settings > Intelligence > Model Context Protocol > Xcode Tools** enabled
- **Node.js 20+**
- SSH access to your Mac (if working remotely)

## Install

```bash
# Install CLI globally
npm install -g @kleinpanic/xcmcp

# Or use the SDK in your project
npm install @kleinpanic/xcode-mcp-sdk
```

## Verify Setup

```bash
# Local Xcode
xcmcp doctor

# Remote Xcode (SSH)
XCODE_HOST=your-mac xcmcp doctor
# or
xcmcp doctor --host your-mac
```

## CLI Usage

```bash
# Build
xcmcp build --host collins-pro

# Run tests
xcmcp test --host collins-pro --scheme MyApp

# Swift REPL
xcmcp repl --host collins-pro 'print("Hello from Xcode REPL!")'

# Screenshot
xcmcp screenshot --host collins-pro --mode simulator --out ui.png

# Call any tool directly
xcmcp call DocumentationSearch '{"query": "SwiftUI"}'
```

## SDK Usage

```typescript
import { XcodeSession } from "@kleinpanic/xcode-mcp-sdk";

const session = new XcodeSession({ host: "collins-pro" });
const window = await session.connect();

// Build
const buildResult = await session.buildProject({ scheme: "MyApp" });
console.log(`Build ${buildResult.success ? "succeeded" : "failed"}`);

// Run tests
const testResult = await session.runAllTests();
console.log(`${testResult.passed} passed, ${testResult.failed} failed`);

// Swift REPL
const repl = await session.runSwiftREPL({ code: "print(1 + 1)" });
console.log(repl.output); // "2\n"

session.disconnect();
```

## MCP Proxy for AI Agents

Register as an MCP server for Claude Code, Codex, or any MCP client:

```bash
# Claude Code
claude mcp add --transport stdio xcode -- npx @kleinpanic/xcode-mcp-proxy

# Codex
codex mcp add xcode -- npx @kleinpanic/xcode-mcp-proxy

# Set host via environment
XCODE_HOST=collins-pro claude mcp add --transport stdio xcode -- npx @kleinpanic/xcode-mcp-proxy
```

## Next Steps

- [Tools Reference](./tools-reference.md) — All 20 tools with parameters and return types
- [Agent Integration](./agent-integration.md) — Detailed agent wiring guide
- [Apple Official Docs](./apple-official.md) — Verbatim Apple documentation
