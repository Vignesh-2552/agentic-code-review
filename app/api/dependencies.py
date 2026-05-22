from fastapi import Request

from app.services.code_review_service import CodeReviewService


def get_code_review_service(request: Request) -> CodeReviewService:
    """Get the code review service from the dependency injection container."""
    return request.app.container.code_review_service()
