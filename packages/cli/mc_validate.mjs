#!/usr/bin/env node
/**
 * mc_validate.mjs — Single-session OpenClawMC validation via Xcode MCP
 * Runs: windows → build → issues → screenshot
 * All operations use ONE mcpbridge process (one XPC session).
 */
import { XcodeClient } from "@kleinpanic/xcode-mcp-sdk";
import { writeFileSync } from "fs";
import { execSync } from "child_process";

const OUT_DIR = "/tmp/mc_validate";
execSync(`mkdir -p ${OUT_DIR}`);

const client = new XcodeClient({ timeout: 60000 });
console.log("Connecting…");
await client.connect();

// ── 1. Discover windows ─────────────────────────────────────────────────────
const { windows } = await client.listWindows();
if (!windows || windows.length === 0) {
  console.error("❌ No Xcode windows found. Open the project.");
  process.exit(1);
}
const tab = windows[0].tabIdentifier;
console.log(`✓ Window: ${tab}  (${windows[0].workspacePath ?? "?"})`);

// ── 2. Build ─────────────────────────────────────────────────────────────────
console.log("\nBuilding OpenClawMC (Debug)…");
let buildOk = false;
try {
  const buildResult = await client.callTool("BuildProject", {
    tabIdentifier: tab,
    configuration: "Debug",
  });
  const raw = JSON.stringify(buildResult);
  writeFileSync(`${OUT_DIR}/build_result.json`, raw);
  buildOk = !raw.includes('"errors"') || raw.includes('"errors":[]');
  console.log(buildOk ? "✓ Build succeeded" : "✗ Build has errors — check build_result.json");
} catch (e) {
  console.error(`✗ Build failed: ${e.message}`);
}

// ── 3. Build log ─────────────────────────────────────────────────────────────
console.log("\nFetching build log (errors only)…");
try {
  const log = await client.callTool("GetBuildLog", {
    tabIdentifier: tab,
    severity: "error",
  });
  const logText = typeof log === "string" ? log : JSON.stringify(log, null, 2);
  writeFileSync(`${OUT_DIR}/build_log.txt`, logText);
  const errCount = (logText.match(/error:/gi) ?? []).length;
  console.log(`  ${errCount} error(s) in build log → ${OUT_DIR}/build_log.txt`);
} catch (e) {
  console.error(`  Build log unavailable: ${e.message}`);
}

// ── 4. Navigator issues ───────────────────────────────────────────────────────
console.log("\nFetching navigator issues…");
try {
  const issues = await client.callTool("XcodeListNavigatorIssues", {
    tabIdentifier: tab,
  });
  const issText = typeof issues === "string" ? issues : JSON.stringify(issues, null, 2);
  writeFileSync(`${OUT_DIR}/issues.json`, issText);
  const errCount = (issText.match(/"severity"\s*:\s*"error"/gi) ?? []).length;
  const warnCount = (issText.match(/"severity"\s*:\s*"warning"/gi) ?? []).length;
  console.log(`  Errors: ${errCount}  Warnings: ${warnCount} → ${OUT_DIR}/issues.json`);
} catch (e) {
  console.error(`  Issues unavailable: ${e.message}`);
}

// ── 5. File listing (spot check) ──────────────────────────────────────────────
console.log("\nSpot-checking file structure…");
try {
  const ls = await client.callTool("XcodeLS", {
    tabIdentifier: tab,
    path: "Sources/OpenClawMC/Views",
  });
  const lsText = typeof ls === "string" ? ls : JSON.stringify(ls, null, 2);
  writeFileSync(`${OUT_DIR}/views_ls.txt`, lsText);
  console.log(`✓ Views dir listed → ${OUT_DIR}/views_ls.txt`);
} catch (e) {
  console.error(`  XcodeLS failed: ${e.message}`);
}

// ── 6. Screenshot (simulator) ─────────────────────────────────────────────────
console.log("\nCapturing simulator screenshot…");
try {
  const shot = await client.callTool("RenderPreview", {
    tabIdentifier: tab,
    filePath: "Sources/OpenClawMC/Views/Dashboard/DashboardView.swift",
  });
  const raw = typeof shot === "object" ? shot : {};
  const b64 = raw.image ?? raw.base64 ?? "";
  if (b64) {
    writeFileSync(`${OUT_DIR}/dashboard_preview.png`, Buffer.from(b64, "base64"));
    console.log(`✓ Dashboard preview → ${OUT_DIR}/dashboard_preview.png`);
  } else {
    writeFileSync(`${OUT_DIR}/render_raw.json`, JSON.stringify(shot, null, 2));
    console.log(`  Preview raw response → ${OUT_DIR}/render_raw.json`);
  }
} catch (e) {
  console.error(`  RenderPreview failed: ${e.message}`);
}

client.disconnect();
console.log(`\nAll artifacts in ${OUT_DIR}/`);
