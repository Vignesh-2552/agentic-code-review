import re
from datetime import datetime
from pathlib import Path
from typing import Any

from loguru import logger

_RESULT_DIR = Path("result")


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return slug or "run"


def make_run_id(pr_title: str) -> str:
    """Build a filesystem-safe, sortable identifier shared by every node in one review run."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"{timestamp}-{_slugify(pr_title)[:40]}"


def _render_value(value: Any, level: int = 0) -> list[str]:
    indent = "  " * level
    lines: list[str] = []

    if isinstance(value, dict):
        for key, v in value.items():
            if isinstance(v, (dict, list)) and v:
                lines.append(f"{indent}- **{key}**:")
                lines.extend(_render_value(v, level + 1))
            else:
                lines.append(f"{indent}- **{key}**: {v}")
    elif isinstance(value, list):
        if not value:
            lines.append(f"{indent}- _None_")
        for item in value:
            if isinstance(item, dict):
                lines.extend(_render_value(item, level))
                lines.append("")
            else:
                lines.append(f"{indent}- {item}")
    else:
        lines.append(f"{indent}{value}")

    return lines


def to_markdown(title: str, data: dict) -> str:
    """Render a flat/nested result dict (e.g. a Pydantic model_dump()) as Markdown."""
    lines = [f"# {title}", ""]
    for key, value in data.items():
        heading = key.replace("_", " ").title()
        lines.append(f"## {heading}")
        lines.extend(_render_value(value) if isinstance(value, (dict, list)) else [str(value)])
        lines.append("")
    return "\n".join(lines)


def write_node_result_md(run_id: str, node_name: str, title: str, data: dict) -> None:
    """Persist one node's structured result as a Markdown file at result/<node_name>-<run_id>.md.

    Shared by every node in the graph so each review run leaves a per-node audit trail on disk.
    """
    _RESULT_DIR.mkdir(parents=True, exist_ok=True)
    file_path = _RESULT_DIR / f"{node_name}-{run_id}.md"
    file_path.write_text(to_markdown(title, data), encoding="utf-8")
    logger.debug(f"Wrote node result markdown: {file_path}")
