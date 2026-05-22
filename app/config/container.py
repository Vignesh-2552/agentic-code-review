from dependency_injector import containers, providers

from app.agents.code_review_agent.graph import CodeReviewGraph
from app.config.settings import settings
from app.core.llm_service import LLMService
from app.core.prompt_service import PromptService
from app.services.code_review_service import CodeReviewService


class Container(containers.DeclarativeContainer):
    # Configuration
    config = providers.Configuration()

    # Repository
    # (Removed)

    # Core Services
    llm_service = providers.Singleton(LLMService)

    prompt_service = providers.Singleton(PromptService)




    code_review_graph = providers.Singleton(
        CodeReviewGraph,
        llm_service=llm_service,
        prompt_service=prompt_service,
    )





    # Code Review Service
    code_review_service = providers.Factory(CodeReviewService,
        code_review_graph=code_review_graph
    )


