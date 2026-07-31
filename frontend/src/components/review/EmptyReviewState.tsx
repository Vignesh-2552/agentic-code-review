'use client';

import { FileQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description: string;
  example?: string;
  className?: string;
}

export default function EmptyReviewState({ title, description, example, className }: Props) {
  return (
    <div
      className={cn(
        'surface-panel flex flex-col items-center justify-center text-center px-6 py-16',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        <FileQuestion className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed">{description}</p>
      {example && (
        <code className="mt-4 max-w-lg rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-left text-[11px] font-mono text-muted-foreground break-all">
          {example}
        </code>
      )}
    </div>
  );
}
