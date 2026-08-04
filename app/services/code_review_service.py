from typing import Any, AsyncGenerator

from loguru import logger

from app.agents.code_review_agent.graph import CodeReviewGraph
from app.config.settings import settings
from app.models.types import PRReviewState
from app.utils.github_directory_fetcher import build_synthetic_diff, fetch_directory_files


class CodeReviewService:
    def __init__(self, code_review_graph: CodeReviewGraph):
        self.code_review_graph = code_review_graph

    def build_directory_state(self, github_url: str, context: str | None) -> tuple[PRReviewState, list[dict]]:
        """Fetch a GitHub directory and assemble the PRReviewState for a directory review.

        Returns the state alongside the raw fetched files, since callers need both
        (state for the graph, files for building the per-file findings response).
        Raises ValueError on bad URLs or unsupported directories.
        """
        files = fetch_directory_files(github_url, token=settings.GITHUB_TOKEN)
        synthetic_diff = build_synthetic_diff(files)
        file_paths = [f["path"] for f in files]

        state: PRReviewState = {
            "git_diff": synthetic_diff,
            "pr_title": f"Directory review: {github_url}",
            "pr_description": context,
            "commit_messages": [],
            "repository_context": {"files_in_scope": file_paths},
        }
        return state, files

    async def analyze_code(self, state: PRReviewState):
        """Run the PR review workflow using the compiled LangGraph graph.

        Args:
            state: The PRReviewState containing the git diff and PR metadata.

        Returns:
            The final state after all analysis nodes have completed.
        """
        logger.info("Starting PR review workflow")
        try:
            result = await self.code_review_graph.ainvoke(state)
            logger.success("PR review completed successfully")
            return result
        except Exception as e:
            logger.error(f"Error in PR review: {e}", exc_info=True)
            return {
                **state,
                "review_complete": True,
                "severity_level": "error",
                "requires_human_review": True,
                "inline_comments": [{"error": f"Review failed: {str(e)}"}],
                "pr_summary": {
                    "approval_status": "requires_human_review",
                    "summary_text": f"Review pipeline failed: {str(e)}",
                    "key_findings": [],
                    "positive_aspects": [],
                    "blocking_issues": [str(e)],
                    "non_blocking_suggestions": [],
                },
                "all_findings": [],
                "architecture_issues": [],
                "security_vulnerabilities": [],
                "performance_issues": [],
                "best_practice_violations": [],
            }

    async def astream_pr_review(self, state: PRReviewState) -> AsyncGenerator[Any, None]:
        """Stream PR review events from the LangGraph workflow."""
        logger.info("Starting streaming PR review workflow")
        async for event in self.code_review_graph.astream(state):
            yield event
