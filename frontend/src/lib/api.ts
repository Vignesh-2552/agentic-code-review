'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  AnalyzeSSEEvent,
  CodeReviewRequest,
  DirectoryReviewRequest,
  DirectoryReviewResponse,
  DirectorySSEEvent,
  FindingItem,
  InlineComment,
  NodeCompleteEvent,
  NodeName,
  NodeStatus,
  PRReviewRequest,
  PRReviewResponse,
  SSEEvent,
  StreamAnalyzeResult,
} from '@/types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface PartialFindings {
  security_vulnerabilities: FindingItem[];
  performance_issues: FindingItem[];
  best_practice_violations: FindingItem[];
  architecture_issues: FindingItem[];
  severity_level: string | null;
  requires_human_review: boolean;
  inline_comments: InlineComment[];
}

const emptyPartialFindings = (): PartialFindings => ({
  security_vulnerabilities: [],
  performance_issues: [],
  best_practice_violations: [],
  architecture_issues: [],
  severity_level: null,
  requires_human_review: false,
  inline_comments: [],
});

const PARALLEL_NODES: NodeName[] = [
  'architecture_validation',
  'security_scan',
  'performance_check',
  'best_practices',
];

function nextRunningStatuses(
  prev: Partial<Record<NodeName, NodeStatus>>,
  completed: NodeName,
): Partial<Record<NodeName, NodeStatus>> {
  const next: Partial<Record<NodeName, NodeStatus>> = {
    ...prev,
    [completed]: 'complete',
  };

  if (completed === 'ingest_pr') {
    next.build_project_context = 'running';
  } else if (completed === 'build_project_context') {
    for (const n of PARALLEL_NODES) next[n] = 'running';
  } else if (PARALLEL_NODES.includes(completed)) {
    const allDone = PARALLEL_NODES.every(
      (n) => n === completed || next[n] === 'complete',
    );
    if (allDone) next.aggregate_findings = 'running';
  } else if (completed === 'aggregate_findings') {
    next.human_escalation = 'running';
  } else if (completed === 'human_escalation') {
    next.generate_inline_comments = 'running';
  } else if (completed === 'generate_inline_comments') {
    next.generate_pr_summary = 'running';
  }

  return next;
}

function mergePartialFindings(
  prev: PartialFindings,
  partial: NodeCompleteEvent['partial_state'],
): PartialFindings {
  return {
    ...prev,
    ...(partial.security_vulnerabilities
      ? { security_vulnerabilities: partial.security_vulnerabilities }
      : {}),
    ...(partial.performance_issues
      ? { performance_issues: partial.performance_issues }
      : {}),
    ...(partial.best_practice_violations
      ? { best_practice_violations: partial.best_practice_violations }
      : {}),
    ...(partial.architecture_issues
      ? { architecture_issues: partial.architecture_issues }
      : {}),
    ...(partial.severity_level !== undefined
      ? { severity_level: partial.severity_level ?? null }
      : {}),
    ...(partial.requires_human_review !== undefined
      ? { requires_human_review: partial.requires_human_review }
      : {}),
    ...(partial.inline_comments
      ? { inline_comments: partial.inline_comments }
      : {}),
  };
}

async function consumeSSE<TEvent extends { type: string }>(
  url: string,
  body: unknown,
  onEvent: (event: TEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      if (typeof payload?.detail === 'string') detail = payload.detail;
      else if (payload?.message) detail = payload.message;
    } catch {
      // keep status-based message
    }
    throw new Error(detail);
  }

  if (!response.body) {
    throw new Error('No response body from stream endpoint');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      onEvent(JSON.parse(raw) as TEvent);
    }
  }
}

function useStreamReview<
  TRequest,
  TResult,
  TEvent extends { type: string },
>(endpoint: string) {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TResult | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<
    Partial<Record<NodeName, NodeStatus>>
  >({});
  const [nodeTimings, setNodeTimings] = useState<
    Partial<Record<NodeName, number>>
  >({});
  const [partialFindings, setPartialFindings] =
    useState<PartialFindings>(emptyPartialFindings);
  const [totalElapsedMs, setTotalElapsedMs] = useState<number | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);

  const mutate = useCallback(
    (variables: TRequest) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsPending(true);
      setIsSuccess(false);
      setError(null);
      setData(null);
      setNodeStatuses({ ingest_pr: 'running' });
      setNodeTimings({});
      setPartialFindings(emptyPartialFindings());
      setTotalElapsedMs(undefined);
      startedAtRef.current = performance.now();

      void (async () => {
        try {
          await consumeSSE<TEvent>(
            `${API_BASE}${endpoint}`,
            variables,
            (event) => {
              if (event.type === 'node_complete') {
                const e = event as unknown as NodeCompleteEvent;
                setNodeStatuses((prev) => nextRunningStatuses(prev, e.node));
                setNodeTimings((prev) => ({
                  ...prev,
                  [e.node]: e.execution_time_ms,
                }));
                setPartialFindings((prev) =>
                  mergePartialFindings(prev, e.partial_state),
                );
                setTotalElapsedMs(performance.now() - startedAtRef.current);
              } else if (event.type === 'complete') {
                const e = event as unknown as { type: 'complete'; result: TResult };
                setData(e.result);
                setIsSuccess(true);
                setTotalElapsedMs(performance.now() - startedAtRef.current);
              } else if (event.type === 'error') {
                const e = event as unknown as { type: 'error'; message: string };
                throw new Error(e.message || 'Streaming review failed');
              }
            },
            controller.signal,
          );
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsSuccess(false);
        } finally {
          if (!controller.signal.aborted) {
            setIsPending(false);
            setTotalElapsedMs((prev) =>
              prev ?? performance.now() - startedAtRef.current,
            );
          }
        }
      })();
    },
    [endpoint],
  );

  return {
    mutate,
    isPending,
    error,
    data,
    isSuccess,
    nodeStatuses,
    nodeTimings,
    partialFindings,
    totalElapsedMs,
  };
}

export function useStreamAnalyzeCode() {
  return useStreamReview<
    CodeReviewRequest,
    StreamAnalyzeResult,
    AnalyzeSSEEvent
  >('/api/v1/review/analyze/stream');
}

export function useStreamPRReview() {
  return useStreamReview<
    PRReviewRequest,
    Omit<PRReviewResponse, 'processing_time_seconds'>,
    SSEEvent
  >('/api/v1/review/pr/stream');
}

export function useStreamDirectoryReview() {
  return useStreamReview<
    DirectoryReviewRequest,
    Omit<DirectoryReviewResponse, 'processing_time_seconds'>,
    DirectorySSEEvent
  >('/api/v1/review/directory/stream');
}
