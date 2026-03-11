/**
 * Xcode MCP SDK types — verified against actual xcrun mcpbridge tools/list output.
 *
 * Source: https://gist.github.com/keith/d8aca9661002388650cf2fdc5eac9f3b
 * All parameter names match the REAL Xcode 26.3 API exactly.
 *
 * @see https://developer.apple.com/documentation/xcode/giving-agentic-coding-tools-access-to-xcode
 */

// ─── Shared ────────────────────────────────────────────────────────────────

export interface WithTabIdentifier {
  /** Obtained from XcodeListWindows. Always call listWindows() first. */
  tabIdentifier: string;
}

// ─── File Operations (9 tools) ─────────────────────────────────────────────

/** XcodeRead — Read file contents (cat -n style with line numbers). */
export interface XcodeReadParams extends WithTabIdentifier {
  /** Path within Xcode project organization (e.g. "ProjectName/Sources/MyFile.swift"). */
  filePath: string;
  /** Line number to start reading from (for large files). */
  offset?: number;
  /** Number of lines to read (default: 600). */
  limit?: number;
}
export interface XcodeReadResult {
  content: string;
  filePath: string;
  fileSize: number;
  linesRead: number;
  startLine: number;
  totalLines: number;
}

/** XcodeWrite — Create or overwrite files in the project. */
export interface XcodeWriteParams extends WithTabIdentifier {
  filePath: string;
  content: string;
}
export interface XcodeWriteResult {
  success: boolean;
  filePath: string;
  bytesWritten: number;
  linesWritten: number;
  message: string;
  wasExistingFile: boolean;
  absolutePath?: string;
}

/** XcodeUpdate — str_replace-style file edits.
 *  IMPORTANT: Uses oldString/newString, NOT oldText/newText. */
export interface XcodeUpdateParams extends WithTabIdentifier {
  filePath: string;
  /** The exact text to find and replace. */
  oldString: string;
  /** The replacement text (must differ from oldString). */
  newString: string;
  /** Replace all occurrences (default: false). */
  replaceAll?: boolean;
}
export interface XcodeUpdateResult {
  success: boolean;
  filePath: string;
  editsApplied: number;
  originalContentLength: number;
  modifiedContentLength: number;
  message?: string;
}

/** XcodeGlob — Find files by glob pattern. */
export interface XcodeGlobParams extends WithTabIdentifier {
  /** Glob pattern (e.g. "**\/*.swift"). Defaults to "**\/*" if omitted. */
  pattern?: string;
  /** Project directory to search in (optional, defaults to root). */
  path?: string;
}
export interface XcodeGlobResult {
  /** Matching file paths, sorted by most recently modified. Truncated at 100. */
  matches: string[];
  pattern: string;
  searchPath: string;
  totalFound: number;
  truncated: boolean;
  message?: string;
}

/** XcodeGrep — Search file contents with regex. */
export interface XcodeGrepParams extends WithTabIdentifier {
  /** Regex pattern to search for (REQUIRED). */
  pattern: string;
  /** Only search files matching this glob. */
  glob?: string;
  /** Project path to search in (defaults to root). */
  path?: string;
  /** Stop after N results. */
  headLimit?: number;
  /** Ignore case when matching. */
  ignoreCase?: boolean;
  /** Show N lines after each match. */
  linesAfter?: number;
  /** Show N lines before each match. */
  linesBefore?: number;
  /** Show N lines both before and after. */
  linesContext?: number;
  /** Allow patterns to span multiple lines. */
  multiline?: boolean;
  /** What to return: "content" | "filesWithMatches" | "count" (default: "filesWithMatches"). */
  outputMode?: "content" | "filesWithMatches" | "count";
  /** Show line numbers (content mode only). */
  showLineNumbers?: boolean;
  /** Shortcut for common file types (swift, js, py, etc.). */
  type?: string;
}
export interface XcodeGrepResult {
  results: string[];
  pattern: string;
  searchPath: string;
  matchCount: number;
  truncated: boolean;
  message?: string;
}

/** XcodeLS — List directory contents in project structure. */
export interface XcodeLSParams extends WithTabIdentifier {
  /** Project path to browse (e.g. "ProjectName/Sources/"). */
  path: string;
  /** Recursively list all files (truncated to 100). Default: true. */
  recursive?: boolean;
  /** Skip files/folders matching these patterns. */
  ignore?: string[];
}
export interface XcodeLSResult {
  items: string[];
  path: string;
}

/** XcodeMakeDir — Create directories/groups in project. */
export interface XcodeMakeDirParams extends WithTabIdentifier {
  /** Project navigator relative path for the directory to create. */
  directoryPath: string;
}
export interface XcodeMakeDirResult {
  success: boolean;
  message: string;
  createdPath?: string;
}

/** XcodeRM — Remove files/directories from project. */
export interface XcodeRMParams extends WithTabIdentifier {
  /** Project path to remove. */
  path: string;
  /** Also move underlying files to Trash (default: true). */
  deleteFiles?: boolean;
  /** Remove directories recursively. */
  recursive?: boolean;
}
export interface XcodeRMResult {
  success: boolean;
  removedPath: string;
  message: string;
}

/** XcodeMV — Move/rename/copy files in project.
 *  IMPORTANT: Uses sourcePath/destinationPath, NOT from/to. */
