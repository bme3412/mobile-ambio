import { useEffect } from "react";
import { AppState } from "react-native";
import { useActivity } from "../state/activity";
import type { ActivityKind } from "./learning";
// Count foreground engagement, stop after a minute without a new interaction.
export function useLearningTime(
  kind: ActivityKind,
  active: boolean,
  interaction: unknown,
) {
  useEffect(() => {
    if (!active) return;
    let last = Date.now();
    const until = last + 60000;
    const flush = () => {
      const now = Date.now();
      if (
        AppState.currentState === "active" &&
        useActivity.persist.hasHydrated()
      )
        useActivity.getState().track(kind, last, Math.min(now, until));
      last = now;
    };
    const timer = setInterval(flush, 5000);
    const subscription = AppState.addEventListener("change", () => {
      last = Date.now();
    });
    return () => {
      flush();
      clearInterval(timer);
      subscription?.remove();
    };
  }, [kind, active, interaction]);
}
