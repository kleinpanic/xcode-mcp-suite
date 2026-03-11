import { describe, it, expect, vi, beforeEach } from "vitest";
import { XcodeSession } from "../session.js";

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
    if (msg.method === "tools/call" && msg.params?.name === "XcodeListWindows") {
      simulateResponse(msg.id, {
        structuredContent: {
          windows: [
            { tabIdentifier: "windowtab1", workspacePath: "/Users/me/MyApp.xcodeproj" },
            { tabIdentifier: "windowtab2", workspacePath: "/Users/me/Other.xcodeproj" },
          ],
        },
      });
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
    const buildCall = calls.find(([c]) => c.includes("BuildProject"));
    expect(buildCall).toBeDefined();
    const parsed = JSON.parse(buildCall![0]);
    expect(parsed.params.arguments.tabIdentifier).toBe("windowtab1");
    session.disconnect();
  });
});
