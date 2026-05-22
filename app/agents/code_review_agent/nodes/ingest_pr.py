import re
from typing import Any, Dict, List

from loguru import logger

from app.models.types import PRReviewState


def parse_git_diff(git_diff: str) -> List[Dict[str, Any]]:
    """Parse unified diff format into a list of changed files with their hunks."""
    files: List[Dict[str, Any]] = []
    current_file: Dict[str, Any] | None = None

    for line in git_diff.split('\n'):
        if line.startswith('diff --git'):
            if current_file is not None:
                files.append(current_file)
            match = re.search(r' b/(.+)$', line)
            path = match.group(1) if match else 'unknown'
            current_file = {"path": path, "hunks": []}
        elif line.startswith('@@') and current_file is not None:
            match = re.search(r'\+(\d+)(?:,(\d+))?', line)
            if match:
                start_line = int(match.group(1))
                current_file["hunks"].append({
                    "start_line": start_line,
                    "header": line,
                    "lines": [],
                })
        elif current_file is not None and current_file["hunks"]:
            current_file["hunks"][-1]["lines"].append(line)

    if current_file is not None:
        files.append(current_file)

    return files


class IngestPRNode:
    """Validate and parse the PR diff into structured changed_files."""

    async def __call__(self, state: PRReviewState) -> dict:
        logger.info(f"Ingesting PR: {state.get('pr_title', 'unknown')}")

        git_diff = state.get("git_diff", "")
        pr_title = state.get("pr_title", "")

        if not git_diff:
            raise ValueError("git_diff is required and cannot be empty")
        if len(git_diff) > 500_000:
            raise ValueError(
                f"git_diff exceeds maximum length of 500,000 characters (got {len(git_diff)})"
            )
        if not pr_title:
            raise ValueError("pr_title is required and cannot be empty")

        changed_files = parse_git_diff(git_diff)
        logger.info(f"Parsed {len(changed_files)} changed files from diff")

        return {
            "changed_files": changed_files,
            # Initialize parallel output fields so operator.add has a base to extend
            "architecture_issues": [],
            "security_vulnerabilities": [],
            "performance_issues": [],
            "best_practice_violations": [],
        }
