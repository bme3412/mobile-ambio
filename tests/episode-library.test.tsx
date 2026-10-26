import { WordSheet } from "../src/components/WordSheet";
import { fireEvent, render } from "@testing-library/react-native";
import Library from "../src/app/(tabs)/library";
import { editions, getEdition, phraseAt } from "../src/data/catalog";
import { useLibrary } from "../src/state/library";
import { player } from "../src/playback/player";
import { createEpisodePlayer } from "../src/playback/episodePlayer";
import { createSimulatedPlayer } from "../src/playback/adapter";
import { router } from "expo-router";
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
const latest = getEdition("daily-fr-2026-10-25");
const original = getEdition("daily-fr-2026-10-24");
beforeEach(() => {
  useLibrary.setState({
    activeEpisodeId: original.episode.id,
    progressByEpisode: {},
    progress: null,
  });
  player.pause();
  player.seek(0);
});
test("search finds stories and filters resume/finished editions", async () => {
  useLibrary
    .getState()
    .saveProgress({ episodeId: latest.episode.id, positionMs: 30000, rate: 1 });
  const ui = await render(<Library />);
  await fireEvent.changeText(ui.getByLabelText("Search episodes"), "Louvre");
  expect(ui.getByText(latest.episode.title)).toBeTruthy();
  expect(ui.queryByText(original.episode.title)).toBeNull();
  await fireEvent.changeText(ui.getByLabelText("Search episodes"), "");
  await fireEvent.press(ui.getByLabelText("In progress"));
  expect(
    ui.getByLabelText(`Continue listening · ${latest.episode.title}`),
  ).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Finished"));
  expect(
    ui.getByText("No episodes here yet. Try another search or choose All."),
  ).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Show all episodes"));
  await fireEvent.press(
    ui.getByLabelText(`Read transcript · ${latest.episode.title}`),
  );
  expect(useLibrary.getState().activeEpisodeId).toBe(latest.episode.id);
  expect(router.push).toHaveBeenCalledWith("/transcript");
});
test("switching disposes the old engine and independently restores positions and rates", async () => {
  await useLibrary.persist.rehydrate();
  useLibrary.setState({
    activeEpisodeId: original.episode.id,
    progressByEpisode: {},
  });
  const engines: ReturnType<typeof createSimulatedPlayer>[] = [];
  const disposed = jest.fn();
  const manager = createEpisodePlayer(({ episode }) => {
    const engine = createSimulatedPlayer(episode.durationMs);
    engines.push(engine);
    return { ...engine, dispose: disposed };
  });
  manager.seek(45000);
  manager.setRate(0.8);
  manager.play();
  useLibrary.getState().selectEpisode(latest.episode.id);
  expect(engines[0].getSnapshot().playing).toBe(false);
  expect(disposed).toHaveBeenCalledTimes(1);
  expect(manager.getSnapshot().positionMs).toBe(0);
  manager.seek(20000);
  manager.setRate(1.2);
  useLibrary.getState().selectEpisode(original.episode.id);
  expect(manager.getSnapshot()).toMatchObject({
    positionMs: 45000,
    rate: 0.8,
    playing: false,
  });
  expect(
    useLibrary.getState().progressByEpisode[latest.episode.id].positionMs,
  ).toBe(20000);
  manager.dispose();
});
test("legacy listening position survives the storage migration", async () => {
  const migrate = useLibrary.persist.getOptions().migrate!;
  const progress = {
    episodeId: original.episode.id,
    positionMs: 12345,
    rate: 0.8,
  };
  const migrated = (await migrate(
    {
      progress,
      bookmarks: [],
      transcripts: [original.episode.id],
      sessions: [],
    },
    1,
  )) as ReturnType<typeof useLibrary.getState>;
  expect(migrated.progressByEpisode[original.episode.id]).toEqual(progress);
  expect(migrated.transcripts).toEqual([original.episode.id]);
});
test("every edition has complete phrase coverage, definitions, ordered timing and music gaps", () => {
  const ids = new Set<string>();
  for (const data of editions) {
    const { episode, episodePhrases, audioTiming } = data;
    expect(audioTiming.model).toBe("eleven_v4");
    expect(episodePhrases.flatMap((p) => p.words)).toEqual(
      episode.segments.flatMap((s) => s.words),
    );
    let previous = 0;
    for (const segment of episode.segments) {
      expect(segment.startMs).toBeGreaterThanOrEqual(previous);
      expect(segment.endMs).toBeLessThanOrEqual(episode.durationMs);
      previous = segment.endMs;
      for (const word of segment.words) {
        expect(ids.has(word.id)).toBe(false);
        ids.add(word.id);
        if (/[a-zàâéèêëîïôùûüç]/i.test(word.text))
          expect(word.meaning).toBeTruthy();
        expect(word.endMs).toBeGreaterThanOrEqual(word.startMs);
        for (const gap of audioTiming.musicOnlyRanges)
          expect(word.startMs >= gap.endMs || word.endMs <= gap.startMs).toBe(
            true,
          );
      }
    }
    for (const phrase of episodePhrases) {
      expect(phrase.translation).toBeTruthy();
      expect(phraseAt(episodePhrases, phrase.words[0].startMs)).toBe(phrase);
    }
  }
});

test("word lookup saves the source edition even when another episode is selected", async () => {
  const segment = latest.episode.segments[4];
  const word = segment.words[0];
  player.play();
  const ui = await render(
    <WordSheet selection={{ segment, word }} onClose={jest.fn()} />,
  );
  expect(player.getSnapshot().playing).toBe(false);
  await fireEvent.press(ui.getByLabelText("Save expression"));
  expect(
    useLibrary.getState().bookmarks.find((item) => item.id === word.id),
  ).toMatchObject({
    episodeId: latest.episode.id,
    segmentId: segment.id,
    context: segment.words.map((w) => w.text).join(" "),
  });
});

test("October 26 is first and the default remains October 24", () => {
  expect(editions.map((item) => item.episode.id)).toEqual([
    "daily-fr-2026-10-26",
    "daily-fr-2026-10-25",
    "daily-fr-2026-10-24",
  ]);
  expect(getEdition("unknown").episode.id).toBe("daily-fr-2026-10-24");
  const latest = editions[0];
  expect(latest.episode.durationMs).toBeGreaterThanOrEqual(300000);
  expect(latest.episode.durationMs).toBeLessThanOrEqual(360000);
  expect(latest.featuredPhrase.word.text).toBe("tenir compte de");
});
