# AI Code Review & Conversation Engine

An advanced, full-stack AI-powered code review service built with **FastAPI** and **LangGraph** on the backend, and **Next.js** with **Tailwind CSS** on the frontend. This system orchestrates intelligent workflows to perform multi-dimensional code analysis and generate actionable, context-aware Project-Level Pull Request (PR) feedback.

![Python](https://img.shields.io/badge/Python-3.13+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.1+-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## ✨ Features

### Code Review Engine (Backend)
- **Multi-dimensional Analysis**: Scans for security vulnerabilities, evaluates performance bottlenecks, checks best practices, and validates structural architecture.
- **RAG & Context-Aware (V2 Engine)**: Ingests multi-file git diffs, builds project-level contexts to map dependencies, and validates against global rules rather than just isolated files.
- **Agentic Workflow**: Uses `langgraph` stateful agents for parallel execution (Map-Reduce Fan-out/Fan-in architecture) of checks.
- **Inline Comments Generation**: Emits structured feedback mapped strictly to the git diff lines, ready for injection into GitHub/GitLab PRs.

### Interactive Dashboard (Frontend)
- **Single Snippet Analysis**: Paste a file URL and instantly catch syntax, security, or performance issues via an inline-annotated viewer.
- **Pull Request Review Dashboard**: Paste PR details and a git diff to get a unified dashboard. Includes:
  - Severity Level Header & Human Escalation warnings.
  - Interactive **Scorecards** breaking down issues into Architecture, Security, Performance, and Best Practices.
  - **Code Diff Viewer**: A highly interactive UI displaying inline feedback (`react-diff-viewer-continued`) nested closely beneath the affected code lines.
- **Modern UI Stack**: Built with React 19, accessible components via **Shadcn UI**, and lightning-fast styling with **Tailwind CSS**.

---

## 🏗️ Architecture

The monorepo encompasses two major domains cleanly separated into distinct folders:

```text
agent/
├── app/                       # FastAPI Backend (LangGraph logic)
│   ├── agents/                # Stateful AI agents & parallel validation layer
│   ├── api/                   # HTTP REST endpoints & routing
│   ├── core/                  # Core services (OpenAI, Prompt handling)
│   ├── models/                # Pydantic schemas & TypedDict states
│   └── config/                # DI container & environment setup
├── frontend/                  # Next.js Application
│   ├── src/app/               # App router pages (analyze, pr, directory review)
│   ├── src/components/        # UI components, diff viewers, and forms
│   └── src/lib/               # React Query mutations & API clients
└── doc/                       # Architectural specifications
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.13+
- Node.js 20+
- OpenAI API Key

### 1. Start the Backend

```bash
# Clone the repository
git clone <repository-url>
cd agent

# Install Python dependencies using uv (recommended)
uv sync
# Or use standard pip: pip install -r pyproject.toml

# Set up environment variables
cp .env.example .env
# Edit .env and supply your OPENAI_API_KEY
# OPENAI_API_KEY=sk-...
# MODEL=gpt-4o

# Run the FastAPI server
python main.py
```
> The Interactive API documentation will be available at `http://localhost:8000/docs`.

### 2. Start the Frontend

```bash
cd frontend

# Install Node dependencies
npm install

# Start the development server
npm run dev
```
> The Frontend Dashboard will be available at `http://localhost:3000`.

---

## 📡 API Endpoints

The backend exposes primary interaction points located under `/api/v1/review/`:
- `POST /analyze`: Forward-compatible endpoint for analyzing single files or code snippets. Returns a categorized array of isolated findings.
- `POST /pr`: The primary V2 endpoint. Accepts `git_diff`, `pr_title`, `pr_description`, and `commit_messages`. Runs parallel agentic checks and returns actionable `inline_comments` alongside a comprehensive `pr_summary`.

---

## 🛠️ Development & Customization

### Adding Custom Architectural Rules (Backend)
1. Add new guidelines inside the `app/prompts/architecture_validation.yml`.
2. The AI uses these static prompts as a "rule engine" to verify pull requests against your custom organizational standards (e.g. "Always use dependency injection for database services.").

### Frontend State and Theming
- **State Management**: Zustand and `@tanstack/react-query`.
- **Theming**: `next-themes` is preconfigured to support Dark/Light modes gracefully using Tailwind's `dark:` selectors.

