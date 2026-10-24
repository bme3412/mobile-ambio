import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  Bookmark,
  ConversationSession,
  PlaybackProgress,
} from "../domain/types";
interface Library {
  bookmarks: Bookmark[];
  transcripts: string[];
  toggleTranscript: (episodeId: string) => void;
  sessions: ConversationSession[];
  progress: PlaybackProgress | null;
  storageError: boolean;
  toggle: (bookmark: Bookmark) => void;
  review: (id: string) => void;
  saveSession: (session: ConversationSession) => void;
  saveProgress: (progress: PlaybackProgress) => void;
}
export const useLibrary = create<Library>()(
  persist(
    (set) => ({
      bookmarks: [],
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
      saveSession: (session) =>
        set((s) => ({
          sessions: [session, ...s.sessions.filter((x) => x.id !== session.id)],
        })),
      saveProgress: (progress) => set({ progress }),
    }),
    {
      name: "ambio-library-v1",
      version: 1,
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
      partialize: ({ bookmarks, sessions, progress, transcripts }) => ({
        bookmarks,
        transcripts,
        sessions,
        progress,
      }),
    },
  ),
);
