/**
 * XcodeSession — managed session with automatic tabIdentifier handling.
 *
 * Wraps XcodeClient, auto-calls listWindows on first use, and exposes
 * all 20 tool methods with tabIdentifier pre-filled.
 */

import { XcodeClient, type XcodeClientOptions } from "./client.js";
import { XcodeConnectionError } from "./types.js";
import type {
  XcodeWindow,
  XcodeReadResult,
  XcodeWriteResult,
  XcodeUpdateResult,
  XcodeGlobResult,
  XcodeGrepResult,
  XcodeLSResult,
  XcodeMakeDirResult,
  XcodeRMResult,
  XcodeMVResult,
  BuildProjectResult,
  GetBuildLogResult,
  RunAllTestsResult,
  RunSomeTestsResult,
  GetTestListResult,
  XcodeListNavigatorIssuesResult,
  XcodeRefreshCodeIssuesInFileResult,
  ExecuteSnippetResult,
  RenderPreviewResult,
  DocumentationSearchParams,
  DocumentationSearchResult,
  XcodeListWindowsResult,
} from "./types.js";

export interface XcodeSessionOptions extends XcodeClientOptions {
  /** Prefer this window by workspace path match. Falls back to first window. */
  projectPath?: string;
}

export class XcodeSession {
  readonly client: XcodeClient;
  private _tabId: string | null = null;
  private readonly opts: XcodeSessionOptions;

  constructor(opts: XcodeSessionOptions = {}) {
    this.opts = opts;
    this.client = new XcodeClient(opts);
  }

  async connect(): Promise<string> {
    await this.client.connect();
    return this.tabId();
  }

  async tabId(): Promise<string> {
    if (this._tabId) return this._tabId;
    const result = await this.client.listWindows();
    // Parse windows from result (format varies: message string or windows array)
    const windows = result.windows ?? this._parseWindowsFromMessage(result.message);
    if (!windows || windows.length === 0) {
      throw new XcodeConnectionError(
        "No Xcode windows found. Open a project in Xcode on the target host.",
      );
    }
    const win = this.opts.projectPath
      ? (windows.find((w) => w.workspacePath?.includes(this.opts.projectPath!)) ?? windows[0]!)
      : windows[0]!;
    this._tabId = win.tabIdentifier;
    return this._tabId;
  }

  private _parseWindowsFromMessage(msg?: string): XcodeWindow[] {
    if (!msg) return [];
    // Parse "* tabIdentifier: windowtab1, workspacePath: /path/to/project" format
    const windows: XcodeWindow[] = [];
    const lines = msg.split("\n").filter((l) => l.includes("tabIdentifier"));
    for (const line of lines) {
      const tabMatch = line.match(/tabIdentifier:\s*(\S+)/);
      const pathMatch = line.match(/workspacePath:\s*(\S+)/);
      if (tabMatch?.[1]) {
        windows.push({
          tabIdentifier: tabMatch[1],
          workspacePath: pathMatch?.[1],
        });
      }
    }
    return windows;
  }

  disconnect(): void {
    this.client.disconnect();
  }

  // ── File Operations ─────────────────────────────────────────────────────

  async readFile(filePath: string): Promise<XcodeReadResult> {
    return this.client.readFile({ tabIdentifier: await this.tabId(), filePath });
  }

  async writeFile(filePath: string, content: string): Promise<XcodeWriteResult> {
    return this.client.writeFile({ tabIdentifier: await this.tabId(), filePath, content });
  }

  async updateFile(filePath: string, oldString: string, newString: string, replaceAll?: boolean): Promise<XcodeUpdateResult> {
    return this.client.updateFile({ tabIdentifier: await this.tabId(), filePath, oldString, newString, replaceAll });
  }

  async glob(pattern: string): Promise<XcodeGlobResult> {
    return this.client.glob({ tabIdentifier: await this.tabId(), pattern });
  }

  async grep(pattern: string, include?: string): Promise<XcodeGrepResult> {
    return this.client.grep({ tabIdentifier: await this.tabId(), pattern, include });
  }

  async ls(path: string): Promise<XcodeLSResult> {
    return this.client.ls({ tabIdentifier: await this.tabId(), path });
  }

  async mkdir(directoryPath: string): Promise<XcodeMakeDirResult> {
    return this.client.mkdir({ tabIdentifier: await this.tabId(), directoryPath });
  }

  async rm(path: string): Promise<XcodeRMResult> {
    return this.client.rm({ tabIdentifier: await this.tabId(), path });
  }

  async mv(sourcePath: string, destinationPath: string, operation?: "move" | "copy"): Promise<XcodeMVResult> {
    return this.client.mv({ tabIdentifier: await this.tabId(), sourcePath, destinationPath, operation });
  }

  // ── Build & Test ────────────────────────────────────────────────────────

  async buildProject(): Promise<BuildProjectResult> {
    return this.client.buildProject({ tabIdentifier: await this.tabId() });
  }

  async getBuildLog(params: { severity?: "error" | "warning" | "remark"; glob?: string; pattern?: string } = {}): Promise<GetBuildLogResult> {
    return this.client.getBuildLog({ ...params, tabIdentifier: await this.tabId() });
  }

  async runAllTests(): Promise<RunAllTestsResult> {
    return this.client.runAllTests({ tabIdentifier: await this.tabId() });
  }

  async runSomeTests(tests: string[]): Promise<RunSomeTestsResult> {
    return this.client.runSomeTests({ tests, tabIdentifier: await this.tabId() });
  }

  async getTestList(): Promise<GetTestListResult> {
    return this.client.getTestList({ tabIdentifier: await this.tabId() });
  }

  // ── Diagnostics ─────────────────────────────────────────────────────────

  async listNavigatorIssues(): Promise<XcodeListNavigatorIssuesResult> {
    return this.client.listNavigatorIssues({ tabIdentifier: await this.tabId() });
  }

  async refreshCodeIssuesInFile(filePath: string): Promise<XcodeRefreshCodeIssuesInFileResult> {
    return this.client.refreshCodeIssuesInFile({ tabIdentifier: await this.tabId(), filePath });
  }

  // ── Code Execution ──────────────────────────────────────────────────────

  async executeSnippet(codeSnippet: string, sourceFilePath: string, timeout?: number): Promise<ExecuteSnippetResult> {
    return this.client.executeSnippet({ tabIdentifier: await this.tabId(), codeSnippet, sourceFilePath, timeout });
  }

  // ── Preview ─────────────────────────────────────────────────────────────

  async renderPreview(filePath: string, previewName?: string): Promise<RenderPreviewResult> {
    return this.client.renderPreview({ tabIdentifier: await this.tabId(), filePath, previewName });
  }

  // ── Documentation (no tabIdentifier needed) ─────────────────────────────

  async searchDocumentation(query: string): Promise<DocumentationSearchResult> {
    return this.client.searchDocumentation({ query });
  }

  // ── Windowing ───────────────────────────────────────────────────────────

  async listWindows(): Promise<XcodeListWindowsResult> {
    return this.client.listWindows();
  }
}

/** Convenience: create, connect, run callback, disconnect. */
export async function withXcodeSession<T>(
  opts: XcodeSessionOptions,
  fn: (session: XcodeSession) => Promise<T>,
): Promise<T> {
  const session = new XcodeSession(opts);
  await session.connect();
  try {
    return await fn(session);
  } finally {
    session.disconnect();
  }
}
