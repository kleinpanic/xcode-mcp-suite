/**
 * XcodeClient — typed wrapper for all 20 Xcode MCP tools.
 *
 * Connects to Xcode via a local or remote xcrun mcpbridge process.
 *
 * @example
 * ```ts
 * const client = new XcodeClient({ host: "collins-pro" });
 * await client.connect();
 * const { windows } = await client.listWindows();
 * const tabId = windows[0]["tab-identifier"];
 * const result = await client.buildProject({ "tab-identifier": tabId });
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
  type BuildProjectParams,
  type BuildProjectResult,
  type GetBuildLogParams,
  type GetBuildLogResult,
  type RunAllTestsParams,
  type RunAllTestsResult,
  type GetTestResultsParams,
  type GetTestResultsResult,
  type CleanBuildFolderParams,
  type CleanBuildFolderResult,
  type XcodeListWindowsParams,
  type XcodeListWindowsResult,
  type XcodeOpenFileParams,
  type XcodeOpenFileResult,
  type XcodeNavigateToSymbolParams,
  type XcodeNavigateToSymbolResult,
  type XcodeGetFileContentsParams,
  type XcodeGetFileContentsResult,
  type XcodeRefreshCodeIssuesInFileParams,
  type XcodeRefreshCodeIssuesInFileResult,
  type XcodeGetDiagnosticsParams,
  type XcodeGetDiagnosticsResult,
  type XcodeGetSymbolInfoParams,
  type XcodeGetSymbolInfoResult,
  type XcodeSearchDocumentationParams,
  type XcodeSearchDocumentationResult,
  type XcodeGetCompletionsParams,
  type XcodeGetCompletionsResult,
  type XcodeGetReferencesForSymbolParams,
  type XcodeGetReferencesForSymbolResult,
  type XcodeRunSwiftREPLParams,
  type XcodeRunSwiftREPLResult,
  type XcodeGetSwiftUIPreviewParams,
  type XcodeGetSwiftUIPreviewResult,
  type XcodeRefreshSwiftUIPreviewParams,
  type XcodeRefreshSwiftUIPreviewResult,
  type XcodeListSimulatorsParams,
  type XcodeListSimulatorsResult,
  type XcodeRunOnSimulatorParams,
  type XcodeRunOnSimulatorResult,
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

    // Send MCP initialize
    await this._call("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "xcode-mcp-sdk", version: "0.1.0" },
      capabilities: {},
    });
    await this._call("notifications/initialized", {});
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

  private async _tool<P, R>(name: string, params: P): Promise<R> {
    const result = await this._call("tools/call", { name, arguments: params });
    // MCP tools/call returns { content: [{type:"text",text:"..."}] }
    const content = (result as { content?: Array<{ type: string; text?: string }> })?.content;
    const text = content?.find((c) => c.type === "text")?.text ?? "{}";
    try {
      return JSON.parse(text) as R;
    } catch {
      return text as unknown as R;
    }
  }

  // ─── Build & Test ─────────────────────────────────────────────────────────

  /** Build the active Xcode project/workspace. */
  async buildProject(params: BuildProjectParams): Promise<BuildProjectResult> {
    const result = await this._tool<BuildProjectParams, BuildProjectResult>("BuildProject", params);
    if (!result.success && result.errors.length > 0) {
      throw new XcodeBuildError(
        `Build failed with ${result.errors.length} error(s)`,
        result.errors,
      );
    }
    return result;
  }

  /** Fetch the build log, optionally filtered by severity. */
  getBuildLog(params: GetBuildLogParams): Promise<GetBuildLogResult> {
    return this._tool("GetBuildLog", params);
  }

  /** Run all tests in the active scheme. */
  runAllTests(params: RunAllTestsParams): Promise<RunAllTestsResult> {
    return this._tool("RunAllTests", params);
  }

  /** Get results from the most recent test run. */
  getTestResults(params: GetTestResultsParams): Promise<GetTestResultsResult> {
    return this._tool("GetTestResults", params);
  }

  /** Clean the derived data / build folder. */
  cleanBuildFolder(params: CleanBuildFolderParams): Promise<CleanBuildFolderResult> {
    return this._tool("CleanBuildFolder", params);
  }

  // ─── Files & Navigation ───────────────────────────────────────────────────

  /**
   * List open Xcode windows. **Always call this first** to obtain tab-identifiers
   * required by all other tools.
   */
  listWindows(params: XcodeListWindowsParams = {}): Promise<XcodeListWindowsResult> {
    return this._tool("XcodeListWindows", params);
  }

  /** Open a file in Xcode, optionally jumping to a line. */
  openFile(params: XcodeOpenFileParams): Promise<XcodeOpenFileResult> {
    return this._tool("XcodeOpenFile", params);
  }

  /** Jump to a named symbol in the Xcode editor. */
  navigateToSymbol(params: XcodeNavigateToSymbolParams): Promise<XcodeNavigateToSymbolResult> {
    return this._tool("XcodeNavigateToSymbol", params);
  }

  /** Read a file's contents through Xcode's buffer (includes unsaved changes). */
  getFileContents(params: XcodeGetFileContentsParams): Promise<XcodeGetFileContentsResult> {
    return this._tool("XcodeGetFileContents", params);
  }

  /** Re-run diagnostics on a specific file and return current issues. */
  refreshCodeIssuesInFile(
    params: XcodeRefreshCodeIssuesInFileParams,
  ): Promise<XcodeRefreshCodeIssuesInFileResult> {
    return this._tool("XcodeRefreshCodeIssuesInFile", params);
  }

  // ─── Diagnostics & Intelligence ───────────────────────────────────────────

  /** Get all current diagnostics, optionally scoped to a file. */
  getDiagnostics(params: XcodeGetDiagnosticsParams): Promise<XcodeGetDiagnosticsResult> {
    return this._tool("XcodeGetDiagnostics", params);
  }

  /** Look up symbol information (type, declaration, docs). */
  getSymbolInfo(params: XcodeGetSymbolInfoParams): Promise<XcodeGetSymbolInfoResult> {
    return this._tool("XcodeGetSymbolInfo", params);
  }

  /** Search Apple developer documentation. */
  searchDocumentation(
    params: XcodeSearchDocumentationParams,
  ): Promise<XcodeSearchDocumentationResult> {
    return this._tool("XcodeSearchDocumentation", params);
  }

  /** Get code completions at a cursor position. */
  getCompletions(params: XcodeGetCompletionsParams): Promise<XcodeGetCompletionsResult> {
    return this._tool("XcodeGetCompletions", params);
  }

  /** Find all references to a symbol across the project. */
  getReferencesForSymbol(
    params: XcodeGetReferencesForSymbolParams,
  ): Promise<XcodeGetReferencesForSymbolResult> {
    return this._tool("XcodeGetReferencesForSymbol", params);
  }

  // ─── Swift REPL & Previews ────────────────────────────────────────────────

  /** Execute Swift code in the REPL. */
  runSwiftREPL(params: XcodeRunSwiftREPLParams): Promise<XcodeRunSwiftREPLResult> {
    return this._tool("XcodeRunSwiftREPL", params);
  }

  /** Render a SwiftUI preview and return a base64-encoded PNG. */
  getSwiftUIPreview(params: XcodeGetSwiftUIPreviewParams): Promise<XcodeGetSwiftUIPreviewResult> {
    return this._tool("XcodeGetSwiftUIPreview", params);
  }

  /** Refresh a SwiftUI preview for a file. */
  refreshSwiftUIPreview(
    params: XcodeRefreshSwiftUIPreviewParams,
  ): Promise<XcodeRefreshSwiftUIPreviewResult> {
    return this._tool("XcodeRefreshSwiftUIPreview", params);
  }

  // ─── Simulator ────────────────────────────────────────────────────────────

  /** List available simulators and their boot state. */
  listSimulators(params: XcodeListSimulatorsParams = {}): Promise<XcodeListSimulatorsResult> {
    return this._tool("XcodeListSimulators", params);
  }

  /** Build and run the app on a simulator. */
  runOnSimulator(params: XcodeRunOnSimulatorParams): Promise<XcodeRunOnSimulatorResult> {
    return this._tool("XcodeRunOnSimulator", params);
  }
}
