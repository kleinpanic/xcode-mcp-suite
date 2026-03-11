/**
 * XcodeSession — manages the tab-identifier lifecycle automatically.
 *
 * Wraps XcodeClient, auto-calls listWindows on first use, and exposes
 * all tool methods with tab-identifier pre-filled.
 */

import { XcodeClient, type XcodeClientOptions } from "./client.js";
import { XcodeConnectionError } from "./types.js";
import type {
  BuildProjectParams,
  BuildProjectResult,
  GetBuildLogParams,
  GetBuildLogResult,
  RunAllTestsParams,
  RunAllTestsResult,
  GetTestResultsResult,
  CleanBuildFolderResult,
  XcodeWindow,
  XcodeOpenFileParams,
  XcodeOpenFileResult,
  XcodeNavigateToSymbolParams,
  XcodeNavigateToSymbolResult,
  XcodeGetFileContentsParams,
  XcodeGetFileContentsResult,
  XcodeGetDiagnosticsResult,
  XcodeGetSymbolInfoParams,
  XcodeGetSymbolInfoResult,
  XcodeSearchDocumentationParams,
  XcodeSearchDocumentationResult,
  XcodeGetCompletionsParams,
  XcodeGetCompletionsResult,
  XcodeGetReferencesForSymbolParams,
  XcodeGetReferencesForSymbolResult,
  XcodeRunSwiftREPLParams,
  XcodeRunSwiftREPLResult,
  XcodeGetSwiftUIPreviewParams,
  XcodeGetSwiftUIPreviewResult,
  XcodeRefreshSwiftUIPreviewResult,
  XcodeListSimulatorsResult,
  XcodeRunOnSimulatorParams,
  XcodeRunOnSimulatorResult,
} from "./types.js";

export interface XcodeSessionOptions extends XcodeClientOptions {
  /** Prefer this window by project/workspace path. Falls back to first window. */
  projectPath?: string;
}

export class XcodeSession {
  readonly client: XcodeClient;
  private _window: XcodeWindow | null = null;
  private readonly opts: XcodeSessionOptions;

  constructor(opts: XcodeSessionOptions = {}) {
    this.opts = opts;
    this.client = new XcodeClient(opts);
  }

  async connect(): Promise<XcodeWindow> {
    await this.client.connect();
    return this.window();
  }

  async window(): Promise<XcodeWindow> {
    if (this._window) return this._window;
    const { windows } = await this.client.listWindows();
    if (windows.length === 0) {
      throw new XcodeConnectionError(
        "No Xcode windows found. Open a project in Xcode on the target host.",
      );
    }
    this._window = this.opts.projectPath
      ? (windows.find(
          (w) =>
            w.projectPath?.includes(this.opts.projectPath!) ||
            w.workspacePath?.includes(this.opts.projectPath!),
        ) ?? windows[0]!)
      : windows[0]!;
    return this._window;
  }

  private async tabId(): Promise<string> {
    return (await this.window())["tab-identifier"];
  }

  disconnect(): void {
    this.client.disconnect();
  }

  // ── Convenience wrappers (tab-identifier pre-filled) ────────────────────

  async buildProject(params: Omit<BuildProjectParams, "tab-identifier"> = {}): Promise<BuildProjectResult> {
    return this.client.buildProject({ ...params, "tab-identifier": await this.tabId() });
  }

  async getBuildLog(params: Omit<GetBuildLogParams, "tab-identifier"> = {}): Promise<GetBuildLogResult> {
    return this.client.getBuildLog({ ...params, "tab-identifier": await this.tabId() });
  }

  async runAllTests(params: Omit<RunAllTestsParams, "tab-identifier"> = {}): Promise<RunAllTestsResult> {
    return this.client.runAllTests({ ...params, "tab-identifier": await this.tabId() });
  }

  async getTestResults(): Promise<GetTestResultsResult> {
    return this.client.getTestResults({ "tab-identifier": await this.tabId() });
  }

  async cleanBuildFolder(): Promise<CleanBuildFolderResult> {
    return this.client.cleanBuildFolder({ "tab-identifier": await this.tabId() });
  }

  async openFile(params: Omit<XcodeOpenFileParams, "tab-identifier">): Promise<XcodeOpenFileResult> {
    return this.client.openFile({ ...params, "tab-identifier": await this.tabId() });
  }

  async navigateToSymbol(params: Omit<XcodeNavigateToSymbolParams, "tab-identifier">): Promise<XcodeNavigateToSymbolResult> {
    return this.client.navigateToSymbol({ ...params, "tab-identifier": await this.tabId() });
  }

  async getFileContents(params: Omit<XcodeGetFileContentsParams, "tab-identifier">): Promise<XcodeGetFileContentsResult> {
    return this.client.getFileContents({ ...params, "tab-identifier": await this.tabId() });
  }

  async getDiagnostics(filePath?: string): Promise<XcodeGetDiagnosticsResult> {
    const params: XcodeGetDiagnosticsParams = { "tab-identifier": await this.tabId() };
    if (filePath !== undefined) params.filePath = filePath;
    return this.client.getDiagnostics(params);
  }

  async getSymbolInfo(params: Omit<XcodeGetSymbolInfoParams, "tab-identifier">): Promise<XcodeGetSymbolInfoResult> {
    return this.client.getSymbolInfo({ ...params, "tab-identifier": await this.tabId() });
  }

  async searchDocumentation(params: XcodeSearchDocumentationParams): Promise<XcodeSearchDocumentationResult> {
    return this.client.searchDocumentation(params);
  }

  async getCompletions(params: Omit<XcodeGetCompletionsParams, "tab-identifier">): Promise<XcodeGetCompletionsResult> {
    return this.client.getCompletions({ ...params, "tab-identifier": await this.tabId() });
  }

  async getReferencesForSymbol(params: Omit<XcodeGetReferencesForSymbolParams, "tab-identifier">): Promise<XcodeGetReferencesForSymbolResult> {
    return this.client.getReferencesForSymbol({ ...params, "tab-identifier": await this.tabId() });
  }

  async runSwiftREPL(params: Omit<XcodeRunSwiftREPLParams, "tab-identifier">): Promise<XcodeRunSwiftREPLResult> {
    return this.client.runSwiftREPL({ ...params, "tab-identifier": await this.tabId() });
  }

  async getSwiftUIPreview(params: Omit<XcodeGetSwiftUIPreviewParams, "tab-identifier">): Promise<XcodeGetSwiftUIPreviewResult> {
    return this.client.getSwiftUIPreview({ ...params, "tab-identifier": await this.tabId() });
  }

  async refreshSwiftUIPreview(filePath: string): Promise<XcodeRefreshSwiftUIPreviewResult> {
    return this.client.refreshSwiftUIPreview({ "tab-identifier": await this.tabId(), filePath });
  }

  async listSimulators(): Promise<XcodeListSimulatorsResult> {
    return this.client.listSimulators();
  }

  async runOnSimulator(params: Omit<XcodeRunOnSimulatorParams, "tab-identifier"> = {}): Promise<XcodeRunOnSimulatorResult> {
    return this.client.runOnSimulator({ ...params, "tab-identifier": await this.tabId() });
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
