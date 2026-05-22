'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import type { FindingItem } from '@/types/api';

interface Props {
  title: string;
  items: FindingItem[];
  colorClass?: string;
}

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

export default function CardDisplay({ title, items, colorClass = '' }: Props) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center space-y-2 h-full min-h-[150px]">
        <h3 className={`text-sm font-semibold tracking-wide uppercase ${colorClass}`}>{title}</h3>
        <p className="text-sm text-muted-foreground/70">No issues found. Excellent work!</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
        <h3 className={`text-sm font-bold tracking-wider uppercase ${colorClass}`}>{title}</h3>
        <Badge variant="secondary" className="text-xs font-mono font-bold shrink-0 bg-background/80 shadow-sm border-border/50">
          {items.length} {items.length === 1 ? 'Issue' : 'Issues'}
        </Badge>
      </div>
      <Accordion type="multiple" className="px-3 py-2">
        {items.map((item, idx) => (
          <AccordionItem key={idx} value={`item-${idx}`} className="border-b-0 mb-2 last:mb-0">
            <AccordionTrigger className="text-sm py-3 px-3 hover:no-underline text-left rounded-lg transition-all hover:bg-muted/50 data-[state=open]:bg-muted/30">
              <div className="flex items-start gap-3 min-w-0 pr-4">
                {item.severity && (
                  <Badge variant={severityVariant(item.severity)} className="text-[10px] shrink-0 uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full shadow-sm mt-0.5">
                    {item.severity}
                  </Badge>
                )}
                <span className="text-left font-medium leading-relaxed truncate group-hover:text-foreground/80 transition-colors">
                  {item.description ?? `Finding #${idx + 1}`}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-sm px-3 pt-2 pb-4">
              <div className="pl-4 ml-[11px] border-l-2 border-border/50 space-y-4">
                {item.description && (
                  <p className="text-muted-foreground leading-relaxed text-[13px]">{item.description}</p>
                )}
                {(item.recommendation != null || item.optimization != null) && (
                  <div className="space-y-1.5">
                    <p className="font-semibold text-[11px] text-foreground/60 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                      Recommendation
                    </p>
                    <pre className="text-[13px] bg-background/80 border border-border/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap font-mono text-foreground/90 shadow-inner">
                      {String(item.recommendation ?? item.optimization ?? '')}
                    </pre>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  {item.line != null && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/40 px-2 py-1 rounded-md">
                      <span>Line</span>
                      <span className="font-mono text-foreground/80">{item.line}</span>
                    </div>
                  )}
                  {item.file && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/40 px-2 py-1 rounded-md">
                      <span>File</span>
                      <span className="font-mono text-foreground/80 lowercase truncate max-w-[200px]">{item.file}</span>
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
