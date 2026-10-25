import { createBrowserPlayer } from "../src/playback/browserAdapter";

function fixture() {
  const handlers = new Map<string, Set<() => void>>();
  const audio = {
    currentTime: 0,
    paused: true,
    ended: false,
    seeking: false,
    readyState: 1,
    error: null,
    playbackRate: 1,
    play: jest.fn(() => {
      audio.paused = false;
      return Promise.resolve();
    }),
    pause: jest.fn(() => {
      audio.paused = true;
    }),
    addEventListener: (event: string, fn: () => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
    },
    removeEventListener: (event: string, fn: () => void) =>
      handlers.get(event)?.delete(fn),
    removeAttribute: jest.fn(),
    load: jest.fn(),
    remove: jest.fn(),
  };
  const player = createBrowserPlayer(
    100000,
    () => audio as unknown as HTMLAudioElement,
  );
  return {
    audio,
    player,
    emit: (event: string) => handlers.get(event)?.forEach((fn) => fn()),
  };
}

test("media events advance the shared clock even without the UI polling timer", () => {
  const { audio, player, emit } = fixture();
  player.play();
  audio.currentTime = 12.3;
  emit("timeupdate");
  expect(player.getSnapshot()).toMatchObject({
    positionMs: 12300,
    playing: true,
  });
  audio.currentTime = 18;
  player.tick(0);
  expect(player.getSnapshot().positionMs).toBe(18000);
});

test("Safari play runs in the user gesture even when a restored seek awaits metadata", () => {
  const { audio, player, emit } = fixture();
  audio.readyState = 0;
  player.seek(66000);
  player.play();
  expect(audio.play).toHaveBeenCalledTimes(1);
  expect(player.getSnapshot().positionMs).toBe(66000);
  audio.readyState = 1;
  emit("loadedmetadata");
  expect(audio.currentTime).toBe(66);
  audio.currentTime = 67;
  emit("timeupdate");
  expect(player.getSnapshot()).toMatchObject({
    positionMs: 67000,
    playing: true,
  });
});

test("a seek during playback does not pause audio or leave the clock locked", () => {
  const { audio, player, emit } = fixture();
  player.play();
  player.seek(50000);
  expect(audio.pause).not.toHaveBeenCalled();
  audio.currentTime = 51;
  emit("timeupdate");
  expect(player.getSnapshot().positionMs).toBe(51000);
});

test("sentence replay stops at the selected boundary and dispose detaches listeners", () => {
  const { audio, player, emit } = fixture();
  player.replay(2000, 4000);
  audio.currentTime = 4.1;
  emit("timeupdate");
  expect(player.getSnapshot()).toMatchObject({
    positionMs: 4000,
    playing: false,
    replayEndMs: null,
  });
  player.dispose();
  const snapshot = player.getSnapshot();
  audio.currentTime = 20;
  emit("timeupdate");
  expect(player.getSnapshot()).toBe(snapshot);
  expect(audio.remove).toHaveBeenCalled();
});

test("Safari seeking flag cannot freeze an advancing audio clock", () => {
  const { audio, player, emit } = fixture();
  player.play();
  player.seek(66000);
  audio.seeking = true;
  audio.currentTime = 67;
  emit("timeupdate");
  expect(player.getSnapshot().positionMs).toBe(67000);
  audio.currentTime = 68;
  player.tick(100);
  expect(player.getSnapshot().positionMs).toBe(68000);
});

test("metadata missed before listener registration cannot lock a restored seek", () => {
  const { audio, player, emit } = fixture();
  audio.readyState = 0;
  player.seek(66000);
  audio.readyState = 4;
  player.play();
  expect(audio.currentTime).toBe(66);
  audio.currentTime = 67;
  emit("timeupdate");
  expect(player.getSnapshot().positionMs).toBe(67000);
});
