'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, FileCode, FolderOpen, Folder } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { FileAnalysis, InlineComment } from '@/types/api';

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

function severityColor(count: number) {
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
          className="flex w-full items-center gap-1.5 px-2 py-1 rounded hover:bg-muted text-sm text-left"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
          )}
          <span className="font-medium">{node.name}</span>
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
      className={`flex w-full items-center gap-1.5 px-2 py-1 rounded text-sm text-left transition-colors ${
        isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => onSelect(node.path)}
    >
      <FileCode className="h-3.5 w-3.5 shrink-0 text-blue-400" />
      <span className="flex-1 truncate">{node.name}</span>
      {count > 0 && (
        <Badge variant={severityColor(count)} className="text-xs px-1.5 py-0 h-4">
          {count}
        </Badge>
      )}
    </button>
  );
}

interface FilePanelProps {
  fileAnalysis: FileAnalysis;
}

function FilePanel({ fileAnalysis }: FilePanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileCode className="h-4 w-4 text-blue-400" />
        <span className="font-mono text-sm font-medium">{fileAnalysis.file_path}</span>
        <Badge variant="outline" className="text-xs capitalize">
          {fileAnalysis.language}
        </Badge>
        <Badge
          variant={severityColor(fileAnalysis.findings_count)}
          className="text-xs"
        >
          {fileAnalysis.findings_count} finding{fileAnalysis.findings_count !== 1 ? 's' : ''}
        </Badge>
      </div>

      {fileAnalysis.inline_comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No issues found in this file.</p>
      ) : (
        <div className="space-y-2">
          {fileAnalysis.inline_comments.map((c: InlineComment, i: number) => (
            <div
              key={i}
              className={`border-l-4 rounded-r-md p-3 text-sm ${
                c.severity === 'critical' || c.severity === 'high'
                  ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                  : c.severity === 'medium'
                  ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                  : 'border-blue-400 bg-blue-50 dark:bg-blue-950/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">
                  Line {c.line_number}
                </span>
                {c.severity && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {c.severity}
                  </Badge>
                )}
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
    </div>
  );
}

interface Props {
  fileFindings: FileAnalysis[];
}

export default function FileTreeExplorer({ fileFindings }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(
    fileFindings[0]?.file_path ?? null
  );

  const tree = buildTree(fileFindings);
  const selectedFile = fileFindings.find((f) => f.file_path === selectedPath);

  return (
    <div className="flex gap-0 border rounded-lg overflow-hidden min-h-[400px]">
      {/* Sidebar tree */}
      <div className="w-60 shrink-0 border-r bg-muted/20 overflow-y-auto py-2">
        <p className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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

      {/* File detail panel */}
      <div className="flex-1 p-4 overflow-y-auto">
        {selectedFile ? (
          <FilePanel fileAnalysis={selectedFile} />
        ) : (
          <p className="text-sm text-muted-foreground">Select a file to view findings.</p>
        )}
      </div>
    </div>
  );
}
