'use client';

import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import type { InlineComment } from '@/types/api';

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
      return 'border-red-500 bg-red-50 dark:bg-red-950/20';
    case 'medium':
      return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
    default:
      return 'border-blue-400 bg-blue-50 dark:bg-blue-950/20';
  }
}

interface CommentThreadProps {
  comments: InlineComment[];
}

function CommentThread({ comments }: CommentThreadProps) {
  return (
    <div className="space-y-2 p-2">
      {comments.map((c, i) => (
        <div key={i} className={`border-l-4 rounded-r-md p-3 text-sm ${severityColor(c.severity)}`}>
          <div className="flex items-center gap-2 mb-1">
            {c.severity && (
              <Badge variant="outline" className="text-xs capitalize">
                {c.severity}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {c.file_path}:{c.line_number}
            </span>
          </div>
          <p>{c.comment}</p>
          {c.suggestion && (
            <pre className="mt-2 text-xs bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
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
}

export default function CodeDiffViewer({ gitDiff, inlineComments }: Props) {
  const commentMap = buildCommentMap(inlineComments);

  // Split diff into old/new for the viewer
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

  const hasComments = Object.keys(commentMap).length > 0;

  return (
    <div className="space-y-4">
      {hasComments && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Inline Comments ({inlineComments.length})
          </h3>
          {inlineComments.map((c, i) => (
            <div key={i} className={`border-l-4 rounded-r-md p-3 text-sm ${severityColor(c.severity)}`}>
              <div className="flex items-center gap-2 mb-1">
                {c.severity && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {c.severity}
                  </Badge>
                )}
                <span className="text-xs font-mono text-muted-foreground">
                  {c.file_path}:{c.line_number}
                </span>
              </div>
              <p>{c.comment}</p>
              {c.suggestion && (
                <pre className="mt-2 text-xs bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono">
                  {c.suggestion}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg overflow-hidden border text-xs font-mono">
        <ReactDiffViewer
          oldValue={oldLines.join('\n')}
          newValue={newLines.join('\n')}
          splitView={false}
          useDarkTheme={false}
          hideLineNumbers={false}
        />
      </div>
    </div>
  );
}
