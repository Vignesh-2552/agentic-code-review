from loguru import logger

from app.models.types import PRReviewState
from app.core.llm_service import LLMService
from app.core.prompt_service import PromptService
from .build_project_context import _format_related_files_context


class PerformanceAnalysisNode:
    def __init__(self, llm_service: LLMService, prompt_service: PromptService) -> None:
        self._llm_service = llm_service
        self._prompt_service = prompt_service

    async def __call__(self, state: PRReviewState) -> dict:
        logger.info("Starting performance analysis")
        try:
            project_context = state.get("project_context", {})
            related_files_context = _format_related_files_context(project_context)

            prompt_str = self._prompt_service.get_performance_prompt(
                git_diff=state["git_diff"],
                related_files_context=related_files_context,
            )
            response = await self._llm_service.model.ainvoke(prompt_str)
            content = response.content if hasattr(response, 'content') else str(response)
            result = self._llm_service.extract_json_from_response(content)

            issues = result.get("issues", [])
            for issue in issues:
                issue.setdefault("source", "performance")

            logger.info(f"Performance analysis found {len(issues)} issues")
        except Exception as e:
            logger.error(f"Error in performance analysis: {e}", exc_info=True)
            issues = [{"error": f"Performance analysis failed: {str(e)}", "source": "performance"}]

        return {"performance_issues": issues}
