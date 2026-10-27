import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { useActivity } from "../state/activity";
import { voiceApi } from "../conversation/api";
import {
  assertEditionBundle,
  fromBundle,
  type EditionBundle,
} from "./editionBundle";
import { localAudio, saveAudio, removeAudio, releaseAudio } from "./downloads";
import {
  episode,
  episodeSources,
  speakingPrompt,
  featuredPhrase,
} from "./episode";
import { episodePhrases } from "./phrases";
import { vocabulary } from "./vocabulary";
import audioTiming from "./audio-timing.json";
import editorial25 from "./editions/2026-10-25/editorial.json";
import timing25 from "./editions/2026-10-25/audio-timing.json";
import vocabulary25 from "./editions/2026-10-25/vocabulary.json";
import definitions25 from "./editions/2026-10-25/dictionary.json";
import pairs25 from "./editions/2026-10-25/phrases.json";
import editorial26 from "./editions/2026-10-26/editorial.json";
import timing26 from "./editions/2026-10-26/audio-timing.json";
import vocabulary26 from "./editions/2026-10-26/vocabulary.json";
import definitions26 from "./editions/2026-10-26/dictionary.json";
import pairs26 from "./editions/2026-10-26/phrases.json";
import { buildEdition } from "./buildEdition";
import { useLibrary } from "../state/library";

export const DEFAULT_EPISODE_ID = "daily-fr-2026-10-24";
const original = {
  episode,
  date: "24 octobre 2026",
  verifiedAt: undefined as string | undefined,
  episodeSources,
  speakingPrompt,
  featuredPhrase,
  episodePhrases,
  vocabulary,
  audioTiming,
  audio: require("../../assets/audio/edition-2026-10-24-cafe.mp3"),
};
export let editions = [
  buildEdition({
    date: "2026-10-26",
    editorial: editorial26,
    timing: timing26,
    pairs: pairs26,
    definitions: definitions26,
    vocabulary: vocabulary26,
    audio: require("../../assets/audio/edition-2026-10-26-cafe.mp3"),
    featured: {
      ...editorial26.featuredPhrase,
      id: "phrase-tenir-compte-de-20261026",
    },
  }),
  buildEdition({
    date: "2026-10-25",
    editorial: editorial25,
    timing: timing25,
    pairs: pairs25,
    definitions: definitions25,
    vocabulary: vocabulary25,
    audio: require("../../assets/audio/edition-2026-10-25-cafe.mp3"),
    featured: {
      id: "phrase-a-portee-de-main-20261025",
      text: "à portée de main",
      meaning: "within reach",
      segmentIndex: 20,
      startWord: 5,
      wordCount: 4,
      example: "La curiosité à portée de main.",
    },
  }),
  original,
];
export let LATEST_EPISODE_ID = "daily-fr-2026-10-26";
export let latestEdition = editions.find(
  ({ episode }) => episode.id === LATEST_EPISODE_ID,
)!;
export const findEdition = (id: string) =>
  editions.find((item) => item.episode.id === id);
export const getEdition = (id: string) => {
  const found = findEdition(id);
  if (!found) throw Error("This edition is unavailable. Connect and retry.");
  return found;
};
export const editionForSegment = (id: string) =>
  editions.find((item) =>
    item.episode.segments.some((segment) => segment.id === id),
  );
export const phraseAt = (phrases: typeof episodePhrases, positionMs: number) =>
  phrases[
    Math.max(
      0,
      phrases.findLastIndex(({ words }) => words[0].startMs <= positionMs),
    )
  ];
export function useEpisodeData() {
  useCatalog((s) => s.version);
  const id = useLibrary((state) => state.activeEpisodeId);
  const data = getEdition(id);
  return {
    ...data,
    currentPhrase: (positionMs: number) =>
      phraseAt(data.episodePhrases, positionMs),
  };
}

