from loguru import logger

from app.models.types import PRReviewState

_SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}
_RANK_TO_SEVERITY = {4: "critical", 3: "high", 2: "medium", 1: "low", 0: "low"}


class AggregateFindingsNode:
    """Merge all parallel analysis outputs, deduplicate, and compute overall severity."""

    async def __call__(self, state: PRReviewState) -> dict:
        logger.info("Aggregating findings from all parallel analysis nodes")

        all_raw = (
            list(state.get("architecture_issues") or []) +
            list(state.get("security_vulnerabilities") or []) +
            list(state.get("performance_issues") or []) +
            list(state.get("best_practice_violations") or [])
        )

        # Deduplicate by (file_path, line, description[:80])
        seen: set = set()
        deduplicated = []
        for finding in all_raw:
            if finding.get("error"):
                deduplicated.append(finding)
                continue
            key = (
                finding.get("file_path", ""),
                finding.get("line"),
                (finding.get("description", "") or "")[:80],
            )
            if key not in seen:
                seen.add(key)
                deduplicated.append(finding)

        # Compute overall severity from the highest-ranked finding
        max_rank = 0
        for finding in deduplicated:
            if finding.get("error"):
                continue
            sev = finding.get("severity", "low")
            max_rank = max(max_rank, _SEVERITY_RANK.get(sev, 0))

        severity_level = _RANK_TO_SEVERITY[max_rank]

        logger.info(
            f"Aggregated {len(deduplicated)} unique findings "
            f"(from {len(all_raw)} raw), severity: {severity_level}"
        )

        return {
            "all_findings": deduplicated,
            "severity_level": severity_level,
        }
