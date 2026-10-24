import Saved from "../src/app/(tabs)/saved";
import { act, fireEvent, render } from "@testing-library/react-native";
import Conversation from "../src/conversation/ScriptedConversation";
import { PracticeSheet } from "../src/components/PracticeSheet";
import { PlaybackControls } from "../src/components/PlaybackControls";
import { useLibrary } from "../src/state/library";
import { episode } from "../src/data/episode";
import { player } from "../src/playback/player";
import { router } from "expo-router";
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
beforeEach(() => {
  useLibrary.setState({ bookmarks: [], sessions: [], transcripts: [] });
  player.pause();
  player.seek(0);
});
test("three-turn conversation supports help, interruption and saving user text", async () => {
  jest.useFakeTimers();
  const ui = await render(<Conversation />);
  await fireEvent.press(ui.getByLabelText("Start demo conversation"));
  await fireEvent.press(ui.getByLabelText("Help me understand"));
  expect(ui.getByText(/Choose science, craftsmanship/)).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Use sample response"));
  await fireEvent.press(ui.getByLabelText("Interrupt tutor"));
  await fireEvent.changeText(
    ui.getByLabelText("Your French response"),
    "Je préfère les romans.",
  );
  await fireEvent.press(ui.getByLabelText("Send response"));
  await act(async () => jest.advanceTimersByTime(1500));
  await fireEvent.press(ui.getByLabelText("Use sample response"));
  await act(async () => jest.advanceTimersByTime(1500));
  await fireEvent.press(ui.getByLabelText("End & save demo recap"));
  const session = useLibrary.getState().sessions[0];
  expect(session.turns).toHaveLength(7);
  expect(session.turns.some((t) => t.text === "Je préfère les romans.")).toBe(
    true,
  );
  expect(session.observations).toHaveLength(1);
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/recap",
    params: { id: session.id },
  });
  jest.useRealTimers();
});
test("practice reveals meaning and persists review outcome", async () => {
  const segment = episode.segments[0];
  const b = {
    id: segment.words[0].id,
    episodeId: episode.id,
    segmentId: segment.id,
    word: segment.words[0],
    context: "Bonjour",
    reviewed: false,
  };
  useLibrary.setState({ bookmarks: [b] });
  const ui = await render(<PracticeSheet items={[b]} onClose={jest.fn()} />);
  expect(ui.queryByText("hello")).toBeNull();
  await fireEvent.press(ui.getByLabelText("Reveal meaning"));
  expect(ui.getByText("hello")).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Got it · next"));
  expect(useLibrary.getState().bookmarks[0].reviewed).toBe(true);
  expect(ui.getByText("A little more familiar.")).toBeTruthy();
});
test("accessible seek actions move playback and transcript saving toggles", async () => {
  const ui = await render(<PlaybackControls />);
  await fireEvent(
    ui.getByLabelText("Playback position"),
    "accessibilityAction",
    { nativeEvent: { actionName: "increment" } },
  );
  expect(player.getSnapshot().positionMs).toBe(15000);
  useLibrary.getState().toggleTranscript(episode.id);
  expect(useLibrary.getState().transcripts).toEqual([episode.id]);
  useLibrary.getState().toggleTranscript(episode.id);
  expect(useLibrary.getState().transcripts).toEqual([]);
});

test("compact library expands actions and updates review filters", async () => {
  const segment = episode.segments[0];
  const b = {
    id: segment.words[0].id,
    episodeId: episode.id,
    segmentId: segment.id,
    word: segment.words[0],
    context: "Bonjour",
    reviewed: false,
  };
  useLibrary.setState({ bookmarks: [b] });
  const ui = await render(<Saved />);
  await fireEvent.press(ui.getByLabelText("Options for Bonjour,"));
  await fireEvent.press(ui.getByLabelText("Mark reviewed"));
  await fireEvent.press(ui.getByText("To review", { exact: true }));
  expect(ui.getByText("No words in this view yet.")).toBeTruthy();
  await fireEvent.press(ui.getByText("Reviewed", { exact: true }));
  expect(ui.getByLabelText("Options for Bonjour,")).toBeTruthy();
});

test("older edition bookmarks remain available for practice and removal", async () => {
  useLibrary.setState({
    bookmarks: [
      {
        id: "older-word",
        episodeId: "older-edition",
        segmentId: episode.segments[0].id,
        word: {
          id: "older-word",
          text: "autrefois",
          meaning: "formerly",
          startMs: 0,
          endMs: 500,
        },
        context: "Une expression ancienne.",
        reviewed: false,
      },
    ],
  });
  const ui = await render(<Saved />);
  expect(ui.getByText("autrefois")).toBeTruthy();
  expect(ui.queryByLabelText("Replay autrefois")).toBeNull();
  await fireEvent.press(ui.getByLabelText("Practice saved expressions"));
  await fireEvent.press(ui.getByLabelText("Reveal meaning"));
  expect(ui.getByText("formerly")).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Got it · next"));
  expect(useLibrary.getState().bookmarks[0].reviewed).toBe(true);
  await fireEvent.press(ui.getByLabelText("Close practice"));
  await fireEvent.press(ui.getByLabelText("Details for autrefois"));
  expect(ui.getByText(/Earlier edition/)).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Remove expression"));
  expect(useLibrary.getState().bookmarks).toEqual([]);
});

test("saved conversation history distinguishes live voice sessions from demo sessions", async () => {
  useLibrary.setState({
    sessions: [
      {
        id: "voice-1",
        episodeId: episode.id,
        createdAt: "2026-10-24T12:00:00.000Z",
        isMock: false,
        turns: [{ id: "t1", role: "user", text: "Bonjour." }],
        observations: [],
      },
      {
        id: "demo-1",
        episodeId: episode.id,
        createdAt: "2026-10-24T12:00:00.000Z",
        isMock: true,
        turns: [{ id: "t2", role: "user", text: "Salut." }],
        observations: [],
      },
    ],
  });
  const ui = await render(<Saved />);
  expect(ui.getByText(/Voice conversation ·/)).toBeTruthy();
  expect(ui.getByText(/Demo session ·/)).toBeTruthy();
});

