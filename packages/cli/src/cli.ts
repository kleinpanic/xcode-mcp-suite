#!/usr/bin/env node
/**
 * xcmcp — Xcode MCP CLI
 *
 * @see https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode
 */

import { execSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { XcodeClient, withXcodeSession } from "@kleinpanic/xcode-mcp-sdk";

const VERSION = "0.2.0";
const APPLE_DOCS_URL =
  "https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode";

// ─── Arg helpers ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0] ?? "help";

/** Check if --flag is present anywhere in args. */
const flag = (name: string) => args.includes(`--${name}`);

/** Get --name <value> from anywhere in args. */
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
};

/** Get positional args (after command), stripping --key value pairs. */
function positionalArgs(startIndex = 1): string[] {
  const result: string[] = [];
  let i = startIndex;
  while (i < args.length) {
    if (args[i]!.startsWith("--")) {
      i += 2; // skip --key value
    } else {
      result.push(args[i]!);
      i++;
    }
  }
  return result;
}

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
  connect [--host <host>]        Verify MCP connection and list Xcode windows
  doctor  [--host <host>]        Full preflight check
  list-tools                     List all 20 available Xcode MCP tools
  call <tool> [json]             Call any tool with optional JSON arguments
  build   [--host <h>] [--scheme <s>]   Build the active project
  test    [--host <h>] [--scheme <s>]   Run all tests
  test-some [--host <h>] <test1> <test2>  Run specific tests
  screenshot [--host <h>] [--mode simulator|screen] [--out <path>]
  repl    [--host <h>] <swift-code>     Run Swift code via ExecuteSnippet
  preview [--host <h>] --file <path>    Render SwiftUI preview (saves PNG)
  docs    [--host <h>] <query>          Search Apple docs + WWDC transcripts
  windows [--host <h>]           List open Xcode windows + tabIdentifiers
  ui      <subcommand>           Simulator interaction (tap/type/swipe/key/log)

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
  xcmcp preview --host collins-pro --file Sources/ContentView.swift
  xcmcp docs --host collins-pro "SwiftUI List selection"
  xcmcp screenshot --host collins-pro --mode simulator --out /tmp/ui.png
  xcmcp ui tap --host collins-pro 195 420
  xcmcp call XcodeRead '{"tabIdentifier":"windowtab1","filePath":"main.swift"}'

\x1b[1mTCC NOTE\x1b[0m
  Tools that trigger Xcode automation (BuildProject, RenderPreview, ExecuteSnippet,
  RunAllTests, RunSomeTests, GetTestList) require macOS Automation permission.
  On first use, macOS shows a TCC dialog on the Mac — click "Allow" in Xcode.
  Over SSH, ensure the dialog has been accepted on the physical machine first.
  Read-only tools (XcodeRead, XcodeLS, XcodeGrep, DocumentationSearch) work
  without TCC permission.

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
    const result = await client.listWindows();
    const windows = result.windows ?? [];
    if (windows.length === 0) {
      console.warn("  ⚠ No Xcode windows found — open a project in Xcode");
      if (result.message) console.log(`  Raw: ${result.message}`);
    } else {
      ok(`Found ${windows.length} Xcode window(s)`);
      for (const w of windows) {
        console.log(`  • ${w.tabIdentifier}  ${w.workspacePath ?? "(no workspace)"}`);
      }
    }
    client.disconnect();
  } catch (e) {
    die(String(e));
  }
}

