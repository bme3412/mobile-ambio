export interface PlaybackSnapshot {
  positionMs: number;
  playing: boolean;
  rate: number;
  replayEndMs: number | null;
}
export interface PlaybackAdapter {
  getSnapshot(): PlaybackSnapshot;
  subscribe(listener: () => void): () => void;
  play(): void;
  pause(): void;
  seek(positionMs: number): void;
  replay(startMs: number, endMs: number): void;
  setRate(rate: number): void;
  tick(elapsedMs: number): void;
}
export function createSimulatedPlayer(durationMs: number): PlaybackAdapter {
  let state: PlaybackSnapshot = {
    positionMs: 0,
    playing: false,
    rate: 1,
    replayEndMs: null,
  };
  const listeners = new Set<() => void>();
  const clamp = (value: number) => Math.max(0, Math.min(durationMs, value));
  const update = (patch: Partial<PlaybackSnapshot>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  return {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    play: () =>
      update({
        playing: true,
        replayEndMs: null,
        positionMs: state.positionMs >= durationMs ? 0 : state.positionMs,
      }),
    pause: () => update({ playing: false }),
    seek: (value) => update({ positionMs: clamp(value), replayEndMs: null }),
    replay: (start, end) => {
      const positionMs = clamp(start);
      const replayEndMs = clamp(end);
      update({ positionMs, replayEndMs, playing: replayEndMs > positionMs });
    },
    setRate: (rate) => update({ rate: Math.max(0.5, Math.min(2, rate)) }),
    tick: (elapsed) => {
      if (!state.playing) return;
      const end = state.replayEndMs ?? durationMs;
      const positionMs = Math.min(
        end,
        state.positionMs + Math.max(0, elapsed) * state.rate,
      );
      update({ positionMs, playing: positionMs < end });
    },
  };
}
