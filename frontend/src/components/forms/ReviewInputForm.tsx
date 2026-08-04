'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface MutationLike<TVariables> {
  mutate: (variables: TVariables) => void;
  isPending: boolean;
  error: Error | null;
}

interface Props {
  mutation: MutationLike<{
    git_diff: string;
    pr_title: string;
    pr_description?: string;
    commit_messages?: string[];
  }>;
  hideLoadingState?: boolean;
  compact?: boolean;
  onSubmitStart?: () => void;
  /** Expose submitted diff so parent can render CodeDiffViewer. */
  onDiffSubmit?: (diff: string) => void;
}

export default function ReviewInputForm(props: Props) {
  const [prTitle, setPrTitle] = useState('');
  const [gitDiff, setGitDiff] = useState('');
  const [prDescription, setPrDescription] = useState('');
  const [commitMessages, setCommitMessages] = useState('');

  const { mutation } = props;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    props.onSubmitStart?.();
    props.onDiffSubmit?.(gitDiff);
    props.mutation.mutate({
      git_diff: gitDiff,
      pr_title: prTitle,
      pr_description: prDescription || undefined,
      commit_messages: commitMessages
        ? commitMessages.split(',').map((m) => m.trim()).filter(Boolean)
        : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', props.compact && 'space-y-3')}>
      <div className="space-y-1.5">
        <Label htmlFor="pr_title" className="text-xs font-medium text-muted-foreground">
          PR Title
        </Label>
        <Input
          id="pr_title"
          placeholder="feat: add user authentication"
          value={prTitle}
          onChange={(e) => setPrTitle(e.target.value)}
          required
          className="h-9 bg-background/60"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="git_diff" className="text-xs font-medium text-muted-foreground">
          Git Diff
        </Label>
        <Textarea
          id="git_diff"
          placeholder="diff --git a/main.py b/main.py..."
          value={gitDiff}
          onChange={(e) => setGitDiff(e.target.value)}
          rows={8}
          required
          className="font-mono text-[12px] bg-muted/30"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pr_description" className="text-xs font-medium text-muted-foreground">
            PR Description (optional)
          </Label>
          <Textarea
            id="pr_description"
            placeholder="Implements JWT login and session management"
            value={prDescription}
            onChange={(e) => setPrDescription(e.target.value)}
            rows={2}
            className="resize-none bg-background/60 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="commit_messages" className="text-xs font-medium text-muted-foreground">
            Commit Messages (comma-separated)
          </Label>
          <Textarea
            id="commit_messages"
            placeholder="add jwt lib, wire up router, fix tests"
            value={commitMessages}
            onChange={(e) => setCommitMessages(e.target.value)}
            rows={2}
            className="resize-none bg-background/60 text-sm"
          />
        </div>
      </div>

      {mutation.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {mutation.error.message}
        </div>
      )}

      <Button
        type="submit"
        disabled={mutation.isPending}
        className="h-9 w-full text-sm font-semibold"
      >
        {mutation.isPending ? 'Analyzing…' : 'Run Review'}
      </Button>
    </form>
  );
}
