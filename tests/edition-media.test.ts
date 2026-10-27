import { createEditionMedia } from "../src/playback/editionMedia";
import { fixture } from "./edition-fixture";
import { fromBundle } from "../src/data/editionBundle";
import { resolveAudio } from "../src/data/catalog";
import { createAudioPlayer } from "expo-audio";
jest.mock("../src/data/catalog", () => ({ resolveAudio: jest.fn() }));
jest.mock("../src/data/downloads", () => ({ releaseAudio: jest.fn() }));
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn() }));
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
test("pause while resolving audio cannot start playback; retry refreshes the signed URL", async () => {
  let finish!: (url: string) => void;
  jest.mocked(resolveAudio).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const engine = {
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(async () => {}),
    setPlaybackRate: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    remove: jest.fn(),
    currentTime: 0,
    playing: false,
  };
  jest
    .mocked(createAudioPlayer)
    .mockReturnValue(engine as unknown as ReturnType<typeof createAudioPlayer>);
  const media = createEditionMedia(fromBundle(fixture()));
  media.seek(5000);
  media.play();
  media.pause();
  finish("https://audio.example/one");
  await flush();
  expect(engine.play).not.toHaveBeenCalled();
  expect(engine.seekTo).toHaveBeenCalledWith(5);
  media.dispose();
  jest.mocked(resolveAudio).mockRejectedValueOnce(Error("expired"));
  media.play();
  await flush();
  expect(media.getSnapshot().error).toBeTruthy();
  jest.mocked(resolveAudio).mockResolvedValueOnce("https://audio.example/two");
  media.play();
  await flush();
  expect(engine.play).toHaveBeenCalled();
  media.dispose();
});
