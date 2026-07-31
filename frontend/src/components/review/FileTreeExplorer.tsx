'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, FileCode, FolderOpen, Folder } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { FileAnalysis, InlineComment } from '@/types/api';
import { cn } from '@/lib/utils';

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  fileAnalysis?: FileAnalysis;
}

function buildTree(files: FileAnalysis[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [] };

  for (const fa of files) {
    const parts = fa.file_path.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          isDir: !isLast,
          children: [],
          fileAnalysis: isLast ? fa : undefined,
        };
        node.children.push(child);
      }
      node = child;
    }
  }

  return root;
}

function countVariant(count: number): 'secondary' | 'destructive' | 'default' {
  if (count === 0) return 'secondary';
  if (count >= 5) return 'destructive';
  return 'default';
}

interface NodeProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function TreeNodeRow({ node, depth, selectedPath, onSelect }: NodeProps) {
  const [open, setOpen] = useState(depth < 2);

  if (node.isDir && node.children.length === 0) return null;

  if (node.isDir) {
    return (
      <div>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs hover:bg-muted/60"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[var(--sev-medium)]" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--sev-medium)]" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {open &&
          node.children.map((child) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const count = node.fileAnalysis?.findings_count ?? 0;
  const isSelected = selectedPath === node.path;

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors',
        isSelected
          ? 'bg-primary/12 text-primary font-medium'
          : 'hover:bg-muted/60 text-foreground/80',
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => onSelect(node.path)}
    >
      <FileCode className="h-3.5 w-3.5 shrink-0 text-sky-400" />
      <span className="flex-1 truncate font-mono">{node.name}</span>
      {count > 0 && (
        <Badge variant={countVariant(count)} className="h-4 px-1.5 py-0 text-[10px] tabular-nums">
          {count}
        </Badge>
      )}
    </button>
  );
}

function FilePanel({ fileAnalysis }: { fileAnalysis: FileAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FileCode className="h-4 w-4 text-sky-400" />
        <span className="font-mono text-sm font-medium break-all">{fileAnalysis.file_path}</span>
        <Badge variant="outline" className="text-[10px] capitalize">
          {fileAnalysis.language}
        </Badge>
        <Badge variant={countVariant(fileAnalysis.findings_count)} className="text-[10px] tabular-nums">
          {fileAnalysis.findings_count} finding
          {fileAnalysis.findings_count !== 1 ? 's' : ''}
        </Badge>
      </div>

      {fileAnalysis.inline_comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No issues found in this file.</p>
      ) : (
        <div className="space-y-2">
          {fileAnalysis.inline_comments.map((c: InlineComment, i: number) => (
            <div
              key={i}
              className={cn(
                'rounded-r-md border-l-2 p-3 text-sm',
                c.severity === 'critical' || c.severity === 'high'
                  ? 'border-l-[var(--sev-high)] bg-[var(--sev-high)]/10'
                  : c.severity === 'medium'
                    ? 'border-l-[var(--sev-medium)] bg-[var(--sev-medium)]/10'
                    : 'border-l-[var(--sev-low)] bg-[var(--sev-low)]/10',
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Line {c.line_number}
                </span>
                {c.severity && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {c.severity}
                  </Badge>
                )}
              </div>
              <p className="leading-relaxed">{c.comment}</p>
              {c.suggestion && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md border border-border/50 bg-muted/40 p-2 font-mono text-[11px]">
                  {c.suggestion}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  fileFindings: FileAnalysis[];
}

export default function FileTreeExplorer({ fileFindings }: Props) {
  const defaultPath = useMemo(() => {
    const withIssues = fileFindings.find((f) => f.findings_count > 0);
    return withIssues?.file_path ?? fileFindings[0]?.file_path ?? null;
  }, [fileFindings]);

  const [selectedPath, setSelectedPath] = useState<string | null>(defaultPath);

  useEffect(() => {
    setSelectedPath(defaultPath);
  }, [defaultPath]);

  const tree = useMemo(() => buildTree(fileFindings), [fileFindings]);
  const selectedFile = fileFindings.find((f) => f.file_path === selectedPath);

  return (
    <div className="surface-panel flex min-h-[420px] overflow-hidden">
      <div className="w-64 shrink-0 overflow-y-auto border-r border-border/60 bg-muted/15 py-2">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Files ({fileFindings.length})
        </p>
        {tree.children.map((child) => (
          <TreeNodeRow
            key={child.path}
            node={child}
            depth={0}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />
        ))}
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {selectedFile ? (
          <FilePanel fileAnalysis={selectedFile} />
        ) : (
          <p className="text-sm text-muted-foreground">Select a file to view findings.</p>
        )}
      </div>
    </div>
  );
}
