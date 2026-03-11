#!/usr/bin/env node
/**
 * xcmcp — Xcode MCP CLI
 *
 * @see https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode
 */

import { execSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { XcodeClient, XcodeSession, withXcodeSession } from "@kleinpanic/xcode-mcp-sdk";

const VERSION = "0.1.0";
const APPLE_DOCS_URL =
  "https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode";

// ─── Arg helpers ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0] ?? "help";
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};

function host(): string {
  return opt("host") ?? process.env["XCODE_HOST"] ?? "";
}

function die(msg: string, code = 1): never {
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
  process.exit(code);
}

function ok(msg: string) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ─── Commands ─────────────────────────────────────────────────────────────

async function cmdHelp() {
  console.log(`
\x1b[1mxcmcp\x1b[0m — Xcode MCP CLI v${VERSION}

\x1b[1mUSAGE\x1b[0m
  xcmcp <command> [options]

\x1b[1mCOMMANDS\x1b[0m
  connect [--host <host>]        Verify SSH connection and Xcode availability
  doctor  [--host <host>]        Full preflight check
  list-tools                     List all 20 available Xcode MCP tools
  call <tool> [json]             Call any tool with optional JSON arguments
  build   [--host <h>] [--scheme <s>]   Build the active project
  test    [--host <h>] [--scheme <s>]   Run all tests
  clean   [--host <h>]           Clean build folder
  screenshot [--host <h>] [--mode simulator|screen] [--out <path>]
  repl    [--host <h>] <swift-code>     Run Swift code in REPL
  preview [--host <h>] --file <path>    Get SwiftUI preview (saves PNG)
  windows [--host <h>]           List open Xcode windows

\x1b[1mOPTIONS\x1b[0m
  --host <host>    Remote macOS host (default: \$XCODE_HOST or local)
  --json           Output raw JSON
  --version        Show version
  --help           Show this help

\x1b[1mENVIRONMENT\x1b[0m
  XCODE_HOST       Default remote host (e.g. "collins-pro")

\x1b[1mEXAMPLES\x1b[0m
  xcmcp doctor --host collins-pro
  xcmcp build --host collins-pro --scheme MyApp
  xcmcp test --host collins-pro
  xcmcp repl --host collins-pro 'print(1 + 1)'
  xcmcp screenshot --host collins-pro --mode simulator --out /tmp/ui.png
  xcmcp call XcodeListWindows '{}'

\x1b[1mDOCS\x1b[0m
  ${APPLE_DOCS_URL}
`);
}

async function cmdConnect() {
  const h = host();
  section(`Connecting to Xcode${h ? ` on ${h}` : " (local)"}`);
  const client = new XcodeClient({ host: h });
  try {
    await client.connect();
    ok("Connected to xcrun mcpbridge");
    const { windows } = await client.listWindows();
    ok(`Found ${windows.length} Xcode window(s)`);
    for (const w of windows) {
      console.log(`  • ${w.title} [${w["tab-identifier"]}]`);
    }
    client.disconnect();
  } catch (e) {
    die(String(e));
  }
}

async function cmdDoctor() {
  const h = host();
  section("Xcode MCP Doctor");
  let ok_ = true;

  // 1. SSH reachability
  if (h) {
    try {
      execSync(`ssh -T -o ConnectTimeout=5 ${h} echo ok`, { stdio: "pipe" });
      ok(`SSH to ${h} reachable`);
    } catch {
      console.error(`\x1b[31m✗\x1b[0m SSH to ${h} failed`);
      ok_ = false;
    }
  } else {
    ok("Running locally (no host)");
  }

  // 2. xcrun mcpbridge
  if (!h) {
    try {
      execSync("xcrun mcpbridge --help 2>&1 | head -1", { stdio: "pipe" });
      ok("xcrun mcpbridge available");
    } catch {
      console.error("\x1b[31m✗\x1b[0m xcrun mcpbridge not found — Xcode 26.3+ required");
      ok_ = false;
    }
  }

  // 3. MCP connection
  const client = new XcodeClient({ host: h, timeout: 10_000 });
  try {
    await client.connect();
    ok("MCP protocol handshake successful");
    const { windows } = await client.listWindows();
    if (windows.length > 0) {
      ok(`Xcode open with ${windows.length} window(s)`);
      for (const w of windows) console.log(`  • ${w.title}`);
    } else {
      console.warn("  ⚠ No Xcode windows — open a project");
    }
    client.disconnect();
  } catch (e) {
    console.error(`\x1b[31m✗\x1b[0m MCP connection failed: ${e}`);
    ok_ = false;
  }

  console.log();
  if (ok_) {
    ok("All checks passed — ready for agentic coding!");
  } else {
    die("Some checks failed. Check Xcode Settings → Intelligence → enable Xcode Tools.");
  }
}

async function cmdListTools() {
  const tools = [
    { category: "Build & Test", tools: ["BuildProject", "GetBuildLog", "RunAllTests", "GetTestResults", "CleanBuildFolder"] },
    { category: "Files & Navigation", tools: ["XcodeListWindows", "XcodeOpenFile", "XcodeNavigateToSymbol", "XcodeGetFileContents", "XcodeRefreshCodeIssuesInFile"] },
    { category: "Diagnostics & Intelligence", tools: ["XcodeGetDiagnostics", "XcodeGetSymbolInfo", "XcodeSearchDocumentation", "XcodeGetCompletions", "XcodeGetReferencesForSymbol"] },
    { category: "Swift REPL & Previews", tools: ["XcodeRunSwiftREPL", "XcodeGetSwiftUIPreview", "XcodeRefreshSwiftUIPreview"] },
    { category: "Simulator", tools: ["XcodeListSimulators", "XcodeRunOnSimulator"] },
  ];
  console.log("\nXcode MCP Tools (20 total)\n");
  for (const g of tools) {
    console.log(`\x1b[1m${g.category}\x1b[0m`);
    for (const t of g.tools) console.log(`  ${t}`);
  }
  console.log(`\nDocs: ${APPLE_DOCS_URL}\n`);
}

