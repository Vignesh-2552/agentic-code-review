from app.models.types import PRReviewState


class RouteBySeverityNode:
    """Conditional edge function: routes to human escalation on critical severity."""

    async def __call__(self, state: PRReviewState) -> str:
        severity = state.get("severity_level", "low")
        if severity == "critical":
            return "human_escalation"
        return "generate_inline_comments"
