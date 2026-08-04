from langchain_openai import ChatOpenAI
from loguru import logger

from app.config.settings import settings

_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class LLMService:
    def __init__(self):
        logger.info("Initializing LLM Service")

        use_openrouter = bool(settings.OPENROUTER_API_KEY)

        if use_openrouter:
            model = settings.OPENROUTER_MODEL
            api_key = settings.OPENROUTER_API_KEY
            base_url = _OPENROUTER_BASE_URL
            default_headers = {
                # OpenRouter uses these for its (optional) app leaderboard/rankings.
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": settings.APP_TITLE,
            }
        else:
            model = settings.MODEL
            api_key = settings.OPENAI_API_KEY
            base_url = None
            default_headers = None

            if not api_key:
                logger.error("Neither OPENROUTER_API_KEY nor OPENAI_API_KEY is set")
                raise ValueError("OPENROUTER_API_KEY or OPENAI_API_KEY environment variable is required")
            if not model:
                logger.error("MODEL environment variable is missing")
                raise ValueError("MODEL environment variable is required")

        provider = "OpenRouter" if use_openrouter else "OpenAI"
        try:
            self.model = ChatOpenAI(
                model=model,
                temperature=0.0,
                max_retries=3,
                api_key=api_key,
                base_url=base_url,
                default_headers=default_headers,
            )
            logger.success(f"LLM Service initialized successfully via {provider} with model: {model}")
        except Exception as e:
            logger.error(f"Failed to initialize {provider} model: {e!s}")
            raise ValueError(f"Failed to initialize {provider} model: {e!s}")
