# xcode-mcp-suite — Agent Context

This repo is the Xcode MCP Suite: SDK, CLI, and proxy for Xcode's `xcrun mcpbridge`.

## Structure

```
packages/sdk/      TypeScript SDK (@kleinpanic/xcode-mcp-sdk)
packages/cli/      CLI tool (@kleinpanic/xcmcp)
packages/mcp-proxy/ Standalone MCP proxy (@kleinpanic/xcode-mcp-proxy)
docs/              Documentation (tools-reference, quickstart, agent-integration, apple-official)
man/               Man page (xcmcp.1)
examples/          Runnable TypeScript examples
```

## Dev Commands

```bash
pnpm install       # install all deps
pnpm build         # build all packages
pnpm test          # run unit tests
pnpm typecheck     # TypeScript strict check
pnpm lint          # ESLint
man -l man/xcmcp.1 # read the man page
```

## Rules

- TypeScript strict mode — no `any`, no suppressions
- All tools must have typed params AND typed return interfaces in `packages/sdk/src/types.ts`
- Tests live in `packages/*/src/__tests__/`; mock child_process for unit tests (no live Xcode needed)
- Man page must be valid groff — validate with `man -l man/xcmcp.1`
- CI must pass before merge

## Apple Docs Reference

https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode

## Important Notes

- `XcodeListWindows` must ALWAYS be called first to get a `tab-identifier`
- The proxy is a transparent JSON-RPC stdio pipe — keep it minimal
- `XcodeSession` handles `tab-identifier` lifecycle automatically (preferred for SDK users)
