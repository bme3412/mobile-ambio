import { createDecodedPlayer } from "../src/playback/decodedPlayer";
import { resolveAudio } from "../src/data/catalog";
import { releaseAudio } from "../src/data/downloads";
import "../src/playback/player.web";
jest.mock("../src/data/catalog", () => ({
  resolveAudio: jest.fn(async () => "blob:downloaded-edition"),
}));
jest.mock("../src/data/downloads", () => ({ releaseAudio: jest.fn() }));
jest.mock("../src/playback/episodePlayer", () => ({
  createEpisodePlayer: (factory: (edition: unknown) => unknown) =>
    factory({
      episode: { id: "daily-fr-2026-10-27", durationMs: 60000 },
      audio: "",
    }),
}));
jest.mock("../src/playback/decodedPlayer", () => ({
  createDecodedPlayer: jest.fn(() => ({
    subscribe: jest.fn(),
    getSnapshot: jest.fn(),
  })),
}));
test("web audio decodes the repository-resolved file instead of fetching an empty bundled source", async () => {
  const original = global.fetch;
  const bytes = new ArrayBuffer(10);
  global.fetch = jest.fn(async () => ({
    ok: true,
    arrayBuffer: async () => bytes,
  })) as unknown as typeof fetch;
  try {
    const decodeAudioData = jest.fn(async () => ({}));
    const loader = jest.mocked(createDecodedPlayer).mock.calls[0][2];
    await loader({ decodeAudioData } as unknown as AudioContext);
    expect(resolveAudio).toHaveBeenCalledWith("daily-fr-2026-10-27");
    expect(global.fetch).toHaveBeenCalledWith("blob:downloaded-edition", {
      credentials: "same-origin",
    });
    expect(decodeAudioData).toHaveBeenCalledWith(bytes);
    expect(releaseAudio).toHaveBeenCalledWith("blob:downloaded-edition");
  } finally {
    global.fetch = original;
  }
});
