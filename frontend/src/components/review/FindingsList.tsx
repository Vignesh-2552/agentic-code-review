'use client';

import { useMemo } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import type { FindingItem } from '@/types/api';
import type { FindingCategory } from '@/store/reviewStore';
import { cn } from '@/lib/utils';

export interface CategorizedFinding extends FindingItem {
  category: Exclude<FindingCategory, 'all'>;
}

interface Props {
  findings: CategorizedFinding[];
  filter: FindingCategory;
  onLocate?: (finding: CategorizedFinding) => void;
  className?: string;
}

const CATEGORY_LABEL: Record<Exclude<FindingCategory, 'all'>, string> = {
  architecture: 'Architecture',
  security: 'Security',
  performance: 'Performance',
  best_practices: 'Best Practices',
};

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function severityVariant(severity?: string): 'destructive' | 'default' | 'secondary' | 'outline' {
  switch (severity?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    default:
      return 'secondary';
  }
}

function severityBorder(severity?: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'border-l-[var(--sev-high)]';
    case 'medium':
      return 'border-l-[var(--sev-medium)]';
    default:
      return 'border-l-[var(--sev-low)]';
  }
}

export default function FindingsList({ findings, filter, onLocate, className }: Props) {
  const filtered = useMemo(() => {
    const list = filter === 'all' ? findings : findings.filter((f) => f.category === filter);
    return [...list].sort((a, b) => {
      const ra = SEVERITY_RANK[String(a.severity ?? '').toLowerCase()] ?? 5;
      const rb = SEVERITY_RANK[String(b.severity ?? '').toLowerCase()] ?? 5;
      return ra - rb;
    });
  }, [findings, filter]);

  const title =
    filter === 'all' ? 'All Findings' : CATEGORY_LABEL[filter];

  if (filtered.length === 0) {
    return (
      <div className={cn('surface-panel flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">No issues in this category.</p>
      </div>
    );
  }

  return (
    <div
      key={filter}
      className={cn('surface-panel overflow-hidden animate-findings-in', className)}
    >
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <Badge variant="secondary" className="font-mono text-[10px] tabular-nums">
          {filtered.length}
        </Badge>
      </div>

      <Accordion type="multiple" className="px-2 py-2">
        {filtered.map((item, idx) => {
          const file = (item.file as string | undefined) ?? undefined;
          const line =
            typeof item.line === 'number'
              ? item.line
              : typeof item.line_number === 'number'
                ? item.line_number
                : undefined;

          return (
            <AccordionItem
              key={`${item.category}-${idx}`}
              value={`item-${idx}`}
              className={cn('mb-1.5 rounded-md border-l-2 border-b-0 last:mb-0', severityBorder(item.severity))}
            >
              <AccordionTrigger className="rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted/40 hover:no-underline data-[state=open]:bg-muted/30">
                <div className="flex min-w-0 items-start gap-2 pr-3">
                  {item.severity && (
                    <Badge
                      variant={severityVariant(item.severity)}
                      className="mt-0.5 shrink-0 rounded px-1.5 py-0 text-[10px] uppercase tracking-wide"
                    >
                      {item.severity}
                    </Badge>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium leading-snug">
                      {item.description ?? `Finding #${idx + 1}`}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {CATEGORY_LABEL[item.category]}
                      {file != null && (
                        <span className="ml-2 font-mono">
                          {file}
                          {line != null ? `:${line}` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 pt-1">
                <div className="ml-1 space-y-3 border-l border-border/50 pl-3">
                  {item.description && (
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  {(item.recommendation != null || item.optimization != null) && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Recommendation
                      </p>
                      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-[12px] text-foreground/90">
                        {String(item.recommendation ?? item.optimization ?? '')}
                      </pre>
                    </div>
                  )}
                  {(file != null || line != null) && (
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors',
                        onLocate && 'hover:border-primary/40 hover:text-primary cursor-pointer',
                      )}
                      onClick={() => onLocate?.(item)}
                      disabled={!onLocate}
                    >
                      {file ?? 'snippet'}
                      {line != null ? `:${line}` : ''}
                    </button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

/** Helper to merge category buckets into a flat list for FindingsList. */
export function flattenFindings(buckets: {
  architecture?: FindingItem[];
  security?: FindingItem[];
  performance?: FindingItem[];
  best_practices?: FindingItem[];
}): CategorizedFinding[] {
  const out: CategorizedFinding[] = [];
  for (const item of buckets.architecture ?? []) {
    out.push({ ...item, category: 'architecture' });
  }
  for (const item of buckets.security ?? []) {
    out.push({ ...item, category: 'security' });
  }
  for (const item of buckets.performance ?? []) {
    out.push({ ...item, category: 'performance' });
  }
  for (const item of buckets.best_practices ?? []) {
    out.push({ ...item, category: 'best_practices' });
  }
  return out;
}
