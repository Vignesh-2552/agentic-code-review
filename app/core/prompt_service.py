from pathlib import Path

from loguru import logger

from app.config.prompt_config import load_code_review_config


class PromptService:
    def __init__(self):
        self.prompts_dir = Path("prompts")
        self._setup_configs()

    def _setup_configs(self):
        """Initialize all configurations using Pydantic models."""
        logger.info("Loading configurations using Pydantic models")

        try:
            self.code_review_config = load_code_review_config()
            logger.success("Code review configuration loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load code review configuration: {e}")
            self.code_review_config = None

    def get_security_prompt(self, git_diff: str, related_files_context: str) -> str:
        """Get formatted security scan prompt."""
        if self.code_review_config:
            return self.code_review_config.SECURITY_SCAN.prompt.format(
                git_diff=git_diff,
                related_files_context=related_files_context,
            )
        return f"Analyze this git diff for security vulnerabilities:\n\n{git_diff}"

    def get_performance_prompt(self, git_diff: str, related_files_context: str) -> str:
        """Get formatted performance analysis prompt."""
        if self.code_review_config:
            return self.code_review_config.PERFORMANCE_ANALYSIS.prompt.format(
                git_diff=git_diff,
                related_files_context=related_files_context,
            )
        return f"Analyze this git diff for performance issues:\n\n{git_diff}"

    def get_best_practices_prompt(
        self, git_diff: str, related_files_context: str, pr_title: str, commit_messages: str
    ) -> str:
        """Get formatted best practices prompt."""
        if self.code_review_config:
            return self.code_review_config.BEST_PRACTICES.prompt.format(
                git_diff=git_diff,
                related_files_context=related_files_context,
                pr_title=pr_title,
                commit_messages=commit_messages,
            )
        return f"Analyze this git diff for best practice violations:\n\n{git_diff}"

    def get_architecture_prompt(
        self, git_diff: str, related_files_context: str, architecture_rules: str
    ) -> str:
        """Get formatted architecture validation prompt."""
        if self.code_review_config:
            return self.code_review_config.ARCHITECTURE_VALIDATION.prompt.format(
                git_diff=git_diff,
                related_files_context=related_files_context,
                architecture_rules=architecture_rules,
            )
        return f"Analyze this git diff for architectural issues:\n\n{git_diff}"

    def get_inline_comments_prompt(self, git_diff: str, all_findings: str) -> str:
        """Get formatted inline comments prompt."""
        if self.code_review_config:
            return self.code_review_config.INLINE_COMMENTS.prompt.format(
                git_diff=git_diff,
                all_findings=all_findings,
            )
        return f"Convert these findings into inline comments:\n\n{all_findings}"

    def get_pr_summary_prompt(
        self,
        pr_title: str,
        pr_description: str,
        all_findings_summary: str,
        severity_level: str,
        requires_human_review: str,
    ) -> str:
        """Get formatted PR summary prompt."""
        if self.code_review_config:
            return self.code_review_config.PR_SUMMARY.prompt.format(
                pr_title=pr_title,
                pr_description=pr_description,
                all_findings_summary=all_findings_summary,
                severity_level=severity_level,
                requires_human_review=requires_human_review,
            )
        return f"Write a PR review summary for: {pr_title}"
