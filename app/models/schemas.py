from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


class PRReviewRequest(BaseModel):
    """Request model for PR review."""
    git_diff: str = Field(..., description="The unified git diff of the PR", min_length=1, max_length=500000)
    pr_title: str = Field(..., description="Title of the pull request", min_length=1, max_length=500)
    pr_description: Optional[str] = Field(None, description="Description/body of the pull request")
    commit_messages: Optional[List[str]] = Field(None, description="List of commit messages in the PR")
    repository_context: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional repository context (related_files, dependency_map, architecture_rules)"
    )


class PRReviewResponse(BaseModel):
    """Response model for PR review results."""
    requires_human_review: bool
    review_complete: bool
    severity_level: Optional[str]
    processing_time_seconds: float
    inline_comments: List[Dict[str, Any]]
    pr_summary: Dict[str, Any]
    findings_count: Dict[str, int]


class DirectoryReviewRequest(BaseModel):
    """Request model for directory-level review."""
    github_url: str = Field(
        ...,
        description="GitHub tree URL for the folder (e.g. https://github.com/owner/repo/tree/main/src)"
    )
    context: Optional[str] = Field(None, description="Additional context about the codebase")

    @validator('github_url')
    def validate_github_url(cls, v):
        if 'github.com' not in v:
            raise ValueError('github_url must be a valid GitHub URL')
        return v


class FileAnalysis(BaseModel):
    """Analysis result for a single file within a directory review."""
    file_path: str
    language: str
    security_vulnerabilities: List[Dict[str, Any]] = []
    performance_issues: List[Dict[str, Any]] = []
    best_practice_violations: List[Dict[str, Any]] = []
    architecture_issues: List[Dict[str, Any]] = []
    inline_comments: List[Dict[str, Any]] = []
    findings_count: int = 0


class DirectoryReviewResponse(BaseModel):
    """Response model for directory-level review."""
    requires_human_review: bool
    review_complete: bool
    severity_level: Optional[str]
    processing_time_seconds: float
    files_analyzed: List[str]
    file_findings: List[FileAnalysis]
    inline_comments: List[Dict[str, Any]]
    pr_summary: Dict[str, Any]
    findings_count: Dict[str, int]


class RepoVerifyResponse(BaseModel):
    """Response for GET /github/verify — confirms a repo exists and lists its branches."""
    owner: str
    repo: str
    default_branch: str
    private: bool
    description: Optional[str] = None
    branches: List[str]


class RepoTreeFile(BaseModel):
    path: str
    language: str


class RepoTreeResponse(BaseModel):
    """Response for GET /github/tree — flat list of supported source files at a branch."""
    files: List[RepoTreeFile]
    truncated: bool


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    version: str = "1.0.0"


class ArchitectureIssue(BaseModel):
    """A single architectural issue found by the architecture validation LLM call."""
    file_path: str
    line: Optional[int] = None
    severity: str
    type: str
    description: str
    recommendation: str


class ArchitectureValidationResult(BaseModel):
    """Structured output schema for the architecture validation LLM call."""
    architecture_score: int
    issues: List[ArchitectureIssue] = Field(default_factory=list)
    summary: str


class SecurityVulnerability(BaseModel):
    """A single vulnerability found by the security scan LLM call."""
    file_path: str
    line: Optional[int] = None
    severity: str
    type: str
    description: str
    recommendation: str


class SecurityScanResult(BaseModel):
    """Structured output schema for the security scan LLM call."""
    security_score: int
    vulnerabilities: List[SecurityVulnerability] = Field(default_factory=list)
    summary: str


class PerformanceIssue(BaseModel):
    """A single issue found by the performance analysis LLM call."""
    file_path: str
    line: Optional[int] = None
    severity: str
    type: str
    description: str
    optimization: str


class PerformanceAnalysisResult(BaseModel):
    """Structured output schema for the performance analysis LLM call."""
    performance_score: int
    issues: List[PerformanceIssue] = Field(default_factory=list)
    summary: str


class BestPracticeIssue(BaseModel):
    """A single violation found by the best practices LLM call."""
    file_path: str
    line: Optional[int] = None
    severity: str
    category: str
    description: str
    recommendation: str


class BestPracticesResult(BaseModel):
    """Structured output schema for the best practices LLM call."""
    best_practices_score: int
    issues: List[BestPracticeIssue] = Field(default_factory=list)
    summary: str


class PRSummaryResult(BaseModel):
    """Structured output schema for the PR summary generation LLM call."""
    approval_status: str
    summary_text: str
    key_findings: List[str] = Field(default_factory=list)
    positive_aspects: List[str] = Field(default_factory=list)
    blocking_issues: List[str] = Field(default_factory=list)
    non_blocking_suggestions: List[str] = Field(default_factory=list)


class InlineComment(BaseModel):
    """A single GitHub-style inline comment derived from aggregated findings."""
    path: str
    line: Optional[int] = None
    position: Optional[int] = None
    severity: str
    category: str
    body: str
    suggestion: Optional[str] = None


class InlineCommentsResult(BaseModel):
    """Structured output schema for the inline comments generation LLM call."""
    inline_comments: List[InlineComment] = Field(default_factory=list)
