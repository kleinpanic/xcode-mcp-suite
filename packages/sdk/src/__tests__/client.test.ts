import { describe, it, expect, vi, beforeEach } from "vitest";
import { XcodeClient } from "../client.js";
import { XcodeConnectionError, XcodeToolError } from "../types.js";

// ── Mock child_process.spawn ───────────────────────────────────────────────

const mockStdin = { write: vi.fn(), end: vi.fn() };
const mockStdout = { setEncoding: vi.fn(), on: vi.fn() };
const mockStderr = { on: vi.fn() };
const mockProc = {
  stdin: mockStdin,
  stdout: mockStdout,
  stderr: mockStderr,
  on: vi.fn(),
  killed: false,
  kill: vi.fn(),
};

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => mockProc),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function getStdoutHandler(): ((chunk: string) => void) | undefined {
  const calls = mockStdout.on.mock.calls as [string, (c: string) => void][];
  return calls.find(([ev]) => ev === "data")?.[1];
}

function simulateResponse(id: number, result: unknown) {
  const handler = getStdoutHandler();
  handler?.(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function simulateError(id: number, message: string) {
  const handler = getStdoutHandler();
  handler?.(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -1, message } }) + "\n");
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("XcodeClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProc.killed = false;
  });

  it("is not connected before connect()", () => {
    const client = new XcodeClient();
    expect(client.connected).toBe(false);
  });

  it("connect() sends initialize handshake", async () => {
    const client = new XcodeClient({ timeout: 500 });

    // Auto-respond to initialize and notifications/initialized
    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, { protocolVersion: "2024-11-05" });
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
    });

    await client.connect();
    expect(mockStdin.write).toHaveBeenCalledTimes(2);
    const firstCall = JSON.parse((mockStdin.write.mock.calls[0] as [string])[0]);
    expect(firstCall.method).toBe("initialize");
    expect(firstCall.params.clientInfo.name).toBe("xcode-mcp-sdk");
  });

  it("listWindows returns parsed window list", async () => {
    const client = new XcodeClient({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "XcodeListWindows") {
        simulateResponse(msg.id, {
          content: [{ type: "text", text: JSON.stringify({ windows: [{ "tab-identifier": "tab-1", title: "MyApp" }] }) }],
        });
      }
    });

    await client.connect();
    const result = await client.listWindows();
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]?.["tab-identifier"]).toBe("tab-1");
    client.disconnect();
  });

  it("throws XcodeToolError on MCP error response", async () => {
    const client = new XcodeClient({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call") simulateError(msg.id, "Xcode not running");
    });

    await client.connect();
    await expect(client.listWindows()).rejects.toThrow("Xcode not running");
    client.disconnect();
  });

  it("throws XcodeConnectionError when not connected", async () => {
    const client = new XcodeClient();
    await expect(client.listWindows()).rejects.toThrow(XcodeConnectionError);
  });

  it("throws XcodeBuildError on build failure", async () => {
    const client = new XcodeClient({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "BuildProject") {
        simulateResponse(msg.id, {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              errors: [{ message: "Use of undeclared type 'Foo'", severity: "error", file: "main.swift", line: 10 }],
              warnings: [],
              notes: [],
            }),
          }],
        });
      }
    });

    await client.connect();
    await expect(
      client.buildProject({ "tab-identifier": "tab-1" }),
    ).rejects.toThrow("Build failed with 1 error(s)");
    client.disconnect();
  });
});
