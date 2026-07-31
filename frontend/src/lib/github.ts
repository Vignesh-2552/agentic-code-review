
import type { RepoTreeResponse, RepoVerifyResponse } from '@/types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`;
    try {
      const payload = await res.json();
      if (typeof payload?.detail === 'string') detail = payload.detail;
    } catch {
      // keep status-based message
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function verifyRepo(repo: string): Promise<RepoVerifyResponse> {
  const params = new URLSearchParams({ repo });
  return getJSON(`${API_BASE}/api/v1/review/github/verify?${params.toString()}`);
}

export function fetchRepoTree(owner: string, repo: string, branch: string): Promise<RepoTreeResponse> {
  const params = new URLSearchParams({ owner, repo, branch });
  return getJSON(`${API_BASE}/api/v1/review/github/tree?${params.toString()}`);
}
