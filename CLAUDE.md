# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
```bash
# Start the FastAPI server
python main.py

# Or using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Package Management
```bash
# Install dependencies (preferred method)
uv sync

# Alternative with pip
pip install -r pyproject.toml
```

### Testing
```bash
# Run API tests
python test_api.py
```

### API Documentation
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Architecture Overview

This is an AI-powered code review and conversation API built with FastAPI and LangGraph agent architecture. The application follows a clean architecture pattern with dependency injection.

### Key Components

**Agent-Based Architecture**: The application uses LangGraph for agent workflows
- `CodeReviewAgent`: Multi-stage code analysis pipeline (syntax, security, performance, best practices)
- `ConversationAgent`: RAG-enabled Q&A system with document processing

**Core Services**:
- `LLMService`: OpenAI integration with JSON response parsing
- `PromptService`: Centralized prompt management from YAML configs
- `VectorDBService`: FAISS-based document retrieval for RAG
- `AuthService`: JWT-based authentication with PostgreSQL

**Directory Structure**:
```
app/
├── agents/           # LangGraph-based AI agents
├── api/              # FastAPI routes and dependencies  
├── core/             # Core services (LLM, prompts)
├── services/         # Business logic layer
├── Infrastructure/   # Data access layer (repositories)
├── models/           # Pydantic models and TypedDict states
├── config/           # Configuration and DI container
├── prompts/          # AI prompt templates in YAML format
└── utils/            # Utility functions
```

### Configuration

**Environment Variables** (required):
- `OPENAI_API_KEY`: OpenAI API key
- `MODEL`: OpenAI model (e.g., gpt-4o-mini)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET_KEY`: JWT signing key

**Prompt Configuration**:
- Code review prompts: `app/prompts/code_review_config.yml`
- Conversation prompts: `app/prompts/conversation_config.yml`

### State Management

The application uses TypedDict for type-safe agent state management:
- `CodeReviewState`: State for code review workflows
- `ConversationState`: State for conversation workflows

### Dependency Injection

Uses `dependency-injector` with container configuration in `app/config/container.py`. Services are wired automatically at application startup.

### Supported Languages
- Python (.py files)
- JavaScript (.js files)

### Performance Limits
- Max code length: 50,000 characters
- Max question length: 10,000 characters
- Vector search results: Up to 6 documents

### Logging

Structured logging with Loguru to separate log files:
- `logs/app.log`: General application logs
- `logs/auth.log`: Authentication events
- `logs/code_review.log`: Code review operations
- `logs/error.log`: Error tracking
- `logs/requests.log`: HTTP request logs