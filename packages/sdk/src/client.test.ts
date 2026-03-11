import { describe, it, expect, vi, beforeEach } from "vitest";
import { XcodeClient } from "./client.js";
import { XcodeToolError, XcodeBuildError } from "./types.js";

// Mock child_process.spawn
vi.mock("node:child_process", () => {
  const mockStdin = { write: vi.fn(), end: vi.fn() };
  const mockStdout = {
    setEncoding: vi.fn(),
    on: vi.fn(),
  };
  const mockStderr = { on: vi.fn() };
  const mockProc = {
    stdin: mockStdin,
    stdout: mockStdout,
    stderr: mockStderr,
    on: vi.fn(),
    kill: vi.fn(),
    killed: false,
  };
  return {
    spawn: vi.fn(() => mockProc),
    __mockProc: mockProc,
  };
});

function getStdoutHandler(): (chunk: string) => void {
  const cp = require("node:child_process") as { __mockProc: { stdout: { on: ReturnType<typeof vi.fn> } } };
  const calls = cp.__mockProc.stdout.on.mock.calls;
  const dataCall = calls.find((c: [string, unknown]) => c[0] === "data");
  return dataCall?.[1] as (chunk: string) => void;
}

function simulateResponse(id: number, result: unknown): void {
  const handler = getStdoutHandler();
  const response = JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n";
  handler(response);
}

function simulateError(id: number, error: { code: number; message: string }): void {
  const handler = getStdoutHandler();
  const response = JSON.stringify({ jsonrpc: "2.0", id, error }) + "\n";
  handler(response);
}

describe("XcodeClient", () => {
  let client: XcodeClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new XcodeClient({ timeout: 5000 });
  });

  it("should connect and send initialize + initialized", async () => {
    const connectPromise = client.connect();
    // initialize request is id=1
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    // notifications/initialized is id=2
    simulateResponse(2, {});
    await connectPromise;
    expect(client.connected).toBe(true);
  });

  it("should call listWindows via _tool", async () => {
    const connectPromise = client.connect();
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    simulateResponse(2, {});
    await connectPromise;

    const listPromise = client.listWindows();
    simulateResponse(3, {
      content: [{ type: "text", text: JSON.stringify({ windows: [{ "tab-identifier": "tab-1", title: "MyApp" }] }) }],
    });
    const result = await listPromise;
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]!["tab-identifier"]).toBe("tab-1");
  });

  it("should call buildProject and return result on success", async () => {
    const connectPromise = client.connect();
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    simulateResponse(2, {});
    await connectPromise;

    const buildPromise = client.buildProject({ "tab-identifier": "tab-1" });
    simulateResponse(3, {
      content: [{ type: "text", text: JSON.stringify({ success: true, errors: [], warnings: [], notes: [] }) }],
    });
    const result = await buildPromise;
    expect(result.success).toBe(true);
  });

  it("should throw XcodeBuildError when build fails", async () => {
    const connectPromise = client.connect();
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    simulateResponse(2, {});
    await connectPromise;

    const buildPromise = client.buildProject({ "tab-identifier": "tab-1" });
    simulateResponse(3, {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          errors: [{ message: "Cannot find type 'Foo'", severity: "error", file: "main.swift", line: 10 }],
          warnings: [],
          notes: [],
        }),
      }],
    });
    await expect(buildPromise).rejects.toThrow(XcodeBuildError);
  });

  it("should throw XcodeToolError on MCP error response", async () => {
    const connectPromise = client.connect();
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    simulateResponse(2, {});
    await connectPromise;

    const searchPromise = client.searchDocumentation({ query: "SwiftUI" });
    simulateError(3, { code: -32601, message: "Tool not found" });
    await expect(searchPromise).rejects.toThrow(XcodeToolError);
  });

  it("should call runAllTests", async () => {
    const connectPromise = client.connect();
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    simulateResponse(2, {});
    await connectPromise;

    const testPromise = client.runAllTests({ "tab-identifier": "tab-1" });
    simulateResponse(3, {
      content: [{ type: "text", text: JSON.stringify({ passed: 10, failed: 0, skipped: 2, duration: 3.5, failures: [] }) }],
    });
    const result = await testPromise;
    expect(result.passed).toBe(10);
    expect(result.failed).toBe(0);
  });

  it("should call runSwiftREPL", async () => {
    const connectPromise = client.connect();
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    simulateResponse(2, {});
    await connectPromise;

    const replPromise = client.runSwiftREPL({ "tab-identifier": "tab-1", code: 'print("Hi")' });
    simulateResponse(3, {
      content: [{ type: "text", text: JSON.stringify({ output: "Hi\n", success: true }) }],
    });
    const result = await replPromise;
    expect(result.output).toBe("Hi\n");
    expect(result.success).toBe(true);
  });

  it("should call listSimulators", async () => {
    const connectPromise = client.connect();
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    simulateResponse(2, {});
    await connectPromise;

    const simPromise = client.listSimulators();
    simulateResponse(3, {
      content: [{
        type: "text",
        text: JSON.stringify({
          simulators: [{ udid: "abc-123", name: "iPhone 16", runtime: "iOS 18.0", state: "Shutdown", deviceType: "iPhone" }],
        }),
      }],
    });
    const result = await simPromise;
    expect(result.simulators).toHaveLength(1);
    expect(result.simulators[0]!.name).toBe("iPhone 16");
  });

  it("should disconnect gracefully", async () => {
    const connectPromise = client.connect();
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    simulateResponse(2, {});
    await connectPromise;

    client.disconnect();
    expect(client.connected).toBe(false);
  });
});
