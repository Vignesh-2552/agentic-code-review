'use client';

import { cn } from '@/lib/utils';

interface Props {
  pipeline: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Two-column review workspace: sticky pipeline rail + main content. */
export default function ReviewWorkspace({ pipeline, children, className }: Props) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]', className)}>
      <aside className="lg:sticky lg:top-16 lg:self-start">{pipeline}</aside>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}
