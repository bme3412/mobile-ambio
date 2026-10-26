import { create } from "zustand";

// Deliberately session-only: a new app session starts with French alone.
export const useReader = create<{
  english: boolean;
  toggleEnglish: () => void;
}>((set) => ({
  english: false,
  toggleEnglish: () => set((state) => ({ english: !state.english })),
}));
