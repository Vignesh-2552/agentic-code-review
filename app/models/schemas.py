from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


class CodeReviewRequest(BaseModel):
    """Request model for code review."""
    github_url: str = Field(..., description="GitHub file URL to analyze (blob, raw, or any GitHub URL)")
    context: Optional[str] = Field(None, description="Additional context about the code")

    @validator('github_url')
    def validate_github_url(cls, v):
        if not v.startswith('http'):
            raise ValueError('github_url must be a valid HTTP/HTTPS URL')
        return v


class CodeReviewResponse(BaseModel):
    """Response model for code review results."""
    severity_level: str
    requires_human_review: bool
    analysis_complete: bool
    processing_time_seconds: float
    syntax_issues: List[Dict[str, Any]]
    security_vulnerabilities: List[Dict[str, Any]]
    performance_issues: List[Dict[str, Any]]
    style_violations: List[Dict[str, Any]]
    best_practice_violations: List[Dict[str, Any]]
    explanations: List[Dict[str, Any]]
    improvement_suggestions: List[Dict[str, Any]]
    learning_resources: List[str]
    summary: Dict[str, Any]


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


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: str
    version: str = "1.0.0"
