from fastapi import APIRouter, HTTPException, Query
from loguru import logger

from app.config.settings import settings
from app.models.schemas import RepoTreeResponse, RepoVerifyResponse
from app.utils.github_repo import fetch_branches, fetch_repo_info, fetch_repo_tree, parse_repo_input

router = APIRouter()


@router.get("/verify", response_model=RepoVerifyResponse)
async def verify_repo(repo: str = Query(..., description="'owner/repo' or a github.com URL")):
    """Verify a repository exists and return its default branch + branch list."""
    try:
        owner, name = parse_repo_input(repo)
        info = fetch_repo_info(owner, name, token=settings.GITHUB_TOKEN)
        branches = fetch_branches(owner, name, token=settings.GITHUB_TOKEN)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error verifying repo '{repo}': {e}", exc_info=True)
        raise HTTPException(status_code=502, detail="Could not reach GitHub")

    return RepoVerifyResponse(**info, branches=branches)


@router.get("/tree", response_model=RepoTreeResponse)
async def get_repo_tree(
    owner: str = Query(...),
    repo: str = Query(...),
    branch: str = Query(...),
):
    """List supported source files in a repository at a given branch."""
    try:
        files, truncated = fetch_repo_tree(owner, repo, branch, token=settings.GITHUB_TOKEN)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching tree for '{owner}/{repo}@{branch}': {e}", exc_info=True)
        raise HTTPException(status_code=502, detail="Could not reach GitHub")

    return RepoTreeResponse(files=files, truncated=truncated)
