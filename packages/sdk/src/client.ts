/**
 * XcodeClient — typed wrapper for all 20 Xcode MCP tools.
 *
 * Connects to Xcode 26.3+ via local or remote xcrun mcpbridge.
 *
 * @example
 * ```ts
 * const client = new XcodeClient({ host: "collins-pro" });
 * await client.connect();
 * const windows = await client.listWindows();
 * const tabId = windows.windows?.[0]?.tabIdentifier ?? "windowtab1";
 * const result = await client.buildProject({ tabIdentifier: tabId });
 * await client.disconnect();
 * ```
 *
 * @see https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  XcodeConnectionError,
  XcodeToolError,
  XcodeBuildError,
  type XcodeReadParams, type XcodeReadResult,
  type XcodeWriteParams, type XcodeWriteResult,
  type XcodeUpdateParams, type XcodeUpdateResult,
  type XcodeGlobParams, type XcodeGlobResult,
  type XcodeGrepParams, type XcodeGrepResult,
  type XcodeLSParams, type XcodeLSResult,
  type XcodeMakeDirParams, type XcodeMakeDirResult,
  type XcodeRMParams, type XcodeRMResult,
  type XcodeMVParams, type XcodeMVResult,
  type BuildProjectParams, type BuildProjectResult, type BuildError,
  type GetBuildLogParams, type GetBuildLogResult,
  type RunAllTestsParams, type RunAllTestsResult,
  type RunSomeTestsParams, type RunSomeTestsResult,
  type GetTestListParams, type GetTestListResult,
  type XcodeListNavigatorIssuesParams, type XcodeListNavigatorIssuesResult,
  type XcodeRefreshCodeIssuesInFileParams, type XcodeRefreshCodeIssuesInFileResult,
  type ExecuteSnippetParams, type ExecuteSnippetResult,
  type RenderPreviewParams, type RenderPreviewResult,
  type DocumentationSearchParams, type DocumentationSearchResult,
  type XcodeListWindowsResult,
  type XcodeWindow,
} from "./types.js";

// ─── MCP JSON-RPC types ────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ─── Client options ────────────────────────────────────────────────────────

export interface XcodeClientOptions {
  /**
   * Remote macOS host running Xcode. When provided, connects via SSH.
   * When omitted, runs xcrun mcpbridge locally.
   */
  host?: string;
  /** Additional SSH arguments (e.g. ["-i", "/path/to/key"]). */
  sshArgs?: string[];
  /** Request timeout in milliseconds. Default: 30000. */
  timeout?: number;
}

// ─── XcodeClient ──────────────────────────────────────────────────────────

