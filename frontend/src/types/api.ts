export interface CodeReviewRequest {
  github_url: string;
  context?: string;
}

export interface PRReviewRequest {
  git_diff: string;
  pr_title: string;
  pr_description?: string;
  commit_messages?: string[];
}

// ── SSE Streaming ─────────────────────────────────────────────────────────────

export type NodeName =
  | 'ingest_pr'
  | 'build_project_context'
  | 'architecture_validation'
  | 'security_scan'
  | 'performance_check'
  | 'best_practices'
  | 'aggregate_findings'
  | 'human_escalation'
  | 'generate_inline_comments'
  | 'generate_pr_summary';

export type NodeStatus = 'pending' | 'running' | 'complete';

export interface NodeCompleteEvent {
  type: 'node_complete';
  node: NodeName;
  execution_time_ms: number;
  partial_state: {
    changed_files?: unknown[];
    project_context?: unknown;
    architecture_issues?: FindingItem[];
    security_vulnerabilities?: FindingItem[];
    performance_issues?: FindingItem[];
    best_practice_violations?: FindingItem[];
    all_findings?: FindingItem[];
    severity_level?: string;
    requires_human_review?: boolean;
    inline_comments?: InlineComment[];
    pr_summary?: PRSummary;
    review_complete?: boolean;
  };
}

export interface CompleteEvent<T = Omit<PRReviewResponse, 'processing_time_seconds'>> {
  type: 'complete';
  result: T;
}

export interface StreamAnalyzeResult {
  severity_level: string;
  requires_human_review: boolean;
  analysis_complete: boolean;
  security_vulnerabilities: FindingItem[];
  performance_issues: FindingItem[];
  best_practice_violations: FindingItem[];
  summary: CodeReviewSummary;
}

export type AnalyzeSSEEvent = NodeCompleteEvent | CompleteEvent<StreamAnalyzeResult> | StreamErrorEvent;
export type DirectorySSEEvent = NodeCompleteEvent | CompleteEvent<Omit<DirectoryReviewResponse, 'processing_time_seconds'>> | StreamErrorEvent;

export interface StreamErrorEvent {
  type: 'error';
  message: string;
}

export type SSEEvent = NodeCompleteEvent | CompleteEvent<Omit<PRReviewResponse, 'processing_time_seconds'>> | StreamErrorEvent;

export interface FindingItem {
  severity?: string;
  description?: string;
  recommendation?: string;
  line?: number;
  file?: string;
  [key: string]: unknown;
}

export interface CodeReviewSummary {
  total_issues: number;
  security_vulnerabilities: number;
  performance_issues: number;
  best_practice_violations: number;
  architecture_issues: number;
  github_url: string;
  language: string;
}

export interface CodeReviewResponse {
  severity_level: string;
  requires_human_review: boolean;
  analysis_complete: boolean;
  processing_time_seconds: number;
  security_vulnerabilities: FindingItem[];
  performance_issues: FindingItem[];
  best_practice_violations: FindingItem[];
  syntax_issues: FindingItem[];
  style_violations: FindingItem[];
  explanations: FindingItem[];
  improvement_suggestions: FindingItem[];
  learning_resources: string[];
  summary: CodeReviewSummary;
}

export interface InlineComment {
  file_path: string;
  line_number: number;
  severity?: string;
  comment: string;
  suggestion?: string;
}

export interface PRFindingsCount {
  total: number;
  architecture: number;
  security: number;
  performance: number;
  best_practices: number;
}

export interface PRSummary {
  summary_text?: string;
  [key: string]: unknown;
}

export interface PRReviewResponse {
  requires_human_review: boolean;
  review_complete: boolean;
  severity_level: string | null;
  processing_time_seconds: number;
  inline_comments: InlineComment[];
  pr_summary: PRSummary;
  findings_count: PRFindingsCount;
}

// ── Directory Review ──────────────────────────────────────────────────────────

export interface DirectoryReviewRequest {
  github_url: string;
  context?: string;
}

export interface FileAnalysis {
  file_path: string;
  language: string;
  security_vulnerabilities: FindingItem[];
  performance_issues: FindingItem[];
  best_practice_violations: FindingItem[];
  architecture_issues: FindingItem[];
  inline_comments: InlineComment[];
  findings_count: number;
}

export interface DirectoryReviewResponse {
  requires_human_review: boolean;
  review_complete: boolean;
  severity_level: string | null;
  processing_time_seconds: number;
  files_analyzed: string[];
  file_findings: FileAnalysis[];
  inline_comments: InlineComment[];
  pr_summary: PRSummary;
  findings_count: PRFindingsCount;
}
