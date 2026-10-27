import { useSyncExternalStore } from "react";
import { createEpisodePlayer } from "./episodePlayer";
import { createEditionMedia } from "./editionMedia";
export const player = createEpisodePlayer(createEditionMedia);
export const usePlayback = () =>
  useSyncExternalStore(
    player.subscribe,
    player.getSnapshot,
    player.getSnapshot,
  );
export const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
