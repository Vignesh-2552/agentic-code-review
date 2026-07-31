import { create } from 'zustand';

export type FindingCategory =
  | 'all'
  | 'architecture'
  | 'security'
  | 'performance'
  | 'best_practices';

interface ReviewStore {
  mode: 'analyze' | 'pr' | 'directory';
  setMode: (m: 'analyze' | 'pr' | 'directory') => void;
  findingFilter: FindingCategory;
  setFindingFilter: (f: FindingCategory) => void;
}

export const useReviewStore = create<ReviewStore>((set) => ({
  mode: 'analyze',
  setMode: (m) => set({ mode: m }),
  findingFilter: 'all',
  setFindingFilter: (f) => set({ findingFilter: f }),
}));
