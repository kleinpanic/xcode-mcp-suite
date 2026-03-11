import { describe, it, expect, vi, beforeEach } from "vitest";
import { XcodeClient } from "../client.js";
import { XcodeConnectionError } from "../types.js";

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

  it("listWindows returns parsed result (structuredContent)", async () => {
    const client = new XcodeClient({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "XcodeListWindows") {
        simulateResponse(msg.id, {
          structuredContent: {
            windows: [{ tabIdentifier: "windowtab1", workspacePath: "/Users/me/MyApp.xcodeproj" }],
          },
        });
      }
    });

    await client.connect();
    const result = await client.listWindows();
    expect(result.windows).toHaveLength(1);
    expect(result.windows?.[0]?.tabIdentifier).toBe("windowtab1");
    client.disconnect();
  });

  it("listWindows falls back to content text parsing", async () => {
    const client = new XcodeClient({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "XcodeListWindows") {
        simulateResponse(msg.id, {
          content: [{
            type: "text",
            text: JSON.stringify({ message: "* tabIdentifier: windowtab1, workspacePath: /path" }),
          }],
        });
      }
    });

    await client.connect();
    const result = await client.listWindows();
    expect(result.message).toContain("tabIdentifier");
    client.disconnect();
  });

  it("readFile sends XcodeRead tool call", async () => {
    const client = new XcodeClient({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "XcodeRead") {
        simulateResponse(msg.id, {
          structuredContent: { content: "import SwiftUI", filePath: "main.swift" },
        });
      }
    });

    await client.connect();
    const result = await client.readFile({ tabIdentifier: "tab1", filePath: "main.swift" });
    expect(result.content).toBe("import SwiftUI");
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
          structuredContent: {
            buildResult: "Build failed",
            errors: [{ classification: "error", message: "Use of undeclared type 'Foo'", filePath: "main.swift", lineNumber: 10 }],
          },
        });
      }
    });

    await client.connect();
    await expect(
      client.buildProject({ tabIdentifier: "tab1" }),
    ).rejects.toThrow("Build failed with 1 error(s)");
    client.disconnect();
  });

  it("does NOT throw XcodeBuildError for warnings only", async () => {
    const client = new XcodeClient({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "BuildProject") {
        simulateResponse(msg.id, {
          structuredContent: {
            buildResult: "Build succeeded",
            errors: [{ classification: "warning", message: "Unused variable", filePath: "main.swift", lineNumber: 5 }],
          },
        });
      }
    });

    await client.connect();
    const result = await client.buildProject({ tabIdentifier: "tab1" });
    expect(result.buildResult).toBe("Build succeeded");
    expect(result.errors).toHaveLength(1);
    client.disconnect();
  });

  it("executeSnippet uses codeSnippet/sourceFilePath params", async () => {
    const client = new XcodeClient({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "ExecuteSnippet") {
        // Verify correct param names
        const args = msg.params?.arguments;
        expect(args.codeSnippet).toBe("print(42)");
        expect(args.sourceFilePath).toBe("Sources/main.swift");
        simulateResponse(msg.id, {
          structuredContent: { executionResults: "42\n" },
        });
      }
    });

    await client.connect();
    const result = await client.executeSnippet({
      tabIdentifier: "tab1",
      codeSnippet: "print(42)",
      sourceFilePath: "Sources/main.swift",
    });
    expect(result.executionResults).toBe("42\n");
    client.disconnect();
  });

  it("updateFile uses oldString/newString params", async () => {
    const client = new XcodeClient({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "XcodeUpdate") {
        const args = msg.params?.arguments;
        expect(args.oldString).toBe("old code");
        expect(args.newString).toBe("new code");
        expect(args.replaceAll).toBe(true);
        simulateResponse(msg.id, {
          structuredContent: {
            success: true, filePath: "main.swift", editsApplied: 2,
            originalContentLength: 100, modifiedContentLength: 110,
          },
        });
      }
    });

    await client.connect();
    const result = await client.updateFile({
      tabIdentifier: "tab1", filePath: "main.swift",
      oldString: "old code", newString: "new code", replaceAll: true,
    });
    expect(result.editsApplied).toBe(2);
    client.disconnect();
  });

  it("mv uses sourcePath/destinationPath params", async () => {
    const client = new XcodeClient({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "XcodeMV") {
        const args = msg.params?.arguments;
        expect(args.sourcePath).toBe("Sources/old.swift");
        expect(args.destinationPath).toBe("Sources/new.swift");
        simulateResponse(msg.id, {
          structuredContent: { success: true, operation: "move", message: "Moved" },
        });
      }
    });

    await client.connect();
    const result = await client.mv({
      tabIdentifier: "tab1",
      sourcePath: "Sources/old.swift",
      destinationPath: "Sources/new.swift",
    });
    expect(result.success).toBe(true);
    client.disconnect();
  });
});
