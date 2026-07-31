"""
Repository discovery helpers backing the repo-picker UI: verify a repo exists,
list its branches, and list its supported source files at a given branch.
"""

import json
import re
import time
import urllib.error
import urllib.request
from urllib.parse import quote, urlparse

_NAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")

_RATE_LIMIT_HINT = (
    "GitHub API rate limit exceeded. Set GITHUB_TOKEN in your .env to raise "
    "the limit from 60 to 5000 requests/hr."
)

# Short TTL cache so repeatedly verifying/browsing the same repo+branch while
# interacting with the picker UI doesn't spend extra rate-limit budget.
_CACHE_TTL_SECONDS = 60
_MAX_CACHE_ENTRIES = 500
_cache: dict[str, tuple[float, object]] = {}

_SUPPORTED_EXTENSIONS = {".py", ".js", ".tsx", ".jsx", ".html"}

_EXTENSION_TO_LANG = {
    ".py": "python",
    ".js": "javascript",
    ".tsx": "typescript",
    ".jsx": "javascript",
    ".html": "html",
}

_MAX_TREE_FILES = 3000


def _validate_name(value: str, field: str) -> str:
    if not value or not _NAME_RE.match(value):
        raise ValueError(f"Invalid {field}: '{value}'")
    return value


def parse_repo_input(value: str) -> tuple[str, str]:
    """Parse 'owner/repo' or a github.com URL into (owner, repo)."""
    value = value.strip().rstrip("/")
    if value.startswith("http://") or value.startswith("https://"):
        parsed = urlparse(value)
        if parsed.netloc != "github.com":
            raise ValueError("Repository URL must be a github.com URL")
        parts = parsed.path.lstrip("/").split("/")
    else:
        parts = value.split("/")

    if len(parts) < 2 or not parts[0] or not parts[1]:
        raise ValueError("Repository must be in 'owner/repo' format")

    owner, repo = parts[0], parts[1]
    if repo.endswith(".git"):
        repo = repo[:-4]

    return _validate_name(owner, "owner"), _validate_name(repo, "repository name")


def _api_get(url: str, token: str | None = None) -> object:
    cache_key = f"{'auth' if token else 'anon'}::{url}"
    now = time.monotonic()
    cached = _cache.get(cache_key)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    headers = {"Accept": "application/vnd.github+json", "User-Agent": "code-review-agent"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    if len(_cache) > _MAX_CACHE_ENTRIES:
        _cache.clear()
    _cache[cache_key] = (now, data)
    return data


def fetch_repo_info(owner: str, repo: str, token: str | None = None) -> dict:
    """Verify a repo exists and return its metadata."""
    _validate_name(owner, "owner")
    _validate_name(repo, "repository name")
    url = f"https://api.github.com/repos/{quote(owner)}/{quote(repo)}"
    try:
        data = _api_get(url, token)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise ValueError(
                f"Repository '{owner}/{repo}' not found (or private — set GITHUB_TOKEN in your .env)"
            ) from exc
        if exc.code == 403:
            raise ValueError(_RATE_LIMIT_HINT) from exc
        raise ValueError(f"GitHub API error: {exc.code} {exc.reason}") from exc

    return {
        "owner": owner,
        "repo": repo,
        "default_branch": data.get("default_branch", "main"),
        "private": bool(data.get("private", False)),
        "description": data.get("description"),
    }


def fetch_branches(owner: str, repo: str, token: str | None = None) -> list[str]:
    _validate_name(owner, "owner")
    _validate_name(repo, "repository name")
    url = f"https://api.github.com/repos/{quote(owner)}/{quote(repo)}/branches?per_page=100"
    try:
        data = _api_get(url, token)
    except urllib.error.HTTPError as exc:
        if exc.code == 403:
            raise ValueError(_RATE_LIMIT_HINT) from exc
        raise ValueError(f"Could not list branches: {exc.code} {exc.reason}") from exc
    if not isinstance(data, list):
        return []
    return [b["name"] for b in data if "name" in b]


def fetch_repo_tree(owner: str, repo: str, branch: str, token: str | None = None) -> tuple[list[dict], bool]:
    """Return (files, truncated) — flat list of supported source files at `branch`."""
    _validate_name(owner, "owner")
    _validate_name(repo, "repository name")
    if not branch:
        raise ValueError("Branch is required")

    ref = quote(branch, safe="")
    url = f"https://api.github.com/repos/{quote(owner)}/{quote(repo)}/git/trees/{ref}?recursive=1"
    try:
        data = _api_get(url, token)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise ValueError(f"Branch '{branch}' not found") from exc
        if exc.code == 403:
            raise ValueError(_RATE_LIMIT_HINT) from exc
        raise ValueError(f"GitHub API error: {exc.code} {exc.reason}") from exc

    entries = data.get("tree", []) if isinstance(data, dict) else []
    files: list[dict] = []
    for entry in entries:
        if entry.get("type") != "blob":
            continue
        path = entry.get("path", "")
        dot = path.rfind(".")
        ext = path[dot:] if dot != -1 else ""
        if ext in _SUPPORTED_EXTENSIONS:
            files.append({"path": path, "language": _EXTENSION_TO_LANG[ext]})
        if len(files) >= _MAX_TREE_FILES:
            break

    truncated = bool(data.get("truncated")) if isinstance(data, dict) else False
    return files, truncated
