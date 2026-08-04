from loguru import logger

from app.core.llm_service import LLMService
from app.core.prompt_service import PromptService
from app.models.schemas import PerformanceAnalysisResult
from app.models.types import PRReviewState
from app.utils.node_result_writer import write_node_result_md

from .build_project_context import _format_related_files_context


class PerformanceAnalysisNode:
    def __init__(self, llm_service: LLMService, prompt_service: PromptService) -> None:
        self._llm_service = llm_service
        self._prompt_service = prompt_service
        self._structured_model = llm_service.model.with_structured_output(PerformanceAnalysisResult)

    async def __call__(self, state: PRReviewState) -> dict:
        logger.info("Starting performance analysis")
        try:
            project_context = state.get("project_context", {})
            related_files_context = _format_related_files_context(project_context)

            prompt_str = self._prompt_service.get_performance_prompt(
                git_diff=state["git_diff"],
                related_files_context=related_files_context,
            )
            result: PerformanceAnalysisResult = await self._structured_model.ainvoke(prompt_str)
            write_node_result_md(
                state.get("run_id", "unknown-run"),
                "performance_check",
                "Performance Analysis",
                result.model_dump(),
            )

            issues = [issue.model_dump() for issue in result.issues]
            for issue in issues:
                issue.setdefault("source", "performance")

            logger.info(f"Performance analysis found {len(issues)} issues")
        except Exception as e:
            logger.error(f"Error in performance analysis: {e}", exc_info=True)
            issues = [{"error": f"Performance analysis failed: {str(e)}", "source": "performance"}]

        return {"performance_issues": issues}
