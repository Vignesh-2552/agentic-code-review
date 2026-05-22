import urllib.error
import urllib.request
from urllib.parse import urlparse

_EXTENSION_MAP = {
    ".py": ("python", "py"),
    ".js": ("javascript", "js"),
    ".tsx": ("typescript", "tsx"),
    ".jsx": ("javascript", "jsx"),
    ".html": ("html", "html"),
}


def normalize_to_raw_url(url: str) -> str:
    """Convert any GitHub file URL to raw.githubusercontent.com."""
    parsed = urlparse(url)
    if parsed.netloc == "raw.githubusercontent.com":
        return url
    if parsed.netloc != "github.com":
        return url

    # Strip leading slash and split path
    parts = parsed.path.lstrip("/").split("/")
    # parts: [owner, repo, "blob"|"raw", branch, ...path]
    if len(parts) >= 4 and parts[2] in ("blob", "raw"):
        owner, repo, _, branch = parts[:4]
        file_path = "/".join(parts[4:])
        return f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file_path}"

    return url


def detect_language_from_url(url: str) -> tuple[str, str]:
    """Return (language, file_type) based on the file extension in the URL."""
    path = urlparse(url).path
    dot_idx = path.rfind(".")
    if dot_idx == -1:
        raise ValueError("Unsupported file extension: (none)")
    ext = path[dot_idx:]
    if ext not in _EXTENSION_MAP:
        raise ValueError(f"Unsupported file extension: {ext}")
    return _EXTENSION_MAP[ext]


def fetch_github_file(url: str) -> tuple[str, str, str]:
    """Fetch a file from GitHub and return (code, language, file_type)."""
    raw_url = normalize_to_raw_url(url)
    language, file_type = detect_language_from_url(raw_url)

    req = urllib.request.Request(raw_url, headers={"User-Agent": "code-review-agent"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        code = resp.read().decode("utf-8", errors="replace")

    if len(code) > 50_000:
        raise ValueError("File exceeds the 50,000 character limit")

    return code, language, file_type
