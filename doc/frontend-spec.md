# Code Review Agent - Frontend Specification (V2)

## Overview
The Frontend for the Code Review Agent V2 transforms the complex JSON outputs from our LangGraph backend into an intuitive, actionable dashboard. It enables developers to seamlessly review single-file snippets or comprehensive multi-file Pull Requests through interactive diff viewers and architectural scorecards.

## Core Technologies
- **Framework**: Next.js (React 18+, App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI (for accessible, rapid component design)
- **Formatting**: Monaco Editor or `react-diff-viewer` (for rendering code and inline git-diffs)
- **State Management**: React Query (for async data fetching) + Zustand (for local UI state)

---

## Key User Workflows

### 1. Single Snippet Review (V1 Compatibility)
- **Input**: A developer pastes a direct GitHub Raw/Blob URL into a prominent search bar.
- **Processing**: The UI displays a loading skeleton (since the backend LangGraph can take 10-20 seconds to run multiple LLM queries).
- **Output View**: Displays the raw code snippet. Inline annotations (squiggles or highlight blocks) mark lines where syntax, security, or performance issues were found.
- **Backend Touchpoint**: `POST /review/analyze`

### 2. Pull Request Review Dashboard (V2 Focus)
- **Input**: A developer submits a repository URL and a Pull Request ID.
- **Processing**: The frontend fetches the PR's `git_diff` and `commit_messages` (via GitHub/GitLab API proxy on the backend) and submits the payload. **Crucially, the frontend consumes a streamed response (e.g., Server-Sent Events or chunked JSON)** to receive partial findings and node-specific execution times as the backend parallel nodes complete, rather than waiting 10-20 seconds for a monolithic response.
- **Output View**: 
  - **Summary Header**: Shows the `severity_level` (Critical, High, Medium, Low) and whether the PR `requires_human_escalation`.
  - **Scorecards**: Four distinct cards showing the count of issues found across *Architecture*, *Security*, *Performance*, and *Best Practices*.
  - **Diff Viewer**: A split-pane or unified git diff view. V2's `inline_comments` are rendered directly beneath the corresponding lines of code, exactly like GitHub's native PR review interface.
- **Backend Touchpoint**: `POST /review/pr`

### 3. Planned V3: Directory/Folder Review
- **Input**: A developer pastes a GitHub repository folder link (e.g. `.../tree/main/src/components`).
- **Processing**: The backend recursively fetches the contents of the folder, aggregating the files into a deep analysis context. Given the high token volume, the UI will display a specialized multi-stage progress bar showing which files are currently being analyzed.
- **Output View**: A file-tree explorer sidebar. Clicking a file reveals the specific LLM architectural feedback and security vulnerabilities found inside that file relative to its sibling files.
- **Backend Touchpoint**: `POST /review/directory` (Proposed)

---

## UI Component Architecture

### `DashboardLayout`
The root layout providing navigation between "Single Snippet" and "Pull Request" modes, a dark/light mode toggle, and global error boundaries.

### `ReviewInputForm`
A dynamic form that shapes itself based on the selected mode:
- Single mode: Single input field for `github_url`.
- PR mode: Inputs for Repository, PR Number, and an optional text area for additional `context` or `pr_description`.

### `AnalysisSummaryPanel`
Renders the high-level `pr_summary`:
- **Status Badge**: Green (Approved), Yellow (Suggestions), Red (Changes Requested / Escalation).
- **Pillars**: visual graphs showing the breakdown from the `findings_count` dictionary.

### `CodeDiffViewer`
The core interactive component.
- Takes the raw `git_diff` string and renders it.
- Parses the `inline_comments` array. For each comment, it matches the `file_path` and `line_number`, injecting a `CommentThread` React component immediately below that line in the diff viewer.

### `CardDisplay` (For specific findings)
Collapsible accordion menus mapping to the individual arrays in the JSON response (e.g., `security_vulnerabilities`, `best_practice_violations`).
Each card shows:
- **Severity Badge**
- **Description**
- **Recommendation/Optimization** snippet

### `NodeExecutionPanel`
Live execution status panel shown during PR review streaming. Displays each LangGraph node as a row with:
- **Status indicator**: `pending` (grey dot) → `running` (animated spinner) → `complete` (green checkmark)
- **Node label**: Human-readable name (e.g., "Security Scan", "Architecture Validation")
- **Execution time**: Shown in milliseconds once the node completes (e.g., `2341 ms`)
- **Parallel group indicator**: The four parallel analysis nodes (`architecture_validation`, `security_scan`, `performance_check`, `best_practices`) are grouped visually with a bracket, making it clear they run concurrently.

Node display order matches the graph execution sequence:
1. Ingest PR
2. Build Project Context
3. *(parallel group)* Architecture Validation · Security Scan · Performance Check · Best Practices
4. Aggregate Findings
5. Human Escalation *(conditional)*
6. Generate Inline Comments
7. Generate PR Summary

As each `node_complete` SSE event arrives, the corresponding row updates from running → complete with the received `execution_time_ms`. Once the `complete` event fires, the panel collapses or transitions to a summary row showing total elapsed time.

---

## SSE Event Contract

The `/review/pr/stream` endpoint streams `text/event-stream` data. Each line is prefixed `data: ` followed by a JSON object.

### Event Types

#### `node_complete`
Emitted when a LangGraph node finishes. Contains the partial state updated by that node.

```json
{
  "type": "node_complete",
  "node": "security_scan",
  "execution_time_ms": 2341,
  "partial_state": {
    "security_vulnerabilities": [
      {
        "severity": "high",
        "description": "SQL injection risk in query builder",
        "line_number": 42,
        "recommendation": "Use parameterised queries"
      }
    ]
  }
}
```

Possible `node` values (in execution order):
| Node | `partial_state` keys |
|------|----------------------|
| `ingest_pr` | `changed_files` |
| `build_project_context` | `project_context` |
| `architecture_validation` | `architecture_issues` |
| `security_scan` | `security_vulnerabilities` |
| `performance_check` | `performance_issues` |
| `best_practices` | `best_practice_violations` |
| `aggregate_findings` | `all_findings`, `severity_level` |
| `human_escalation` | `requires_human_review` |
| `generate_inline_comments` | `inline_comments` |
| `generate_pr_summary` | `pr_summary`, `review_complete` |

#### `complete`
Emitted once as the final event. Contains the full `PRReviewResponse`-equivalent result.

```json
{
  "type": "complete",
  "result": {
    "requires_human_review": false,
    "review_complete": true,
    "severity_level": "medium",
    "inline_comments": [...],
    "pr_summary": {
      "approval_status": "approved_with_suggestions",
      "summary_text": "...",
      "key_findings": [...],
      "positive_aspects": [...],
      "blocking_issues": [],
      "non_blocking_suggestions": [...]
    },
    "findings_count": {
      "total": 5,
      "architecture": 1,
      "security": 2,
      "performance": 1,
      "best_practices": 1
    }
  }
}
```

#### `error`
Emitted if the backend encounters an unrecoverable error mid-stream.

```json
{
  "type": "error",
  "message": "LLM rate limit exceeded"
}
```

---

## API Integration Map

### 1. `POST /review/analyze` (Single File)
**Request Payload:**
```json
{
  "github_url": "https://github.com/user/repo/blob/main/app.py",
  "context": "Check if my auth logic is safe."
}
```
**UI Mapping:** The frontend state stores the returned lists (`security_vulnerabilities`, etc.) and renders them as side-by-side cards next to a standard Monaco code editor view.

### 2. `POST /review/pr` (Blocking — kept for backward compatibility)
**Request Payload:**
```json
{
  "git_diff": "diff --git a/main.py b/main.py...",
  "pr_title": "feat: add user auth",
  "pr_description": "Implements JWT login",
  "commit_messages": ["add jwt lib", "wire up router"]
}
```
**UI Mapping:** Returns a single `PRReviewResponse` JSON after all nodes complete (10-20 s). Use `/review/pr/stream` instead for live updates.

### 3. `POST /review/pr/stream` (Streaming SSE — preferred)
**Request Payload:** Identical to `/review/pr`.

**Consuming with `fetch` + `ReadableStream` (recommended):**
```typescript
async function streamPRReview(payload: PRReviewRequest, onEvent: (e: SSEEvent) => void) {
  const response = await fetch("/api/v1/review/pr/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        onEvent(JSON.parse(line.slice(6)));
      }
    }
  }
}
```

**Consuming with `EventSource` (simpler, GET-only limitation workaround via POST proxy):**
```typescript
// Since EventSource only supports GET, use fetch-based approach above for POST.
// Alternatively, expose a GET /review/pr/stream?token=<job_id> endpoint that
// replays a pre-enqueued job — a future V3 enhancement.
```

**Real-time state flow:**
1. Submit → show `NodeExecutionPanel` with all rows in `pending` state.
2. `ingest_pr` `node_complete` → row 1 goes green; `changed_files` stored locally.
3. `build_project_context` `node_complete` → row 2 goes green.
4. Four parallel `node_complete` events arrive in any order → each corresponding scorecard card updates its count immediately as findings arrive (Architecture, Security, Performance, Best Practices). All four rows go green once received.
5. `aggregate_findings` `node_complete` → `severity_level` badge updates in the Summary Header.
6. `generate_inline_comments` `node_complete` → `CodeDiffViewer` renders inline comments overlaid on the diff.
7. `generate_pr_summary` `node_complete` → `AnalysisSummaryPanel` renders the final approval status and `summary_text`.
8. `complete` event → `NodeExecutionPanel` transitions to a compact summary; full result stored for export.
