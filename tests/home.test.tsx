import { act, fireEvent, render } from "@testing-library/react-native";
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
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  client.setQueryData(["episode", "demo"], episode);
  return render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>,
  );
}
test("selecting a story updates its details without starting audio; play seeks to that story", async () => {
  const ui = await home();
  await fireEvent.press(ui.getByLabelText("Select Direction Phobos"));
  expect(ui.getByText(episode.stories[1].description)).toBeTruthy();
  expect(player.getSnapshot().playing).toBe(false);
  expect(router.push).not.toHaveBeenCalled();
  await fireEvent.press(ui.getByLabelText("▶ Play story 2"));
  expect(player.getSnapshot().positionMs).toBe(
    episode.segments.find((s) => s.id === episode.stories[1].segmentId)!
      .startMs,
  );
  expect(router.push).toHaveBeenCalledWith("/player");
  player.pause();
});
test("primary action reflects playback position and vocabulary opens its definition", async () => {
  const ui = await home();
  expect(ui.getByLabelText(/Play episode/)).toBeTruthy();
  await act(async () => {
    player.seek(50000);
  });
  expect(ui.getByLabelText(/Resume episode/)).toBeTruthy();
  await fireEvent.press(ui.getByLabelText("Learn reculer"));
  expect(
    ui.getByText("to move back; here, to put the clocks back"),
  ).toBeTruthy();
});
