from loguru import logger

from app.models.types import PRReviewState
from app.models.schemas import BestPracticesResult
from app.core.llm_service import LLMService
from app.core.prompt_service import PromptService
from app.utils.node_result_writer import write_node_result_md
from .build_project_context import _format_related_files_context


class BestPracticesNode:
    def __init__(self, llm_service: LLMService, prompt_service: PromptService) -> None:
        self._llm_service = llm_service
        self._prompt_service = prompt_service
        self._structured_model = llm_service.model.with_structured_output(BestPracticesResult)

    async def __call__(self, state: PRReviewState) -> dict:
        logger.info("Starting best practices check")
        try:
            project_context = state.get("project_context", {})
            related_files_context = _format_related_files_context(project_context)

            commit_messages = state.get("commit_messages") or []
            commit_messages_str = "\n".join(f"  - {m}" for m in commit_messages) or "None provided"

            prompt_str = self._prompt_service.get_best_practices_prompt(
                git_diff=state["git_diff"],
                related_files_context=related_files_context,
                pr_title=state.get("pr_title", ""),
                commit_messages=commit_messages_str,
            )
            result: BestPracticesResult = await self._structured_model.ainvoke(prompt_str)
            write_node_result_md(
                state.get("run_id", "unknown-run"),
                "best_practices",
                "Best Practices",
                result.model_dump(),
            )

            issues = [issue.model_dump() for issue in result.issues]
            for issue in issues:
                issue.setdefault("source", "best_practices")

            logger.info(f"Best practices check found {len(issues)} violations")
        except Exception as e:
            logger.error(f"Error in best practices check: {e}", exc_info=True)
            issues = [{"error": f"Best practices check failed: {str(e)}", "source": "best_practices"}]

        return {"best_practice_violations": issues}
