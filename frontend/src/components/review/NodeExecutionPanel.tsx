'use client';

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { NodeName, NodeStatus } from '@/types/api';

const NODE_LABELS: Record<NodeName, string> = {
  ingest_pr: 'Ingest PR',
  build_project_context: 'Build Project Context',
  architecture_validation: 'Architecture Validation',
  security_scan: 'Security Scan',
  performance_check: 'Performance Check',
  best_practices: 'Best Practices',
  aggregate_findings: 'Aggregate Findings',
  human_escalation: 'Human Escalation',
  generate_inline_comments: 'Generate Inline Comments',
  generate_pr_summary: 'Generate PR Summary',
};

const PARALLEL_NODES: NodeName[] = [
  'architecture_validation',
  'security_scan',
  'performance_check',
  'best_practices',
];

const SEQUENTIAL_NODES: { node: NodeName; label: string }[] = [
  { node: 'ingest_pr', label: 'Ingest PR' },
  { node: 'build_project_context', label: 'Build Project Context' },
  { node: 'aggregate_findings', label: 'Aggregate Findings' },
  { node: 'human_escalation', label: 'Human Escalation' },
  { node: 'generate_inline_comments', label: 'Generate Inline Comments' },
  { node: 'generate_pr_summary', label: 'Generate PR Summary' },
];

function StatusIcon({ status }: { status: NodeStatus }) {
  if (status === 'complete')
    return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === 'running')
    return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />;
}

interface Props {
  nodeStatuses: Partial<Record<NodeName, NodeStatus>>;
  nodeTimings: Partial<Record<NodeName, number>>;
  totalElapsedMs?: number;
  isComplete?: boolean;
}

export default function NodeExecutionPanel({
  nodeStatuses,
  nodeTimings,
  totalElapsedMs,
  isComplete,
}: Props) {
  const parallelStatuses = PARALLEL_NODES.map((n) => nodeStatuses[n] ?? 'pending');
  const allParallelComplete = parallelStatuses.every((s) => s === 'complete');
  const anyParallelRunning = parallelStatuses.some((s) => s === 'running');
  const parallelGroupStatus: NodeStatus = allParallelComplete
    ? 'complete'
    : anyParallelRunning
    ? 'running'
    : 'pending';

  const renderRow = (node: NodeName, label: string) => {
    const status = nodeStatuses[node] ?? 'pending';
    const timing = nodeTimings[node];
    return (
      <div key={node} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
        <StatusIcon status={status} />
        <span className="text-xs text-foreground/70 flex-1">{label}</span>
        {status === 'complete' && timing != null && (
          <span className="text-xs text-muted-foreground tabular-nums">{timing} ms</span>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-4 space-y-0.5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground/80">Execution Pipeline</h3>
        {totalElapsedMs != null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {(totalElapsedMs / 1000).toFixed(1)}s total
          </span>
        )}
      </div>

      {renderRow('ingest_pr', 'Ingest PR')}
      {renderRow('build_project_context', 'Build Project Context')}

      {/* Parallel analysis group */}
      <div className="border border-border/40 rounded-lg p-2 my-1 bg-muted/10">
        <div className="flex items-center gap-2 mb-2 px-1">
          <StatusIcon status={parallelGroupStatus} />
          <span className="text-xs font-semibold text-foreground/60">Parallel Analysis</span>
          {allParallelComplete && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {PARALLEL_NODES.reduce((sum, n) => sum + (nodeTimings[n] ?? 0), 0)} ms combined
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {PARALLEL_NODES.map((node) => {
            const status = nodeStatuses[node] ?? 'pending';
            const timing = nodeTimings[node];
            return (
              <div
                key={node}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/20"
              >
                <StatusIcon status={status} />
                <span className="text-xs text-foreground/60 truncate">{NODE_LABELS[node]}</span>
                {status === 'complete' && timing != null && (
                  <span className="ml-auto text-xs text-muted-foreground shrink-0 tabular-nums">
                    {timing} ms
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {renderRow('aggregate_findings', 'Aggregate Findings')}
      {renderRow('human_escalation', 'Human Escalation')}
      {renderRow('generate_inline_comments', 'Generate Inline Comments')}
      {renderRow('generate_pr_summary', 'Generate PR Summary')}

      {isComplete && (
        <div className="pt-2 mt-1 border-t border-border/30 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            Review Complete
          </span>
        </div>
      )}
    </div>
  );
}
