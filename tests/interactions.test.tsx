import Player from "../src/app/player";
import { FlatList } from "react-native";
import Transcript from "../src/app/transcript";
import { act, fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WordSheet } from "../src/components/WordSheet";
import { PlaybackControls } from "../src/components/PlaybackControls";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { episode } from "../src/data/episode";
import { currentPhrase } from "../src/data/phrases";
import { useLibrary } from "../src/state/library";
import { player } from "../src/playback/player";
beforeEach(() => {
  useLibrary.setState({ bookmarks: [] });
  player.pause();
  player.seek(0);
});
test("word sheet saves and unsaves context, persisting the bookmark", async () => {
  const segment = episode.segments[0];
  const ui = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, bottom: 0, right: 0 },
      }}
    >
      <WordSheet
        selection={{ segment, word: segment.words[0] }}
        onClose={jest.fn()}
      />
    </SafeAreaProvider>,
  );
  await fireEvent.press(ui.getByLabelText("Save expression"));
  expect(useLibrary.getState().bookmarks[0].word.id).toBe(segment.words[0].id);
  await Promise.resolve();
  expect(await AsyncStorage.getItem("ambio-library-v1")).toContain(
    segment.words[0].id,
  );
  await fireEvent.press(ui.getByLabelText("Unsave expression"));
  expect(useLibrary.getState().bookmarks).toHaveLength(0);
});
test("playback buttons change the adapter", async () => {
  const ui = await render(<PlaybackControls />);
  await fireEvent.press(ui.getByLabelText("▶ Play"));
  expect(player.getSnapshot().playing).toBe(true);
  await fireEvent.press(ui.getByLabelText("+15 s"));
  expect(player.getSnapshot().positionMs).toBe(15000);
  await fireEvent.press(ui.getByLabelText("Pause"));
  expect(player.getSnapshot().playing).toBe(false);
});

test("transcript selection opens sheet and Back to Live exits browsing", async () => {
  const ui = await render(<Transcript />);
  await fireEvent.press(ui.getByLabelText("Look up Bonjour,"));
  expect(ui.getByLabelText("Save expression")).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Close"));
  expect(ui.getByText("Browsing · playback continues")).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("↓ Back to Live"));
  expect(ui.getByText("Following the conversation")).toBeTruthy();
});

test("drag browsing blocks automatic scroll until Back to Live", async () => {
  const scroll = jest
    .spyOn(FlatList.prototype, "scrollToIndex")
    .mockImplementation(() => {});
  const ui = await render(<Transcript />);
  await fireEvent(ui.getByTestId("transcript-list"), "scrollBeginDrag");
  scroll.mockClear();
  await act(async () => {
    player.seek(episode.segments[3].startMs);
  });
  expect(scroll).not.toHaveBeenCalled();
  await fireEvent.press(ui.getByLabelText("↓ Back to Live"));
  expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ index: 3 }));
  scroll.mockRestore();
});

test("bookmarks rehydrate from local storage", async () => {
  const segment = episode.segments[0];
  const bookmark = {
    id: segment.words[0].id,
    episodeId: episode.id,
    segmentId: segment.id,
    word: segment.words[0],
    context: "Bonjour",
    reviewed: false,
  };
  await AsyncStorage.setItem(
    "ambio-library-v1",
    JSON.stringify({
      state: { bookmarks: [bookmark], sessions: [], progress: null },
      version: 1,
    }),
  );
  await useLibrary.persist.rehydrate();
  expect(useLibrary.getState().bookmarks).toEqual([bookmark]);
});

test("initial transcript layout follows a restored position without overriding later browsing", async () => {
  player.seek(episode.segments[6].startMs);
  const scroll = jest
    .spyOn(FlatList.prototype, "scrollToIndex")
    .mockImplementation(() => {});
  const ui = await render(<Transcript />);
  await fireEvent(
    ui.getByTestId("transcript-list"),
    "contentSizeChange",
    390,
    2400,
  );
  expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ index: 6 }));
  await fireEvent(ui.getByTestId("transcript-list"), "scrollBeginDrag");
  scroll.mockClear();
  await fireEvent(
    ui.getByTestId("transcript-list"),
    "contentSizeChange",
    390,
    2600,
  );
  expect(scroll).not.toHaveBeenCalled();
  scroll.mockRestore();
});

