from loguru import logger

from app.models.types import PRReviewState
from app.core.llm_service import LLMService
from app.core.prompt_service import PromptService
from .build_project_context import _format_related_files_context


class BestPracticesNode:
    def __init__(self, llm_service: LLMService, prompt_service: PromptService) -> None:
        self._llm_service = llm_service
        self._prompt_service = prompt_service

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
            response = await self._llm_service.model.ainvoke(prompt_str)
            content = response.content if hasattr(response, 'content') else str(response)
            result = self._llm_service.extract_json_from_response(content)

            issues = result.get("issues", [])
            for issue in issues:
                issue.setdefault("source", "best_practices")

            logger.info(f"Best practices check found {len(issues)} violations")
        except Exception as e:
            logger.error(f"Error in best practices check: {e}", exc_info=True)
            issues = [{"error": f"Best practices check failed: {str(e)}", "source": "best_practices"}]

        return {"best_practice_violations": issues}
