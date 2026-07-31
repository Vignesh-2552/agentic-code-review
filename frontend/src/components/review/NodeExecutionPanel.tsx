'use client';

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { NodeName, NodeStatus } from '@/types/api';
import { cn } from '@/lib/utils';

const NODE_LABELS: Record<NodeName, string> = {
  ingest_pr: 'Ingest PR',
  build_project_context: 'Build Context',
  architecture_validation: 'Architecture',
  security_scan: 'Security',
  performance_check: 'Performance',
  best_practices: 'Best Practices',
  aggregate_findings: 'Aggregate',
  human_escalation: 'Escalation',
  generate_inline_comments: 'Inline Comments',
  generate_pr_summary: 'PR Summary',
};

const PARALLEL_NODES: NodeName[] = [
  'architecture_validation',
  'security_scan',
  'performance_check',
  'best_practices',
];

function StatusIcon({ status }: { status: NodeStatus }) {
  if (status === 'complete')
    return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--sev-low)] shrink-0 transition-colors" />;
  if (status === 'running')
    return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />;
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

  const renderRow = (node: NodeName, label: string, compact = false) => {
    const status = nodeStatuses[node] ?? 'pending';
    const timing = nodeTimings[node];
    return (
      <div
        key={node}
        className={cn(
          'flex items-center gap-2 rounded-md px-2 transition-colors',
          compact ? 'py-1' : 'py-1.5',
          status === 'running' && 'bg-primary/8',
          status === 'complete' && 'opacity-90',
        )}
      >
        <StatusIcon status={status} />
        <span
          className={cn(
            'flex-1 truncate text-xs',
            status === 'running' ? 'font-medium text-foreground' : 'text-muted-foreground',
            status === 'complete' && 'text-foreground/80',
          )}
        >
          {label}
        </span>
        {status === 'complete' && timing != null && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {timing}ms
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="surface-panel p-3 space-y-0.5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pipeline
        </h3>
        {totalElapsedMs != null && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {(totalElapsedMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {renderRow('ingest_pr', NODE_LABELS.ingest_pr)}
      {renderRow('build_project_context', NODE_LABELS.build_project_context)}

      <div
        className={cn(
          'my-1 rounded-md border border-border/50 bg-muted/20 p-1.5 transition-colors',
          parallelGroupStatus === 'running' && 'border-primary/30 bg-primary/5',
        )}
      >
        <div className="mb-1 flex items-center gap-2 px-1">
          <StatusIcon status={parallelGroupStatus} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Parallel
          </span>
          {allParallelComplete && (
            <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
              {PARALLEL_NODES.reduce((sum, n) => sum + (nodeTimings[n] ?? 0), 0)}ms
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-0.5">
          {PARALLEL_NODES.map((node) => renderRow(node, NODE_LABELS[node], true))}
        </div>
      </div>

      {renderRow('aggregate_findings', NODE_LABELS.aggregate_findings)}
      {renderRow('human_escalation', NODE_LABELS.human_escalation)}
      {renderRow('generate_inline_comments', NODE_LABELS.generate_inline_comments)}
      {renderRow('generate_pr_summary', NODE_LABELS.generate_pr_summary)}

      {isComplete && (
        <div className="mt-2 flex items-center gap-2 border-t border-border/40 pt-2 px-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--sev-low)]" />
          <span className="text-[11px] font-medium text-[var(--sev-low)]">Review complete</span>
        </div>
      )}
    </div>
  );
}