test("player live words follow playback, seeking and word lookup by default", async () => {
  const ui = await render(<Player />);
  expect(
    ui.getByLabelText("Look up Bonjour,").props.accessibilityState.selected,
  ).toBe(true);
  const segment = episode.segments[0];
  await act(async () => {
    player.seek(segment.words[2].startMs);
  });
  expect(
    ui.getByLabelText(`Look up ${segment.words[2].text}`).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(ui.queryByLabelText("Look up Bonjour,")).toBeNull();
  const next = episode.segments[1];
  await act(async () => {
    player.seek(next.words[0].startMs);
  });
  expect(ui.getByText(next.speaker)).toBeTruthy();
  expect(ui.queryByLabelText("Look up Bonjour,")).toBeNull();
  await fireEvent.press(ui.getByLabelText(`Look up ${next.words[0].text}`));
  expect(ui.getByLabelText("Save expression")).toBeTruthy();
});

test("transcript follows a new sentence inside the same speaker turn", async () => {
  const scroll = jest
    .spyOn(FlatList.prototype, "scrollToIndex")
    .mockImplementation(() => {});
  const ui = await render(<Transcript />);
  scroll.mockClear();
  const words = episode.segments[0].words;
  const boundary = words.findIndex((word) => /[.!?]$/.test(word.text));
  await act(async () => {
    player.seek(words[boundary + 1].startMs);
  });
  expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }));
  await ui.unmount();
  scroll.mockRestore();
});

test("focus reader opens without sentence choices and closes without stopping audio", async () => {
  const ui = await render(<Transcript />);
  await act(async () => {
    player.play();
  });
  await fireEvent.press(ui.getByLabelText("Focus reader"));
  expect(ui.queryByLabelText("Show 1 sentence")).toBeNull();
  expect(ui.getByLabelText("English translation")).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Close focus reader"));
  expect(ui.queryByLabelText("Close focus reader")).toBeNull();
  expect(player.getSnapshot().playing).toBe(true);
});

test("player opens focus reader and returns without interrupting listening", async () => {
  const ui = await render(<Player />);
  await act(async () => {
    player.seek(12000);
    player.play();
  });
  await fireEvent.press(ui.getByLabelText("Focus reader"));
  expect(player.getSnapshot().playing).toBe(true);
  expect(player.getSnapshot().positionMs).toBe(12000);
  await fireEvent.press(ui.getByLabelText("Back to player"));
  expect(ui.queryByLabelText("Close focus reader")).toBeNull();
  expect(player.getSnapshot().playing).toBe(true);
});

test("focus English toggle follows each displayed French phrase without changing audio", async () => {
  const ui = await render(<Player />);
  await fireEvent.press(ui.getByLabelText("Focus reader"));
  expect(ui.queryByTestId("focus-translation")).toBeNull();
  await act(async () => {
    player.play();
  });
  await fireEvent.press(ui.getByLabelText("English translation"));
  expect(ui.getByTestId("focus-translation").props.children).toBe(
    "Hello, welcome",
  );
  expect(ui.getAllByTestId("focus-translation")).toHaveLength(1);
  await act(async () => {
    player.seek(episode.segments[0].words[2].startMs);
  });
  expect(ui.getByTestId("focus-translation").props.children).toBe(
    "to Ambio Daily.",
  );
  await act(async () => {
    player.seek(episode.segments[1].startMs);
  });
  expect(ui.getAllByTestId("focus-translation")[0].props.children).toBe(
    "So, a small adjustment",
  );
  expect(player.getSnapshot().playing).toBe(true);
  await fireEvent.press(ui.getByLabelText("English translation"));
  expect(ui.queryByTestId("focus-translation")).toBeNull();
});

test("focus replay uses the current phrase boundaries and stops at its end", async () => {
  const ui = await render(<Player />);
  const words = episode.segments[0].words;
  const phrase = currentPhrase(words[2].startMs);
  await act(async () => {
    player.seek(words[2].startMs);
  });
  await fireEvent.press(ui.getByLabelText("Focus reader"));
  await fireEvent.press(ui.getByLabelText("Replay phrase"));
  expect(player.getSnapshot()).toMatchObject({
    positionMs: phrase.words[0].startMs,
    replayEndMs: phrase.words.at(-1)!.endMs,
    playing: true,
  });
  await act(async () => {
    player.tick(10000);
  });
  expect(player.getSnapshot().positionMs).toBe(phrase.words.at(-1)!.endMs);
  expect(player.getSnapshot().playing).toBe(false);
});

test("a touch without a drag does not disable transcript following", async () => {
  const scroll = jest
    .spyOn(FlatList.prototype, "scrollToIndex")
    .mockImplementation(() => {});
  const ui = await render(<Transcript />);
  await fireEvent(ui.getByTestId("transcript-list"), "touchStart");
  scroll.mockClear();
  await act(async () => {
    player.seek(episode.segments[2].startMs);
  });
  expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ index: 2 }));
  expect(ui.queryByText("Browsing · playback continues")).toBeNull();
  scroll.mockRestore();
});

test("resuming playback restores following after browsing", async () => {
  const scroll = jest
    .spyOn(FlatList.prototype, "scrollToIndex")
    .mockImplementation(() => {});
  const ui = await render(<Transcript />);
  await fireEvent(ui.getByTestId("transcript-list"), "scrollBeginDrag");
  await act(async () => {
    player.seek(episode.segments[2].startMs);
  });
  scroll.mockClear();
  await fireEvent.press(ui.getByLabelText("Resume current episode"));
  expect(ui.getByText("Following the conversation")).toBeTruthy();
  expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ index: 2 }));
  scroll.mockRestore();
});
