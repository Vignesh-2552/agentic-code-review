'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { CodeReviewResponse, PRReviewResponse } from '@/types/api';

interface MutationLike<TVariables> {
  mutate: (variables: TVariables) => void;
  isPending: boolean;
  error: Error | null;
}

interface AnalyzeFormProps {
  mode: 'analyze';
  mutation: MutationLike<{ github_url: string; context?: string }>;
  hideLoadingState?: boolean;
}

interface PRFormProps {
  mode: 'pr';
  mutation: MutationLike<{ git_diff: string; pr_title: string; pr_description?: string; commit_messages?: string[] }>;
  hideLoadingState?: boolean;
}

type Props = AnalyzeFormProps | PRFormProps;

export default function ReviewInputForm(props: Props) {
  const [githubUrl, setGithubUrl] = useState('');
  const [context, setContext] = useState('');
  const [prTitle, setPrTitle] = useState('');
  const [gitDiff, setGitDiff] = useState('');
  const [prDescription, setPrDescription] = useState('');
  const [commitMessages, setCommitMessages] = useState('');

  const { mutation } = props;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (props.mode === 'analyze') {
      props.mutation.mutate({ github_url: githubUrl, context: context || undefined });
    } else {
      props.mutation.mutate({
        git_diff: gitDiff,
        pr_title: prTitle,
        pr_description: prDescription || undefined,
        commit_messages: commitMessages
          ? commitMessages.split(',').map((m) => m.trim()).filter(Boolean)
          : undefined,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-card/20 backdrop-blur-sm p-6 rounded-xl border border-border/50 shadow-sm">
      {props.mode === 'analyze' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="github_url" className="text-foreground/80 font-medium tracking-wide text-sm">GitHub URL</Label>
            <Input
              id="github_url"
              placeholder="https://github.com/owner/repo/blob/main/app.py"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              required
              className="bg-background/50 border-border/50 focus-visible:ring-primary/30 transition-shadow transition-colors"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="context" className="text-foreground/80 font-medium tracking-wide text-sm">Context (optional)</Label>
            <Textarea
              id="context"
              placeholder="e.g. Check if my auth logic is safe"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              className="bg-background/50 border-border/50 focus-visible:ring-primary/30 transition-shadow transition-colors resize-none"
            />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="pr_title" className="text-foreground/80 font-medium tracking-wide text-sm">PR Title</Label>
            <Input
              id="pr_title"
              placeholder="feat: add user authentication"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              required
              className="bg-background/50 border-border/50 focus-visible:ring-primary/30"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="git_diff" className="text-foreground/80 font-medium tracking-wide text-sm">Git Diff</Label>
            <Textarea
              id="git_diff"
              placeholder="diff --git a/main.py b/main.py..."
              value={gitDiff}
              onChange={(e) => setGitDiff(e.target.value)}
              rows={10}
              required
              className="font-mono text-[13px] bg-muted/30 border-border/50 focus-visible:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pr_description" className="text-foreground/80 font-medium tracking-wide text-sm">PR Description (optional)</Label>
              <Textarea
                id="pr_description"
                placeholder="Implements JWT login and session management"
                value={prDescription}
                onChange={(e) => setPrDescription(e.target.value)}
                rows={3}
                className="bg-background/50 border-border/50 focus-visible:ring-primary/30 resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commit_messages" className="text-foreground/80 font-medium tracking-wide text-sm">Commit Messages (comma-separated)</Label>
              <Textarea
                id="commit_messages"
                placeholder="add jwt lib, wire up router, fix tests"
                value={commitMessages}
                onChange={(e) => setCommitMessages(e.target.value)}
                rows={3}
                className="bg-background/50 border-border/50 focus-visible:ring-primary/30 resize-none"
              />
            </div>
          </div>
        </>
      )}

      {mutation.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {mutation.error.message}
        </div>
      )}

      <div className="pt-2">
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="w-full h-11 text-base font-semibold tracking-wide bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all"
        >
          {mutation.isPending ? 'Analyzing...' : 'Analyze'}
        </Button>
      </div>

      {mutation.isPending && !props.hideLoadingState && (
        <div className="space-y-4 pt-6 animate-pulse">
          <Skeleton className="h-[100px] w-full rounded-xl bg-muted/60" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-28 w-full rounded-xl bg-muted/60" />
            <Skeleton className="h-28 w-full rounded-xl bg-muted/60" />
            <Skeleton className="h-28 w-full rounded-xl bg-muted/60" />
            <Skeleton className="h-28 w-full rounded-xl bg-muted/60" />
          </div>
        </div>
      )}
    </form>
  );
}