async function cmdDoctor() {
  const h = host();
  section("Xcode MCP Doctor");
  let pass = true;

  // 1. SSH reachability (remote only)
  if (h) {
    try {
      execSync(`ssh -T -o ConnectTimeout=5 ${h} echo ok`, { stdio: "pipe" });
      ok(`SSH to ${h} reachable`);
    } catch {
      console.error(`\x1b[31m✗\x1b[0m SSH to ${h} failed`);
      pass = false;
    }
  } else {
    ok("Running locally (no --host)");
  }

  // 2. xcrun mcpbridge availability
  try {
    const testCmd = h
      ? `ssh -T -o ConnectTimeout=5 ${h} "xcrun mcpbridge --help 2>&1 | head -1"`
      : `xcrun mcpbridge --help 2>&1 | head -1`;
    execSync(testCmd, { stdio: "pipe" });
    ok("xcrun mcpbridge available");
  } catch {
    console.error("\x1b[31m✗\x1b[0m xcrun mcpbridge not found — Xcode 26.3+ required");
    pass = false;
  }

  // 3. MCP connection + windows
  const client = new XcodeClient({ host: h, timeout: 10_000 });
  try {
    await client.connect();
    ok("MCP protocol handshake successful");
    const result = await client.listWindows();
    const windows = result.windows ?? [];
    if (windows.length > 0) {
      ok(`Xcode open with ${windows.length} window(s)`);
      for (const w of windows) console.log(`  • ${w.tabIdentifier}  ${w.workspacePath ?? ""}`);
    } else {
      console.warn("  ⚠ No Xcode windows found — open a project in Xcode");
    }
    client.disconnect();
  } catch (e) {
    console.error(`\x1b[31m✗\x1b[0m MCP connection failed: ${e}`);
    pass = false;
  }

  // 4. TCC note
  console.log("\n  ℹ TCC Note: BuildProject, RenderPreview, ExecuteSnippet, RunAllTests,");
  console.log("    RunSomeTests, GetTestList require macOS Automation permission.");
  console.log("    Accept the TCC dialog on the Mac on first use.");

  console.log();
  if (pass) {
    ok("All checks passed — ready for agentic coding!");
  } else {
    die("Some checks failed. Check Xcode Settings → Intelligence → enable Xcode Tools.");
  }
}

async function cmdListTools() {
  const tools = [
    {
      category: "File Operations (9)",
      tools: [
        "XcodeRead              Read file from project (includes unsaved buffer)",
        "XcodeWrite             Write full file content (create/overwrite)",
        "XcodeUpdate            str_replace-style file patch (oldText → newText)",
        "XcodeGlob              Find files by glob pattern (e.g. **/*.swift)",
        "XcodeGrep              Search file contents",
        "XcodeLS                List directory contents",
        "XcodeMakeDir           Create directories",
        "XcodeRM                Remove files/directories",
        "XcodeMV                Move/rename files",
      ],
    },
    {
      category: "Build & Test (5)",
      tools: [
        "BuildProject           Build active scheme [TCC]",
        "GetBuildLog            Get build output (filter by severity)",
        "RunAllTests            Run all tests in active scheme [TCC]",
        "RunSomeTests           Run specific tests by identifier [TCC]",
        "GetTestList            List all available tests [TCC]",
      ],
    },
    {
      category: "Diagnostics (2)",
      tools: [
        "XcodeListNavigatorIssues        All project errors/warnings",
        "XcodeRefreshCodeIssuesInFile     Live diagnostics for one file",
      ],
    },
    {
      category: "Code Execution (1)",
      tools: [
        "ExecuteSnippet         Run Swift code in REPL-like env [TCC]",
      ],
    },
    {
      category: "Preview (1)",
      tools: [
        "RenderPreview          SwiftUI preview → base64 PNG image [TCC]",
      ],
    },
    {
      category: "Documentation (1)",
      tools: [
        "DocumentationSearch    Search Apple docs + WWDC transcripts (MLX semantic)",
      ],
    },
    {
      category: "Windowing (1)",
      tools: [
        "XcodeListWindows       ⭐ Call first — get tabIdentifier for all tools",
      ],
    },
  ];

  console.log("\nXcode MCP Tools (20 total)\n");
  for (const g of tools) {
    console.log(`\x1b[1m${g.category}\x1b[0m`);
    for (const t of g.tools) console.log(`  ${t}`);
    console.log();
  }
  console.log("[TCC] = requires macOS Automation permission (TCC dialog on first use)");
  console.log(`\nDocs: ${APPLE_DOCS_URL}\n`);
}

async function cmdCall() {
  const pos = positionalArgs();
  const toolName = pos[0];
  if (!toolName) die("Usage: xcmcp call <ToolName> [json-args]");
  const rawArgs = pos[1] ? JSON.parse(pos[1]) : {};
  const client = new XcodeClient({ host: host() });
  await client.connect();
  try {
    const result = await client.callTool(toolName, rawArgs);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    client.disconnect();
  }
}