export class XcodeClient extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private buf = "";
  private seq = 1;
  private readonly opts: Required<XcodeClientOptions>;

  constructor(opts: XcodeClientOptions = {}) {
    super();
    this.opts = {
      host: opts.host ?? "",
      sshArgs: opts.sshArgs ?? [],
      timeout: opts.timeout ?? 30_000,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.proc) return;

    const [cmd, args] = this.opts.host
      ? ["ssh", [...this.opts.sshArgs, "-T", this.opts.host, "xcrun", "mcpbridge"]]
      : ["xcrun", ["mcpbridge"]];

    this.proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => this._onData(chunk));
    this.proc.stderr.on("data", (chunk: Buffer) =>
      this.emit("stderr", chunk.toString()),
    );
    this.proc.on("exit", (code) => {
      this.emit("exit", code);
      this._rejectAll(new XcodeConnectionError(`xcrun mcpbridge exited with code ${code}`));
    });

    // MCP handshake: initialize then notifications/initialized
    await this._call("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "xcode-mcp-sdk", version: "0.1.0" },
      capabilities: {},
    });
    // Required: client must notify server it is ready before any tool calls.
    // Xcode 26.3 mcpbridge silently ignores tools/list and tools/call
    // until this notification is received (confirmed empirically).
    this._notify("notifications/initialized", {});
    await new Promise<void>((r) => setTimeout(r, 2000));
  }

  disconnect(): void {
    this.proc?.stdin.end();
    this.proc?.kill();
    this.proc = null;
    this._rejectAll(new XcodeConnectionError("Client disconnected"));
  }

  get connected(): boolean {
    return this.proc !== null && !this.proc.killed;
  }

  // ── Internal transport ────────────────────────────────────────────────────

  private _onData(chunk: string): void {
    this.buf += chunk;
    const lines = this.buf.split("\n");
    this.buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        const pend = this.pending.get(msg.id);
        if (!pend) continue;
        clearTimeout(pend.timer);
        this.pending.delete(msg.id);
        if (msg.error) {
          pend.reject(new XcodeToolError(msg.error.message, "", msg.error));
        } else {
          pend.resolve(msg.result);
        }
      } catch {
        // non-JSON line — ignore
      }
    }
  }

  private _rejectAll(err: Error): void {
    for (const pend of this.pending.values()) {
      clearTimeout(pend.timer);
      pend.reject(err);
    }
    this.pending.clear();
  }

  private _call(method: string, params?: unknown): Promise<unknown> {
    if (!this.proc) throw new XcodeConnectionError("Not connected — call connect() first");
    const id = this.seq++;
    const req: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new XcodeToolError(`Timeout calling ${method}`, method)),
        this.opts.timeout,
      );
      this.pending.set(id, { resolve, reject, timer });
      this.proc!.stdin.write(JSON.stringify(req) + "\n");
    });
  }

  /** Send a JSON-RPC notification (no id, no response expected). */
  private _notify(method: string, params?: unknown): void {
    if (!this.proc) return;
    this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  /** Call any MCP tool by name with typed or untyped params. */
  async callTool<R = unknown>(name: string, params: Record<string, unknown> = {}): Promise<R> {
    const result = await this._call("tools/call", { name, arguments: params });
    // MCP tools/call returns { content: [{type:"text",text:"..."}], structuredContent?: ... }
    const raw = result as {
      content?: Array<{ type: string; text?: string }>;
      structuredContent?: unknown;
    };
    // Prefer structuredContent (Xcode 26.3 RC2+)
    if (raw.structuredContent) return raw.structuredContent as R;
    // Fall back to parsing content[0].text
    const text = raw.content?.find((c) => c.type === "text")?.text ?? "{}";
    try {
      return JSON.parse(text) as R;
    } catch {
      return text as unknown as R;
    }
  }

  // ─── File Operations ──────────────────────────────────────────────────────

  /** Read a file from the project (includes unsaved Xcode buffer changes). */
  readFile(params: XcodeReadParams): Promise<XcodeReadResult> {
    return this.callTool("XcodeRead", params as unknown as Record<string, unknown>);
  }

  /** Write full file content (creates or overwrites). */
  writeFile(params: XcodeWriteParams): Promise<XcodeWriteResult> {
    return this.callTool("XcodeWrite", params as unknown as Record<string, unknown>);
  }

  /** Apply a str_replace-style patch to a file. */
  updateFile(params: XcodeUpdateParams): Promise<XcodeUpdateResult> {
    return this.callTool("XcodeUpdate", params as unknown as Record<string, unknown>);
  }

  /** Find files by glob pattern (e.g. "**\/*.swift"). */
  glob(params: XcodeGlobParams): Promise<XcodeGlobResult> {
    return this.callTool("XcodeGlob", params as unknown as Record<string, unknown>);
  }

  /** Search file contents (grep). */
  grep(params: XcodeGrepParams): Promise<XcodeGrepResult> {
    return this.callTool("XcodeGrep", params as unknown as Record<string, unknown>);
  }

  /** List directory contents. */
  ls(params: XcodeLSParams): Promise<XcodeLSResult> {
    return this.callTool("XcodeLS", params as unknown as Record<string, unknown>);
  }

  /** Create a directory. */
  mkdir(params: XcodeMakeDirParams): Promise<XcodeMakeDirResult> {
    return this.callTool("XcodeMakeDir", params as unknown as Record<string, unknown>);
  }

  /** Remove a file or directory. */
  rm(params: XcodeRMParams): Promise<XcodeRMResult> {
    return this.callTool("XcodeRM", params as unknown as Record<string, unknown>);
  }

  /** Move or rename a file. */
  mv(params: XcodeMVParams): Promise<XcodeMVResult> {
    return this.callTool("XcodeMV", params as unknown as Record<string, unknown>);
  }

  // ─── Build & Test ─────────────────────────────────────────────────────────

  /** Build the active project. Throws XcodeBuildError on failure. */
  async buildProject(params: BuildProjectParams): Promise<BuildProjectResult> {
    const result = await this.callTool<BuildProjectResult>("BuildProject", params as unknown as Record<string, unknown>);
    const errors = result.errors?.filter((e: BuildError) => e.classification === "error") ?? [];
    if (errors.length > 0) {
      throw new XcodeBuildError(
        `Build failed with ${errors.length} error(s)`,
        errors,
      );
    }
    return result;
  }

  /** Fetch build log output, optionally filtered by severity. */
  getBuildLog(params: GetBuildLogParams): Promise<GetBuildLogResult> {
    return this.callTool("GetBuildLog", params as unknown as Record<string, unknown>);
  }

  /** Run all tests in the active scheme. */
  runAllTests(params: RunAllTestsParams): Promise<RunAllTestsResult> {
    return this.callTool("RunAllTests", params as unknown as Record<string, unknown>);
  }

  /** Run specific tests by identifier (e.g. "MyAppTests/testLogin"). */
  runSomeTests(params: RunSomeTestsParams): Promise<RunSomeTestsResult> {
    return this.callTool("RunSomeTests", params as unknown as Record<string, unknown>);
  }

  /** List all available tests. */
  getTestList(params: GetTestListParams): Promise<GetTestListResult> {
    return this.callTool("GetTestList", params as unknown as Record<string, unknown>);
  }

  // ─── Diagnostics ──────────────────────────────────────────────────────────

  /** Get all navigator issues (errors, warnings) for the project. */
  listNavigatorIssues(params: XcodeListNavigatorIssuesParams): Promise<XcodeListNavigatorIssuesResult> {
    return this.callTool("XcodeListNavigatorIssues", params as unknown as Record<string, unknown>);
  }

  /** Refresh and return live diagnostics for a specific file. */
  refreshCodeIssuesInFile(params: XcodeRefreshCodeIssuesInFileParams): Promise<XcodeRefreshCodeIssuesInFileResult> {
    return this.callTool("XcodeRefreshCodeIssuesInFile", params as unknown as Record<string, unknown>);
  }

  // ─── Code Execution ───────────────────────────────────────────────────────

  /** Execute a Swift code snippet in a REPL-like environment. */
  executeSnippet(params: ExecuteSnippetParams): Promise<ExecuteSnippetResult> {
    return this.callTool("ExecuteSnippet", params as unknown as Record<string, unknown>);
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  /** Render a SwiftUI preview → returns base64 PNG image. */
  renderPreview(params: RenderPreviewParams): Promise<RenderPreviewResult> {
    return this.callTool("RenderPreview", params as unknown as Record<string, unknown>);
  }

  // ─── Documentation ────────────────────────────────────────────────────────

  /**
   * Search Apple developer documentation and WWDC video transcripts.
   * Uses Apple's MLX-accelerated semantic search ("Squirrel MLX").
   */
  searchDocumentation(params: DocumentationSearchParams): Promise<DocumentationSearchResult> {
    return this.callTool("DocumentationSearch", params as unknown as Record<string, unknown>);
  }

  // ─── Windowing ────────────────────────────────────────────────────────────

  /**
   * List open Xcode windows and their tabIdentifiers.
   *
   * Xcode 26.3 mcpbridge (v24582) does not implement XcodeListWindows.
   * We probe via XcodeLS with an empty tabIdentifier — Xcode replies with
   * an error that enumerates all open windows:
   *   "* tabIdentifier: windowtab1, workspacePath: /path/to/project"
   */
  async listWindows(): Promise<XcodeListWindowsResult> {
    // Probe: intentionally omit tabIdentifier so Xcode returns the window list.
    let raw: unknown;
    try {
      raw = await this.callTool("XcodeLS", { tabIdentifier: "", path: "/" });
    } catch {
      // ignore — we only need the error message content
    }
    // If a future Xcode returns structured windows, use them.
    const asWindows = raw as { windows?: XcodeWindow[] } | undefined;
    if (asWindows?.windows && asWindows.windows.length > 0) {
      return { windows: asWindows.windows };
    }
    // Parse the tabIdentifier list from the error message.
    const errText = typeof raw === "string" ? raw
      : (raw as { content?: Array<{ text?: string }> } | undefined)
        ?.content?.[0]?.text ?? "";
    return { windows: this._parseWindowsFromMessage(errText) };
  } /** @internal Extract window list from Xcode tabIdentifier error messages. */
  private _parseWindowsFromMessage(msg: string): XcodeWindow[] {
    const windows: XcodeWindow[] = [];
    const lines = msg.split("\n").filter((l) => l.includes("tabIdentifier:"));
    for (const line of lines) {
      const tabMatch = line.match(/tabIdentifier:\s*(\S+)/);
      const pathMatch = line.match(/workspacePath:\s*(\S+)/);
      if (tabMatch?.[1]) {
        const win: XcodeWindow = { tabIdentifier: tabMatch[1] };
        if (pathMatch?.[1]) win.workspacePath = pathMatch[1];
        windows.push(win);
      }
    }
    return windows;
  }
}
