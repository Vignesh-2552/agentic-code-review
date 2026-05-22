import json

from loguru import logger

from app.models.types import PRReviewState
from app.core.llm_service import LLMService
from app.core.prompt_service import PromptService

_SEVERITY_ORDER = ["critical", "high", "medium", "low"]


class HumanEscalationNode:
    """Flag the PR for human review and initialize empty inline comments."""

    async def __call__(self, state: PRReviewState) -> dict:
        logger.warning(
            f"Critical severity detected — flagging for human review: {state.get('pr_title')}"
        )
        return {
            "requires_human_review": True,
            "inline_comments": [],
        }


class GeneratePRSummaryNode:
    def __init__(self, llm_service: LLMService, prompt_service: PromptService) -> None:
        self._llm_service = llm_service
        self._prompt_service = prompt_service

    async def __call__(self, state: PRReviewState) -> dict:
        logger.info("Generating PR summary")
        try:
            all_findings = state.get("all_findings", [])

            # Build a condensed findings summary for the prompt
            findings_by_severity: dict = {}
            for f in all_findings:
                if not f.get("error"):
                    sev = f.get("severity", "low")
                    findings_by_severity.setdefault(sev, []).append(
                        f.get("description", "")
                    )

            summary_lines = []
            for sev in _SEVERITY_ORDER:
                items = findings_by_severity.get(sev, [])
                if items:
                    summary_lines.append(f"{sev.upper()} ({len(items)}):")
                    for item in items[:5]:  # cap at 5 per severity to keep prompt manageable
                        summary_lines.append(f"  - {item}")

            all_findings_summary = "\n".join(summary_lines) if summary_lines else "No findings."

            prompt_str = self._prompt_service.get_pr_summary_prompt(
                pr_title=state.get("pr_title", ""),
                pr_description=state.get("pr_description") or "No description provided.",
                all_findings_summary=all_findings_summary,
                severity_level=state.get("severity_level", "low"),
                requires_human_review=str(state.get("requires_human_review", False)),
            )
            response = await self._llm_service.model.ainvoke(prompt_str)
            content = response.content if hasattr(response, 'content') else str(response)
            result = self._llm_service.extract_json_from_response(content)

            logger.info(
                f"PR summary generated with approval_status: {result.get('approval_status')}"
            )
        except Exception as e:
            logger.error(f"Error generating PR summary: {e}", exc_info=True)
            result = {
                "approval_status": "requires_human_review",
                "summary_text": f"Summary generation failed: {str(e)}",
                "key_findings": [],
                "positive_aspects": [],
                "blocking_issues": [],
                "non_blocking_suggestions": [],
            }

        return {
            "pr_summary": result,
            "review_complete": True,
        }
