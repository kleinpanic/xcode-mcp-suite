/**
 * Example: Full build + test cycle using the Xcode MCP SDK.
 *
 * Usage:
 *   XCODE_HOST=collins-pro npx tsx examples/build-and-test.ts
 */

import { withXcodeSession } from "@kleinpanic/xcode-mcp-sdk";

const host = process.env["XCODE_HOST"] ?? "";

await withXcodeSession({ host }, async (session) => {
  console.log("--- Build & Test Cycle ---\n");

  // Step 1: Clean
  console.log("Cleaning build folder...");
  await session.cleanBuildFolder();
  console.log("Clean complete.\n");

  // Step 2: Build
  console.log("Building...");
  try {
    const build = await session.buildProject();
    console.log(`Build succeeded with ${build.warnings.length} warning(s).\n`);
  } catch (err) {
    console.error("Build failed:", err);
    process.exit(1);
  }

  // Step 3: Run tests
  console.log("Running tests...");
  const tests = await session.runAllTests();
  console.log(
    `Results: ${tests.passed} passed, ${tests.failed} failed, ${tests.skipped} skipped (${tests.duration}s)\n`,
  );

  if (tests.failures.length > 0) {
    console.log("Failures:");
    for (const f of tests.failures) {
      console.log(`  ${f.testName} (${f.file}:${f.line})`);
      console.log(`    ${f.message}`);
    }
    process.exit(1);
  }

  // Step 4: Check diagnostics
  console.log("Checking diagnostics...");
  const diag = await session.getDiagnostics();
  const errors = diag.diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) {
    console.log(`${errors.length} remaining error(s):`);
    for (const e of errors) {
      console.log(`  ${e.file}:${e.line}: ${e.message}`);
    }
  } else {
    console.log("No errors.");
  }

  console.log("\n--- Done ---");
});
