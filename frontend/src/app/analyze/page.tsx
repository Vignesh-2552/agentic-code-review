'use client';

import { useEffect, useMemo } from 'react';
import ReviewInputForm from '@/components/forms/ReviewInputForm';
import AnalysisSummaryPanel from '@/components/review/AnalysisSummaryPanel';
import CollapsibleInput, { useCollapsibleInput } from '@/components/review/CollapsibleInput';
import EmptyReviewState from '@/components/review/EmptyReviewState';
import FindingsList, { flattenFindings } from '@/components/review/FindingsList';
import NodeExecutionPanel from '@/components/review/NodeExecutionPanel';
import ReviewWorkspace from '@/components/review/ReviewWorkspace';
import { useStreamAnalyzeCode } from '@/lib/api';
import { useReviewStore } from '@/store/reviewStore';

export default function AnalyzePage() {
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
  } = useStreamAnalyzeCode();

  const { collapsed, toggle, collapse } = useCollapsibleInput(false);
  const findingFilter = useReviewStore((s) => s.findingFilter);
  const setFindingFilter = useReviewStore((s) => s.setFindingFilter);

  useEffect(() => {
    setFindingFilter('all');
  }, [setFindingFilter]);

  const severityLevel = data?.severity_level ?? partialFindings.severity_level ?? null;
  const requiresHumanReview =
    data?.requires_human_review ?? partialFindings.requires_human_review ?? false;
  const findingsCount = data
    ? {
        total: data.summary.total_issues,
        architecture: data.summary.architecture_issues,
        security: data.summary.security_vulnerabilities,
        performance: data.summary.performance_issues,
        best_practices: data.summary.best_practice_violations,
      }
    : {
        total:
          (partialFindings.security_vulnerabilities?.length ?? 0) +
          (partialFindings.performance_issues?.length ?? 0) +
          (partialFindings.best_practice_violations?.length ?? 0) +
          (partialFindings.architecture_issues?.length ?? 0),
        architecture: partialFindings.architecture_issues?.length ?? 0,
        security: partialFindings.security_vulnerabilities?.length ?? 0,
        performance: partialFindings.performance_issues?.length ?? 0,
        best_practices: partialFindings.best_practice_violations?.length ?? 0,
      };

  const findings = useMemo(
    () =>
      flattenFindings({
        architecture: partialFindings.architecture_issues,
        security: data?.security_vulnerabilities ?? partialFindings.security_vulnerabilities,
        performance: data?.performance_issues ?? partialFindings.performance_issues,
        best_practices:
          data?.best_practice_violations ?? partialFindings.best_practice_violations,
      }),
    [data, partialFindings],
  );

  const showWorkspace = isPending || isSuccess;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Single File Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a GitHub file URL to analyze security, performance, architecture, and best practices.
        </p>
      </div>

      <CollapsibleInput
        title="Review input"
        description="GitHub blob URL + optional context"
        collapsed={collapsed && showWorkspace}
        onToggle={toggle}
      >
        <ReviewInputForm
          mode="analyze"
          mutation={{ mutate, isPending, error }}
          hideLoadingState
          compact
          onSubmitStart={() => {
            collapse();
            setFindingFilter('all');
          }}
        />
      </CollapsibleInput>

      {!showWorkspace && (
        <EmptyReviewState
          title="Ready to review"
          description="Submit a GitHub file URL to start the streaming analysis pipeline. Findings appear live as each node completes."
          example="https://github.com/owner/repo/blob/main/src/auth.py"
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
            activeFilter={findingFilter}
            onFilterChange={setFindingFilter}
          />
          <FindingsList findings={findings} filter={findingFilter} />
        </ReviewWorkspace>
      )}
    </div>
  );
}
