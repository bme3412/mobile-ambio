import { PlaybackAdapter, PlaybackSnapshot } from "./adapter";

// Read the clock from the same HTML media element that produces the sound.
// Do not wait for an asynchronous seek before calling play(): Safari requires
// play() to run directly inside the user's gesture.
export function createBrowserPlayer(
  durationMs: number,
  create: () => HTMLAudioElement,
) {
  let media: HTMLAudioElement | undefined;
  let pendingSeek: number | null = null;
  let playRequest = 0;
  let state: PlaybackSnapshot & { error: string | null } = {
    positionMs: 0,
    playing: false,
    rate: 1,
    replayEndMs: null,
    error: null,
  };
  const listeners = new Set<() => void>();
  const clamp = (value: number) => Math.max(0, Math.min(durationMs, value));
  const update = (patch: Partial<typeof state>) => {
    if (
      Object.entries(patch).every(
        ([key, value]) => state[key as keyof typeof state] === value,
      )
    )
      return;
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const fail = () =>
    update({
      playing: false,
      error:
        "Audio could not play. Check your connection, then tap Play to retry.",
    });
  const sync = () => {
    if (!media) return;
    if (media.error) {
      fail();
      return;
    }
    // Safari can continue producing audio while its seeking flag remains true.
    // That flag must never freeze the clock used by every transcript view.
    applySeek();
    const positionMs =
      pendingSeek !== null ? state.positionMs : clamp(media.currentTime * 1000);
    if (state.replayEndMs !== null && positionMs >= state.replayEndMs) {
      const end = state.replayEndMs;
      update({ replayEndMs: null, positionMs: end, playing: false });
      media.pause();
      media.currentTime = end / 1000;
      return;
    }
    update({ positionMs, playing: !media.paused && !media.ended });
  };
  const applySeek = () => {
    if (media && media.readyState > 0 && pendingSeek !== null) {
      media.currentTime = pendingSeek / 1000;
      pendingSeek = null;
    }
  };
  const events = [
    "timeupdate",
    "playing",
    "play",
    "pause",
    "seeked",
    "ended",
    "ratechange",
    "error",
  ];
  const loaded = () => {
    applySeek();
    sync();
  };
  const get = () => {
    if (!media) {
      media = create();
      media.playbackRate = state.rate;
      events.forEach((event) => media!.addEventListener(event, sync));
      media.addEventListener("loadedmetadata", loaded);
    }
    return media;
  };
  const seek = (ms: number) => {
    pendingSeek = clamp(ms);
    update({ positionMs: pendingSeek, replayEndMs: null, error: null });
    get();
    applySeek();
  };
  const start = () => {
    const request = ++playRequest;
    try {
      const audio = get();
      // Call synchronously, before awaiting metadata or any promise.
      void audio.play().catch((error: unknown) => {
        if (request !== playRequest || audio !== media) return;
        if (error instanceof Error && error.name === "AbortError") return;
        fail();
      });
      sync();
    } catch {
      fail();
    }
  };
  const adapter: Omit<PlaybackAdapter, "getSnapshot"> & {
    getSnapshot: () => typeof state;
    dispose: () => void;
  } = {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    play: () => {
      if (state.positionMs >= durationMs) seek(0);
      update({ replayEndMs: null, error: null });
      start();
    },
    pause: () => {
      playRequest++;
      media?.pause();
      update({ playing: false });
    },
    seek,
    replay: (startMs, endMs) => {
      seek(startMs);
      update({ replayEndMs: clamp(endMs) });
      if (endMs > startMs) start();
      else adapter.pause();
    },
    setRate: (rate) => {
      const bounded = Math.max(0.5, Math.min(2, rate));
      get().playbackRate = bounded;
      update({ rate: bounded });
    },
    tick: sync,
    dispose: () => {
      playRequest++;
      if (media) {
        events.forEach((event) => media!.removeEventListener(event, sync));
        media.removeEventListener("loadedmetadata", loaded);
        media.pause();
        media.removeAttribute("src");
        media.load();
        media.remove();
        media = undefined;
      }
      pendingSeek = null;
      update({ playing: false });
    },
  };
  return adapter;
}
