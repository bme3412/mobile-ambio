import {
  ActivityKind,
  LearningDay,
  emptyDay,
  mergeIntervals,
  frenchWords,
} from "../activity/learning";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { localDay, PracticeActivity } from "../activity/model";
interface Activity {
  attempts: PracticeActivity[];
  days: Record<string, LearningDay>;
  track: (
    kind: ActivityKind,
    start: number,
    end: number,
    text?: string,
  ) => void;
  words: (
    id: string,
    text: string,
    mode: "spoken" | "typed" | "encountered",
  ) => void;
  storageError: boolean;
  record: (attempt: PracticeActivity) => void;
}
export const useActivity = create<Activity>()(
  persist(
    (set) => ({
      attempts: [],
      days: {},
      track: (kind, start, end, text = "") => {
        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          end <= start ||
          end - start > 15000
        )
          return;
        set((state) => {
          const days = { ...state.days };
          let cursor = start;
          while (cursor < end) {
            const date = new Date(cursor),
              key = localDay(date);
            const midnight = new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate() + 1,
            ).getTime();
            const until = Math.min(end, midnight),
              day = days[key] ?? emptyDay();
            days[key] = {
              ...day,
              intervals: {
                ...day.intervals,
                [kind]: mergeIntervals([
                  ...day.intervals[kind],
                  [cursor, until],
                ]),
              },
              encountered: [
                ...new Set([...day.encountered, ...frenchWords(text)]),
              ],
            };
            cursor = until;
          }
          return { days };
        });
      },
      words: (id, text, mode) =>
        set((state) => {
          if (/\[[^\]]*\]/.test(text)) return state;
          const key = localDay(),
            day = state.days[key] ?? emptyDay(),
            words = frenchWords(text);
          return {
            days: {
              ...state.days,
              [key]: {
                ...day,
                encountered:
                  mode === "encountered"
                    ? [...new Set([...day.encountered, ...words])]
                    : day.encountered,
                contributions:
                  mode === "encountered"
                    ? day.contributions
                    : {
                        ...day.contributions,
                        [id]: { words: words.length, mode },
                      },
              },
            },
          };
        }),
      storageError: false,
      record: (attempt) =>
        set((state) =>
          state.attempts.some((a) => a.id === attempt.id)
            ? state
            : { attempts: [attempt, ...state.attempts] },
        ),
    }),
    {
      name: "ambio-activity-v1",
      storage: createJSONStorage(() => ({
        getItem: async (key) => {
          try {
            return await AsyncStorage.getItem(key);
          } catch {
            queueMicrotask(() => useActivity.setState({ storageError: true }));
            return null;
          }
        },
        setItem: async (key, value) => {
          try {
            await AsyncStorage.setItem(key, value);
          } catch {
            if (!useActivity.getState().storageError)
              useActivity.setState({ storageError: true });
          }
        },
        removeItem: (key) => AsyncStorage.removeItem(key),
      })),
      partialize: ({ attempts, days }) => ({ attempts, days }),
    },
  ),
);
// Wait for stored history before appending an attempt, including on a slow device.
let hydration: Promise<void> | undefined;
export async function recordPractice(attempt: PracticeActivity) {
  if (!useActivity.persist.hasHydrated()) {
    hydration ??= Promise.resolve(useActivity.persist.rehydrate()).finally(
      () => {
        hydration = undefined;
      },
    );
    await hydration;
  }
  useActivity.getState().record(attempt);
}
