/**
 * Core types for the Xcode MCP SDK.
 *
 * All 20 tools as documented in Xcode 26.3's xcrun mcpbridge.
 * @see https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode
 */

// ─── Shared ────────────────────────────────────────────────────────────────

/** Most tools require a tabIdentifier to target a specific Xcode window. */
export interface WithTabIdentifier {
  /** Obtained from {@link XcodeListWindowsResult}. Always call XcodeListWindows first. */
  tabIdentifier: string;
}

// ─── File Operations (9 tools) ─────────────────────────────────────────────

export interface XcodeReadParams extends WithTabIdentifier {
  /** Absolute or project-relative file path. */
  filePath: string;
}
export interface XcodeReadResult {
  content: string;
  filePath: string;
}

export interface XcodeWriteParams extends WithTabIdentifier {
  /** Absolute or project-relative file path. */
  filePath: string;
  /** Full file content to write. */
  content: string;
}
export interface XcodeWriteResult {
  success: boolean;
}

export interface XcodeUpdateParams extends WithTabIdentifier {
  /** File to patch. */
  filePath: string;
  /** Exact text to find (must match exactly). */
  oldText: string;
  /** Replacement text. */
  newText: string;
}
export interface XcodeUpdateResult {
  success: boolean;
  /** Number of replacements made. */
  replacements?: number;
}

export interface XcodeGlobParams extends WithTabIdentifier {
  /** Glob pattern (e.g. "**\/*.swift"). */
  pattern: string;
}
export interface XcodeGlobResult {
  files: string[];
}

export interface XcodeGrepParams extends WithTabIdentifier {
  /** Search pattern (string or regex). */
  pattern: string;
  /** Optional: limit search to specific path/glob. */
  include?: string;
}
export interface XcodeGrepResult {
  matches: GrepMatch[];
}
export interface GrepMatch {
  file: string;
  line: number;
  text: string;
}

export interface XcodeLSParams extends WithTabIdentifier {
  /** Directory path to list. */
  path: string;
}
export interface XcodeLSResult {
  entries: DirectoryEntry[];
}
export interface DirectoryEntry {
  name: string;
  type: "file" | "directory" | "symlink";
  size?: number;
}

export interface XcodeMakeDirParams extends WithTabIdentifier {
  /** Directory path to create. */
  path: string;
}
export interface XcodeMakeDirResult {
  success: boolean;
}

export interface XcodeRMParams extends WithTabIdentifier {
  /** File or directory to remove. */
  path: string;
}
export interface XcodeRMResult {
  success: boolean;
}

export interface XcodeMVParams extends WithTabIdentifier {
  /** Source path. */
  from: string;
  /** Destination path. */
  to: string;
}
export interface XcodeMVResult {
  success: boolean;
}

// ─── Build & Test (5 tools) ────────────────────────────────────────────────

export interface BuildProjectParams extends WithTabIdentifier {
  scheme?: string;
  configuration?: string;
}
export interface BuildProjectResult {
  buildResult: string;
  elapsedTime?: number;
  errors: BuildIssue[];
  warnings?: BuildIssue[];
}
export interface BuildIssue {
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity?: "error" | "warning" | "note";
}

export interface GetBuildLogParams extends WithTabIdentifier {
  severity?: "error" | "warning" | "all";
}
export interface GetBuildLogResult {
  log: string;
  entries?: BuildIssue[];
}

export interface RunAllTestsParams extends WithTabIdentifier {
  scheme?: string;
}
export interface RunAllTestsResult {
  testResult: string;
  passed?: number;
  failed?: number;
  duration?: number;
  failures?: TestFailure[];
}
export interface TestFailure {
  testName: string;
  file?: string;
  line?: number;
  message: string;
}

export interface RunSomeTestsParams extends WithTabIdentifier {
  /** Test identifiers to run (e.g. "MyAppTests/testLogin"). */
  tests: string[];
  scheme?: string;
}
export interface RunSomeTestsResult extends RunAllTestsResult {}

export interface GetTestListParams extends WithTabIdentifier {
  scheme?: string;
}
export interface GetTestListResult {
  tests: TestEntry[];
}
export interface TestEntry {
  name: string;
  suite: string;
  identifier: string;
}

// ─── Diagnostics (2 tools) ─────────────────────────────────────────────────

export interface XcodeListNavigatorIssuesParams extends WithTabIdentifier {}
export interface XcodeListNavigatorIssuesResult {
  issues: NavigatorIssue[];
}
export interface NavigatorIssue {
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity: "error" | "warning" | "note";
  category?: string;
}

export interface XcodeRefreshCodeIssuesInFileParams extends WithTabIdentifier {
  filePath: string;
}
export interface XcodeRefreshCodeIssuesInFileResult {
  issues: NavigatorIssue[];
}

// ─── Code Execution (1 tool) ───────────────────────────────────────────────

export interface ExecuteSnippetParams extends WithTabIdentifier {
  /** Swift source code to execute. */
  code: string;
  timeout?: number;
}
export interface ExecuteSnippetResult {
  output: string;
  error?: string;
  success: boolean;
}

// ─── Preview (1 tool) ──────────────────────────────────────────────────────

export interface RenderPreviewParams extends WithTabIdentifier {
  /** SwiftUI source file path. */
  filePath: string;
  /** Optional preview name within the file. */
  previewName?: string;
}
export interface RenderPreviewResult {
  /** Base64-encoded PNG image data. */
  imageData?: string;
  error?: string;
}

// ─── Documentation (1 tool) ────────────────────────────────────────────────

export interface DocumentationSearchParams {
  /** Search query (semantic search via Apple's MLX embeddings). */
  query: string;
}
export interface DocumentationSearchResult {
  results: DocumentationEntry[];
}
export interface DocumentationEntry {
  title: string;
  url: string;
  abstract?: string;
  /** Source: "documentation" or "wwdc" (WWDC video transcripts). */
  source?: string;
}

// ─── Windowing (1 tool) ────────────────────────────────────────────────────

export interface XcodeListWindowsResult {
  /** Raw message string listing windows. */
  message?: string;
  windows?: XcodeWindow[];
}
export interface XcodeWindow {
  tabIdentifier: string;
  workspacePath?: string;
  title?: string;
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
