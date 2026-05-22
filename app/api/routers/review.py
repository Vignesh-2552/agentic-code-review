import json
import time
import urllib.error
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from loguru import logger

from app.api.dependencies import get_code_review_service
from app.config.settings import settings
from app.models.schemas import (
    CodeReviewRequest,
    CodeReviewResponse,
    DirectoryReviewRequest,
    DirectoryReviewResponse,
    FileAnalysis,
    PRReviewRequest,
    PRReviewResponse,
)
from app.models.types import PRReviewState
from app.services.code_review_service import CodeReviewService
from app.utils.github_directory_fetcher import build_synthetic_diff, fetch_directory_files
from app.utils.github_fetcher import fetch_github_file

router = APIRouter()


@router.post("/analyze", response_model=CodeReviewResponse)
async def review_code(
    request: CodeReviewRequest,
    review_service: CodeReviewService = Depends(get_code_review_service),
):
    """
    Analyze code for syntax, security, performance, and best practice issues.
    """
    start_time = datetime.now()

    try:
        try:
            code, language, file_type = fetch_github_file(request.github_url)
        except ValueError as fetch_err:
            raise HTTPException(status_code=400, detail=str(fetch_err))
        except urllib.error.URLError:
            raise HTTPException(status_code=502, detail="Could not fetch file from GitHub")

        # Build a minimal PRReviewState from the fetched file so the
        # shared service/graph can process it.  We synthesize a minimal diff
        # from the raw code string so the V2 graph has something to work with.
        synthetic_diff = (
            f"diff --git a/snippet.{file_type} b/snippet.{file_type}\n"
            f"--- a/snippet.{file_type}\n"
            f"+++ b/snippet.{file_type}\n"
            f"@@ -0,0 +1 @@\n"
            + "\n".join(f"+{line}" for line in code.splitlines())
        )

        state: PRReviewState = {
            "git_diff": synthetic_diff,
            "pr_title": f"Code review: {language} snippet",
            "pr_description": request.context,
            "commit_messages": [],
            "repository_context": {},
        }

        result = await review_service.analyze_code(state)
        processing_time = (datetime.now() - start_time).total_seconds()

        def count_valid(lst):
            return len([x for x in (lst or []) if not x.get("error")])

        security_count = count_valid(result.get("security_vulnerabilities"))
        performance_count = count_valid(result.get("performance_issues"))
        best_practice_count = count_valid(result.get("best_practice_violations"))
        architecture_count = count_valid(result.get("architecture_issues"))
        total_issues = security_count + performance_count + best_practice_count + architecture_count

        return CodeReviewResponse(
            severity_level=result.get("severity_level", "unknown"),
            requires_human_review=result.get("requires_human_review", False),
            analysis_complete=result.get("review_complete", False),
            processing_time_seconds=processing_time,
            syntax_issues=[],
            security_vulnerabilities=result.get("security_vulnerabilities", []),
            performance_issues=result.get("performance_issues", []),
            style_violations=[],
            best_practice_violations=result.get("best_practice_violations", []),
            explanations=[],
            improvement_suggestions=[],
            learning_resources=[],
            summary={
                "total_issues": total_issues,
                "syntax_issues": 0,
                "security_vulnerabilities": security_count,
                "performance_issues": performance_count,
                "style_violations": 0,
                "best_practice_violations": best_practice_count,
                "architecture_issues": architecture_count,
                "github_url": request.github_url,
                "language": language,
            },
        )
    except ValueError as e:
        logger.warning(f"Validation error in /review/analyze: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error during code review: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


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

        def count_valid(lst):
            return len([x for x in (lst or []) if not x.get("error")])

        findings_count = {
            "total": count_valid(result.get("all_findings")),
            "architecture": count_valid(result.get("architecture_issues")),
            "security": count_valid(result.get("security_vulnerabilities")),
            "performance": count_valid(result.get("performance_issues")),
            "best_practices": count_valid(result.get("best_practice_violations")),
        }

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
        def count_valid(lst):
            return len([x for x in (lst or []) if not x.get("error")])

        findings_count = {
            "total": count_valid(final_state.get("all_findings")),
            "architecture": count_valid(final_state.get("architecture_issues")),
            "security": count_valid(final_state.get("security_vulnerabilities")),
            "performance": count_valid(final_state.get("performance_issues")),
            "best_practices": count_valid(final_state.get("best_practice_violations")),
        }

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


async def _analyze_stream_generator(
    request: CodeReviewRequest,
    review_service: CodeReviewService,
) -> AsyncGenerator[str, None]:
    try:
        try:
            code, language, file_type = fetch_github_file(request.github_url)
        except ValueError as fetch_err:
            yield f"data: {json.dumps({'type': 'error', 'message': str(fetch_err)})}\n\n"
            return
        except urllib.error.URLError:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Could not fetch file from GitHub'})}\n\n"
            return

        synthetic_diff = (
            f"diff --git a/snippet.{file_type} b/snippet.{file_type}\n"
            f"--- a/snippet.{file_type}\n"
            f"+++ b/snippet.{file_type}\n"
            f"@@ -0,0 +1 @@\n"
            + "\n".join(f"+{line}" for line in code.splitlines())
        )

        state: PRReviewState = {
            "git_diff": synthetic_diff,
            "pr_title": f"Code review: {language} snippet",
            "pr_description": request.context,
            "commit_messages": [],
            "repository_context": {},
        }

    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        return

    final_state: dict = {}

    async for item in _graph_stream_generator(state, review_service):
        if isinstance(item, dict) and not item.get("type"):
            final_state = item
        else:
            yield item

    if final_state:
        def count_valid(lst):
            return len([x for x in (lst or []) if not x.get("error")])

        security_count = count_valid(final_state.get("security_vulnerabilities"))
        performance_count = count_valid(final_state.get("performance_issues"))
        best_practice_count = count_valid(final_state.get("best_practice_violations"))
        architecture_count = count_valid(final_state.get("architecture_issues"))
        total_issues = security_count + performance_count + best_practice_count + architecture_count

        complete_chunk = {
            "type": "complete",
            "result": {
                "severity_level": final_state.get("severity_level", "unknown"),
                "requires_human_review": final_state.get("requires_human_review", False),
                "analysis_complete": final_state.get("review_complete", False),
                "security_vulnerabilities": final_state.get("security_vulnerabilities", []),
                "performance_issues": final_state.get("performance_issues", []),
                "best_practice_violations": final_state.get("best_practice_violations", []),
                "summary": {
                    "total_issues": total_issues,
                    "syntax_issues": 0,
                    "security_vulnerabilities": security_count,
                    "performance_issues": performance_count,
                    "style_violations": 0,
                    "best_practice_violations": best_practice_count,
                    "architecture_issues": architecture_count,
                    "github_url": request.github_url,
                    "language": language,
                },
            },
        }
        yield f"data: {json.dumps(complete_chunk)}\n\n"


async def _directory_stream_generator(
    request: DirectoryReviewRequest,
    review_service: CodeReviewService,
) -> AsyncGenerator[str, None]:
    try:
        try:
            files = fetch_directory_files(request.github_url, token=settings.GITHUB_TOKEN)
        except ValueError as fetch_err:
            yield f"data: {json.dumps({'type': 'error', 'message': str(fetch_err)})}\n\n"
            return
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Could not fetch directory from GitHub: {exc}'})}\n\n"
            return

        synthetic_diff = build_synthetic_diff(files)
        file_paths = [f["path"] for f in files]

        state: PRReviewState = {
            "git_diff": synthetic_diff,
            "pr_title": f"Directory review: {request.github_url}",
            "pr_description": request.context,
            "commit_messages": [],
            "repository_context": {"files_in_scope": file_paths},
        }

    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        return

    final_state: dict = {}

    async for item in _graph_stream_generator(state, review_service):
        if isinstance(item, dict) and not item.get("type"):
            final_state = item
        else:
            yield item

    if final_state:
        def count_valid(lst):
            return len([x for x in (lst or []) if not x.get("error")])

        inline_comments: list = final_state.get("inline_comments", [])

        comments_by_file: dict[str, list] = {}
        for comment in inline_comments:
            fp = comment.get("file_path", "unknown")
            comments_by_file.setdefault(fp, []).append(comment)

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

        findings_count = {
            "total": count_valid(final_state.get("all_findings")),
            "architecture": count_valid(final_state.get("architecture_issues")),
            "security": count_valid(final_state.get("security_vulnerabilities")),
            "performance": count_valid(final_state.get("performance_issues")),
            "best_practices": count_valid(final_state.get("best_practice_violations")),
        }

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


@router.post("/analyze/stream")
async def review_analyze_stream(
    request: CodeReviewRequest,
    review_service: CodeReviewService = Depends(get_code_review_service),
):
    """
    Stream a single-file code review via Server-Sent Events.
    Fetches the file from GitHub, synthesises a diff, and streams
    `node_complete` events followed by a `complete` event shaped as
    CodeReviewResponse.
    """
    return StreamingResponse(
        _analyze_stream_generator(request, review_service),
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
            files = fetch_directory_files(request.github_url, token=settings.GITHUB_TOKEN)
        except ValueError as fetch_err:
            raise HTTPException(status_code=400, detail=str(fetch_err))
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Could not fetch directory from GitHub: {exc}")

        synthetic_diff = build_synthetic_diff(files)
        file_paths = [f["path"] for f in files]

        state: PRReviewState = {
            "git_diff": synthetic_diff,
            "pr_title": f"Directory review: {request.github_url}",
            "pr_description": request.context,
            "commit_messages": [],
            "repository_context": {"files_in_scope": file_paths},
        }

        result = await review_service.analyze_code(state)
        processing_time = (datetime.now() - start_time).total_seconds()

        def count_valid(lst):
            return len([x for x in (lst or []) if not x.get("error")])

        inline_comments: list = result.get("inline_comments", [])

        # Group inline comments back to per-file findings
        comments_by_file: dict[str, list] = {}
        for comment in inline_comments:
            fp = comment.get("file_path", "unknown")
            comments_by_file.setdefault(fp, []).append(comment)

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

        findings_count = {
            "total": count_valid(result.get("all_findings")),
            "architecture": count_valid(result.get("architecture_issues")),
            "security": count_valid(result.get("security_vulnerabilities")),
            "performance": count_valid(result.get("performance_issues")),
            "best_practices": count_valid(result.get("best_practice_violations")),
        }

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
