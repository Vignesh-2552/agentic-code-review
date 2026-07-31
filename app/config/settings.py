import os

from dotenv import load_dotenv

# Load environment variables from .env file - force reload
load_dotenv(override=True)

class Settings:
    """Application configuration settings."""

    def __init__(self):
        # Reload environment variables to ensure they're fresh
        load_dotenv(override=True)

    # API Configuration
    APP_TITLE = "Code Review API"
    APP_DESCRIPTION = "AI-powered code review service that analyzes syntax, security, performance, and best practices"
    APP_VERSION = "1.0.0"

    # Server Configuration
    HOST = "0.0.0.0"
    PORT = 8000
    RELOAD = True
    LOG_LEVEL = "info"



    # OpenAI Configuration - Use properties to get fresh values
    @property
    def OPENAI_API_KEY(self):
        return os.getenv("OPENAI_API_KEY")

    @property
    def MODEL(self):
        return os.getenv("MODEL")

    # OpenRouter Configuration — when OPENROUTER_API_KEY is set, LLMService routes
    # through OpenRouter's OpenAI-compatible endpoint instead of OpenAI directly.
    # Model catalog (including free ":free" models): https://openrouter.ai/models
    @property
    def OPENROUTER_API_KEY(self):
        return os.getenv("OPENROUTER_API_KEY")

    @property
    def OPENROUTER_MODEL(self):
        # Must be a model id from https://openrouter.ai/api/v1/models ending in
        # ":free" (verified live, not from static docs — OpenRouter's free
        # catalog rotates). Override via OPENROUTER_MODEL if you want a different one.
        return os.getenv("OPENROUTER_MODEL") or "openai/gpt-oss-20b:free"

    # Code Review Settings
    MAX_CODE_LENGTH = 50000
    SUPPORTED_LANGUAGES = ["python", "javascript", "typescript", "html"]
    SUPPORTED_FILE_TYPES = ["py", "js", "tsx", "jsx", "html"]

    # GitHub API (optional — raises rate limit from 60 to 5000 req/hr)
    @property
    def GITHUB_TOKEN(self):
        return os.getenv("GITHUB_TOKEN")

    # CORS Settings
    # Wildcard origins + credentials is rejected by browsers (and insecure where it
    # isn't); the API doesn't use cookies/sessions, so credentials stay off and
    # origins are an explicit allowlist, overridable via ALLOWED_ORIGINS.
    @property
    def CORS_ORIGINS(self):
        origins = os.getenv("ALLOWED_ORIGINS")
        if origins:
            return [o.strip() for o in origins.split(",") if o.strip()]
        return ["http://localhost:3000"]

    CORS_CREDENTIALS = False
    CORS_METHODS = ["*"]
    CORS_HEADERS = ["*"]

    # Performance Analysis Aspects
    PERFORMANCE_ASPECTS = [
        "time complexity",
        "memory usage",
        "query optimization",
        "loop efficiency",
        "resource management"
    ]

    @classmethod
    def validate_settings(cls):
        """Validate required environment variables."""
        instance = cls() if not hasattr(cls, '_instance') else cls._instance
        missing_vars = []

        if not instance.OPENROUTER_API_KEY:
            if not instance.OPENAI_API_KEY:
                missing_vars.append("OPENAI_API_KEY (or set OPENROUTER_API_KEY)")
            if not instance.MODEL:
                missing_vars.append("MODEL (or set OPENROUTER_API_KEY)")

        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        return True

settings = Settings()