async function cmdBuild() {
  await withXcodeSession({ host: host() }, async (s: any) => {
    console.log("Building…");
    try {
      const r = await s.buildProject();
      const warnCount = r.errors?.filter((e: any) => e.classification === "warning").length ?? 0;
      ok(`Build ${r.buildResult}${warnCount > 0 ? ` (${warnCount} warning(s))` : ""}`);
      if (r.elapsedTime) console.log(`  ⏱ ${r.elapsedTime.toFixed(1)}s`);
      if (flag("json")) console.log(JSON.stringify(r, null, 2));
    } catch (e: any) {
      if (e.name === "XcodeBuildError" && e.errors) {
        console.error("\nBuild errors:");
        for (const i of e.errors) {
          console.error(`  ${i.filePath ?? "?"}:${i.lineNumber ?? "?"}: ${i.message}`);
        }
      }
      die("Build failed");
    }
  });
}

async function cmdTest() {
  await withXcodeSession({ host: host() }, async (s: any) => {
    console.log("Running tests…");
    const r = await s.runAllTests();
    if (flag("json")) {
      console.log(JSON.stringify(r, null, 2));
    } else {
      const c = r.counts ?? {};
      console.log(`  Passed: ${c.passed ?? "?"}  Failed: ${c.failed ?? "?"}  Skipped: ${c.skipped ?? 0}  Total: ${c.total ?? "?"}`);
      const failed = r.results?.filter((t: any) => t.state === "failed") ?? [];
      if (failed.length > 0) {
        console.error("\nFailures:");
        for (const f of failed) {
          console.error(`  ✗ ${f.displayName} (${f.identifier})`);
        }
        process.exit(1);
      }
      ok(r.summary ?? "All tests passed");
    }
  });
}

async function cmdTestSome() {
  const tests = positionalArgs();
  if (tests.length === 0) die("Usage: xcmcp test-some [--host <h>] <TestClass/testMethod> ...");
  await withXcodeSession({ host: host() }, async (s: any) => {
    console.log(`Running ${tests.length} test(s)…`);
    const r = await s.runSomeTests(tests);
    if (flag("json")) {
      console.log(JSON.stringify(r, null, 2));
    } else {
      const c = r.counts ?? {};
      console.log(`  Passed: ${c.passed ?? "?"}  Failed: ${c.failed ?? "?"}  Total: ${c.total ?? "?"}`);
      const failed = r.results?.filter((t: any) => t.state === "failed") ?? [];
      if (failed.length > 0) {
        for (const f of failed) console.error(`  ✗ ${f.displayName} (${f.identifier})`);
        process.exit(1);
      }
      ok(r.summary ?? "Tests passed");
    }
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
        execSync(`ssh ${h} "xcrun simctl io booted screenshot '${remoteTmp}'"`, { stdio: "pipe" });
      } else {
        execSync(`ssh ${h} "screencapture -x '${remoteTmp}'"`, { stdio: "pipe" });
      }
      execSync(`scp -q "${h}:${remoteTmp}" "${out}"`, { stdio: "pipe" });
      execSync(`ssh ${h} "rm -f '${remoteTmp}'"`, { stdio: "pipe" });
    } else {
      if (mode === "simulator") {
        execSync(`xcrun simctl io booted screenshot "${out}"`, { stdio: "pipe" });
      } else {
        execSync(`screencapture -x "${out}"`, { stdio: "pipe" });
      }
    }
    ok(`Screenshot saved: ${out}`);
  } catch (e) {
    die(`Screenshot failed: ${e}`);
  }
}

async function cmdRepl() {
  const pos = positionalArgs();
  const code = pos.join(" ");
  if (!code) die("Usage: xcmcp repl [--host <h>] <swift-code>");
  const sourceFile = opt("file") ?? "main.swift";
  await withXcodeSession({ host: host() }, async (s: any) => {
    const r = await s.executeSnippet(code, sourceFile);
    if (r.error) {
      console.error(`\x1b[31m${r.error.message}\x1b[0m`);
      process.exit(1);
    }
    if (r.executionResults) process.stdout.write(r.executionResults);
  });
}

async function cmdPreview() {
  const file = opt("file");
  if (!file) die("Usage: xcmcp preview --file <path.swift> [--out <path.png>] [--name <PreviewName>]");
  const out = opt("out") ?? `/tmp/xcode-preview-${Date.now()}.png`;
  const previewName = opt("name");
  await withXcodeSession({ host: host() }, async (s: any) => {
    const r = await s.renderPreview(file, previewName);
    if (r.error || !r.imageData) die(r.error ?? "No preview returned — check the file has a #Preview or PreviewProvider");
    writeFileSync(out, Buffer.from(r.imageData, "base64"));
    ok(`Preview saved: ${out}`);
  });
}

