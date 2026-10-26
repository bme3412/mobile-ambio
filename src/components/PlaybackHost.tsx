import { setAudioModeAsync } from "expo-audio";
import { stopPronunciation } from "../playback/pronunciation";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { player } from "../playback/player";
import { useLibrary } from "../state/library";

export function PlaybackHost() {
  useEffect(() => {
    if (Platform.OS !== "web")
      void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const restore = () => {
      const state = useLibrary.getState();
      const p =
        state.progressByEpisode[state.activeEpisodeId] ?? state.progress;
      if (p?.episodeId === useLibrary.getState().activeEpisodeId) {
        player.seek(p.positionMs);
        player.setRate(p.rate);
      }
    };
    const unsub = useLibrary.persist.onFinishHydration(restore);
    if (useLibrary.persist.hasHydrated()) restore();
    const save = () => {
      if (!useLibrary.persist.hasHydrated()) return;
      const p = player.getSnapshot();
      useLibrary.getState().saveProgress({
        episodeId: useLibrary.getState().activeEpisodeId,
        positionMs: p.positionMs,
        rate: p.rate,
      });
    };
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      player.tick(now - last);
      last = now;
    }, 100);
    const persistence = setInterval(save, 3000);
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        stopPronunciation();
        // Browser visibility changes must not cancel an explicit Play request.
        // The audio clock remains authoritative when returning to the tab.
        if (Platform.OS !== "web") player.pause();
        save();
      }
      if (state === "active") player.tick(0);
      last = Date.now();
    });
    return () => {
      clearInterval(timer);
      clearInterval(persistence);
      app.remove();
      unsub();
      save();
      stopPronunciation();
      player.dispose();
    };
  }, []);
  return null;
}
