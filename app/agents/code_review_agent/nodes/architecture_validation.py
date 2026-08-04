from loguru import logger

from app.core.llm_service import LLMService
from app.core.prompt_service import PromptService
from app.models.schemas import ArchitectureValidationResult
from app.models.types import PRReviewState
from app.utils.node_result_writer import write_node_result_md

from .build_project_context import _format_related_files_context


class ArchitectureValidationNode:
    def __init__(self, llm_service: LLMService, prompt_service: PromptService) -> None:
        self._llm_service = llm_service
        self._prompt_service = prompt_service
        self._structured_model = llm_service.model.with_structured_output(ArchitectureValidationResult)

    async def __call__(self, state: PRReviewState) -> dict:
        logger.info("Starting architecture validation")
        try:
            project_context = state.get("project_context", {})
            related_files_context = _format_related_files_context(project_context)
            architecture_rules = project_context.get(
                "architecture_rules",
                "Apply general clean architecture principles.",
            )

            prompt_str = self._prompt_service.get_architecture_prompt(
                git_diff=state["git_diff"],
                related_files_context=related_files_context,
                architecture_rules=architecture_rules,
            )
            result: ArchitectureValidationResult = await self._structured_model.ainvoke(prompt_str)
            write_node_result_md(
                state.get("run_id", "unknown-run"),
                "architecture_validation",
                "Architecture Validation",
                result.model_dump(),
            )

            issues = [issue.model_dump() for issue in result.issues]
            for issue in issues:
                issue.setdefault("source", "architecture")

            logger.info(f"Architecture validation found {len(issues)} issues")
        except Exception as e:
            logger.error(f"Error in architecture validation: {e}", exc_info=True)
            issues = [{"error": f"Architecture validation failed: {str(e)}", "source": "architecture"}]

        return {"architecture_issues": issues}
