import { PlaybackAdapter, PlaybackSnapshot } from "./adapter";
import { getEdition } from "../data/catalog";
import { useLibrary } from "../state/library";

type Engine = Omit<PlaybackAdapter, "getSnapshot"> & {
  dispose(): void;
  getSnapshot(): PlaybackSnapshot & {
    loading?: boolean;
    error?: string | null;
  };
};
// Keep the public player stable while replacing and disposing its audio engine.
export function createEpisodePlayer(
  factory: (edition: ReturnType<typeof getEdition>) => Engine,
) {
  let id = useLibrary.getState().activeEpisodeId;
  let engine = factory(getEdition(id));
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());
  let unsubscribe = engine.subscribe(emit);
  const save = () => {
    if (!useLibrary.persist.hasHydrated()) return;
    const { positionMs, rate } = engine.getSnapshot();
    useLibrary.getState().saveProgress({ episodeId: id, positionMs, rate });
  };
  const switchEpisode = (next: string) => {
    if (next === id) return;
    unsubscribe();
    engine.pause();
    save();
    engine.dispose();
    id = next;
    engine = factory(getEdition(id));
    const progress = useLibrary.getState().progressByEpisode[id];
    if (progress) {
      engine.seek(progress.positionMs);
      engine.setRate(progress.rate);
    }
    unsubscribe = engine.subscribe(emit);
    emit();
  };
  useLibrary.subscribe((state, previous) => {
    if (state.activeEpisodeId !== previous.activeEpisodeId)
      switchEpisode(state.activeEpisodeId);
  });
  return {
    getSnapshot: () => engine.getSnapshot(),
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    play: () => engine.play(),
    pause: () => engine.pause(),
    seek: (ms: number) => engine.seek(ms),
    replay: (start: number, end: number) => engine.replay(start, end),
    setRate: (rate: number) => engine.setRate(rate),
    tick: (ms: number) => engine.tick(ms),
    dispose: () => engine.dispose(),
  };
}
