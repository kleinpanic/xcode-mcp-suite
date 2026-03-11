# Agent Integration Guide

How to wire `xcode-mcp-suite` into AI coding agents.

## Architecture

```
┌─────────────┐     stdio      ┌──────────────────┐     SSH stdio     ┌─────────────┐
│  AI Agent    │ ──────────────→│  xcode-mcp-proxy │ ────────────────→│ xcrun       │
│ (Claude,     │     JSON-RPC   │  (on your dev    │   JSON-RPC       │ mcpbridge   │
│  Codex, etc) │ ←──────────────│   machine)       │ ←────────────────│ (on Mac)    │
└─────────────┘                └──────────────────┘                  └─────────────┘
```

The proxy is a transparent stdio pipe. It forwards MCP JSON-RPC messages between the AI agent and Xcode's `xcrun mcpbridge`.

## Claude Code

### Direct (Xcode on same machine)

```bash
claude mcp add --transport stdio xcode -- xcrun mcpbridge
```

### Via proxy (Xcode on remote Mac)

```bash
XCODE_HOST=collins-pro claude mcp add --transport stdio xcode -- npx @kleinpanic/xcode-mcp-proxy
```

### CLAUDE.md / AGENTS.md snippet

Add to your project's `CLAUDE.md` for automatic Xcode awareness:

```markdown
## Xcode MCP

This project uses Xcode's MCP bridge for builds and tests.
Xcode is running on `collins-pro` with the MCP proxy registered.

### Workflow
1. Always call `XcodeListWindows` first to get a tab-identifier
2. Use `BuildProject` to build, check `GetBuildLog` for errors
3. Run `RunAllTests` after fixes, verify with `GetTestList`
4. Use `RenderPreview` for visual auditing of UI changes

### Available tools
All 20 Xcode MCP tools are available via the `xcode` MCP server.
```

## Codex CLI

```bash
codex mcp add xcode -- npx @kleinpanic/xcode-mcp-proxy
```

Or with a remote host:

```bash
codex mcp add xcode -- env XCODE_HOST=collins-pro npx @kleinpanic/xcode-mcp-proxy
```

## OpenClaw

```bash
# Using mcporter
mcporter add stdio xcode "npx @kleinpanic/xcode-mcp-proxy"

# With environment
mcporter add stdio xcode "env XCODE_HOST=collins-pro npx @kleinpanic/xcode-mcp-proxy"
```

## Custom Agents

If you're building your own agent, use the SDK directly:

```typescript
import { XcodeSession, withXcodeSession } from "@kleinpanic/xcode-mcp-sdk";

// One-shot usage
const result = await withXcodeSession(
  { host: "collins-pro" },
  async (session) => {
    const build = await session.buildProject({ scheme: "MyApp" });
    if (!build.success) {
      const log = await session.getBuildLog({ severity: "error" });
      return { success: false, errors: log.entries };
    }
    const tests = await session.runAllTests();
    return { success: tests.failed === 0, tests };
  },
);
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `XCODE_HOST` | Remote macOS host (SSH alias or hostname) | Local |
| `XCODE_SSH_ARGS` | Extra SSH arguments (space-separated) | None |

## Troubleshooting

**Agent can't connect:**
1. Run `xcmcp doctor --host <your-mac>` to diagnose
2. Ensure Xcode Settings > Intelligence > Xcode Tools is enabled
3. Verify SSH connectivity: `ssh -T <your-mac> echo ok`
4. Check that Xcode has a project open

**Tools return empty results:**
- Always call `XcodeListWindows` first and use the returned `tab-identifier`
- Ensure the project is fully indexed (wait for Xcode to finish processing)

**Timeout errors:**
- Builds and test runs can take a while; increase timeout if needed
- Set `XCODE_TIMEOUT` or use `timeout` option in SDK
