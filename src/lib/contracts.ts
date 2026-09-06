export type OutlineItem = {
  id: string;
  level: number;
  title: string;
};


export type CompatibilityLevel = "safe" | "guarded" | "sourceOnly";

export type CompatibilityIssue = {
  code: string;
  level: CompatibilityLevel;
  count: number;
  lines: number[];
};

export type CompatibilityReport = {
  level: CompatibilityLevel;
  canWysiwyg: boolean;
  semanticSafe: boolean;
  sourceStyleStable: boolean;
  issues: CompatibilityIssue[];
};

export type RenderedDocument = {
  id: string;
  path: string;
  fileName: string;
  format: string;
  editable: boolean;
  encoding: string;
  lineEnding: string;
  source: string;
  html: string;
  outline: OutlineItem[];
  compatibility: CompatibilityReport;
  modifiedAtMs: number;
  sizeBytes: number;
  lineCount: number;
  wordCount: number;
  characterCount: number;
  estimatedReadMinutes: number;
};


export type StartupSystemAction = {
  path: string;
  action: "read" | "edit" | "source" | "print" | "exportHtml" | "copyRich";
};

export type DocumentFileEvent = {
  path: string;
  kind: "created" | "modified" | "removed" | "other";
};

export type ResourceRequest = {
  raw: string;
  kind: "image" | "link";
};

export type ResourceResolution = {
  raw: string;
  kind: "image" | "link";
  path: string;
  fragment: string | null;
  exists: boolean;
  markdown: boolean;
};


export type WorkspaceEntry = {
  path: string;
  relativePath: string;
  name: string;
  depth: number;
  directory: boolean;
  format: string | null;
  sizeBytes: number;
};

export type WorkspaceProject = {
  root: string;
  name: string;
  readmePath: string | null;
  entries: WorkspaceEntry[];
  fileCount: number;
  truncated: boolean;
  scanDurationMs: number;
  indexReusedFiles: number;
};

export type WorkspaceSearchContextLine = {
  line: number;
  text: string;
};

export type WorkspaceSearchResult = {
  path: string;
  relativePath: string;
  fileName: string;
  format: string;
  line: number;
  column: number;
  preview: string;
  contextBefore: WorkspaceSearchContextLine[];
  contextAfter: WorkspaceSearchContextLine[];
};

export type WorkspaceSearchResponse = {
  results: WorkspaceSearchResult[];
  filesScanned: number;
  cacheHits: number;
  skippedLargeFiles: number;
  durationMs: number;
  truncated: boolean;
};

export type RecentProject = {
  path: string;
  name: string;
  lastOpenedAtMs: number;
};

export type RecentFile = {
  path: string;
  fileName: string;
  lastOpenedAtMs: number;
};

export type WorkspaceTabSnapshot = {
  path: string;
  scrollTop: number;
};

export type WorkspaceSnapshot = {
  version: number;
  openTabs: WorkspaceTabSnapshot[];
  activePath: string | null;
  sidebarOpen: boolean;
  recentFiles: RecentFile[];
  projectRoot: string | null;
  recentProjects: RecentProject[];
};

export type AppTheme = "light" | "dark" | "system";

export type ReaderFont = "system" | "serif" | "mono";

export type UserSettings = {
  version: number;
  appTheme: AppTheme;
  fontFamily: ReaderFont;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  codeFontSize: number;
  autoCheckUpdates: boolean;
  autoSave: boolean;
  defaultAppPromptDismissedUntilMs: number;
};


export type ViewerLinkContext = {
  href: string;
  text: string;
  localPath: string | null;
  localMarkdown: boolean;
  localExists: boolean;
  localFragment: string | null;
};

export type ViewerContextMenuRequest = {
  x: number;
  y: number;
  selectionText: string;
  selectionHtml: string;
  link: ViewerLinkContext | null;
};

export type ContextMenuItem = {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  separatorBefore?: boolean;
  run: () => void | Promise<void>;
};

export type BuildInfo = {
  productName: string;
  version: string;
  identifier: string;
  os: string;
  arch: string;
  debug: boolean;
  updaterConfigured: boolean;
};

export type UpdateMetadata = {
  version: string;
  currentVersion: string;
  date: string | null;
  body: string | null;
};

export type UpdateDownloadEvent =
  | { event: "Started"; data: { contentLength: number | null } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export type DefaultAppGroupKey = "markdown" | "json" | "yaml" | "toml" | "csv" | "log" | "diff";

export type DefaultAppAssociationStatus = {
  key: DefaultAppGroupKey;
  label: string;
  extensions: string[];
  isDefault: boolean | null;
  currentAppName: string | null;
};

export type DefaultAppStatus = {
  platform: string;
  canSetDirectly: boolean;
  canOpenSystemSettings: boolean;
  appInstalled: boolean;
  associations: DefaultAppAssociationStatus[];
};

export type DefaultAppActionResult = {
  group: DefaultAppGroupKey;
  mode: "direct" | "systemSettings";
  message: string;
};
