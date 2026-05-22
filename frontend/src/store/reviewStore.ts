import { create } from 'zustand';

interface ReviewStore {
  mode: 'analyze' | 'pr';
  setMode: (m: 'analyze' | 'pr') => void;
}

export const useReviewStore = create<ReviewStore>((set) => ({
  mode: 'analyze',
  setMode: (m) => set({ mode: m }),
}));
