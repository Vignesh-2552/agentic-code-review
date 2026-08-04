import json
import time
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger

from app.api.dependencies import get_code_review_service
from app.models.schemas import (
    DirectoryReviewRequest,
    DirectoryReviewResponse,
    FileAnalysis,
    PRReviewRequest,
    PRReviewResponse,
)
from app.models.types import PRReviewState
from app.services.code_review_service import CodeReviewService

router = APIRouter()


def _count_valid(items: list[dict] | None) -> int:
    return len([x for x in (items or []) if not x.get("error")])


def _build_findings_count(result: dict) -> dict:
    return {
        "total": _count_valid(result.get("all_findings")),
        "architecture": _count_valid(result.get("architecture_issues")),
        "security": _count_valid(result.get("security_vulnerabilities")),
        "performance": _count_valid(result.get("performance_issues")),
        "best_practices": _count_valid(result.get("best_practice_violations")),
    }


def _group_comments_by_file(inline_comments: list[dict]) -> dict[str, list[dict]]:
    comments_by_file: dict[str, list[dict]] = {}
    for comment in inline_comments:
        fp = comment.get("file_path", "unknown")
        comments_by_file.setdefault(fp, []).append(comment)
    return comments_by_file


@router.post("/pr", response_model=PRReviewResponse)
async def review_pr(
    request: PRReviewRequest,
    review_service: CodeReviewService = Depends(get_code_review_service),
):
    """
    Review a pull request diff for security, performance, architecture, and best practice issues.
    Returns GitHub/GitLab-compatible inline comments and an approval decision.
    """
    start_time = datetime.now()

    try:
        state: PRReviewState = {
            "git_diff": request.git_diff,
            "pr_title": request.pr_title,
            "pr_description": request.pr_description,
            "commit_messages": request.commit_messages or [],
            "repository_context": request.repository_context or {},
        }

        result = await review_service.analyze_code(state)
        processing_time = (datetime.now() - start_time).total_seconds()

        findings_count = _build_findings_count(result)

        return PRReviewResponse(
            requires_human_review=result.get("requires_human_review", False),
            review_complete=result.get("review_complete", False),
            severity_level=result.get("severity_level"),
            processing_time_seconds=processing_time,
            inline_comments=result.get("inline_comments", []),
            pr_summary=result.get("pr_summary", {}),
            findings_count=findings_count,
        )
    except ValueError as e:
        logger.warning(f"Validation error in /review/pr: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error during PR review: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


_TRACKED_NODES = {
    "ingest_pr",
    "build_project_context",
    "architecture_validation",
    "security_scan",
    "performance_check",
    "best_practices",
    "aggregate_findings",
    "human_escalation",
    "generate_inline_comments",
    "generate_pr_summary",
}

# Partial state keys emitted per node when it completes
_NODE_STATE_KEYS = {
    "ingest_pr": ["changed_files"],
    "build_project_context": ["project_context"],
    "architecture_validation": ["architecture_issues"],
    "security_scan": ["security_vulnerabilities"],
    "performance_check": ["performance_issues"],
    "best_practices": ["best_practice_violations"],
    "aggregate_findings": ["all_findings", "severity_level"],
    "human_escalation": ["requires_human_review"],
    "generate_inline_comments": ["inline_comments"],
    "generate_pr_summary": ["pr_summary", "review_complete"],
}


async def _graph_stream_generator(
    state: PRReviewState,
    review_service: CodeReviewService,
) -> AsyncGenerator[str, None]:
    """Core SSE generator shared by all three streaming endpoints.

    Yields ``node_complete`` SSE chunks as each tracked LangGraph node
    finishes, then yields a ``complete`` chunk with the full accumulated
    state.  Errors are surfaced as an ``error`` chunk.
    """
    node_start_times: dict[str, float] = {}
    final_state: dict = {}

    try:
        async for event in review_service.astream_pr_review(state):
            event_type = event.get("event")
            # metadata.langgraph_node is the reliable graph node key in v2 events
            node_name = event.get("metadata", {}).get("langgraph_node")

            if event_type == "on_chain_start" and node_name in _TRACKED_NODES:
                node_start_times[node_name] = time.monotonic()

            elif event_type == "on_chain_end" and node_name in _TRACKED_NODES:
                output = event.get("data", {}).get("output")
                # With subgraphs=True, internal LLM/chain completions inside a node
                # also surface here with the same langgraph_node metadata but their
                # output is a string or other non-dict type — skip those.
                if not isinstance(output, dict):
                    continue
                elapsed_ms = int(
                    (time.monotonic() - node_start_times.get(node_name, time.monotonic())) * 1000
                )
                partial: dict = {}
                for key in _NODE_STATE_KEYS.get(node_name, []):
                    if key in output:
                        partial[key] = output[key]
                final_state.update(output)

                chunk = {
                    "type": "node_complete",
                    "node": node_name,
                    "execution_time_ms": elapsed_ms,
                    "partial_state": partial,
                }
                yield f"data: {json.dumps(chunk)}\n\n"

        yield final_state  # signal caller to build the complete chunk

    except Exception as e:
        logger.error(f"Error during streaming review: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


async def _pr_stream_generator(
    request: PRReviewRequest,
    review_service: CodeReviewService,
) -> AsyncGenerator[str, None]:
    state: PRReviewState = {
        "git_diff": request.git_diff,
        "pr_title": request.pr_title,
        "pr_description": request.pr_description,
        "commit_messages": request.commit_messages or [],
        "repository_context": request.repository_context or {},
    }

    final_state: dict = {}

    async for item in _graph_stream_generator(state, review_service):
        if isinstance(item, dict) and not item.get("type"):
            # This is the sentinel final_state dict, not an SSE string
            final_state = item
        else:
            yield item  # SSE string chunk

    if final_state:
        findings_count = _build_findings_count(final_state)

        complete_chunk = {
            "type": "complete",
            "result": {
                "requires_human_review": final_state.get("requires_human_review", False),
                "review_complete": final_state.get("review_complete", False),
                "severity_level": final_state.get("severity_level"),
                "inline_comments": final_state.get("inline_comments", []),
                "pr_summary": final_state.get("pr_summary", {}),
                "findings_count": findings_count,
            },
        }
        yield f"data: {json.dumps(complete_chunk)}\n\n"


async def _directory_stream_generator(
    request: DirectoryReviewRequest,
    review_service: CodeReviewService,
) -> AsyncGenerator[str, None]:
    try:
        state, files = review_service.build_directory_state(request.github_url, request.context)
    except ValueError as fetch_err:
        yield f"data: {json.dumps({'type': 'error', 'message': str(fetch_err)})}\n\n"
        return
    except Exception as exc:
        yield f"data: {json.dumps({'type': 'error', 'message': f'Could not fetch directory from GitHub: {exc}'})}\n\n"
        return

    file_paths = [f["path"] for f in files]
    final_state: dict = {}

    async for item in _graph_stream_generator(state, review_service):
        if isinstance(item, dict) and not item.get("type"):
            final_state = item
        else:
            yield item

    if final_state:
        inline_comments: list = final_state.get("inline_comments", [])
        comments_by_file = _group_comments_by_file(inline_comments)

        file_findings = []
        for f in files:
            path = f["path"]
            file_comments = comments_by_file.get(path, [])
            file_findings.append({
                "file_path": path,
                "language": f["language"],
                "inline_comments": file_comments,
                "findings_count": len(file_comments),
            })

        findings_count = _build_findings_count(final_state)

        complete_chunk = {
            "type": "complete",
            "result": {
                "requires_human_review": final_state.get("requires_human_review", False),
                "review_complete": final_state.get("review_complete", False),
                "severity_level": final_state.get("severity_level"),
                "files_analyzed": file_paths,
                "file_findings": file_findings,
                "inline_comments": inline_comments,
                "pr_summary": final_state.get("pr_summary", {}),
                "findings_count": findings_count,
            },
        }
        yield f"data: {json.dumps(complete_chunk)}\n\n"


_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
}


@router.post("/pr/stream")
async def review_pr_stream(
    request: PRReviewRequest,
    review_service: CodeReviewService = Depends(get_code_review_service),
):
    """
    Stream a pull request review via Server-Sent Events.
    Emits a `node_complete` event as each LangGraph node finishes, and a
    final `complete` event with the full PRReviewResponse payload.
    """
    return StreamingResponse(
        _pr_stream_generator(request, review_service),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/directory/stream")
async def review_directory_stream(
    request: DirectoryReviewRequest,
    review_service: CodeReviewService = Depends(get_code_review_service),
):
    """
    Stream a directory review via Server-Sent Events.
    Fetches all supported files from a GitHub directory, synthesises a
    multi-file diff, and streams `node_complete` events followed by a
    `complete` event shaped as DirectoryReviewResponse.
    """
    return StreamingResponse(
        _directory_stream_generator(request, review_service),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/directory", response_model=DirectoryReviewResponse)
async def review_directory(
    request: DirectoryReviewRequest,
    review_service: CodeReviewService = Depends(get_code_review_service),
):
    """
    Review all supported source files in a GitHub directory.
    Recursively fetches .py and .js files, synthesises a multi-file diff,
    and runs it through the V2 PR review pipeline.
    """
    start_time = datetime.now()

    try:
        try:
            state, files = review_service.build_directory_state(request.github_url, request.context)
        except ValueError as fetch_err:
            raise HTTPException(status_code=400, detail=str(fetch_err))
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Could not fetch directory from GitHub: {exc}")

        file_paths = [f["path"] for f in files]
        result = await review_service.analyze_code(state)
        processing_time = (datetime.now() - start_time).total_seconds()

        inline_comments: list = result.get("inline_comments", [])
        comments_by_file = _group_comments_by_file(inline_comments)

        file_findings = []
        for f in files:
            path = f["path"]
            file_comments = comments_by_file.get(path, [])
            file_findings.append(FileAnalysis(
                file_path=path,
                language=f["language"],
                inline_comments=file_comments,
                findings_count=len(file_comments),
            ))

        findings_count = _build_findings_count(result)

        return DirectoryReviewResponse(
            requires_human_review=result.get("requires_human_review", False),
            review_complete=result.get("review_complete", False),
            severity_level=result.get("severity_level"),
            processing_time_seconds=processing_time,
            files_analyzed=file_paths,
            file_findings=file_findings,
            inline_comments=inline_comments,
            pr_summary=result.get("pr_summary", {}),
            findings_count=findings_count,
        )
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Validation error in /review/directory: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error during directory review: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
