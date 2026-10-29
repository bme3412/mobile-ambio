import { render, fireEvent, act } from "@testing-library/react-native";
import Recap from "../src/app/recap";
import Saved from "../src/app/(tabs)/saved";
import { useLibrary } from "../src/state/library";
import { conversation, result } from "./conversation-review-fixture";
import { validateReview } from "../preview/lib/conversation-review-contract.cjs";
import { router } from "expo-router";
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: "review-test" }),
}));
beforeEach(() => {
  useLibrary.setState({
    sessions: [],
    bookmarks: [],
    conversationPhrases: [],
    transcripts: [],
  });
  jest.clearAllMocks();
});
test("recap keeps transcript collapsed, saves a phrase and opens its own practice context", async () => {
  const parent = conversation();
  parent.review = validateReview(result(), parent);
  useLibrary.setState({ sessions: [parent] });
  const ui = await render(<Recap />);
  expect(ui.queryByText(parent.turns[1].text)).toBeNull();
  expect(ui.queryByText(/edition.*unavailable/i)).toBeNull();
  await fireEvent.press(ui.getByLabelText("Save phrase"));
  expect(useLibrary.getState().conversationPhrases[0]).toMatchObject({
    source: "conversation",
    sessionId: parent.id,
    word: { text: "avec mon ami" },
  });
  expect(useLibrary.getState().bookmarks).toHaveLength(0);
  await fireEvent.press(ui.getByLabelText("Practice these in a conversation"));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/conversation",
    params: expect.objectContaining({
      practiceSessionId: parent.id,
      typing: "0",
    }),
  });
  await fireEvent.press(ui.getByLabelText("Show original transcript"));
  expect(ui.getByText(parent.turns[1].text)).toBeTruthy();
  await ui.unmount();
  const saved = await render(<Saved />);
  expect(saved.getByText(/A café discovery ·/)).toBeTruthy();
  await fireEvent.press(saved.getByLabelText("Practice saved expressions"));
  await fireEvent.press(saved.getByLabelText("Reveal meaning"));
  expect(saved.getByText("with my friend")).toBeTruthy();
  await fireEvent.press(saved.getByLabelText("Got it · next"));
  expect(useLibrary.getState().conversationPhrases[0].reviewed).toBe(true);
  await saved.unmount();
});
test("an interrupted review offers explicit retry and retains the transcript", async () => {
  await act(async () => {
    await useLibrary
      .getState()
      .saveSession({ ...conversation(), reviewStatus: "pending" });
  });
  const ui = await render(<Recap />);
  expect(ui.getByLabelText("Retry review")).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Show original transcript"));
  expect(ui.getByText(conversation().turns[1].text)).toBeTruthy();
  await ui.unmount();
});
