import json

from loguru import logger

from app.core.llm_service import LLMService
from app.core.prompt_service import PromptService
from app.models.schemas import InlineCommentsResult
from app.models.types import PRReviewState
from app.utils.node_result_writer import write_node_result_md


class GenerateInlineCommentsNode:
    def __init__(self, llm_service: LLMService, prompt_service: PromptService) -> None:
        self._llm_service = llm_service
        self._prompt_service = prompt_service
        self._structured_model = llm_service.model.with_structured_output(InlineCommentsResult)

    async def __call__(self, state: PRReviewState) -> dict:
        logger.info("Generating inline comments from aggregated findings")
        try:
            all_findings = state.get("all_findings", [])
            prompt_str = self._prompt_service.get_inline_comments_prompt(
                git_diff=state["git_diff"],
                all_findings=json.dumps(all_findings, indent=2),
            )
            result: InlineCommentsResult = await self._structured_model.ainvoke(prompt_str)
            write_node_result_md(
                state.get("run_id", "unknown-run"),
                "generate_inline_comments",
                "Inline Comments",
                result.model_dump(),
            )

            comments = [comment.model_dump() for comment in result.inline_comments]
            logger.info(f"Generated {len(comments)} inline comments")
        except Exception as e:
            logger.error(f"Error generating inline comments: {e}", exc_info=True)
            comments = [{"error": f"Inline comment generation failed: {str(e)}"}]

        return {"inline_comments": comments}
