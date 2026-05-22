import json

from loguru import logger

from app.models.types import PRReviewState
from app.core.llm_service import LLMService
from app.core.prompt_service import PromptService


class GenerateInlineCommentsNode:
    def __init__(self, llm_service: LLMService, prompt_service: PromptService) -> None:
        self._llm_service = llm_service
        self._prompt_service = prompt_service

    async def __call__(self, state: PRReviewState) -> dict:
        logger.info("Generating inline comments from aggregated findings")
        try:
            all_findings = state.get("all_findings", [])
            prompt_str = self._prompt_service.get_inline_comments_prompt(
                git_diff=state["git_diff"],
                all_findings=json.dumps(all_findings, indent=2),
            )
            response = await self._llm_service.model.ainvoke(prompt_str)
            content = response.content if hasattr(response, 'content') else str(response)
            result = self._llm_service.extract_json_from_response(content)

            comments = result.get("inline_comments", [])
            logger.info(f"Generated {len(comments)} inline comments")
        except Exception as e:
            logger.error(f"Error generating inline comments: {e}", exc_info=True)
            comments = [{"error": f"Inline comment generation failed: {str(e)}"}]

        return {"inline_comments": comments}
