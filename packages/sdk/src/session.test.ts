import { describe, it, expect, vi, beforeEach } from "vitest";
import { XcodeSession } from "./session.js";
import { XcodeConnectionError } from "./types.js";

// Mock child_process.spawn
vi.mock("node:child_process", () => {
  const mockStdin = { write: vi.fn(), end: vi.fn() };
  const mockStdout = { setEncoding: vi.fn(), on: vi.fn() };
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
  handler(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

describe("XcodeSession", () => {
  let session: XcodeSession;

  beforeEach(() => {
    vi.clearAllMocks();
    session = new XcodeSession({ timeout: 5000 });
  });

  it("should connect and auto-discover first window", async () => {
    const connectPromise = session.connect();
    // initialize
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    // initialized
    simulateResponse(2, {});
    // listWindows
    simulateResponse(3, {
      content: [{
        type: "text",
        text: JSON.stringify({
          windows: [
            { "tab-identifier": "tab-abc", title: "MyProject.xcodeproj", projectPath: "/Users/dev/MyProject" },
            { "tab-identifier": "tab-def", title: "Other.xcodeproj" },
          ],
        }),
      }],
    });

    const win = await connectPromise;
    expect(win["tab-identifier"]).toBe("tab-abc");
  });

  it("should throw XcodeConnectionError when no windows are available", async () => {
    const connectPromise = session.connect();
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    simulateResponse(2, {});
    simulateResponse(3, {
      content: [{ type: "text", text: JSON.stringify({ windows: [] }) }],
    });

    await expect(connectPromise).rejects.toThrow(XcodeConnectionError);
  });

  it("should prefer window matching projectPath", async () => {
    const projSession = new XcodeSession({ timeout: 5000, projectPath: "Other" });
    const connectPromise = projSession.connect();
    simulateResponse(1, { protocolVersion: "2024-11-05", capabilities: {} });
    simulateResponse(2, {});
    simulateResponse(3, {
      content: [{
        type: "text",
        text: JSON.stringify({
          windows: [
            { "tab-identifier": "tab-abc", title: "MyProject", projectPath: "/Users/dev/MyProject" },
            { "tab-identifier": "tab-def", title: "Other", projectPath: "/Users/dev/Other" },
          ],
        }),
      }],
    });

    const win = await connectPromise;
    expect(win["tab-identifier"]).toBe("tab-def");
  });

  it("should expose the underlying XcodeClient", () => {
    expect(session.client).toBeDefined();
  });
});