async function cmdDocs() {
  const pos = positionalArgs();
  const query = pos.join(" ");
  if (!query) die("Usage: xcmcp docs [--host <h>] <search query>");
  await withXcodeSession({ host: host() }, async (s: any) => {
    const r = await s.searchDocumentation(query);
    if (flag("json")) {
      console.log(JSON.stringify(r, null, 2));
    } else {
      if (!r.documents || r.documents.length === 0) {
        console.log("No results found.");
        return;
      }
      for (const doc of r.documents) {
        console.log(`\n\x1b[1m${doc.title}\x1b[0m (score: ${doc.score.toFixed(3)})`);
        if (doc.contents) console.log(`  ${doc.contents.slice(0, 200)}${doc.contents.length > 200 ? "…" : ""}`);
        console.log(`  ${doc.uri}`);
      }
    }
  });
}

async function cmdWindows() {
  const client = new XcodeClient({ host: host() });
  await client.connect();
  const result = await client.listWindows();
  const windows = result.windows ?? [];
  if (flag("json")) {
    console.log(JSON.stringify(result, null, 2));
  } else if (windows.length > 0) {
    for (const w of windows) {
      console.log(`${w.tabIdentifier}  ${w.workspacePath ?? "(no workspace)"}`);
    }
  } else {
    console.log("No Xcode windows found.");
    if (result.message) console.log(`Raw: ${result.message}`);
  }
  client.disconnect();
}

// ─── UI Interaction ───────────────────────────────────────────────────────

