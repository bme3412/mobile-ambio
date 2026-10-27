import { fireEvent, render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "../src/app/(tabs)/index";
import { episode } from "../src/data/episode";
import { player } from "../src/playback/player";
import { router } from "expo-router";
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
beforeEach(() => {
  player.pause();
  player.seek(0);
  jest.clearAllMocks();
});
async function home() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  client.setQueryData(["episode", episode.id], episode);
  return render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>,
  );
}
test.each([0, 1, 2])(
  "story %i selects the featured edition and seeks to its boundary",
  async (index) => {
    const { latestEdition } = jest.requireActual("../src/data/catalog");
    const { useLibrary } = jest.requireActual("../src/state/library");
    useLibrary.setState({ activeEpisodeId: episode.id });
    const ui = await home();
    const story = latestEdition.episode.stories[index];
    await fireEvent.press(
      ui.getByLabelText(`Listen to this story · ${story.title}`),
    );
    expect(useLibrary.getState().activeEpisodeId).toBe(
      latestEdition.episode.id,
    );
    expect(player.getSnapshot().positionMs).toBe(
      latestEdition.episode.segments.find(
        (s: { id: string }) => s.id === story.segmentId,
      ).startMs,
    );
    expect(router.push).toHaveBeenCalledWith("/player");
  },
);
test("continue listening preserves the older episode and position", async () => {
  const { useLibrary } = jest.requireActual("../src/state/library");
  useLibrary.setState({ activeEpisodeId: episode.id });
  player.seek(50000);
  const ui = await home();
  await fireEvent.press(ui.getByLabelText("Continue listening"));
  expect(useLibrary.getState().activeEpisodeId).toBe(episode.id);
  expect(player.getSnapshot()).toMatchObject({
    positionMs: 50000,
    playing: true,
  });
});

test("latest edition is featured without interrupting the current listen", async () => {
  const { useLibrary } = jest.requireActual("../src/state/library");
  useLibrary.setState({ activeEpisodeId: episode.id });
  player.seek(45000);
  player.play();
  const ui = await home();
  expect(ui.getByText("Le monde en mouvement")).toBeTruthy();
  expect(useLibrary.getState().activeEpisodeId).toBe(episode.id);
  expect(player.getSnapshot()).toMatchObject({
    positionMs: 45000,
    playing: true,
  });
  await fireEvent.press(
    ui.getByLabelText("Listen to latest edition · Le monde en mouvement"),
  );
  expect(useLibrary.getState().activeEpisodeId).toBe("daily-fr-2026-10-26");
  expect(router.push).toHaveBeenCalledWith("/player");
  player.pause();
});

test("featured transcript selection and vocabulary are independent of active playback", async () => {
  const { useLibrary } = jest.requireActual("../src/state/library");
  useLibrary.setState({ activeEpisodeId: episode.id });
  const ui = await home();
  await fireEvent.press(ui.getByLabelText("Learn Remporter,"));
  expect(useLibrary.getState().activeEpisodeId).toBe(episode.id);
});

test("featured transcript explicitly selects October 26", async () => {
  const { useLibrary } = jest.requireActual("../src/state/library");
  useLibrary.setState({ activeEpisodeId: episode.id });
  const ui = await home();
  await fireEvent.press(ui.getByLabelText("Read transcript & vocabulary →"));
  expect(useLibrary.getState().activeEpisodeId).toBe("daily-fr-2026-10-26");
  expect(router.push).toHaveBeenCalledWith("/transcript");
});

test.each([
  "Après le vote",
  "Des annonces aux actes",
  "Derrière les grands chiffres",
])(
  "practice action routes to %s without changing the listening edition",
  async (title) => {
    const { useLibrary } = jest.requireActual("../src/state/library");
    const { latestEdition } = jest.requireActual("../src/data/catalog");
    useLibrary.setState({ activeEpisodeId: episode.id });
    const ui = await home();
    await fireEvent.press(ui.getByLabelText(`Practice this story · ${title}`));
    expect(useLibrary.getState().activeEpisodeId).toBe(episode.id);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/practice",
      params: {
        episodeId: latestEdition.episode.id,
        storyId: latestEdition.episode.stories.find(
          (s: { title: string }) => s.title === title,
        ).id,
      },
    });
  },
);
