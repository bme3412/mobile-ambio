import { createDecodedPlayer } from "../src/playback/decodedPlayer";
function fixture() {
  const sources: {
    start: jest.Mock;
    stop: jest.Mock;
    disconnect: jest.Mock;
    connect: jest.Mock;
    playbackRate: { value: number };
    onended: null | (() => void);
    buffer: unknown;
  }[] = [];
  const ctx = {
    currentTime: 0,
    state: "running",
    destination: {},
    onstatechange: null as null | (() => void),
    resume: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
    createBufferSource: () => {
      const node = {
        start: jest.fn(),
        stop: jest.fn(),
        disconnect: jest.fn(),
        connect: jest.fn(),
        playbackRate: { value: 1 },
        onended: null,
        buffer: null,
      };
      sources.push(node);
      return node;
    },
  };
  let finish!: (buffer: AudioBuffer) => void;
  const load = jest.fn(
    () =>
      new Promise<AudioBuffer>((resolve) => {
        finish = resolve;
      }),
  );
  const player = createDecodedPlayer(
    100000,
    () => ctx as unknown as AudioContext,
    load,
  );
  return {
    player,
    ctx,
    sources,
    load,
    loaded: async () => {
      finish({ duration: 100 } as AudioBuffer);
      for (let i = 0; i < 8; i++) await Promise.resolve();
    },
  };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
test("audio engine clock drives all progress independently of wall clock", async () => {
  const { player, ctx, loaded } = fixture();
  player.play();
  expect(ctx.resume).toHaveBeenCalledTimes(1);
  expect(player.getSnapshot().loading).toBe(true);
  await loaded();
  ctx.currentTime = 6.02;
  jest.advanceTimersByTime(100);
  expect(player.getSnapshot()).toMatchObject({
    positionMs: 6020,
    playing: true,
    loading: false,
  });
  jest.advanceTimersByTime(10000);
  expect(player.getSnapshot().positionMs).toBe(6020);
  player.dispose();
});
test("pause during loading cannot start audio later", async () => {
  const { player, sources, loaded } = fixture();
  player.play();
  player.pause();
  await loaded();
  expect(sources).toHaveLength(0);
  expect(player.getSnapshot().playing).toBe(false);
  player.dispose();
});
test("restored seek, rate change and resume preserve audio position", async () => {
  const { player, ctx, sources, loaded } = fixture();
  player.seek(6000);
  player.play();
  await loaded();
  expect(sources[0].start).toHaveBeenCalledWith(0, 6, 94);
  ctx.currentTime = 2;
  player.setRate(1.5);
  ctx.currentTime = 4;
  player.tick(0);
  expect(player.getSnapshot().positionMs).toBe(11000);
  player.pause();
  ctx.currentTime = 8;
  player.tick(0);
  expect(player.getSnapshot().positionMs).toBe(11000);
  player.dispose();
});
test("replay schedules an exact ending and ignores stopped source callbacks", async () => {
  const { player, ctx, sources, loaded } = fixture();
  player.replay(2000, 4000);
  await loaded();
  expect(sources[0].start).toHaveBeenCalledWith(0, 2, 2);
  ctx.currentTime = 2;
  player.tick(0);
  expect(player.getSnapshot()).toMatchObject({
    positionMs: 4000,
    playing: false,
    replayEndMs: null,
  });
  player.dispose();
});