const bundled = [...editions];
const cacheKey = "ambio-edition-bundles-v1";
const bundles = new Map<string, EditionBundle>();
const inFlight = new Map<string, Promise<void>>();
let refreshTask: Promise<void> | undefined;
let hydrated = false;
export const useCatalog = create<{
  version: number;
  loading: boolean;
  error: string | null;
  signedOut: boolean;
  nextCursor: string | null;
  downloads: Record<string, "downloading" | "downloaded" | "error">;
}>(() => ({
  version: 0,
  loading: false,
  error: null,
  signedOut: false,
  nextCursor: null,
  downloads: {},
}));
function notify() {
  useCatalog.setState((s) => ({ version: s.version + 1 }));
}
async function request(path: string) {
  const response = await voiceApi.request(path, {
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401) {
    useCatalog.setState({ signedOut: true });
    throw Error("Sign in to load new editions.");
  }
  if (response.status === 404) throw Error("This edition is unavailable.");
  if (!response.ok)
    throw Error(
      "New editions are unavailable. Downloaded editions still work. Please retry.",
    );
  useCatalog.setState({ signedOut: false });
  return response.json();
}
function install(b: EditionBundle) {
  if (bundles.has(b.id)) return;
  const built = fromBundle(b);
  bundles.set(b.id, b);
  // Keep the exact original bundled objects (and their local audio) for legacy references.
  if (!findEdition(b.id)) editions = [...editions, built];
}
async function persistBundles() {
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify([...bundles.values()]));
  } catch {
    useCatalog.setState({
      error: "Edition cache could not be saved on this device.",
    });
  }
}
export async function loadEdition(id: string): Promise<void> {
  if (findEdition(id)) return;
  const pending = inFlight.get(id);
  if (pending) return pending;
  const task = (async () => {
    const value: unknown = await request(
      `/api/editions/${encodeURIComponent(id)}`,
    );
    assertEditionBundle(value);
    if (value.id !== id) throw Error("Edition identity mismatch.");
    install(value);
    notify();
    await persistBundles();
  })().finally(() => inFlight.delete(id));
  inFlight.set(id, task);
  return task;
}
export async function hydrateCatalog() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw)
      for (const value of JSON.parse(raw)) {
        try {
          assertEditionBundle(value);
          install(value);
        } catch {
          /* skip corrupt entries */
        }
      }
    const cached = await AsyncStorage.getItem("ambio-edition-visible-v1");
    if (cached) updateVisible(JSON.parse(cached));
    const downloaded = await AsyncStorage.getItem("ambio-edition-downloads-v1");
    if (downloaded) {
      const states: Record<string, "downloaded"> = {};
      for (const id of JSON.parse(downloaded)) {
        const uri = await localAudio(id);
        if (uri) {
          states[id] = "downloaded";
          releaseAudio(uri);
        }
      }
      useCatalog.setState({ downloads: states });
    }
  } catch {
    useCatalog.setState({
      error:
        "Some downloaded content could not be restored. Please retry online.",
    });
  }
  notify();
}
let visibleIds = bundled.map((x) => x.episode.id);
function updateVisible(ids: string[]) {
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string"))
    throw Error("Invalid catalog.");
  visibleIds = ids.filter((id) => !!findEdition(id));
  if (!visibleIds.length) visibleIds = bundled.map((x) => x.episode.id);
  LATEST_EPISODE_ID = visibleIds[0];
  latestEdition = getEdition(LATEST_EPISODE_ID);
}
export const visibleEditions = () => visibleIds.map(getEdition);
export function refreshCatalog(): Promise<void> {
  if (refreshTask) return refreshTask;
  refreshTask = (async () => {
    useCatalog.setState({ loading: true, error: null });
    try {
      await hydrateCatalog();
      const result = await request("/api/editions");
      if (result.schemaVersion !== 1 || !Array.isArray(result.editions))
        throw Error("Unsupported catalog version.");
      const ids: string[] = result.editions.map((x: { id: string }) => x.id);
      // Limit request concurrency instead of overwhelming the mobile connection.
      for (let i = 0; i < ids.length; i += 4)
        await Promise.all(ids.slice(i, i + 4).map(loadEdition));
      const library = useLibrary.getState();
      const saved = new Set([
        library.activeEpisodeId,
        ...library.transcripts,
        ...library.bookmarks.map((x) => x.episodeId),
        ...library.sessions.map((x) => x.episodeId),
        ...Object.keys(library.progressByEpisode),
        ...useActivity.getState().attempts.map((x) => x.episodeId),
      ]);
      await Promise.allSettled(
        [...saved].filter((id) => !findEdition(id)).map(loadEdition),
      );
      useCatalog.setState({ nextCursor: result.nextCursor ?? null });
      updateVisible(ids);
      notify();
      await AsyncStorage.setItem(
        "ambio-edition-visible-v1",
        JSON.stringify(visibleIds),
      );
    } catch (e) {
      useCatalog.setState({
        error: e instanceof Error ? e.message : "Could not refresh editions.",
      });
    } finally {
      useCatalog.setState({ loading: false });
    }
  })().finally(() => {
    refreshTask = undefined;
  });
  return refreshTask;
}
export async function loadOlderEditions() {
  const { nextCursor, loading } = useCatalog.getState();
  if (!nextCursor || loading) return;
  useCatalog.setState({ loading: true, error: null });
  try {
    const result = await request(
      `/api/editions?before=${encodeURIComponent(nextCursor)}`,
    );
    if (result.schemaVersion !== 1 || !Array.isArray(result.editions))
      throw Error("Unsupported catalog version.");
    const ids: string[] = result.editions.map((x: { id: string }) => x.id);
    for (let i = 0; i < ids.length; i += 4)
      await Promise.all(ids.slice(i, i + 4).map(loadEdition));
    updateVisible([...new Set([...visibleIds, ...ids])]);
    useCatalog.setState({ nextCursor: result.nextCursor ?? null });
    notify();
    await AsyncStorage.setItem(
      "ambio-edition-visible-v1",
      JSON.stringify(visibleIds),
    );
  } catch {
    useCatalog.setState({
      error: "Older editions could not be loaded. Please retry.",
    });
  } finally {
    useCatalog.setState({ loading: false });
  }
}
export async function resolveAudio(id: string): Promise<string | number> {
  const edition = getEdition(id);
  if (edition.audio) return edition.audio;
  const local = await localAudio(id);
  if (local) return local;
  // Resolve immediately before playback so persisted signed URLs never expire in place.
  const media = await request(`/api/editions/${encodeURIComponent(id)}/media`);
  if (typeof media.url !== "string" || !media.url.startsWith("https://"))
    throw Error("Invalid audio URL.");
  return media.url;
}
export async function downloadEdition(id: string) {
  if (useCatalog.getState().downloads[id] === "downloading") return;
  const set = (state: "downloading" | "downloaded" | "error") =>
    useCatalog.setState((s) => ({
      downloads: { ...s.downloads, [id]: state },
    }));
  set("downloading");
  try {
    await loadEdition(id);
    const media = await request(
      `/api/editions/${encodeURIComponent(id)}/media`,
    );
    await saveAudio(id, media.url, media.bytes);
    set("downloaded");
    await persistDownloads();
  } catch {
    set("error");
  }
}
async function persistDownloads() {
  await AsyncStorage.setItem(
    "ambio-edition-downloads-v1",
    JSON.stringify(
      Object.entries(useCatalog.getState().downloads)
        .filter(([, v]) => v === "downloaded")
        .map(([id]) => id),
    ),
  );
}
export async function removeDownload(id: string) {
  try {
    await removeAudio(id);
    useCatalog.setState((s) => {
      const downloads = { ...s.downloads };
      delete downloads[id];
      return { downloads };
    });
    await persistDownloads();
  } catch {
    useCatalog.setState({
      error: "Could not remove the download. Please retry.",
    });
  }
}
