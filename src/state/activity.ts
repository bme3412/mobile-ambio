import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PracticeActivity } from "../activity/model";
interface Activity {
  attempts: PracticeActivity[];
  storageError: boolean;
  record: (attempt: PracticeActivity) => void;
}
export const useActivity = create<Activity>()(
  persist(
    (set) => ({
      attempts: [],
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
      partialize: ({ attempts }) => ({ attempts }),
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
