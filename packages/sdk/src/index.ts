export { XcodeClient } from "./client.js";
export type { XcodeClientOptions } from "./client.js";
export { XcodeSession, withXcodeSession } from "./session.js";
export type { XcodeSessionOptions } from "./session.js";
export {
  XcodeConnectionError,
  XcodeToolError,
  XcodeBuildError,
} from "./types.js";
export type {
  WithTabIdentifier,
  // File operations
  XcodeReadParams, XcodeReadResult,
  XcodeWriteParams, XcodeWriteResult,
  XcodeUpdateParams, XcodeUpdateResult,
  XcodeGlobParams, XcodeGlobResult,
  XcodeGrepParams, XcodeGrepResult,
  XcodeLSParams, XcodeLSResult,
  XcodeMakeDirParams, XcodeMakeDirResult,
  XcodeRMParams, XcodeRMResult,
  XcodeMVParams, XcodeMVResult,
  // Build & test
  BuildProjectParams, BuildProjectResult, BuildError,
  GetBuildLogParams, GetBuildLogResult, BuildLogEntry, BuildLogIssue,
  RunAllTestsParams, RunAllTestsResult, TestCounts, TestResult,
  RunSomeTestsParams, RunSomeTestsResult,
  GetTestListParams, GetTestListResult, TestListEntry,
  // Diagnostics
  XcodeListNavigatorIssuesParams, XcodeListNavigatorIssuesResult, NavigatorIssue,
  XcodeRefreshCodeIssuesInFileParams, XcodeRefreshCodeIssuesInFileResult,
  // Code execution
  ExecuteSnippetParams, ExecuteSnippetResult,
  // Preview
  RenderPreviewParams, RenderPreviewResult,
  // Documentation
  DocumentationSearchParams, DocumentationSearchResult, DocumentationDocument,
  // Windowing
  XcodeListWindowsResult, XcodeWindow,
} from "./types.js";
