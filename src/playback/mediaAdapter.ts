import { PlaybackAdapter, PlaybackSnapshot } from "./adapter";
export interface MediaEngine {
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  setPlaybackRate(rate: number): void;
  currentTime: number;
  playing: boolean;
  addListener(
    event: "playbackStatusUpdate",
    fn: (status: {
      currentTime: number;
      playing: boolean;
      didJustFinish?: boolean;
      error?: string | null;
    }) => void,
  ): { remove(): void };
  remove(): void;
}
export function createMediaPlayer(
  durationMs: number,
  create: () => MediaEngine,
) {
  let state: PlaybackSnapshot & { error: string | null; loading?: boolean } = {
    positionMs: 0,
    playing: false,
    rate: 1,
    replayEndMs: null,
    error: null,
  };
  let engine: MediaEngine | undefined;
  let subscription: { remove(): void } | undefined;
  let seekVersion = 0;
  let seeking = false;
  let wantsPlayback = false;
  let seekQueue = Promise.resolve();
  const listeners = new Set<() => void>();
  const clamp = (n: number) => Math.max(0, Math.min(durationMs, n));
  const update = (patch: Partial<typeof state>) => {
    if (
      Object.entries(patch).every(
        ([key, value]) => state[key as keyof typeof state] === value,
      )
    )
      return;
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  const fail = () =>
    update({
      playing: false,
      error:
        "Audio could not play. Check your connection to the Mac, then tap Play to retry.",
    });
  const sync = (status: {
    currentTime: number;
    playing: boolean;
    didJustFinish?: boolean;
    error?: string | null;
  }) => {
    if (status.error) {
      fail();
      return;
    }
    if (seeking) return;
    if (status.didJustFinish) wantsPlayback = false;
    const positionMs = clamp(status.currentTime * 1000);
    if (state.replayEndMs !== null && positionMs >= state.replayEndMs) {
      const end = state.replayEndMs;
      update({ replayEndMs: null, playing: false, positionMs: end });
      wantsPlayback = false;
      engine?.pause();
      seek(end);
      return;
    }
    update({ positionMs, playing: status.playing && !status.didJustFinish });
  };
  const get = () => {
    if (!engine) {
      engine = create();
      subscription = engine.addListener("playbackStatusUpdate", sync);
    }
    return engine;
  };
  const seek = (ms: number) => {
    const positionMs = clamp(ms);
    const version = ++seekVersion;
    seeking = true;
    engine?.pause();
    update({ positionMs, replayEndMs: null, error: null });
    seekQueue = seekQueue.then(async () => {
      if (version !== seekVersion) return;
      try {
        const media = get();
        await media.seekTo(positionMs / 1000);
        if (version !== seekVersion) return;
        seeking = false;
        if (wantsPlayback) media.play();
      } catch {
        if (version !== seekVersion) return;
        seeking = false;
        wantsPlayback = false;
        fail();
      }
    });
  };
  const adapter: Omit<PlaybackAdapter, "getSnapshot"> & {
    getSnapshot: () => typeof state;
    dispose: () => void;
  } = {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    play: () => {
      try {
        wantsPlayback = true;
        if (state.positionMs >= durationMs) seek(0);
        update({ replayEndMs: null, error: null });
        if (!seeking) get().play();
      } catch {
        fail();
      }
    },
    pause: () => {
      wantsPlayback = false;
      engine?.pause();
      update({ playing: false });
    },
    seek,
    replay: (start, end) => {
      wantsPlayback = end > start;
      seek(start);
      update({ replayEndMs: clamp(end) });
    },
    setRate: (rate) => {
      const bounded = Math.max(0.5, Math.min(2, rate));
      get().setPlaybackRate(bounded);
      update({ rate: bounded });
    },
    tick: () => {
      if (engine)
        sync({ currentTime: engine.currentTime, playing: engine.playing });
    },
    dispose: () => {
      seekVersion++;
      seeking = false;
      wantsPlayback = false;
      subscription?.remove();
      engine?.remove();
      engine = undefined;
      update({ playing: false });
    },
  };
  return adapter;
}
