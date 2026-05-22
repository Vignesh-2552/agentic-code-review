'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import AnalysisSummaryPanel from '@/components/review/AnalysisSummaryPanel';
import CardDisplay from '@/components/review/CardDisplay';
import FileTreeExplorer from '@/components/review/FileTreeExplorer';
import NodeExecutionPanel from '@/components/review/NodeExecutionPanel';
import { useStreamDirectoryReview } from '@/lib/api';

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

  const enrichedFileFindings = data?.file_findings.map((file) => {
    const comments = (data.inline_comments || [])
      .filter((c: any) => c.path === file.file_path || c.file_path === file.file_path)
      .map((c: any) => ({
        ...c,
        file_path: c.file_path || c.path,
        line_number: c.line_number || c.line,
        comment: c.comment || c.body,
      }));
    return {
      ...file,
      inline_comments: comments,
      findings_count: comments.length > 0 ? comments.length : file.findings_count,
    };
  }) || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ github_url: githubUrl, context: context || undefined });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Directory Review</h1>
        <p className="text-muted-foreground text-sm">
          Paste a GitHub folder URL to recursively analyze all .py and .js files inside it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="github_url">GitHub Directory URL</Label>
          <Input
            id="github_url"
            placeholder="https://github.com/owner/repo/tree/main/src"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Must be a folder URL (<code className="font-mono">/tree/</code>). For a single file use{' '}
            <a href="/analyze" className="underline">Single File review</a>.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="context">Context (optional)</Label>
          <Textarea
            id="context"
            placeholder="e.g. This is the authentication module — check for JWT handling issues"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}
          </div>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Analyzing...' : 'Analyze Directory'}
        </Button>
      </form>

      {(isPending || isSuccess) && (
        <NodeExecutionPanel
          nodeStatuses={nodeStatuses}
          nodeTimings={nodeTimings}
          totalElapsedMs={totalElapsedMs}
          isComplete={isSuccess}
        />
      )}

      {(isPending || isSuccess) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardDisplay
            title="Security Issues"
            items={partialFindings.security_vulnerabilities}
            colorClass="text-red-600 dark:text-red-400"
          />
          <CardDisplay
            title="Performance Issues"
            items={partialFindings.performance_issues}
            colorClass="text-yellow-600 dark:text-yellow-400"
          />
          <CardDisplay
            title="Architecture Issues"
            items={partialFindings.architecture_issues}
            colorClass="text-blue-600 dark:text-blue-400"
          />
          <CardDisplay
            title="Best Practices"
            items={partialFindings.best_practice_violations}
            colorClass="text-green-600 dark:text-green-400"
          />
        </div>
      )}

      {isSuccess && data && (
        <>
          <Separator />

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{data.files_analyzed.length} file{data.files_analyzed.length !== 1 ? 's' : ''} analyzed</span>
            {totalElapsedMs != null && (
              <>
                <span>·</span>
                <span>{(totalElapsedMs / 1000).toFixed(1)}s</span>
              </>
            )}
          </div>

          {data.pr_summary?.summary_text && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <h3 className="text-sm font-semibold mb-2">Summary</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {data.pr_summary.summary_text}
              </p>
            </div>
          )}

          <AnalysisSummaryPanel
            severityLevel={data.severity_level}
            requiresHumanReview={data.requires_human_review}
            findingsCount={data.findings_count}
          />

          {enrichedFileFindings.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="text-lg font-semibold mb-4">File Explorer</h2>
                <FileTreeExplorer fileFindings={enrichedFileFindings} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
