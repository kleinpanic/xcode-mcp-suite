import { describe, it, expect, vi, beforeEach } from "vitest";
import { XcodeSession } from "../session.js";
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

function makeWindowsResponse(windows: Array<Record<string, unknown>>) {
  return {
    content: [{ type: "text", text: JSON.stringify({ windows }) }],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("XcodeSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProc.killed = false;
  });

  it("connect() returns the first window", async () => {
    const session = new XcodeSession({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "XcodeListWindows") {
        simulateResponse(msg.id, makeWindowsResponse([
          { "tab-identifier": "tab-abc", title: "MyApp.xcodeproj", projectPath: "/Users/dev/MyApp" },
          { "tab-identifier": "tab-def", title: "Other.xcodeproj" },
        ]));
      }
    });

    const win = await session.connect();
    expect(win["tab-identifier"]).toBe("tab-abc");
    expect(win.title).toBe("MyApp.xcodeproj");
    session.disconnect();
  });

  it("throws XcodeConnectionError when no windows are open", async () => {
    const session = new XcodeSession({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "XcodeListWindows") {
        simulateResponse(msg.id, makeWindowsResponse([]));
      }
    });

    await expect(session.connect()).rejects.toThrow(XcodeConnectionError);
    session.disconnect();
  });

  it("prefers window matching projectPath", async () => {
    const session = new XcodeSession({ timeout: 500, projectPath: "Other" });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "XcodeListWindows") {
        simulateResponse(msg.id, makeWindowsResponse([
          { "tab-identifier": "tab-abc", title: "MyApp", projectPath: "/Users/dev/MyApp" },
          { "tab-identifier": "tab-def", title: "Other", projectPath: "/Users/dev/Other" },
        ]));
      }
    });

    const win = await session.connect();
    expect(win["tab-identifier"]).toBe("tab-def");
    session.disconnect();
  });

  it("buildProject auto-fills tab-identifier", async () => {
    const session = new XcodeSession({ timeout: 500 });

    mockStdin.write.mockImplementation((line: string) => {
      const msg = JSON.parse(line.trim());
      if (msg.method === "initialize") simulateResponse(msg.id, {});
      if (msg.method === "notifications/initialized") simulateResponse(msg.id, {});
      if (msg.method === "tools/call" && msg.params?.name === "XcodeListWindows") {
        simulateResponse(msg.id, makeWindowsResponse([
          { "tab-identifier": "tab-1", title: "App" },
        ]));
      }
      if (msg.method === "tools/call" && msg.params?.name === "BuildProject") {
        // Verify tab-identifier was auto-filled
        expect(msg.params?.arguments?.["tab-identifier"]).toBe("tab-1");
        simulateResponse(msg.id, {
          content: [{ type: "text", text: JSON.stringify({ success: true, errors: [], warnings: [], notes: [] }) }],
        });
      }
    });

    await session.connect();
    const result = await session.buildProject();
    expect(result.success).toBe(true);
    session.disconnect();
  });

  it("exposes the underlying XcodeClient", () => {
    const session = new XcodeSession();
    expect(session.client).toBeDefined();
  });
});
