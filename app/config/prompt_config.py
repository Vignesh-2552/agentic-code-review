"""
Prompt configuration models using Pydantic for type safety and validation.
"""
from typing import Dict, Any
import yaml

from loguru import logger
from pydantic import BaseModel, Field


class PromptConfig(BaseModel):
    """Configuration for a specific prompt version."""

    model: str = Field(..., description="The model to use for this prompt")
    temperature: float = Field(default=0.0, description="Temperature setting for the model")
    prompt: str = Field(..., description="The actual prompt template")


class CodeReviewConfig(BaseModel):
    """Configuration for code review prompts."""

    SECURITY_SCAN: PromptConfig
    PERFORMANCE_ANALYSIS: PromptConfig
    BEST_PRACTICES: PromptConfig
    ARCHITECTURE_VALIDATION: PromptConfig
    INLINE_COMMENTS: PromptConfig
    PR_SUMMARY: PromptConfig


def load_config(config_path: str) -> Dict[str, Any]:
    """
    Load the configuration from a YAML file.

    Args:
        config_path: Path to the YAML configuration file.

    Returns:
        Dictionary containing the parsed YAML configuration.
    """
    try:
        with open(config_path, "r", encoding="utf-8") as file:
            config = yaml.safe_load(file)
        logger.debug(f"Loaded configuration from {config_path}")
        return config
    except FileNotFoundError:
        logger.error(f"Configuration file not found at: {config_path}")
        raise FileNotFoundError(f"Configuration file not found at: {config_path}")
    except yaml.YAMLError as e:
        logger.error(f"Error parsing YAML configuration: {str(e)}")
        raise yaml.YAMLError(f"Error parsing YAML configuration: {str(e)}")


def load_code_review_config(config_dir: str = "code_review") -> CodeReviewConfig:
    """
    Load the code review configuration from a directory of YAML files.

    Args:
        config_dir: Name of the directory containing YAML configuration files in the prompts directory.

    Returns:
        CodeReviewConfig object containing the parsed configuration.
    """
    import os
    import glob
    from pathlib import Path

    # Resolve prompts dir relative to this file (app/config/ → app/prompts/)
    dir_path = str(Path(__file__).parent.parent / "prompts" / config_dir)
    if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
        logger.error(f"Configuration directory not found at: {dir_path}")
        raise FileNotFoundError(f"Configuration directory not found at: {dir_path}")

    config_dict = {}
    yaml_files = glob.glob(os.path.join(dir_path, "*.yml")) + glob.glob(os.path.join(dir_path, "*.yaml"))

    for file_path in yaml_files:
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                file_config = yaml.safe_load(file)
                if isinstance(file_config, dict):
                    config_dict.update(file_config)
            logger.debug(f"Loaded configuration from {file_path}")
        except yaml.YAMLError as e:
            logger.error(f"Error parsing YAML configuration in {file_path}: {str(e)}")
            raise yaml.YAMLError(f"Error parsing YAML configuration in {file_path}: {str(e)}")

    return CodeReviewConfig(**config_dict)
