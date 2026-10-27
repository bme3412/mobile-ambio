import { resolveAudio } from "../data/catalog";
import { releaseAudio } from "../data/downloads";
import { useSyncExternalStore } from "react";
import { createEpisodePlayer } from "./episodePlayer";
import { createDecodedPlayer } from "./decodedPlayer";

export const player = createEpisodePlayer(({ episode }) =>
  createDecodedPlayer(
    episode.durationMs,
    () => {
      // Safari otherwise treats Web Audio as ambient sound and can mute it with
      // the ring/silent switch even while the audio-engine clock keeps advancing.
      const session = (
        navigator as Navigator & {
          audioSession?: { type: string };
        }
      ).audioSession;
      if (session) session.type = "playback";
      return new AudioContext();
    },
    async (context) => {
      const audio = await resolveAudio(episode.id);
      try {
        const response = await fetch(String(audio), {
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Episode download failed");
        return await context.decodeAudioData(await response.arrayBuffer());
      } finally {
        if (typeof audio === "string") releaseAudio(audio);
      }
    },
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
