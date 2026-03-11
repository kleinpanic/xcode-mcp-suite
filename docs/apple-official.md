# Giving External Agentic Coding Tools Access to Xcode

> **Source:** https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode  
> **Retrieved:** 2026-03-11  
> **© Apple Inc.** All rights reserved. Reproduced here for local reference per fair use.

---

## Overview

You can give permission for another agentic coding tool to modify your Xcode project and perform actions, such as building your app.

First, let Xcode know in settings that you plan to use an external third-party agentic coding tool for development. Then configure the agentic coding tool to access Xcode capabilities through the MCP server that Xcode provides.

---

## Update Intelligence Settings

Open Xcode settings and navigate to the Intelligence section. Under **Model Context Protocol**, turn on the **Xcode Tools** toggle to allow external agentic coding tools to access Xcode.

**Xcode → Settings → Intelligence → Model Context Protocol → Xcode Tools: ON**

---

## Configure the Agentic Coding Tool

After enabling the Intelligence setting, configure your agentic coding tool to use the MCP server that Xcode provides. Use `xcrun mcpbridge` as the command that starts the MCP server.

### Claude Code

```bash
claude mcp add --transport stdio xcode -- xcrun mcpbridge
```

### Codex CLI

```bash
codex mcp add xcode -- xcrun mcpbridge
```

### Any MCP-compatible client

Use stdio transport with the command: `xcrun mcpbridge`

The bridge provides all Xcode capabilities as MCP tools over a JSON-RPC stdio connection.

---

## Available Tools (20)

Once configured, the following tools are available to your agent:

### Build & Test
- **BuildProject** — Build the active scheme
- **GetBuildLog** — Fetch build log entries (filter by severity)
- **RunAllTests** — Run all tests in the active scheme
- **GetTestResults** — Retrieve results from the most recent test run
- **CleanBuildFolder** — Clean derived data

### Files & Navigation
- **XcodeListWindows** — List open Xcode windows and their tab-identifiers *(call first)*
- **XcodeOpenFile** — Open a file in the Xcode editor
- **XcodeNavigateToSymbol** — Jump to a named symbol
- **XcodeGetFileContents** — Read file contents through Xcode's buffer (includes unsaved changes)
- **XcodeRefreshCodeIssuesInFile** — Re-run diagnostics on a specific file

### Diagnostics & Intelligence
- **XcodeGetDiagnostics** — Get current diagnostics (errors, warnings) for the project or a file
- **XcodeGetSymbolInfo** — Look up type, declaration, and documentation for a symbol
- **XcodeSearchDocumentation** — Search Apple developer documentation
- **XcodeGetCompletions** — Get code completions at a cursor position
- **XcodeGetReferencesForSymbol** — Find all references to a symbol across the project

### Swift REPL & Previews
- **XcodeRunSwiftREPL** — Execute Swift code in the REPL
- **XcodeGetSwiftUIPreview** — Render a SwiftUI preview (returns base64 PNG)
- **XcodeRefreshSwiftUIPreview** — Refresh the preview for a file

### Simulator
- **XcodeListSimulators** — List available simulators and their boot state
- **XcodeRunOnSimulator** — Build and run the app on a simulator

---

## Important Notes

- **`XcodeListWindows` must be called first** to obtain a `tab-identifier`, which is required by all other tools.
- Xcode must be running with at least one project/workspace open.
- The Intelligence toggle must remain enabled for the MCP server to accept connections.
- `xcrun mcpbridge` uses JSON-RPC 2.0 over stdio (MCP protocol version `2024-11-05`).

---

*This is a local reference copy. For the most current information, see the [official Apple documentation](https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode).*
