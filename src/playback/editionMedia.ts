import { createAudioPlayer } from "expo-audio";
import { getEdition, resolveAudio } from "../data/catalog";
import { releaseAudio } from "../data/downloads";
import { createMediaPlayer } from "./mediaAdapter";
import type { PlaybackSnapshot } from "./adapter";
export function createEditionMedia(edition: ReturnType<typeof getEdition>) {
  const create = (source: number | string) =>
    createMediaPlayer(edition.episode.durationMs, () =>
      createAudioPlayer(source, { updateInterval: 100 }),
    );
  if (edition.audio) return create(edition.audio);
  let state: PlaybackSnapshot & { loading: boolean; error: string | null } = {
    positionMs: 0,
    playing: false,
    rate: 1,
    replayEndMs: null,
    loading: false,
    error: null,
  };
  let media: ReturnType<typeof createMediaPlayer> | undefined;
  let source: string | number | undefined;
  let unsubscribe: (() => void) | undefined;
  let generation = 0;
  let wantsPlayback = false;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<typeof state>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  const reset = () => {
    unsubscribe?.();
    media?.dispose();
    media = undefined;
    if (typeof source === "string") releaseAudio(source);
    source = undefined;
  };
  const start = async () => {
    wantsPlayback = true;
    if (state.loading) return;
    if (media && !state.error) {
      if (state.replayEndMs !== null)
        media.replay(state.positionMs, state.replayEndMs);
      else media.play();
      return;
    }
    reset();
    const version = ++generation;
    update({ loading: true, error: null });
    try {
      const resolved = await resolveAudio(edition.episode.id);
      if (version !== generation) {
        if (typeof resolved === "string") releaseAudio(resolved);
        return;
      }
      source = resolved;
      media = create(source);
      const pending = { ...state };
      media.setRate(pending.rate);
      media.seek(pending.positionMs);
      unsubscribe = media.subscribe(() => {
        if (media) update({ ...media.getSnapshot(), loading: false });
      });
      update({ loading: false });
      if (wantsPlayback) {
        if (pending.replayEndMs !== null)
          media.replay(pending.positionMs, pending.replayEndMs);
        else media.play();
      }
    } catch {
      if (version === generation)
        update({
          loading: false,
          playing: false,
          error:
            "Audio is unavailable. Check your connection or download this edition, then tap Play to retry.",
        });
    }
  };
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    play: () => {
      update({ replayEndMs: null });
      void start();
    },
    pause: () => {
      wantsPlayback = false;
      media?.pause();
      update({ playing: false });
    },
    seek: (ms: number) => {
      const positionMs = Math.max(0, Math.min(edition.episode.durationMs, ms));
      update({ positionMs, replayEndMs: null });
      media?.seek(positionMs);
    },
    replay: (startMs: number, endMs: number) => {
      update({ positionMs: startMs, replayEndMs: endMs });
      void start();
    },
    setRate: (rate: number) => {
      update({ rate });
      media?.setRate(rate);
    },
    tick: (ms: number) => media?.tick(ms),
    dispose: () => {
      ++generation;
      wantsPlayback = false;
      reset();
      update({ loading: false, playing: false });
    },
  };
}
