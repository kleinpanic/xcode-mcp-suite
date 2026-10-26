import { describe, it, expect, vi, beforeEach } from "vitest";
import { XcodeSession, withXcodeSession } from "../session.js";

// ── Mock child_process.spawn ───────────────────────────────────────────────

const mockStdin = { write: vi.fn(), end: vi.fn(), on: vi.fn() };
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

function getStdoutHandler(): ((chunk: string) => void) | undefined {
  const calls = mockStdout.on.mock.calls as [string, (c: string) => void][];
  return calls.find(([ev]) => ev === "data")?.[1];
}

function simulateResponse(id: number, result: unknown) {
  const handler = getStdoutHandler();
  handler?.(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function setupMock() {
  mockStdin.write.mockImplementation((line: string) => {
    const msg = JSON.parse(line.trim());
    if (msg.method === "initialize") simulateResponse(msg.id, {});
    if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
    // listWindows() probes BuildProject with a bogus tab; Xcode lists the real ones.
    if (msg.method === "tools/call" && msg.params?.arguments?.tabIdentifier === "__probe__") {
      simulateResponse(msg.id, {
        isError: true,
        content: [{
          type: "text",
          text: "Error: Valid tabIdentifier required. Currently available:\n" +
            "* tabIdentifier: windowtab1, workspacePath: /Users/me/MyApp.xcodeproj\n" +
            "* tabIdentifier: windowtab2, workspacePath: /Users/me/Other.xcodeproj",
        }],
      });
      return;
    }
    if (msg.method === "tools/call" && msg.params?.name === "BuildProject") {
      simulateResponse(msg.id, {
        structuredContent: {
          buildResult: "Build succeeded",
          errors: [],
          elapsedTime: 1.5,
        },
      });
    }
  });
}

describe("XcodeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProc.killed = false;
  });

  it("connect() returns the first tabIdentifier", async () => {
    setupMock();
    const session = new XcodeSession();
    const tabId = await session.connect();
    expect(tabId).toBe("windowtab1");
    session.disconnect();
  });

  it("prefers window matching projectPath", async () => {
    setupMock();
    const session = new XcodeSession({ projectPath: "Other" });
    const tabId = await session.connect();
    expect(tabId).toBe("windowtab2");
    session.disconnect();
  });

  it("buildProject auto-fills tabIdentifier", async () => {
    setupMock();
    const session = new XcodeSession();
    await session.connect();
    const result = await session.buildProject();
    expect(result.buildResult).toBe("Build succeeded");

    // Verify BuildProject was called with the correct tabIdentifier
    const calls = mockStdin.write.mock.calls as [string][];
    const buildCall = calls.find(([c]) => c.includes("BuildProject") && !c.includes("__probe__"));
    expect(buildCall).toBeDefined();
    const parsed = JSON.parse(buildCall![0]);
    expect(parsed.params.arguments.tabIdentifier).toBe("windowtab1");
    session.disconnect();
  });

  it("withXcodeSession disconnects when connect() fails", async () => {
    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "tools/call") {
        simulateResponse(msg.id, { isError: true, content: [{ type: "text", text: "no windows" }] });
      }
    });
    const fn = vi.fn();
    await expect(withXcodeSession({}, fn)).rejects.toThrow("No Xcode windows found");
    expect(fn).not.toHaveBeenCalled();
    expect(mockProc.kill).toHaveBeenCalled();
  });
});
