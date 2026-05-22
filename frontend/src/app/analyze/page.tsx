'use client';

import ReviewInputForm from '@/components/forms/ReviewInputForm';
import AnalysisSummaryPanel from '@/components/review/AnalysisSummaryPanel';
import CardDisplay from '@/components/review/CardDisplay';
import NodeExecutionPanel from '@/components/review/NodeExecutionPanel';
import { Separator } from '@/components/ui/separator';
import { useStreamAnalyzeCode } from '@/lib/api';

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

  const severityLevel = data?.severity_level ?? partialFindings.severity_level ?? null;
  const requiresHumanReview = data?.requires_human_review ?? partialFindings.requires_human_review ?? false;
  const findingsCount = data
    ? {
        total: data.summary.total_issues,
        architecture: data.summary.architecture_issues,
        security: data.summary.security_vulnerabilities,
        performance: data.summary.performance_issues,
        best_practices: data.summary.best_practice_violations,
      }
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Single File Review</h1>
        <p className="text-muted-foreground text-sm">
          Paste a GitHub file URL to analyze syntax, security, performance, and best practices.
        </p>
      </div>

      <ReviewInputForm mode="analyze" mutation={{ mutate, isPending, error }} hideLoadingState />

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
            title="Security Vulnerabilities"
            items={data?.security_vulnerabilities ?? partialFindings.security_vulnerabilities}
            colorClass="text-red-600 dark:text-red-400"
          />
          <CardDisplay
            title="Performance Issues"
            items={data?.performance_issues ?? partialFindings.performance_issues}
            colorClass="text-yellow-600 dark:text-yellow-400"
          />
          <CardDisplay
            title="Best Practice Violations"
            items={data?.best_practice_violations ?? partialFindings.best_practice_violations}
            colorClass="text-orange-600 dark:text-orange-400"
          />
          <CardDisplay
            title="Architecture Issues"
            items={partialFindings.architecture_issues}
            colorClass="text-blue-600 dark:text-blue-400"
          />
        </div>
      )}

      {isSuccess && data && findingsCount && (
        <>
          <Separator />
          <AnalysisSummaryPanel
            severityLevel={severityLevel}
            requiresHumanReview={requiresHumanReview}
            findingsCount={findingsCount}
          />
        </>
      )}
    </div>
  );
}
