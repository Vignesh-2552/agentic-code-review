'use client';

import { useEffect, useMemo, useState } from 'react';
import ReviewInputForm from '@/components/forms/ReviewInputForm';
import AnalysisSummaryPanel from '@/components/review/AnalysisSummaryPanel';
import CodeDiffViewer from '@/components/review/CodeDiffViewer';
import CollapsibleInput, { useCollapsibleInput } from '@/components/review/CollapsibleInput';
import EmptyReviewState from '@/components/review/EmptyReviewState';
import FindingsList, {
  flattenFindings,
  type CategorizedFinding,
} from '@/components/review/FindingsList';
import NodeExecutionPanel from '@/components/review/NodeExecutionPanel';
import ReviewWorkspace from '@/components/review/ReviewWorkspace';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStreamPRReview } from '@/lib/api';
import { useReviewStore } from '@/store/reviewStore';

export default function PRReviewPage() {
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
  } = useStreamPRReview();

  const { collapsed, toggle, collapse } = useCollapsibleInput(false);
  const findingFilter = useReviewStore((s) => s.findingFilter);
  const setFindingFilter = useReviewStore((s) => s.setFindingFilter);
  const [submittedDiff, setSubmittedDiff] = useState('');
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('findings');

  useEffect(() => {
    setFindingFilter('all');
  }, [setFindingFilter]);

  const inlineComments = data?.inline_comments ?? partialFindings.inline_comments ?? [];
  const severityLevel = data?.severity_level ?? partialFindings.severity_level ?? null;
  const requiresHumanReview =
    data?.requires_human_review ?? partialFindings.requires_human_review ?? false;
  const findingsCount = data?.findings_count ?? {
    total:
      (partialFindings.architecture_issues?.length ?? 0) +
      (partialFindings.security_vulnerabilities?.length ?? 0) +
      (partialFindings.performance_issues?.length ?? 0) +
      (partialFindings.best_practice_violations?.length ?? 0),
    architecture: partialFindings.architecture_issues?.length ?? 0,
    security: partialFindings.security_vulnerabilities?.length ?? 0,
    performance: partialFindings.performance_issues?.length ?? 0,
    best_practices: partialFindings.best_practice_violations?.length ?? 0,
  };

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

  const showWorkspace = isPending || isSuccess;

  const handleLocate = (finding: CategorizedFinding) => {
    const line =
      typeof finding.line === 'number'
        ? finding.line
        : typeof finding.line_number === 'number'
          ? finding.line_number
          : null;
    setHighlightLine(line);
    setActiveTab('diff');
    requestAnimationFrame(() => {
      document.getElementById('diff-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pull Request Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste your git diff and PR details for a streamed review with inline comments.
        </p>
      </div>

      <CollapsibleInput
        title="Review input"
        description="PR title, git diff, optional description"
        collapsed={collapsed && showWorkspace}
        onToggle={toggle}
      >
        <ReviewInputForm
          mutation={{ mutate, isPending, error }}
          hideLoadingState
          compact
          onDiffSubmit={setSubmittedDiff}
          onSubmitStart={() => {
            collapse();
            setFindingFilter('all');
            setActiveTab('findings');
          }}
        />
      </CollapsibleInput>

      {!showWorkspace && (
        <EmptyReviewState
          title="Ready to review a PR"
          description="Paste a unified git diff to run the agent pipeline. Scorecards update live; open Diff to inspect inline comments."
          example="diff --git a/main.py b/main.py ..."
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
            severityLevel={severityLevel}
            requiresHumanReview={requiresHumanReview}
            findingsCount={findingsCount}
            summaryText={
              typeof data?.pr_summary?.summary_text === 'string'
                ? data.pr_summary.summary_text
                : undefined
            }
            activeFilter={findingFilter}
            onFilterChange={setFindingFilter}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="h-8">
              <TabsTrigger value="findings" className="text-xs">
                Findings
              </TabsTrigger>
              <TabsTrigger value="diff" className="text-xs" disabled={!submittedDiff}>
                Diff
                {inlineComments.length > 0 && (
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                    ({inlineComments.length})
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="findings" className="mt-3">
              <FindingsList
                findings={findings}
                filter={findingFilter}
                onLocate={submittedDiff ? handleLocate : undefined}
              />
            </TabsContent>
            <TabsContent value="diff" className="mt-3">
              {submittedDiff ? (
                <CodeDiffViewer
                  gitDiff={submittedDiff}
                  inlineComments={inlineComments}
                  highlightLine={highlightLine}
                />
              ) : (
                <EmptyReviewState
                  title="No diff available"
                  description="Submit a git diff to inspect changes and inline review threads."
                />
              )}
            </TabsContent>
          </Tabs>
        </ReviewWorkspace>
      )}
    </div>
  );
}
