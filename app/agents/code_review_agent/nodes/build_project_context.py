from typing import Any, Dict

from loguru import logger

from app.models.types import PRReviewState


def _format_related_files_context(project_context: Dict[str, Any]) -> str:
    """Format the project context into a prompt-ready string.

    Used by all 4 parallel analysis nodes to inject related-file context.
    """
    related_files = project_context.get("related_files", [])
    dependency_map = project_context.get("dependency_map", {})

    parts: list[str] = []

    if related_files:
        parts.append("Related files in the codebase:")
        for f in related_files:
            if isinstance(f, dict):
                parts.append(f"  - {f.get('path', f)}: {f.get('description', '')}")
            else:
                parts.append(f"  - {f}")

    if dependency_map:
        parts.append("\nDependency map:")
        for key, deps in dependency_map.items():
            parts.append(f"  - {key} → {deps}")

    return "\n".join(parts) if parts else "No additional context provided."


class BuildProjectContextNode:
    """Assemble project_context from repository_context for use by all analysis nodes."""

    async def __call__(self, state: PRReviewState) -> dict:
        logger.info("Building project context")

        repository_context = state.get("repository_context") or {}

        project_context: Dict[str, Any] = {
            "related_files": repository_context.get("related_files", []),
            "dependency_map": repository_context.get("dependency_map", {}),
            "architecture_rules": repository_context.get(
                "architecture_rules",
                "No specific architecture rules provided. Apply general clean architecture principles.",
            ),
        }

        logger.debug(
            f"Project context built with {len(project_context['related_files'])} related files"
        )

        return {"project_context": project_context}
