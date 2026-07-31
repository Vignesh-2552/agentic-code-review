'use client';

import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { Badge } from '@/components/ui/badge';
import type { InlineComment } from '@/types/api';
import { cn } from '@/lib/utils';

const ReactDiffViewer = dynamic(() => import('react-diff-viewer-continued'), { ssr: false });

interface CommentsByLine {
  [key: string]: InlineComment[];
}

function buildCommentMap(comments: InlineComment[]): CommentsByLine {
  return comments.reduce<CommentsByLine>((acc, c) => {
    const key = `${c.file_path}:${c.line_number}`;
    acc[key] = acc[key] ?? [];
    acc[key].push(c);
    return acc;
  }, {});
}

function severityColor(severity?: string) {
  switch (severity?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'border-l-[var(--sev-high)] bg-[var(--sev-high)]/10';
    case 'medium':
      return 'border-l-[var(--sev-medium)] bg-[var(--sev-medium)]/10';
    default:
      return 'border-l-[var(--sev-low)] bg-[var(--sev-low)]/10';
  }
}

interface CommentThreadProps {
  comments: InlineComment[];
}

function CommentThread({ comments }: CommentThreadProps) {
  return (
    <div className="space-y-2 border-y border-border/50 bg-muted/20 px-3 py-2">
      {comments.map((c, i) => (
        <div key={i} className={cn('rounded-r-md border-l-2 p-2.5 text-sm', severityColor(c.severity))}>
          <div className="mb-1 flex items-center gap-2">
            {c.severity && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {c.severity}
              </Badge>
            )}
            <span className="font-mono text-[10px] text-muted-foreground">
              {c.file_path}:{c.line_number}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed">{c.comment}</p>
          {c.suggestion && (
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md border border-border/50 bg-background/60 p-2 font-mono text-[11px]">
              {c.suggestion}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

interface Props {
  gitDiff: string;
  inlineComments: InlineComment[];
  highlightLine?: number | null;
  className?: string;
}

export default function CodeDiffViewer({
  gitDiff,
  inlineComments,
  highlightLine,
  className,
}: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const commentMap = buildCommentMap(inlineComments);

  const lines = gitDiff.split('\n');
  const oldLines: string[] = [];
  const newLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('-') && !line.startsWith('---')) {
      oldLines.push(line.slice(1));
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      newLines.push(line.slice(1));
    } else if (!line.startsWith('\\')) {
      oldLines.push(line.startsWith(' ') ? line.slice(1) : line);
      newLines.push(line.startsWith(' ') ? line.slice(1) : line);
    }
  }

  // Group comments for rendering under the diff as GitHub-style threads
  // (react-diff-viewer doesn't support per-line React slots cleanly across versions)
  const threads = Object.entries(commentMap).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div id="diff-viewer" className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Diff
        </h3>
        {inlineComments.length > 0 && (
          <Badge variant="secondary" className="font-mono text-[10px] tabular-nums">
            {inlineComments.length} comment{inlineComments.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60 text-xs font-mono">
        <ReactDiffViewer
          oldValue={oldLines.join('\n')}
          newValue={newLines.join('\n')}
          splitView={false}
          useDarkTheme={isDark}
          hideLineNumbers={false}
          highlightLines={
            highlightLine != null ? [`R-${highlightLine}`] : undefined
          }
        />
      </div>

      {threads.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Review threads
          </h4>
          {threads.map(([key, comments]) => (
            <div
              key={key}
              id={`comment-${key.replace(/[^a-zA-Z0-9:_-]/g, '_')}`}
              className="surface-panel overflow-hidden"
            >
              <div className="border-b border-border/50 bg-muted/20 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                {key}
              </div>
              <CommentThread comments={comments} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
