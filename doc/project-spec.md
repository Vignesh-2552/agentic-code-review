# Project Technical Specification: AI Code Review & Conversation API

## 1. Introduction
This document serves as the formal technical specification for the "agent" project, an advanced AI-powered code review and conversation service. The application orchestrates intelligent workflows using a multi-agent architecture to perform code analysis and answer questions via Retrieval-Augmented Generation (RAG).

## 2. Technology Stack
The project leverages a modern, async-first Python stack:
- **Core Framework**: FastAPI (v0.116+) for high-performance API routing and validation.
- **Language & Runtime**: Python 3.13+ managed via `uv` (as seen in `uv.lock` and `pyproject.toml`).
- **AI & Orchestration**: 
  - `langchain` (v0.3.27+) and `langchain-openai` for LLM integrations.
  - `langgraph` (v0.6.4+) for defining stateful agent workflows.
- **Vector Search**: (Removed)
- **Data & Persistence**: (Removed)
- **Security & Di**: `dependency-injector` for managing service lifecycles.

## 3. High-Level Architecture
The application follows a modular, cleanly separated architecture:

### 3.1 Directory Structure & Layers
- `app/api/` (API Layer): Handles HTTP requests, CORS, and routing. Exposes endpoints for `review`.
- `app/agents/` (Workflow Layer): Contains LangGraph compiled graphs that define multi-step AI tasks.
- `app/services/` (Business Logic Layer): Core services like `LLMService` and `PromptService`.
- `app/Infrastructure/` (Data Access Layer): Not currently utilized.
- `app/models/` (Data Modeling): Pydantic schemas for API validation and `TypedDict` for agent state management.
- `app/config/` (Configuration Layer): Dependency injection `Container` and environment settings.

## 4. Core Subsystems

### 4.1 Code Review Engine
The Code Review Engine uses `code_review_agent` to perform a multi-dimensional analysis pipeline.
**Workflow:**
1. Input Extraction & Validation
2. Syntax and Style Analysis
3. Security Vulnerability Scanning
4. Performance Evaluation
5. Best Practices Assessment
6. Educational Content Generation

**Endpoints:**
- `POST /api/v1/review/analyze`: Accepts code blobs (Python/JavaScript) and metadata, returning a structured JSON containing severity levels and categorized issues.



## 5. Deployment & Configuration
- **Dependency Injection**: Services are wired dynamically at standard entry points (e.g., `app.api.routers.*`) to allow easy testing and decoupling.
- **Environment Variables**: Managed via `.env` (e.g., `OPENAI_API_KEY`).
- **Server**: Run via `uvicorn "main:app"` with configurable host, port, and reload parameters.

## 6. Testing & Quality Assurance
The repository contains a `test_api.py` suite targeting the `/api/v1` boundaries to ensure end-to-end functionality for the code reviews workflows.
