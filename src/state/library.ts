import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  Bookmark,
  ConversationPhrase,
  ConversationSession,
  PlaybackProgress,
} from "../domain/types";
interface Library {
  activeEpisodeId: string;
  selectEpisode: (id: string) => void;
  progressByEpisode: Record<string, PlaybackProgress>;
  bookmarks: Bookmark[];
  conversationPhrases: ConversationPhrase[];
  togglePhrase: (phrase: ConversationPhrase) => void;
  reviewPhrase: (id: string) => void;
  updateSession: (id: string, patch: Partial<ConversationSession>) => void;
  transcripts: string[];
  toggleTranscript: (episodeId: string) => void;
  sessions: ConversationSession[];
  progress: PlaybackProgress | null;
  storageError: boolean;
  toggle: (bookmark: Bookmark) => void;
  review: (id: string) => void;
  saveSession: (session: ConversationSession) => Promise<void>;
  saveProgress: (progress: PlaybackProgress) => void;
}
export const useLibrary = create<Library>()(
  persist(
    (set) => ({
      activeEpisodeId: "daily-fr-2026-10-24",
      selectEpisode: (activeEpisodeId) => set({ activeEpisodeId }),
      progressByEpisode: {},
      bookmarks: [],
      conversationPhrases: [],
      togglePhrase: (phrase) =>
        set((s) => ({
          conversationPhrases: s.conversationPhrases.some(
            (p) => p.id === phrase.id,
          )
            ? s.conversationPhrases.filter((p) => p.id !== phrase.id)
            : [phrase, ...s.conversationPhrases],
        })),
      reviewPhrase: (id) =>
        set((s) => ({
          conversationPhrases: s.conversationPhrases.map((p) =>
            p.id === id ? { ...p, reviewed: !p.reviewed } : p,
          ),
        })),
      updateSession: (id, patch) =>
        set((s) => ({
          sessions: s.sessions.map((session) =>
            session.id === id
              ? { ...session, ...patch, id: session.id }
              : session,
          ),
        })),
      transcripts: [],
      toggleTranscript: (id) =>
        set((s) => ({
          transcripts: s.transcripts.includes(id)
            ? s.transcripts.filter((x) => x !== id)
            : [...s.transcripts, id],
        })),
      sessions: [],
      progress: null,
      storageError: false,
      toggle: (bookmark) =>
        set((s) => ({
          bookmarks: s.bookmarks.some((b) => b.id === bookmark.id)
            ? s.bookmarks.filter((b) => b.id !== bookmark.id)
            : [bookmark, ...s.bookmarks],
        })),
      review: (id) =>
        set((s) => ({
          bookmarks: s.bookmarks.map((b) =>
            b.id === id ? { ...b, reviewed: !b.reviewed } : b,
          ),
        })),
      saveSession: async (session) => {
        await set((s) => ({
          sessions: [session, ...s.sessions.filter((x) => x.id !== session.id)],
        }));
      },
      saveProgress: (progress) =>
        set((s) => ({
          progress,
          progressByEpisode: {
            ...s.progressByEpisode,
            [progress.episodeId]: progress,
          },
        })),
    }),
    {
      name: "ambio-library-v1",
      version: 3,
      migrate: (persisted) => {
        const state = persisted as Partial<Library>;
        return {
          ...state,
          conversationPhrases: state.conversationPhrases ?? [],
          activeEpisodeId: state.activeEpisodeId ?? "daily-fr-2026-10-24",
          progressByEpisode:
            state.progressByEpisode ??
            (state.progress
              ? { [state.progress.episodeId]: state.progress }
              : {}),
        };
      },
      storage: createJSONStorage(() => ({
        getItem: async (key) => {
          try {
            return await AsyncStorage.getItem(key);
          } catch {
            queueMicrotask(() => useLibrary.setState({ storageError: true }));
            return null;
          }
        },
        setItem: async (key, value) => {
          try {
            await AsyncStorage.setItem(key, value);
          } catch {
            if (!useLibrary.getState().storageError)
              useLibrary.setState({ storageError: true });
          }
        },
        removeItem: (key) => AsyncStorage.removeItem(key),
      })),
      partialize: ({
        conversationPhrases,
        bookmarks,
        sessions,
        progress,
        transcripts,
        activeEpisodeId,
        progressByEpisode,
      }) => ({
        conversationPhrases,
        activeEpisodeId,
        progressByEpisode,
        bookmarks,
        transcripts,
        sessions,
        progress,
      }),
    },
  ),
);
