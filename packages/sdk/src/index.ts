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
  XcodeGrepParams, XcodeGrepResult, GrepMatch,
  XcodeLSParams, XcodeLSResult, DirectoryEntry,
  XcodeMakeDirParams, XcodeMakeDirResult,
  XcodeRMParams, XcodeRMResult,
  XcodeMVParams, XcodeMVResult,
  // Build & test
  BuildProjectParams, BuildProjectResult, BuildIssue,
  GetBuildLogParams, GetBuildLogResult,
  RunAllTestsParams, RunAllTestsResult, TestFailure,
  RunSomeTestsParams, RunSomeTestsResult,
  GetTestListParams, GetTestListResult, TestEntry,
  // Diagnostics
  XcodeListNavigatorIssuesParams, XcodeListNavigatorIssuesResult, NavigatorIssue,
  XcodeRefreshCodeIssuesInFileParams, XcodeRefreshCodeIssuesInFileResult,
  // Code execution
  ExecuteSnippetParams, ExecuteSnippetResult,
  // Preview
  RenderPreviewParams, RenderPreviewResult,
  // Documentation
  DocumentationSearchParams, DocumentationSearchResult, DocumentationEntry,
  // Windowing
  XcodeListWindowsResult, XcodeWindow,
} from "./types.js";