export interface XcodeMVParams extends WithTabIdentifier {
  /** Source project path. */
  sourcePath: string;
  /** Destination project path or new name. */
  destinationPath: string;
  /** Operation type: "move" | "copy". */
  operation?: "move" | "copy";
  /** Whether to overwrite existing files. */
  overwriteExisting?: boolean;
}
export interface XcodeMVResult {
  success: boolean;
  operation: string;
  message: string;
  sourceOriginalPath?: string;
  destinationFinalPath?: string;
}

// ─── Build & Test (5 tools) ────────────────────────────────────────────────

/** BuildProject — Build the project. Only tabIdentifier required. */
export interface BuildProjectParams extends WithTabIdentifier {}
export interface BuildProjectResult {
  buildResult: string;
  elapsedTime?: number;
  errors: BuildError[];
}
export interface BuildError {
  classification: string;
  message: string;
  filePath?: string;
  lineNumber?: number;
}

/** GetBuildLog — Get build log with optional filters. */
export interface GetBuildLogParams extends WithTabIdentifier {
  /** Filter by severity: "error" | "warning" | "remark". Default: "error". */
  severity?: "error" | "warning" | "remark";
  /** Glob to filter by file path. */
  glob?: string;
  /** Regex to filter by message content. */
  pattern?: string;
}
export interface GetBuildLogResult {
  buildResult: string;
  buildIsRunning: boolean;
  buildLogEntries: BuildLogEntry[];
  truncated: boolean;
  totalFound: number;
  fullLogPath: string;
  message?: string;
}
export interface BuildLogEntry {
  buildTask?: string;
  emittedIssues: BuildLogIssue[];
}
export interface BuildLogIssue {
  severity: string;
  message: string;
  line?: number;
  path?: string;
}

/** RunAllTests — Run all tests. Only tabIdentifier required. */
export interface RunAllTestsParams extends WithTabIdentifier {}
export interface RunAllTestsResult {
  summary: string;
  schemeName: string;
  activeTestPlanName?: string;
  counts: TestCounts;
  results: TestResult[];
  truncated: boolean;
  totalResults: number;
  message?: string;
}
export interface TestCounts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  expectedFailures: number;
  notRun: number;
}
export interface TestResult {
  targetName: string;
  identifier: string;
  displayName: string;
  state: string;
}

/** RunSomeTests — Run specific tests by identifier. */
export interface RunSomeTestsParams extends WithTabIdentifier {
  /** Test identifiers in XCTestIdentifier format. */
  tests: string[];
}
export interface RunSomeTestsResult extends RunAllTestsResult {}

/** GetTestList — List all available tests. */
export interface GetTestListParams extends WithTabIdentifier {}
export interface GetTestListResult {
  schemeName: string;
  activeTestPlanName?: string;
  tests: TestListEntry[];
}
export interface TestListEntry {
  identifier: string;
  displayName: string;
  filePath?: string;
  lineNumber?: number;
  isEnabled?: boolean;
  tags?: string[];
}

// ─── Diagnostics (2 tools) ─────────────────────────────────────────────────

/** XcodeListNavigatorIssues — All project errors/warnings from Issue Navigator. */
export interface XcodeListNavigatorIssuesParams extends WithTabIdentifier {}
export interface XcodeListNavigatorIssuesResult {
  issues: NavigatorIssue[];
}
export interface NavigatorIssue {
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity: string;
  category?: string;
}

/** XcodeRefreshCodeIssuesInFile — Live diagnostics for one file. */
export interface XcodeRefreshCodeIssuesInFileParams extends WithTabIdentifier {
  filePath: string;
}
export interface XcodeRefreshCodeIssuesInFileResult {
  filePath: string;
  diagnosticsCount: number;
  content: string;
  success: boolean;
}

// ─── Code Execution (1 tool) ───────────────────────────────────────────────

/** ExecuteSnippet — Run Swift code in project context.
 *  IMPORTANT: Uses codeSnippet/sourceFilePath, NOT code/filePath. */
export interface ExecuteSnippetParams extends WithTabIdentifier {
  /** The Swift code to execute. */
  codeSnippet: string;
  /** A source file in the project whose context the snippet runs in. REQUIRED. */
  sourceFilePath: string;
  /** Timeout in seconds (default: 120). */
  timeout?: number;
}
export interface ExecuteSnippetResult {
  executionResults?: string;
  error?: { message: string };
}

// ─── Preview (1 tool) ──────────────────────────────────────────────────────

/** RenderPreview — Render a SwiftUI preview as PNG. */
export interface RenderPreviewParams extends WithTabIdentifier {
  filePath: string;
  previewName?: string;
}
export interface RenderPreviewResult {
  imageData?: string;
  error?: string;
}

// ─── Documentation (1 tool) ────────────────────────────────────────────────

/** DocumentationSearch — Search Apple docs + WWDC transcripts (no tabIdentifier needed). */
export interface DocumentationSearchParams {
  query: string;
  /** Filter by framework(s). */
  frameworks?: string[];
}
export interface DocumentationSearchResult {
  documents: DocumentationDocument[];
}
export interface DocumentationDocument {
  title: string;
  /** URI (not URL) — e.g. "doc://com.apple.documentation/..." */
  uri: string;
  contents: string;
  score: number;
}

// ─── Windowing (1 tool) ────────────────────────────────────────────────────

export interface XcodeListWindowsResult {
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
    public readonly errors: BuildError[],
  ) {
    super(message);
    this.name = "XcodeBuildError";
  }
}
