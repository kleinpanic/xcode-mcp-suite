/**
 * Example: SwiftUI preview capture + analysis.
 *
 * Captures a SwiftUI preview and saves it as a PNG for visual auditing.
 *
 * Usage:
 *   XCODE_HOST=collins-pro npx tsx examples/swiftui-audit.ts Sources/Views/ContentView.swift
 */

import { writeFileSync } from "node:fs";
import { withXcodeSession } from "@kleinpanic/xcode-mcp-sdk";

const host = process.env["XCODE_HOST"] ?? "";
const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: npx tsx examples/swiftui-audit.ts <SwiftFile.swift>");
  process.exit(1);
}

await withXcodeSession({ host }, async (session) => {
  console.log(`Rendering SwiftUI preview for ${filePath}...`);

  // Get the preview
  const preview = await session.getSwiftUIPreview({ filePath });

  if (preview.error) {
    console.error(`Preview error: ${preview.error}`);
    process.exit(1);
  }

  if (!preview.imageData) {
    console.error("No preview image returned.");
    process.exit(1);
  }

  // Save the image
  const outPath = `/tmp/swiftui-audit-${Date.now()}.png`;
  writeFileSync(outPath, Buffer.from(preview.imageData, "base64"));
  console.log(`Preview saved: ${outPath}`);

  // Also refresh the preview to ensure it's up to date
  console.log("Refreshing preview...");
  const refresh = await session.refreshSwiftUIPreview(filePath);
  console.log(`Refresh: ${refresh.success ? "OK" : "failed"}`);
});
