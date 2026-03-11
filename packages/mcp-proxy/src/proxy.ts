#!/usr/bin/env node
/**
 * xcode-mcp-proxy — Standalone MCP proxy for xcrun mcpbridge.
 *
 * Bridges any MCP client (Claude Code, Codex, OpenClaw, etc.) to
 * Xcode running on a remote macOS host via SSH stdio.
 *
 * Usage:
 *   npx @kleinpanic/xcode-mcp-proxy
 *
 * Environment:
 *   XCODE_HOST      Remote macOS host (required for remote mode)
 *   XCODE_SSH_ARGS  Extra SSH arguments (space-separated)
 *
 * @see https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode
 */

import { spawn } from "node:child_process";

const host = process.env["XCODE_HOST"] ?? "";
const sshArgs = (process.env["XCODE_SSH_ARGS"] ?? "").split(" ").filter(Boolean);

const [cmd, args] = host
  ? ["ssh", [...sshArgs, "-T", host, "xcrun", "mcpbridge"]]
  : ["xcrun", ["mcpbridge"]];

// Transparent stdio proxy — pipe stdin → mcpbridge stdin, mcpbridge stdout → stdout
const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "inherit"] });

process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);

child.on("exit", (code) => process.exit(code ?? 0));
process.on("exit", () => child.kill());
process.on("SIGINT", () => { child.kill("SIGINT"); process.exit(0); });
process.on("SIGTERM", () => { child.kill("SIGTERM"); process.exit(0); });
