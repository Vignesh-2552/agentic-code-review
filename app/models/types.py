import operator
from typing import Annotated, Any, Dict, List, Optional, TypedDict

from typing_extensions import NotRequired, Required


class PRReviewState(TypedDict):
    # Inputs
    git_diff: Required[str]
    pr_title: Required[str]
    pr_description: NotRequired[Optional[str]]
    commit_messages: NotRequired[List[str]]
    repository_context: NotRequired[Dict[str, Any]]
    # After ingest_pr
    changed_files: NotRequired[List[Dict[str, Any]]]
    # After build_project_context
    project_context: NotRequired[Dict[str, Any]]
    # Parallel analysis outputs (operator.add merges partial dicts from all 4 nodes)
    architecture_issues: NotRequired[Annotated[List[Dict[str, Any]], operator.add]]
    security_vulnerabilities: NotRequired[Annotated[List[Dict[str, Any]], operator.add]]
    performance_issues: NotRequired[Annotated[List[Dict[str, Any]], operator.add]]
    best_practice_violations: NotRequired[Annotated[List[Dict[str, Any]], operator.add]]
    # After aggregate_findings
    all_findings: NotRequired[List[Dict[str, Any]]]
    severity_level: NotRequired[Optional[str]]
    # Final outputs
    inline_comments: NotRequired[List[Dict[str, Any]]]
    pr_summary: NotRequired[Dict[str, Any]]
    requires_human_review: NotRequired[bool]
    review_complete: NotRequired[bool]
    processing_time: NotRequired[float]
    node_execution_times: NotRequired[Optional[Dict[str, float]]]


class ConversationState(TypedDict):
    question: Required[str]
    context: NotRequired[str]
    relevant_documents: NotRequired[Optional[List[dict]]]
    enhanced_prompt: NotRequired[str]
    response: NotRequired[str]
    use_rag: NotRequired[bool]
    processing_time: NotRequired[float]
    error: NotRequired[Optional[str]]
