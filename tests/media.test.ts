import { createMediaPlayer, MediaEngine } from "../src/playback/mediaAdapter";
function fixture() {
  let listener: (status: {
    currentTime: number;
    playing: boolean;
    error?: string;
  }) => void = () => {};
  const engine: MediaEngine = {
    currentTime: 0,
    playing: false,
    play: jest.fn(() => {
      engine.playing = true;
    }),
    pause: jest.fn(() => {
      engine.playing = false;
    }),
    seekTo: jest.fn(async (seconds) => {
      engine.currentTime = seconds;
    }),
    setPlaybackRate: jest.fn(),
    addListener: jest.fn((_event, fn) => {
      listener = fn;
      return { remove: jest.fn() };
    }),
    remove: jest.fn(),
  };
  const player = createMediaPlayer(10000, () => engine);
  return {
    player,
    engine,
    emit: (status: Parameters<typeof listener>[0]) => listener(status),
  };
}
test("media clock drives progress, not elapsed UI timer time", () => {
  const { player, engine } = fixture();
  player.play();
  engine.currentTime = 2.5;
  player.tick(90000);
  expect(player.getSnapshot().positionMs).toBe(2500);
  player.setRate(1.25);
  expect(engine.setPlaybackRate).toHaveBeenCalledWith(1.25);
  player.pause();
  expect(engine.pause).toHaveBeenCalled();
});
test("sentence replay seeks audio and stops at its end", async () => {
  const { player, engine } = fixture();
  player.replay(2000, 3500);
  await flush();
  expect(engine.seekTo).toHaveBeenCalledWith(2);
  engine.currentTime = 3.6;
  player.tick(0);
  expect(engine.pause).toHaveBeenCalled();
  expect(player.getSnapshot()).toMatchObject({
    positionMs: 3500,
    playing: false,
  });
});
test("playback failures surface and a user retry clears the error", () => {
  const { player, emit } = fixture();
  player.play();
  emit({ currentTime: 0, playing: false, error: "blocked" });
  expect(player.getSnapshot().error).toContain("tap Play");
  player.play();
  expect(player.getSnapshot().error).toBeNull();
  player.dispose();
});

async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
test("replaying an earlier passage ignores the old position until seeking finishes", async () => {
  const { player, engine, emit } = fixture();
  engine.currentTime = 8;
  let finish!: () => void;
  engine.seekTo = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = () => {
          engine.currentTime = 2;
          resolve();
        };
      }),
  );
  player.replay(2000, 3500);
  await flush();
  emit({ currentTime: 8, playing: true });
  player.tick(0);
  expect(player.getSnapshot().replayEndMs).toBe(3500);
  expect(engine.play).not.toHaveBeenCalled();
  finish();
  await flush();
  expect(engine.play).toHaveBeenCalledTimes(1);
  expect(player.getSnapshot().positionMs).toBe(2000);
});
test("pause cancels playback requested by an unfinished replay seek", async () => {
  const { player, engine } = fixture();
  let finish!: () => void;
  engine.seekTo = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  player.replay(2000, 3500);
  await flush();
  player.pause();
  finish();
  await flush();
  expect(engine.play).not.toHaveBeenCalled();
});
test("unchanged paused ticks preserve the snapshot and do not notify subscribers", () => {
  const { player } = fixture();
  player.play();
  player.pause();
  const snapshot = player.getSnapshot();
  const listener = jest.fn();
  player.subscribe(listener);
  for (let i = 0; i < 100; i++) player.tick(0);
  expect(listener).not.toHaveBeenCalled();
  expect(player.getSnapshot()).toBe(snapshot);
});