async function cmdUi() {
  const pos = positionalArgs();
  const sub = pos[0];
  const h = host();
  const ssh = (cmd: string) =>
    h ? `ssh ${h} "${cmd}"` : cmd;

  switch (sub) {
    case "tap": {
      const x = pos[1], y = pos[2];
      if (!x || !y) die("Usage: xcmcp ui tap [--host <h>] <x> <y>");
      execSync(ssh(`xcrun simctl io booted tap ${x} ${y}`), { stdio: "inherit" });
      ok(`Tapped (${x}, ${y})`);
      break;
    }
    case "type": {
      const text = pos.slice(1).join(" ");
      if (!text) die("Usage: xcmcp ui type [--host <h>] <text>");
      execSync(ssh(`xcrun simctl io booted type "${text.replace(/"/g, '\\"')}"`), { stdio: "inherit" });
      ok(`Typed: ${text}`);
      break;
    }
    case "swipe": {
      const [, x1, y1, x2, y2, dur] = pos;
      if (!x1 || !y1 || !x2 || !y2) die("Usage: xcmcp ui swipe [--host <h>] <x1> <y1> <x2> <y2> [duration-ms]");
      execSync(ssh(`xcrun simctl io booted swipe ${x1} ${y1} ${x2} ${y2} ${dur ?? 300}`), { stdio: "inherit" });
      ok(`Swiped (${x1},${y1}) → (${x2},${y2})`);
      break;
    }
    case "key": {
      const key = pos[1];
      if (!key) die("Usage: xcmcp ui key [--host <h>] <keycode>\n  36=Return, 51=Delete, 53=Escape, 123=Left, 124=Right, 125=Down, 126=Up");
      execSync(ssh(`xcrun simctl io booted sendkey ${key}`), { stdio: "inherit" });
      ok(`Key sent: ${key}`);
      break;
    }
    case "screenshot":
    case "snap": {
      await cmdScreenshot();
      break;
    }
    case "boot": {
      const device = pos[1];
      if (!device) die("Usage: xcmcp ui boot [--host <h>] <device-udid-or-name>");
      execSync(ssh(`xcrun simctl boot "${device}"`), { stdio: "inherit" });
      ok(`Booted: ${device}`);
      break;
    }
    case "shutdown": {
      const device = pos[1] ?? "booted";
      execSync(ssh(`xcrun simctl shutdown "${device}"`), { stdio: "inherit" });
      ok(`Shut down: ${device}`);
      break;
    }
    case "install": {
      const appPath = pos[1];
      if (!appPath) die("Usage: xcmcp ui install [--host <h>] <path-to.app>");
      execSync(ssh(`xcrun simctl install booted "${appPath}"`), { stdio: "inherit" });
      ok(`Installed: ${appPath}`);
      break;
    }
    case "launch": {
      const bundleId = pos[1];
      if (!bundleId) die("Usage: xcmcp ui launch [--host <h>] <bundle-id>");
      execSync(ssh(`xcrun simctl launch booted "${bundleId}"`), { stdio: "inherit" });
      ok(`Launched: ${bundleId}`);
      break;
    }
    case "terminate": {
      const bundleId = pos[1];
      if (!bundleId) die("Usage: xcmcp ui terminate [--host <h>] <bundle-id>");
      execSync(ssh(`xcrun simctl terminate booted "${bundleId}"`), { stdio: "inherit" });
      ok(`Terminated: ${bundleId}`);
      break;
    }
    case "log": {
      const sshArgs = h
        ? ["ssh", [h, "xcrun simctl spawn booted log stream --predicate 'process contains \"App\"'"]] as const
        : ["xcrun", ["simctl", "spawn", "booted", "log", "stream"]] as const;
      const proc = spawn(sshArgs[0], [...sshArgs[1]], { stdio: "inherit" });
      process.on("SIGINT", () => proc.kill());
      await new Promise<void>((resolve) => proc.on("exit", () => resolve()));
      break;
    }
    case "list": {
      const raw = h
        ? execSync(`ssh ${h} "xcrun simctl list devices --json"`, { encoding: "utf8" })
        : execSync(`xcrun simctl list devices --json`, { encoding: "utf8" });
      const data = JSON.parse(raw);
      const devs = Object.entries(data.devices as Record<string, unknown[]>)
        .flatMap(([runtime, devices]) =>
          (devices as Array<{ name: string; udid: string; state: string }>).map((d) => ({
            ...d,
            runtime: runtime.replace("com.apple.CoreSimulator.SimRuntime.", ""),
          })),
        );
      const booted = devs.filter((d) => d.state === "Booted");
      const available = devs.filter((d) => d.state !== "Shutdown");
      const showAll = flag("all");
      const list = showAll ? available : booted;
      if (list.length === 0) {
        console.log(showAll ? "No available simulators" : "No booted simulators (use --all to see available)");
        break;
      }
      for (const d of list) {
        const marker = d.state === "Booted" ? "🟢" : "⚪";
        console.log(`${marker} ${d.udid}  ${d.name}  (${d.runtime})  [${d.state}]`);
      }
      break;
    }
    case "open": {
      // Open Simulator.app
      execSync(ssh("open -a Simulator"), { stdio: "inherit" });
      ok("Simulator.app opened");
      break;
    }
    default:
      console.log(`
\x1b[1mxcmcp ui\x1b[0m — Simulator interaction

\x1b[1mINPUT\x1b[0m
  tap <x> <y>                    Tap at screen coordinates
  type <text>                    Type text into focused element
  swipe <x1> <y1> <x2> <y2>     Swipe gesture (optional duration ms)
  key <keycode>                  Send key (36=Return, 51=Delete, 53=Escape)

\x1b[1mSIMULATOR MANAGEMENT\x1b[0m
  list [--all]                   List booted simulators (--all shows available)
  boot <device>                  Boot a simulator by name or UDID
  shutdown [device]              Shut down booted simulator
  open                           Open Simulator.app

\x1b[1mAPP LIFECYCLE\x1b[0m
  install <path.app>             Install app on booted simulator
  launch <bundle-id>             Launch app by bundle ID
  terminate <bundle-id>          Terminate running app

\x1b[1mCAPTURE & LOGS\x1b[0m
  snap [--out <path>]            Screenshot current simulator state
  log                            Stream simulator app logs

All commands accept --host <host> for remote macOS.

\x1b[1mVISUAL LOOP EXAMPLE\x1b[0m
  xcmcp ui snap --out /tmp/s1.png
  # → analyze with image tool, find button coords
  xcmcp ui tap 195 420
  xcmcp ui snap --out /tmp/s2.png
  # → verify UI changed
`);
  }
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
    case "test-some":  await cmdTestSome();   break;
    case "screenshot": await cmdScreenshot(); break;
    case "repl":       await cmdRepl();       break;
    case "preview":    await cmdPreview();    break;
    case "docs":       await cmdDocs();       break;
    case "windows":    await cmdWindows();    break;
    case "ui":         await cmdUi();         break;
    case "help":
    case "--help":
    case "-h":
    default:           await cmdHelp();       break;
  }
})().catch((e) => { console.error(e); process.exit(1); });
