from typing import Any, AsyncGenerator

from loguru import logger

from app.models.types import PRReviewState
from app.agents.code_review_agent.graph import CodeReviewGraph


class CodeReviewService:
    def __init__(self, code_review_graph: CodeReviewGraph):
        self.code_review_graph = code_review_graph

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
