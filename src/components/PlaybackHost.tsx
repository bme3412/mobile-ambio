import { listeningCredit } from "../activity/learning";
import { useActivity } from "../state/activity";
import { findEdition } from "../data/catalog";
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
      if (
        !useLibrary.persist.hasHydrated() ||
        !findEdition(useLibrary.getState().activeEpisodeId)
      )
        return;
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
    let sample = {
      time: Date.now(),
      state: player.getSnapshot(),
      epoch: player.getTrackingEpoch(),
    };
    const learning = setInterval(() => {
      const now = Date.now(),
        state = player.getSnapshot(),
        epoch = player.getTrackingEpoch();
      const elapsed = now - sample.time;
      const credit = listeningCredit(
        sample.state,
        state,
        elapsed,
        epoch === sample.epoch,
      );
      if (useActivity.persist.hasHydrated() && credit > 0) {
        const edition = findEdition(useLibrary.getState().activeEpisodeId);
        const words =
          edition?.episode.segments
            .flatMap((s) => s.words)
            .filter(
              (w) =>
                w.startMs >= sample.state.positionMs &&
                w.startMs < state.positionMs,
            )
            .map((w) => w.text)
            .join(" ") ?? "";
        useActivity.getState().track("listening", now - credit, now, words);
      }
      sample = { time: now, state, epoch };
    }, 1000);
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
      clearInterval(learning);
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
