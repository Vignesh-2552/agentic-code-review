import json
import re

from langchain_openai import ChatOpenAI
from loguru import logger

class LLMService:
    def __init__(self):
        logger.info("Initializing LLM Service")
        from app.config.settings import settings
        openai_api_key = settings.OPENAI_API_KEY
        model = settings.MODEL

        if not openai_api_key:
            logger.error("OPENAI_API_KEY environment variable is missing")
            raise ValueError("OPENAI_API_KEY environment variable is required")
        if not model:
            logger.error("MODEL environment variable is missing")
            raise ValueError("MODEL environment variable is required")

        try:
            self.model = ChatOpenAI(model = model,
                temperature = 0.0,
                max_retries=3,
            )
            logger.success(f"LLM Service initialized successfully with model: {model}")
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI model: {str(e)}")
            raise ValueError(f"Failed to initialize OpenAI model: {str(e)}")

    def extract_json_from_response(self, response_text: str) -> dict:
        """Extract JSON from model response, handling cases where it's wrapped in text."""
        logger.debug(f"Extracting JSON from response(length: {len(response_text)})")
        try:
            result = json.loads(response_text)
            logger.debug("Successfully parsed JSON directly")
            return result
        except json.JSONDecodeError as e:
            logger.warning(f"Direct JSON parsing failed: {e}. Attempting pattern matching...")
            json_pattern = r'\{[^{}]*(?: \{[^{}]*\}[^{}]*)*\}'
            matches = re.findall(json_pattern, response_text)

            for i, match in enumerate(matches):
                try:
                    result = json.loads(match)
                    logger.debug(f"Successfully parsed JSON from pattern match {i+1}")
                    return result
                except json.JSONDecodeError:
                    continue

            logger.error(f"Could not extract JSON from response: {response_text[: 200]}...")
            return {}
