import { useSyncExternalStore } from "react";
import { episode } from "../data/episode";
import { createDecodedPlayer } from "./decodedPlayer";

export const player = createDecodedPlayer(
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
    const response = await fetch(
      require("../../assets/audio/edition-2026-10-24.mp3"),
      { credentials: "same-origin" },
    );
    if (!response.ok) throw new Error("Episode download failed");
    return context.decodeAudioData(await response.arrayBuffer());
  },
);
export const usePlayback = () =>
  useSyncExternalStore(
    player.subscribe,
    player.getSnapshot,
    player.getSnapshot,
  );
export const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
