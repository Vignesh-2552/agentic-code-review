# Code Review Agent - V1 Specification

## Overview
The Code Review Agent is an AI-powered automated code analysis tool built on FastAPI, LangGraph, and LangChain. It uses an AI agent architecture to evaluate code provided via API against multiple distinct quality pillars, offering educational feedback, finding bugs, and scoring performance.

## Core Technologies
- **Framework**: FastAPI (Python 3.13+)
- **AI/LLM**: LangChain, LangGraph (for graph-based state machine)
- **Dependency Injection**: dependency-injector
- **Configuration**: Pydantic, YAML

## Architectural Design
The agent uses a modular **Graph-based Architecture** (`LangGraph`) moving a `CodeReviewState` dictionary through several isolated processing nodes.

### 1. API Layer (`app/api/routers/review.py`)
Exposes the HTTP endpoints to submit code. Data comes in via Pydantic schemas (e.g., `CodeReviewRequest`).

### 2. Service Layer (`app/services/code_review_service.py`)
Acts as the bridge between the API router and the LangGraph execution engine. It accepts the `CodeReviewState` and calls `.ainvoke(state)` on the compiled graph.

### 3. Agent Graph Engine (`app/agents/code_review_agent/graph.py`)
Constructs and compiles the application logic. 
The Execution Graph flows chronologically:
1. **`parse_input`**: Validates the payload size (max 50k chars) and language (python/js).
2. **`syntax_analysis`**: Checks for syntax errors, typos, and formatting (encompassing style & comment quality).
3. **`security_scan`**: Hunts for vulnerabilities (injection, auth issues, unsafe operations).
4. **`performance_check`**: Measures time/memory complexity and inefficient loops.
5. **`best_practices`**: Enforces SOLID/DRY principles and establishes a `severity_level` (low, medium, high, critical) based on the volume of accumulated issues in the state.

**Conditional Routing (`routing.py`)**:
Based on the `severity_level` computed in `best_practices`:
- `critical` -> Escalate to Human review (`human_escalation` node).
- `high` -> Force detailed analysis (`detailed_analysis` node).
- *Otherwise* -> Generate standard insights (`educational_content` node).

**Termination**:
6. **`generate_report`**: Marks `analysis_complete = True` and flags human review criteria.

### 4. Node Layer (`app/agents/code_review_agent/nodes/`)
Individual steps of the graph are isolated into pure, standalone asynchronous functions that accept a `CodeReviewState` and return an updated `CodeReviewState`.
Nodes needing external services (like LLM invocation) are wrapped in factory closures (e.g. `get_syntax_analysis_node(llm_service, prompt_service)`).

### 5. Prompt Architecture (`app/prompts/code_review/`)
System prompts are mapped into granular, independently manageable YAML files corresponding to their respective node logic.
- `syntax_analysis.yml`
- `style_check.yml`
- `comment_quality.yml`
- `security_scan.yml`
- `performance_analysis.yml`
- `best_practices.yml`
- `explanations.yml`

This allows prompts to be edited in isolation without risking schema drift in Python files. The `PromptService` parses all these YAMLs and binds them into a single `CodeReviewConfig` Pydantic model at runtime.

### 6. Dependency Injection (`app/config/container.py`)
Wires up the application declaratively.
- Instantiates `LLMService` and `PromptService`.
- Instantiates `code_review_graph` using the `create_code_review_graph` builder factory.
- Instantiates `CodeReviewService` and injects the compiled graph into it.
- Wires the router modules globally.

## Expected Input/Output State (`CodeReviewState`)
**Input Keys Built**:
`code` (str), `language` (str), `file_type` (str)

**Injected Outputs**:
- `processing_time` (float)
- `syntax_issues` (List)
- `style_violations` (List)
- `security_vulnerabilities` (List)
- `performance_issues` (List)
- `best_practice_violations` (List)
- `severity_level` (str)
- `explanations` / `improvement_suggestions` / `learning_resources` (Lists)
- `requires_human_review` (bool)
- `analysis_complete` (bool)
