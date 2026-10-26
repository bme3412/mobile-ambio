import { useSyncExternalStore } from "react";
import { createAudioPlayer } from "expo-audio";
import { createEpisodePlayer } from "./episodePlayer";
import { createMediaPlayer } from "./mediaAdapter";
export const player = createEpisodePlayer(({ episode, audio }) =>
  createMediaPlayer(episode.durationMs, () =>
    createAudioPlayer(audio, {
      updateInterval: 100,
    }),
  ),
);
export const usePlayback = () =>
  useSyncExternalStore(
    player.subscribe,
    player.getSnapshot,
    player.getSnapshot,
  );
export const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
