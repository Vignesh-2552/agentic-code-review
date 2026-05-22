'use client';

import ReviewInputForm from '@/components/forms/ReviewInputForm';
import AnalysisSummaryPanel from '@/components/review/AnalysisSummaryPanel';
import CardDisplay from '@/components/review/CardDisplay';
import NodeExecutionPanel from '@/components/review/NodeExecutionPanel';
import { Separator } from '@/components/ui/separator';
import { useStreamPRReview } from '@/lib/api';

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

  const inlineComments = data?.inline_comments ?? partialFindings.inline_comments;
  const severityLevel = data?.severity_level ?? partialFindings.severity_level ?? null;
  const requiresHumanReview = data?.requires_human_review ?? partialFindings.requires_human_review ?? false;
  const findingsCount = data?.findings_count ?? {
    total: 0, architecture: 0, security: 0, performance: 0, best_practices: 0,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Pull Request Review</h1>
        <p className="text-muted-foreground text-sm">
          Paste your git diff and PR details to get a comprehensive review with inline comments.
        </p>
      </div>

      <ReviewInputForm mode="pr" mutation={{ mutate, isPending, error }} hideLoadingState />

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

          {data.pr_summary?.summary_text && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <h3 className="text-sm font-semibold mb-2">PR Summary</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {data.pr_summary.summary_text}
              </p>
            </div>
          )}

          <AnalysisSummaryPanel
            severityLevel={severityLevel}
            requiresHumanReview={requiresHumanReview}
            findingsCount={findingsCount}
            summaryText={undefined}
          />

          {inlineComments.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="text-lg font-semibold mb-4">Inline Comments</h2>
                <div className="space-y-3">
                  {inlineComments.map((comment: any, i: number) => (
                    <div
                      key={i}
                      className="border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 rounded-r-md p-3 text-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground font-semibold">
                          {comment.file_path ?? comment.path}:{comment.line_number ?? comment.line}
                        </span>
                        {comment.severity && (
                          <span className="text-xs capitalize bg-muted px-2 py-0.5 rounded">
                            {comment.severity}
                          </span>
                        )}
                      </div>
                      <p>{comment.comment ?? comment.body}</p>
                      {comment.suggestion && (
                        <pre className="mt-2 text-xs bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono">
                          {comment.suggestion}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
