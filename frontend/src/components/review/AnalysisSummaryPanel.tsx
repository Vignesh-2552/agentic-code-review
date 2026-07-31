'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ShieldAlert,
  Zap,
  BookOpen,
  Building2,
  AlertTriangle,
  LayoutGrid,
} from 'lucide-react';
import type { FindingCategory } from '@/store/reviewStore';
import { cn } from '@/lib/utils';

interface FindingsCount {
  total: number;
  architecture: number;
  security: number;
  performance: number;
  best_practices: number;
}

interface Props {
  severityLevel: string | null;
  requiresHumanReview: boolean;
  findingsCount: FindingsCount;
  summaryText?: string;
  activeFilter?: FindingCategory;
  onFilterChange?: (filter: FindingCategory) => void;
}

function severityClass(level: string | null): string {
  switch (level?.toLowerCase()) {
    case 'critical':
      return 'sev-critical';
    case 'high':
      return 'sev-high';
    case 'medium':
      return 'sev-medium';
    default:
      return 'sev-low';
  }
}

function severityRing(level: string | null): string {
  switch (level?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'ring-[var(--sev-high)]/40 bg-[var(--sev-high)]/10';
    case 'medium':
      return 'ring-[var(--sev-medium)]/40 bg-[var(--sev-medium)]/10';
    default:
      return 'ring-[var(--sev-low)]/40 bg-[var(--sev-low)]/10';
  }
}

const scorecards: {
  key: Exclude<FindingCategory, 'all'>;
  label: string;
  Icon: typeof Building2;
  accent: string;
  ring: string;
}[] = [
  {
    key: 'architecture',
    label: 'Architecture',
    Icon: Building2,
    accent: 'text-sky-500',
    ring: 'ring-sky-500/50',
  },
  {
    key: 'security',
    label: 'Security',
    Icon: ShieldAlert,
    accent: 'sev-high',
    ring: 'ring-[var(--sev-high)]/50',
  },
  {
    key: 'performance',
    label: 'Performance',
    Icon: Zap,
    accent: 'sev-medium',
    ring: 'ring-[var(--sev-medium)]/50',
  },
  {
    key: 'best_practices',
    label: 'Best Practices',
    Icon: BookOpen,
    accent: 'sev-low',
    ring: 'ring-[var(--sev-low)]/50',
  },
];

export default function AnalysisSummaryPanel({
  severityLevel,
  requiresHumanReview,
  findingsCount,
  summaryText,
  activeFilter = 'all',
  onFilterChange,
}: Props) {
  const interactive = Boolean(onFilterChange);

  return (
    <div className="space-y-4">
      <div className="surface-panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Severity
            </span>
            <span
              className={cn(
                'inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide ring-1',
                severityRing(severityLevel),
                severityClass(severityLevel),
              )}
            >
              {severityLevel?.toUpperCase() ?? 'UNKNOWN'}
            </span>
          </div>
          <div className="h-8 w-px bg-border/60" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Issues
            </span>
            <span className="text-2xl font-bold tabular-nums tracking-tight">
              {findingsCount.total}
            </span>
          </div>
        </div>

        {interactive && (
          <button
            type="button"
            onClick={() => onFilterChange?.('all')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              activeFilter === 'all'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground hover:bg-muted/50',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            All
          </button>
        )}
      </div>

      {requiresHumanReview && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--sev-medium)]/30 bg-[var(--sev-medium)]/10 p-3 text-[var(--sev-medium)]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">Human review required for this submission.</span>
        </div>
      )}

      {summaryText && (
        <div className="surface-panel p-4">
          <p className="text-sm leading-relaxed text-foreground/90">{summaryText}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {scorecards.map(({ key, label, Icon, accent, ring }) => {
          const selected = activeFilter === key;
          return (
            <Card
              key={key}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={() => {
                if (!interactive) return;
                onFilterChange?.(selected ? 'all' : key);
              }}
              onKeyDown={(e) => {
                if (!interactive) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onFilterChange?.(selected ? 'all' : key);
                }
              }}
              className={cn(
                'relative overflow-hidden border-border/60 bg-card transition-all duration-200',
                interactive && 'cursor-pointer hover:bg-muted/30',
                selected && cn('ring-2', ring, 'bg-muted/20'),
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={cn('h-3.5 w-3.5', accent)} />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <span className="text-3xl font-bold tabular-nums tracking-tight">
                  {findingsCount[key]}
                </span>
                <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  issues
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
