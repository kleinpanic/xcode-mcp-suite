import { XcodeClient } from "@kleinpanic/xcode-mcp-sdk";

const client = new XcodeClient({ timeout: 60000 });
console.log("Connecting...");
await client.connect();
console.log("Connected. Calling XcodeLS probe directly...");

let raw;
try {
  raw = await client.callTool("XcodeLS", { directoryPath: "/" });
  console.log("XcodeLS raw result type:", typeof raw);
  console.log("XcodeLS raw result:", JSON.stringify(raw)?.slice(0, 400));
} catch(e) {
  console.log("XcodeLS threw:", e.message);
}

console.log("Calling listWindows...");
try {
  const result = await client.listWindows();
  console.log("listWindows result:", JSON.stringify(result));
} catch(e) {
  console.log("listWindows threw:", e.message);
}

client.disconnect();
