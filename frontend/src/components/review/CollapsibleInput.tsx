'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

/** Collapsible input chrome — collapses after submit so results dominate. */
export default function CollapsibleInput({
  title,
  description,
  collapsed,
  onToggle,
  children,
  className,
}: Props) {
  return (
    <div className={cn('surface-panel overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {!collapsed && description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
          )}
          {collapsed && (
            <p className="text-xs text-muted-foreground mt-0.5">Input collapsed — expand to edit</p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs shrink-0"
          onClick={onToggle}
        >
          {collapsed ? (
            <>
              Edit input <ChevronDown className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Collapse <ChevronUp className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>
      {!collapsed && <div className="p-4">{children}</div>}
    </div>
  );
}

export function useCollapsibleInput(initialCollapsed = false) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  return {
    collapsed,
    setCollapsed,
    collapse: () => setCollapsed(true),
    expand: () => setCollapsed(false),
    toggle: () => setCollapsed((c) => !c),
  };
}
