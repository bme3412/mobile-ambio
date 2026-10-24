import { useSyncExternalStore } from "react";
import { createAudioPlayer } from "expo-audio";
import { episode } from "../data/episode";
import { createMediaPlayer } from "./mediaAdapter";
export const player = createMediaPlayer(episode.durationMs, () =>
  createAudioPlayer(require("../../assets/audio/edition-2026-10-24.mp3"), {
    updateInterval: 100,
  }),
);
export const usePlayback = () =>
  useSyncExternalStore(
    player.subscribe,
    player.getSnapshot,
    player.getSnapshot,
  );
export const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
