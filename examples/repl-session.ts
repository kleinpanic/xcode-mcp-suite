/**
 * Example: Swift REPL interaction via Xcode MCP.
 *
 * Runs multiple Swift expressions in Xcode's REPL, which has access
 * to the current project's module and frameworks.
 *
 * Usage:
 *   XCODE_HOST=collins-pro npx tsx examples/repl-session.ts
 */

import { withXcodeSession } from "@kleinpanic/xcode-mcp-sdk";

const host = process.env["XCODE_HOST"] ?? "";

await withXcodeSession({ host }, async (session) => {
  console.log("--- Swift REPL Session ---\n");

  const expressions = [
    'print("Hello from Xcode REPL!")',
    "let numbers = [1, 2, 3, 4, 5]",
    "let doubled = numbers.map { $0 * 2 }",
    "print(doubled)",
    'import Foundation; print(Date())',
  ];

  for (const code of expressions) {
    console.log(`> ${code}`);
    const result = await session.runSwiftREPL({ code });

    if (result.output.trim()) {
      console.log(result.output.trimEnd());
    }
    if (result.error) {
      console.error(`Error: ${result.error}`);
    }
    console.log();
  }

  console.log("--- Session complete ---");
});
