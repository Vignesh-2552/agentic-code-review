"""
Fetch all supported source files from a GitHub directory URL.

Parses URLs of the form:
  https://github.com/{owner}/{repo}/tree/{branch}/{path}

Lists the repo's files with a single call to the Git Trees API (see
app.utils.github_repo.fetch_repo_tree) rather than crawling the Contents API
one request per subfolder, and downloads raw content directly from
raw.githubusercontent.com, which isn't subject to the api.github.com rate
limit — so a directory review costs exactly one GitHub API call regardless
of how deeply nested it is.
"""

import urllib.request
from urllib.parse import quote, urlparse

from app.utils.github_repo import fetch_repo_tree


def parse_tree_url(url: str) -> tuple[str, str, str, str]:
    """
    Parse a GitHub tree URL.

    Returns (owner, repo, branch, dir_path).
    Raises ValueError for unrecognised formats.
    """
    parsed = urlparse(url)
    if parsed.netloc != "github.com":
        raise ValueError("URL must be a github.com URL")

    parts = parsed.path.lstrip("/").split("/")
    # Expected: owner / repo / tree / branch / [path...]
    if len(parts) < 4 or parts[2] not in ("tree", "blob"):
        raise ValueError(
            "URL must be a GitHub URL pointing to a file or directory "
            "(e.g. https://github.com/owner/repo/tree/main/src)"
        )
    if parts[2] == "blob":
        raise ValueError(
            "This looks like a single-file URL (/blob/). "
            "Use the 'Single File' review instead, or provide a folder URL "
            "(e.g. https://github.com/owner/repo/tree/main/src)."
        )

    owner, repo = parts[0], parts[1]
    branch = parts[3]
    dir_path = "/".join(parts[4:]) if len(parts) > 4 else ""
    return owner, repo, branch, dir_path


def _fetch_raw(raw_url: str, token: str | None) -> str:
    """Download raw file content from raw.githubusercontent.com."""
    headers = {"User-Agent": "code-review-agent"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(raw_url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")


def fetch_directory_files(url: str, token: str | None = None) -> list[dict]:
    """
    Fetch all supported source files from a GitHub directory URL.

    Returns a list of dicts:
      [{"path": str, "language": str, "content": str}, ...]

    Raises ValueError on bad URLs or GitHub API errors.
    """
    owner, repo, branch, dir_path = parse_tree_url(url)

    all_files, _truncated = fetch_repo_tree(owner, repo, branch, token=token)

    if dir_path:
        prefix = dir_path.rstrip("/") + "/"
        file_meta = [f for f in all_files if f["path"] == dir_path or f["path"].startswith(prefix)]
    else:
        file_meta = all_files

    if not file_meta:
        raise ValueError("No supported source files (.py, .js) found in the specified directory")

    branch_segment = quote(branch, safe="")
    total_chars = 0
    results = []
    for meta in file_meta:
        raw_url = (
            f"https://raw.githubusercontent.com/{quote(owner)}/{quote(repo)}/"
            f"{branch_segment}/{quote(meta['path'], safe='/')}"
        )
        content = _fetch_raw(raw_url, token)
        total_chars += len(content)
        if total_chars > 200_000:
            # Hard cap to avoid blowing up the LLM token window
            break
        results.append({
            "path": meta["path"],
            "language": meta["language"],
            "content": content,
        })

    return results


def build_synthetic_diff(files: list[dict]) -> str:
    """
    Build a unified-diff-style string from a list of fetched files.
    Each file is treated as a fully added file.
    """
    parts = []
    for f in files:
        path = f["path"]
        lines = f["content"].splitlines()
        added = "\n".join(f"+{line}" for line in lines)
        parts.append(
            f"diff --git a/{path} b/{path}\n"
            f"--- /dev/null\n"
            f"+++ b/{path}\n"
            f"@@ -0,0 +1,{len(lines)} @@\n"
            f"{added}"
        )
    return "\n".join(parts)
