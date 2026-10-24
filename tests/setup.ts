jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// UI interaction tests use a deterministic clock; media integration has its own adapter tests.
jest.mock("../src/playback/player", () => {
  const { useSyncExternalStore } = jest.requireActual("react");
  const { createSimulatedPlayer } = jest.requireActual(
    "../src/playback/adapter",
  );
  const { episode } = jest.requireActual("../src/data/episode");
  const player = createSimulatedPlayer(episode.durationMs);
  return {
    player,
    usePlayback: () =>
      useSyncExternalStore(
        player.subscribe,
        player.getSnapshot,
        player.getSnapshot,
      ),
    time: (ms: number) =>
      `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`,
  };
});
jest.mock("../src/playback/pronunciation", () => ({
  hasPronunciation: () => false,
  pronounce: jest.fn(),
  stopPronunciation: jest.fn(),
}));

// Screen tests render outside the app's SafeAreaProvider.
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
