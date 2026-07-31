'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, FileCode, Folder, FolderOpen, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchRepoTree, verifyRepo } from '@/lib/github';
import type { RepoTreeFile, RepoVerifyResponse } from '@/types/api';

interface TreeDir {
  name: string;
  path: string;
  dirs: Map<string, TreeDir>;
  files: RepoTreeFile[];
}

function buildDirTree(files: RepoTreeFile[]): TreeDir {
  const root: TreeDir = { name: '', path: '', dirs: new Map(), files: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join('/');
      if (!node.dirs.has(name)) {
        node.dirs.set(name, { name, path, dirs: new Map(), files: [] });
      }
      node = node.dirs.get(name)!;
    }
    node.files.push(f);
  }
  return root;
}

interface DirNodeProps {
  node: TreeDir;
  depth: number;
  mode: 'file' | 'directory';
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onSelectDir: (path: string) => void;
}

function DirNode({ node, depth, mode, selectedPath, onSelectFile, onSelectDir }: DirNodeProps) {
  const [open, setOpen] = useState(depth < 1);
  const isSelected = mode === 'directory' && selectedPath === node.path;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
          isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <button
          type="button"
          onClick={mode === 'directory' ? () => onSelectDir(node.path) : () => setOpen((o) => !o)}
          className="flex items-center gap-1.5 flex-1 text-left truncate"
        >
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {open && (
        <div>
          {[...node.dirs.values()].map((child) => (
            <DirNode
              key={child.path}
              node={child}
              depth={depth + 1}
              mode={mode}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              onSelectDir={onSelectDir}
            />
          ))}
          {mode === 'file' &&
            node.files.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => onSelectFile(f.path)}
                className={`flex w-full items-center gap-1.5 px-2 py-1 rounded text-sm text-left transition-colors ${
                  selectedPath === f.path ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                }`}
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
              >
                <FileCode className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                <span className="truncate">{f.path.split('/').pop()}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

interface RepoBranchPickerProps {
  mode: 'file' | 'directory';
  onChange: (url: string | null) => void;
}

export default function RepoBranchPicker({ mode, onChange }: RepoBranchPickerProps) {
  const [repoInput, setRepoInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoVerifyResponse | null>(null);
  const [branch, setBranch] = useState('');
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [files, setFiles] = useState<RepoTreeFile[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const loadTree = async (owner: string, repo: string, br: string) => {
    setTreeLoading(true);
    setTreeError(null);
    setFiles(null);
    setSelectedPath(null);
    onChange(null);
    try {
      const res = await fetchRepoTree(owner, repo, br);
      setFiles(res.files);
      setTruncated(res.truncated);
      if (mode === 'directory') {
        setSelectedPath('');
        onChange(`https://github.com/${owner}/${repo}/tree/${br}`);
      }
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : String(err));
    } finally {
      setTreeLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!repoInput.trim()) return;
    setVerifying(true);
    setVerifyError(null);
    setRepoInfo(null);
    setBranch('');
    setFiles(null);
    setSelectedPath(null);
    onChange(null);
    try {
      const info = await verifyRepo(repoInput.trim());
      setRepoInfo(info);
      setBranch(info.default_branch);
      await loadTree(info.owner, info.repo, info.default_branch);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setVerifying(false);
    }
  };

  const handleBranchChange = (br: string) => {
    setBranch(br);
    if (repoInfo) void loadTree(repoInfo.owner, repoInfo.repo, br);
  };

  const handleSelectFile = (path: string) => {
    if (!repoInfo) return;
    setSelectedPath(path);
    onChange(`https://github.com/${repoInfo.owner}/${repoInfo.repo}/blob/${branch}/${path}`);
  };

  const handleSelectDir = (path: string) => {
    if (!repoInfo) return;
    setSelectedPath(path);
    const url = path
      ? `https://github.com/${repoInfo.owner}/${repoInfo.repo}/tree/${branch}/${path}`
      : `https://github.com/${repoInfo.owner}/${repoInfo.repo}/tree/${branch}`;
    onChange(url);
  };

  const tree = files ? buildDirTree(files) : null;
  const isEmpty = tree && tree.dirs.size === 0 && tree.files.length === 0;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="repo_input" className="text-foreground/80 font-medium tracking-wide text-sm">
          Repository
        </Label>
        <div className="flex gap-2">
          <Input
            id="repo_input"
            placeholder="owner/repo"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleVerify();
              }
            }}
            className="bg-background/50 border-border/50 focus-visible:ring-primary/30"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={verifying || !repoInput.trim()}
            onClick={() => void handleVerify()}
          >
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
          </Button>
        </div>
        {verifyError && <p className="text-sm text-destructive">{verifyError}</p>}
        {repoInfo && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            {repoInfo.owner}/{repoInfo.repo}
            {repoInfo.private && (
              <Badge variant="outline" className="text-xs">
                private
              </Badge>
            )}
          </p>
        )}
      </div>

      {repoInfo && (
        <div className="space-y-2">
          <Label htmlFor="branch_select" className="text-foreground/80 font-medium tracking-wide text-sm">
            Branch
          </Label>
          <select
            id="branch_select"
            value={branch}
            onChange={(e) => handleBranchChange(e.target.value)}
            className="h-9 w-full rounded-md border border-border/50 bg-background/50 px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30"
          >
            {repoInfo.branches.map((b) => (
              <option key={b} value={b}>
                {b}
                {b === repoInfo.default_branch ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {treeLoading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading files…
        </p>
      )}
      {treeError && <p className="text-sm text-destructive">{treeError}</p>}

      {tree && !treeLoading && !isEmpty && (
        <div className="space-y-1.5">
          <Label className="text-foreground/80 font-medium tracking-wide text-sm">
            {mode === 'file' ? 'Select a file' : 'Select a folder (or use the whole repository)'}
          </Label>
          <div className="max-h-64 overflow-y-auto rounded-md border border-border/50 bg-background/30 py-1.5">
            {mode === 'directory' && (
              <button
                type="button"
                onClick={() => handleSelectDir('')}
                className={`flex w-full items-center gap-1.5 px-2 py-1 text-sm text-left ${
                  selectedPath === '' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
                Entire repository
              </button>
            )}
            {[...tree.dirs.values()].map((child) => (
              <DirNode
                key={child.path}
                node={child}
                depth={0}
                mode={mode}
                selectedPath={selectedPath}
                onSelectFile={handleSelectFile}
                onSelectDir={handleSelectDir}
              />
            ))}
            {mode === 'file' &&
              tree.files.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => handleSelectFile(f.path)}
                  className={`flex w-full items-center gap-1.5 px-2 py-1 text-sm text-left ${
                    selectedPath === f.path ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                  }`}
                >
                  <FileCode className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                  {f.path}
                </button>
              ))}
          </div>
          {truncated && (
            <p className="text-xs text-muted-foreground">
              This repository has a lot of files — the list was truncated.
            </p>
          )}
          {mode === 'file' && selectedPath && (
            <p className="text-xs text-muted-foreground">
              Selected: <span className="font-mono">{selectedPath}</span>
            </p>
          )}
        </div>
      )}

      {tree && !treeLoading && isEmpty && (
        <p className="text-sm text-muted-foreground">
          No supported files (.py, .js, .jsx, .tsx, .html) found on this branch.
        </p>
      )}
    </div>
  );
}
