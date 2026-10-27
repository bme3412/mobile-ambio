import AsyncStorage from "@react-native-async-storage/async-storage";
import { fixture } from "./edition-fixture";
import {
  refreshCatalog,
  getEdition,
  latestEdition,
  useCatalog,
  resolveAudio,
  downloadEdition,
  removeDownload,
} from "../src/data/catalog";
import { useLibrary } from "../src/state/library";
import * as downloads from "../src/data/downloads";
jest.mock("../src/data/downloads", () => ({
  localAudio: jest.fn(async () => null),
  saveAudio: jest.fn(async () => {}),
  removeAudio: jest.fn(async () => {}),
  releaseAudio: jest.fn(),
}));
jest.mock("../src/conversation/api", () => ({
  voiceApi: { request: (...args: Parameters<typeof fetch>) => fetch(...args) },
}));
const original = global.fetch;
afterAll(() => {
  global.fetch = original;
});
test("refresh discovers a new edition without moving the active selection; resolves fresh URLs and offline files", async () => {
  const b = fixture();
  const selected = useLibrary.getState().activeEpisodeId;
  let signed = 0;
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    status: 200,
    json: async () =>
      String(url).endsWith("/media")
        ? { url: `https://media.example/${++signed}`, bytes: 500 }
        : String(url) === "/api/editions"
          ? { schemaVersion: 1, editions: [{ id: b.id }] }
          : b,
  })) as unknown as typeof fetch;
  await refreshCatalog();
  expect(useCatalog.getState().error).toBeNull();
  expect(latestEdition.episode.id).toBe(b.id);
  expect(useLibrary.getState().activeEpisodeId).toBe(selected);
  expect(getEdition(b.id).episode.segments.length).toBeGreaterThan(0);
  expect(await resolveAudio(b.id)).toBe("https://media.example/1");
  expect(await resolveAudio(b.id)).toBe("https://media.example/2");
  await downloadEdition(b.id);
  expect(useCatalog.getState().downloads[b.id]).toBe("downloaded");
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    "ambio-edition-downloads-v1",
    JSON.stringify([b.id]),
  );
  jest.mocked(downloads.localAudio).mockResolvedValue("file:///saved.mp3");
  expect(await resolveAudio(b.id)).toBe("file:///saved.mp3");
  await removeDownload(b.id);
  expect(downloads.removeAudio).toHaveBeenCalledWith(b.id);
});
test("offline refresh retains cached editions and reports a retryable error", async () => {
  const before = latestEdition.episode.id;
  global.fetch = jest.fn(async () => {
    throw Error("Network unavailable");
  }) as unknown as typeof fetch;
  await refreshCatalog();
  expect(latestEdition.episode.id).toBe(before);
  expect(useCatalog.getState().error).toBeTruthy();
  expect(useCatalog.getState().loading).toBe(false);
});
test("failed downloads never claim offline availability", async () => {
  global.fetch = jest.fn(async () => ({
    ok: false,
    status: 503,
  })) as unknown as typeof fetch;
  await downloadEdition("daily-fr-2026-10-27");
  expect(useCatalog.getState().downloads["daily-fr-2026-10-27"]).toBe("error");
});
