"""
Fetch all supported source files from a GitHub directory URL.

Parses URLs of the form:
  https://github.com/{owner}/{repo}/tree/{branch}/{path}

Uses the GitHub Contents API:
  GET /repos/{owner}/{repo}/contents/{path}?ref={branch}
"""

import json
import urllib.error
import urllib.request
from urllib.parse import urlparse

_SUPPORTED_EXTENSIONS = {".py", ".js", ".tsx", ".jsx", ".html"}

_EXTENSION_TO_LANG = {
    ".py": "python",
    ".js": "javascript",
    ".tsx": "typescript",
    ".jsx": "javascript",
    ".html": "html",
}


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


def _api_get(url: str, token: str | None = None) -> object:
    """Perform a GitHub API GET request and return parsed JSON."""
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "code-review-agent"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _collect_files(
    owner: str,
    repo: str,
    branch: str,
    path: str,
    token: str | None,
    results: list[dict],
    depth: int = 0,
) -> None:
    """Recursively collect supported files from a GitHub directory."""
    if depth > 5:
        return  # safety cap against deeply nested repos

    api_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}"
    try:
        entries = _api_get(api_url, token)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            hint = (
                "Path not found. This usually means: "
                "(1) the repository is private — set GITHUB_TOKEN in your .env, "
                "(2) the path or branch name is incorrect, or "
                "(3) the directory does not exist."
            )
            raise ValueError(f"GitHub API 404 for path '{path}'. {hint}") from exc
        if exc.code == 403:
            raise ValueError(
                f"GitHub API rate limit exceeded (path '{path}'). "
                "Set GITHUB_TOKEN in your .env to raise the limit from 60 to 5000 requests/hr."
            ) from exc
        raise ValueError(f"GitHub API error for path '{path}': {exc.code} {exc.reason}") from exc

    if not isinstance(entries, list):
        # single file returned — shouldn't happen for a directory
        return

    for entry in entries:
        entry_type = entry.get("type")
        entry_path = entry.get("path", "")
        if entry_type == "file":
            dot = entry_path.rfind(".")
            ext = entry_path[dot:] if dot != -1 else ""
            if ext in _SUPPORTED_EXTENSIONS:
                results.append({
                    "path": entry_path,
                    "download_url": entry.get("download_url"),
                    "language": _EXTENSION_TO_LANG[ext],
                })
        elif entry_type == "dir":
            _collect_files(owner, repo, branch, entry_path, token, results, depth + 1)


def _fetch_raw(download_url: str, token: str | None) -> str:
    """Download raw file content."""
    headers = {"User-Agent": "code-review-agent"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(download_url, headers=headers)
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

    file_meta: list[dict] = []
    _collect_files(owner, repo, branch, dir_path, token, file_meta)

    if not file_meta:
        raise ValueError("No supported source files (.py, .js) found in the specified directory")

    total_chars = 0
    results = []
    for meta in file_meta:
        if not meta.get("download_url"):
            continue
        content = _fetch_raw(meta["download_url"], token)
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
