import { PlaybackAdapter, PlaybackSnapshot } from "./adapter";

// The position is derived from the clock scheduling the audible buffer, never
// wall time or HTMLMediaElement seeking/currentTime status.
export function createDecodedPlayer(
  durationMs: number,
  createContext: () => AudioContext,
  load: (context: AudioContext) => Promise<AudioBuffer>,
) {
  let context: AudioContext | undefined;
  let buffer: AudioBuffer | undefined;
  let loading: Promise<AudioBuffer> | undefined;
  let source: AudioBufferSourceNode | undefined;
  let anchorTime = 0;
  let anchorPosition = 0;
  let wanted = false;
  let generation = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let state: PlaybackSnapshot & { error: string | null; loading: boolean } = {
    positionMs: 0,
    playing: false,
    rate: 1,
    replayEndMs: null,
    error: null,
    loading: false,
  };
  const listeners = new Set<() => void>();
  const clamp = (ms: number) => Math.max(0, Math.min(durationMs, ms));
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
  const position = () =>
    source && context
      ? clamp(
          anchorPosition +
            Math.max(0, context.currentTime - anchorTime) * 1000 * state.rate,
        )
      : state.positionMs;
  const stopSource = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    const old = source;
    source = undefined;
    if (old) {
      old.onended = null;
      old.stop();
      old.disconnect();
    }
  };
  const tick = () => {
    if (!source || !context) return;
    const end = state.replayEndMs ?? durationMs;
    const ms = position();
    if (ms >= end) {
      stopSource();
      wanted = false;
      update({ positionMs: end, playing: false, replayEndMs: null });
    } else update({ positionMs: ms, playing: context.state === "running" });
  };
  const begin = () => {
    if (!wanted || !buffer || !context || context.state !== "running") return;
    stopSource();
    anchorPosition = state.positionMs;
    anchorTime = context.currentTime;
    const node = context.createBufferSource();
    source = node;
    node.buffer = buffer;
    node.playbackRate.value = state.rate;
    node.connect(context.destination);
    const end = Math.min(
      state.replayEndMs ?? durationMs,
      buffer.duration * 1000,
    );
    node.onended = () => {
      if (source !== node) return;
      stopSource();
      wanted = false;
      update({ positionMs: end, playing: false, replayEndMs: null });
    };
    node.start(
      0,
      anchorPosition / 1000,
      Math.max(0, end - anchorPosition) / 1000,
    );
    timer = setInterval(tick, 100);
    update({ playing: true, loading: false, error: null });
  };
  const start = () => {
    wanted = true;
    const version = ++generation;
    try {
      if (!context) {
        context = createContext();
        context.onstatechange = () => {
          tick();
          if (wanted && !source && context?.state === "running" && buffer)
            begin();
        };
      }
      const ctx = context;
      // Resume synchronously inside the tap; download/decode may complete later.
      const resumed = ctx.resume();
      loading ??= load(ctx).then((value) => {
        if (context === ctx) buffer = value;
        return value;
      });
      update({ loading: !buffer, error: null });
      void Promise.all([resumed, loading])
        .then(() => {
          if (version === generation && wanted) begin();
        })
        .catch(() => {
          if (version !== generation) return;
          loading = undefined;
          wanted = false;
          update({
            playing: false,
            loading: false,
            error:
              "Audio could not load. Check your connection and tap Play to retry.",
          });
        });
    } catch {
      wanted = false;
      update({
        playing: false,
        loading: false,
        error: "Audio could not start. Tap Play to retry.",
      });
    }
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
      update({
        positionMs: state.positionMs >= durationMs ? 0 : position(),
        replayEndMs: null,
      });
      start();
    },
    pause: () => {
      const ms = position();
      wanted = false;
      generation++;
      stopSource();
      update({ positionMs: ms, playing: false, loading: false });
    },
    seek: (ms) => {
      stopSource();
      update({ positionMs: clamp(ms), replayEndMs: null });
      if (wanted) begin();
    },
    replay: (startMs, endMs) => {
      stopSource();
      update({ positionMs: clamp(startMs), replayEndMs: clamp(endMs) });
      if (endMs > startMs) start();
      else adapter.pause();
    },
    setRate: (rate) => {
      const ms = position();
      stopSource();
      update({ positionMs: ms, rate: Math.max(0.5, Math.min(2, rate)) });
      if (wanted) begin();
    },
    tick,
    dispose: () => {
      adapter.pause();
      if (context) {
        context.onstatechange = null;
        void context.close();
      }
      context = undefined;
      buffer = undefined;
      loading = undefined;
    },
  };
  return adapter;
}
