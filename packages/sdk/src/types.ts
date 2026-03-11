/**
 * Core types for the Xcode MCP SDK.
 *
 * @see https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode
 */

// ─── Shared ────────────────────────────────────────────────────────────────

/** Every tool call that targets a specific Xcode window requires this. */
export interface WithTabIdentifier {
  /** Obtained from {@link XcodeListWindowsResult}. Always call XcodeListWindows first. */
  "tab-identifier": string;
}

// ─── Build & Test ──────────────────────────────────────────────────────────

export interface BuildProjectParams extends WithTabIdentifier {
  /** Override the active scheme. */
  scheme?: string;
  /** Override the active configuration (e.g. "Debug", "Release"). */
  configuration?: string;
}

export interface BuildProjectResult {
  success: boolean;
  errors: BuildIssue[];
  warnings: BuildIssue[];
  notes: BuildIssue[];
  duration?: number;
}

export interface BuildIssue {
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity: "error" | "warning" | "note";
}

export interface GetBuildLogParams extends WithTabIdentifier {
  severity?: "error" | "warning" | "all";
  limit?: number;
}

export interface GetBuildLogResult {
  entries: BuildIssue[];
  total: number;
}

export interface RunAllTestsParams extends WithTabIdentifier {
  scheme?: string;
  testPlan?: string;
}

export interface RunAllTestsResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: TestFailure[];
}

export interface TestFailure {
  testName: string;
  file: string;
  line: number;
  message: string;
}

export interface GetTestResultsParams extends WithTabIdentifier {}

export interface GetTestResultsResult extends RunAllTestsResult {}

export interface CleanBuildFolderParams extends WithTabIdentifier {}
export interface CleanBuildFolderResult { success: boolean }

// ─── Files & Navigation ────────────────────────────────────────────────────

export interface XcodeListWindowsParams {}

export interface XcodeListWindowsResult {
  windows: XcodeWindow[];
}

export interface XcodeWindow {
  "tab-identifier": string;
  title: string;
  projectPath?: string;
  workspacePath?: string;
  scheme?: string;
}

export interface XcodeOpenFileParams extends WithTabIdentifier {
  filePath: string;
  line?: number;
}
export interface XcodeOpenFileResult { success: boolean }

export interface XcodeNavigateToSymbolParams extends WithTabIdentifier {
  symbol: string;
}
export interface XcodeNavigateToSymbolResult {
  found: boolean;
  file?: string;
  line?: number;
}

export interface XcodeGetFileContentsParams extends WithTabIdentifier {
  filePath: string;
}
export interface XcodeGetFileContentsResult {
  contents: string;
  filePath: string;
  language?: string;
}

export interface XcodeRefreshCodeIssuesInFileParams extends WithTabIdentifier {
  filePath: string;
}
export interface XcodeRefreshCodeIssuesInFileResult {
  issues: BuildIssue[];
}

// ─── Diagnostics & Intelligence ────────────────────────────────────────────

export interface XcodeGetDiagnosticsParams extends WithTabIdentifier {
  filePath?: string;
}
export interface XcodeGetDiagnosticsResult {
  diagnostics: BuildIssue[];
}

export interface XcodeGetSymbolInfoParams extends WithTabIdentifier {
  symbol: string;
  filePath?: string;
}
export interface XcodeGetSymbolInfoResult {
  symbol: string;
  kind: string;
  declaration?: string;
  documentation?: string;
  file?: string;
  line?: number;
}

export interface XcodeSearchDocumentationParams {
  query: string;
  limit?: number;
}
export interface XcodeSearchDocumentationResult {
  results: DocumentationResult[];
}
export interface DocumentationResult {
  title: string;
  url: string;
  abstract?: string;
}

export interface XcodeGetCompletionsParams extends WithTabIdentifier {
  filePath: string;
  line: number;
  column: number;
}
export interface XcodeGetCompletionsResult {
  completions: Completion[];
}
export interface Completion {
  text: string;
  kind: string;
  documentation?: string;
}

export interface XcodeGetReferencesForSymbolParams extends WithTabIdentifier {
  symbol: string;
  filePath?: string;
}
export interface XcodeGetReferencesForSymbolResult {
  references: SymbolReference[];
}
export interface SymbolReference {
  file: string;
  line: number;
  column: number;
  snippet?: string;
}

// ─── Swift REPL & Previews ─────────────────────────────────────────────────

export interface XcodeRunSwiftREPLParams extends WithTabIdentifier {
  code: string;
  timeout?: number;
}
export interface XcodeRunSwiftREPLResult {
  output: string;
  error?: string;
  success: boolean;
}

export interface XcodeGetSwiftUIPreviewParams extends WithTabIdentifier {
  filePath: string;
  previewName?: string;
  deviceName?: string;
}
export interface XcodeGetSwiftUIPreviewResult {
  /** Base64-encoded PNG of the rendered preview. */
  imageData?: string;
  error?: string;
}

export interface XcodeRefreshSwiftUIPreviewParams extends WithTabIdentifier {
  filePath: string;
}
export interface XcodeRefreshSwiftUIPreviewResult {
  success: boolean;
}

// ─── Simulator ─────────────────────────────────────────────────────────────

export interface XcodeListSimulatorsParams {}
export interface XcodeListSimulatorsResult {
  simulators: Simulator[];
}
export interface Simulator {
  udid: string;
  name: string;
  runtime: string;
  state: "Booted" | "Shutdown" | "Booting";
  deviceType: string;
}

export interface XcodeRunOnSimulatorParams extends WithTabIdentifier {
  simulatorUdid?: string;
  deviceName?: string;
  scheme?: string;
}
export interface XcodeRunOnSimulatorResult {
  success: boolean;
  simulatorUdid?: string;
  error?: string;
}

// ─── Errors ────────────────────────────────────────────────────────────────

export class XcodeConnectionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "XcodeConnectionError";
  }
}

export class XcodeToolError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "XcodeToolError";
  }
}

export class XcodeBuildError extends Error {
  constructor(
    message: string,
    public readonly issues: BuildIssue[],
  ) {
    super(message);
    this.name = "XcodeBuildError";
  }
}
