'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, Zap, BookOpen, Building2, AlertTriangle } from 'lucide-react';

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
}

function getSeverityVariant(level: string | null): 'destructive' | 'default' | 'secondary' | 'outline' {
  switch (level?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    default:
      return 'secondary';
  }
}

function getSeverityColor(level: string | null): string {
  switch (level?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'text-red-600 dark:text-red-400';
    case 'medium':
      return 'text-yellow-600 dark:text-yellow-400';
    default:
      return 'text-green-600 dark:text-green-400';
  }
}

const scorecards = [
  {
    key: 'architecture' as const,
    label: 'Architecture',
    Icon: Building2,
    color: 'text-blue-500',
    bgLight: 'bg-blue-500/10',
    border: 'border-blue-500/20 hover:border-blue-500/50',
    shadow: 'hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]'
  },
  {
    key: 'security' as const,
    label: 'Security',
    Icon: ShieldAlert,
    color: 'text-red-500',
    bgLight: 'bg-red-500/10',
    border: 'border-red-500/20 hover:border-red-500/50',
    shadow: 'hover:shadow-[0_0_15px_rgba(239,68,68,0.15)]'
  },
  {
    key: 'performance' as const,
    label: 'Performance',
    Icon: Zap,
    color: 'text-yellow-500',
    bgLight: 'bg-yellow-500/10',
    border: 'border-yellow-500/20 hover:border-yellow-500/50',
    shadow: 'hover:shadow-[0_0_15px_rgba(234,179,8,0.15)]'
  },
  {
    key: 'best_practices' as const,
    label: 'Best Practices',
    Icon: BookOpen,
    color: 'text-green-500',
    bgLight: 'bg-green-500/10',
    border: 'border-green-500/20 hover:border-green-500/50',
    shadow: 'hover:shadow-[0_0_15px_rgba(34,197,94,0.15)]'
  },
];

export default function AnalysisSummaryPanel({
  severityLevel,
  requiresHumanReview,
  findingsCount,
  summaryText,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 bg-card/50 backdrop-blur-sm border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Severity</span>
            <Badge variant={getSeverityVariant(severityLevel)} className="text-sm px-4 py-1.5 font-bold tracking-wide rounded-md shadow-sm">
              <span className={getSeverityColor(severityLevel)}>
                {severityLevel?.toUpperCase() ?? 'UNKNOWN'}
              </span>
            </Badge>
          </div>
          <div className="h-10 w-px bg-border/50 mx-2" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Issues</span>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              {findingsCount.total}
            </span>
          </div>
        </div>
      </div>

      {requiresHumanReview && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-yellow-500/5 p-4 text-yellow-700 dark:text-yellow-400 shadow-sm animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" />
          <span className="text-sm font-medium tracking-wide">Human review is strictly required for this submission.</span>
        </div>
      )}

      {summaryText && (
        <div className="bg-muted/30 p-4 rounded-xl border border-border/50 backdrop-blur-sm">
          <p className="text-sm text-foreground/90 leading-relaxed font-medium">{summaryText}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {scorecards.map(({ key, label, Icon, color, bgLight, border, shadow }) => (
          <Card
            key={key}
            className={`relative overflow-hidden transition-all duration-300 transform hover:-translate-y-1 hover:bg-card/80 backdrop-blur-sm ${border} ${shadow} cursor-default group`}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-2xl opacity-50 transition-opacity group-hover:opacity-70 ${bgLight}`} />
            <CardHeader className="pb-2 pt-5 relative z-10 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground/80">{label}</CardTitle>
              <div className={`p-2 rounded-lg ${bgLight}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </CardHeader>
            <CardContent className="pb-5 relative z-10">
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold tracking-tighter">{findingsCount[key]}</span>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Issues</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