async function cmdCall() {
  const toolName = args[1];
  if (!toolName) die("Usage: xcmcp call <ToolName> [json-args]");
  const rawArgs = args[2] ? JSON.parse(args[2]) : {};
  const client = new XcodeClient({ host: host() });
  await client.connect();
  try {
    // Use internal _call directly via cast
    const result = await (client as any)._tool(toolName, rawArgs);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.disconnect();
  }
}

async function cmdBuild() {
  await withXcodeSession({ host: host() }, async (s) => {
    console.log("Building…");
    try {
      const scheme = opt("scheme");
      const r = await s.buildProject(scheme ? { scheme } : {});
      ok(`Build succeeded (${r.warnings.length} warning(s))`);
    } catch (e: any) {
      if (e.issues) {
        for (const i of e.issues) console.error(`  ${i.file}:${i.line}: ${i.message}`);
      }
      die("Build failed");
    }
  });
}

async function cmdTest() {
  await withXcodeSession({ host: host() }, async (s) => {
    console.log("Running tests…");
    const r = await s.runAllTests();
    console.log(`Passed: ${r.passed}  Failed: ${r.failed}  Skipped: ${r.skipped}  (${r.duration}s)`);
    if (r.failed > 0) {
      for (const f of r.failures) console.error(`  ✗ ${f.testName}: ${f.message}`);
      process.exit(1);
    }
    ok("All tests passed");
  });
}

async function cmdClean() {
  await withXcodeSession({ host: host() }, async (s) => {
    await s.cleanBuildFolder();
    ok("Build folder cleaned");
  });
}

async function cmdScreenshot() {
  const mode = (opt("mode") ?? "simulator") as "simulator" | "screen";
  const out = opt("out") ?? `/tmp/xcode-screenshot-${Date.now()}.png`;
  const h = host();
  const remoteTmp = `/tmp/xcmcp-shot-${Date.now()}.png`;

  console.log(`Capturing ${mode} screenshot${h ? ` from ${h}` : ""}…`);
  try {
    if (h) {
      if (mode === "simulator") {
        execSync(`ssh ${h} "xcrun simctl io booted screenshot '${remoteTmp}'"`, { stdio: "inherit" });
      } else {
        execSync(`ssh ${h} "screencapture -x '${remoteTmp}'"`, { stdio: "inherit" });
      }
      execSync(`scp -q "${h}:${remoteTmp}" "${out}"`, { stdio: "inherit" });
      execSync(`ssh ${h} "rm -f '${remoteTmp}'"`, { stdio: "pipe" });
    } else {
      if (mode === "simulator") {
        execSync(`xcrun simctl io booted screenshot "${out}"`, { stdio: "inherit" });
      } else {
        execSync(`screencapture -x "${out}"`, { stdio: "inherit" });
      }
    }
    ok(`Screenshot saved: ${out}`);
  } catch (e) {
    die(`Screenshot failed: ${e}`);
  }
}

async function cmdRepl() {
  const code = args.slice(flag("host") ? 3 : 1).join(" ");
  if (!code) die("Usage: xcmcp repl [--host <h>] <swift-code>");
  await withXcodeSession({ host: host() }, async (s) => {
    const r = await s.runSwiftREPL({ code });
    if (r.error) die(r.error);
    process.stdout.write(r.output);
  });
}

async function cmdPreview() {
  const file = opt("file");
  if (!file) die("Usage: xcmcp preview --file <path.swift> [--out <path.png>]");
  const out = opt("out") ?? `/tmp/xcode-preview-${Date.now()}.png`;
  await withXcodeSession({ host: host() }, async (s) => {
    const r = await s.getSwiftUIPreview({ filePath: file });
    if (r.error || !r.imageData) die(r.error ?? "No preview returned");
    writeFileSync(out, Buffer.from(r.imageData!, "base64"));
    ok(`Preview saved: ${out}`);
  });
}

async function cmdWindows() {
  const client = new XcodeClient({ host: host() });
  await client.connect();
  const { windows } = await client.listWindows();
  if (flag("json")) { console.log(JSON.stringify(windows, null, 2)); }
  else {
    for (const w of windows) {
      console.log(`${w["tab-identifier"]}  ${w.title}`);
      if (w.projectPath) console.log(`  project: ${w.projectPath}`);
    }
  }
  client.disconnect();
}

// ─── Router ───────────────────────────────────────────────────────────────

(async () => {
  if (flag("version")) { console.log(`xcmcp v${VERSION}`); process.exit(0); }
  switch (cmd) {
    case "connect":    await cmdConnect();    break;
    case "doctor":     await cmdDoctor();     break;
    case "list-tools": await cmdListTools();  break;
    case "call":       await cmdCall();       break;
    case "build":      await cmdBuild();      break;
    case "test":       await cmdTest();       break;
    case "clean":      await cmdClean();      break;
    case "screenshot": await cmdScreenshot(); break;
    case "repl":       await cmdRepl();       break;
    case "preview":    await cmdPreview();    break;
    case "windows":    await cmdWindows();    break;
    case "help":
    case "--help":
    case "-h":
    default:           await cmdHelp();       break;
  }
})().catch((e) => { console.error(e); process.exit(1); });
