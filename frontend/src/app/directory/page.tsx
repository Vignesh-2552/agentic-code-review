'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AnalysisSummaryPanel from '@/components/review/AnalysisSummaryPanel';
import CollapsibleInput, { useCollapsibleInput } from '@/components/review/CollapsibleInput';
import EmptyReviewState from '@/components/review/EmptyReviewState';
import FindingsList, { flattenFindings } from '@/components/review/FindingsList';
import FileTreeExplorer from '@/components/review/FileTreeExplorer';
import NodeExecutionPanel from '@/components/review/NodeExecutionPanel';
import ReviewWorkspace from '@/components/review/ReviewWorkspace';
import RepoBranchPicker from '@/components/forms/RepoBranchPicker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStreamDirectoryReview } from '@/lib/api';
import { useReviewStore } from '@/store/reviewStore';

export default function DirectoryReviewPage() {
  const [githubUrl, setGithubUrl] = useState('');
  const [context, setContext] = useState('');
  const {
    mutate,
    isPending,
    error,
    data,
    isSuccess,
    nodeStatuses,
    nodeTimings,
    partialFindings,
    totalElapsedMs,
  } = useStreamDirectoryReview();

  const { collapsed, toggle, collapse } = useCollapsibleInput(false);
  const findingFilter = useReviewStore((s) => s.findingFilter);
  const setFindingFilter = useReviewStore((s) => s.setFindingFilter);
  const [activeTab, setActiveTab] = useState('files');

  useEffect(() => {
    setFindingFilter('all');
  }, [setFindingFilter]);

  const enrichedFileFindings =
    data?.file_findings.map((file) => {
      const comments = (data.inline_comments || [])
        .filter((c: { path?: string; file_path?: string }) => c.path === file.file_path || c.file_path === file.file_path)
        .map((c: { path?: string; file_path?: string; line?: number; line_number?: number; body?: string; comment?: string; severity?: string; suggestion?: string }) => ({
          ...c,
          file_path: c.file_path || c.path || file.file_path,
          line_number: c.line_number || c.line || 0,
          comment: c.comment || c.body || '',
        }));
      return {
        ...file,
        inline_comments: comments,
        findings_count: comments.length > 0 ? comments.length : file.findings_count,
      };
    }) || [];

  const findings = useMemo(
    () =>
      flattenFindings({
        architecture: partialFindings.architecture_issues,
        security: partialFindings.security_vulnerabilities,
        performance: partialFindings.performance_issues,
        best_practices: partialFindings.best_practice_violations,
      }),
    [partialFindings],
  );

  const findingsCount = data?.findings_count ?? {
    total: findings.length,
    architecture: partialFindings.architecture_issues?.length ?? 0,
    security: partialFindings.security_vulnerabilities?.length ?? 0,
    performance: partialFindings.performance_issues?.length ?? 0,
    best_practices: partialFindings.best_practice_violations?.length ?? 0,
  };

  const showWorkspace = isPending || isSuccess;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl) return;
    collapse();
    setFindingFilter('all');
    setActiveTab('files');
    mutate({ github_url: githubUrl, context: context || undefined });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Directory Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a GitHub folder URL to recursively analyze supported source files.
        </p>
      </div>

      <CollapsibleInput
        title="Review input"
        description="GitHub tree URL + optional context"
        collapsed={collapsed && showWorkspace}
        onToggle={toggle}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <RepoBranchPicker mode="directory" onChange={(url) => setGithubUrl(url ?? '')} />
          <p className="text-[11px] text-muted-foreground">
            For reviewing a single file instead, use{' '}
            <a href="/analyze" className="underline underline-offset-2 hover:text-foreground">
              Single File
            </a>
            .
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="context" className="text-xs font-medium text-muted-foreground">
              Context (optional)
            </Label>
            <Textarea
              id="context"
              placeholder="e.g. This is the authentication module — check for JWT handling issues"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
              className="resize-none bg-background/60 text-sm"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message}
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending || !githubUrl}
            className="h-9 w-full text-sm font-semibold"
          >
            {isPending ? 'Analyzing…' : 'Run Directory Review'}
          </Button>
        </form>
      </CollapsibleInput>

      {!showWorkspace && (
        <EmptyReviewState
          title="Ready to review a directory"
          description="Submit a GitHub /tree/ URL. The pipeline streams findings; explore files in the tree once analysis completes."
          example="https://github.com/owner/repo/tree/main/src"
        />
      )}

      {showWorkspace && (
        <ReviewWorkspace
          pipeline={
            <NodeExecutionPanel
              nodeStatuses={nodeStatuses}
              nodeTimings={nodeTimings}
              totalElapsedMs={totalElapsedMs}
              isComplete={isSuccess}
            />
          }
        >
          <AnalysisSummaryPanel
            severityLevel={data?.severity_level ?? partialFindings.severity_level ?? null}
            requiresHumanReview={
              data?.requires_human_review ?? partialFindings.requires_human_review ?? false
            }
            findingsCount={findingsCount}
            summaryText={
              typeof data?.pr_summary?.summary_text === 'string'
                ? data.pr_summary.summary_text
                : undefined
            }
            activeFilter={findingFilter}
            onFilterChange={setFindingFilter}
          />

          {isSuccess && data && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">
                {data.files_analyzed.length} file{data.files_analyzed.length !== 1 ? 's' : ''}
              </span>
              {totalElapsedMs != null && (
                <>
                  <span>·</span>
                  <span className="font-mono tabular-nums">{(totalElapsedMs / 1000).toFixed(1)}s</span>
                </>
              )}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="h-8">
              <TabsTrigger value="files" className="text-xs" disabled={!isSuccess}>
                Files
              </TabsTrigger>
              <TabsTrigger value="findings" className="text-xs">
                Findings
              </TabsTrigger>
            </TabsList>
            <TabsContent value="files" className="mt-3">
              {isSuccess && enrichedFileFindings.length > 0 ? (
                <FileTreeExplorer fileFindings={enrichedFileFindings} />
              ) : (
                <EmptyReviewState
                  title={isPending ? 'Analyzing files…' : 'No files yet'}
                  description={
                    isPending
                      ? 'File explorer unlocks when the directory review completes.'
                      : 'No file findings were returned.'
                  }
                />
              )}
            </TabsContent>
            <TabsContent value="findings" className="mt-3">
              <FindingsList findings={findings} filter={findingFilter} />
            </TabsContent>
          </Tabs>
        </ReviewWorkspace>
      )}
    </div>
  );
}
