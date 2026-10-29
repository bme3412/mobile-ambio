import { act, render } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useLearningTime } from "../src/activity/useLearningTime";
import { useActivity } from "../src/state/activity";
import { learningSummary } from "../src/activity/learning";
function Screen({ interaction = 0 }: { interaction?: number }) {
  useLearningTime("practice", true, interaction);
  return null;
}
test("engagement stops at idle limit and excludes background time", async () => {
  jest.useFakeTimers();
  const original = AppState.currentState;
  let change: (state: string) => void = () => {};
  const subscription = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_, fn) => {
      change = fn as typeof change;
      return { remove: jest.fn() };
    });
  const hydration = jest
    .spyOn(useActivity.persist, "hasHydrated")
    .mockReturnValue(true);
  AppState.currentState = "active";
  useActivity.setState({ days: {} });
  const ui = await render(<Screen />);
  await act(async () => {
    jest.advanceTimersByTime(65000);
  });
  expect(learningSummary(useActivity.getState().days).milliseconds).toBe(60000);
  await ui.rerender(<Screen interaction={1} />);
  await act(async () => {
    AppState.currentState = "background";
    change("background");
    jest.advanceTimersByTime(10000);
  });
  expect(learningSummary(useActivity.getState().days).milliseconds).toBe(60000);
  await ui.unmount();
  AppState.currentState = original;
  subscription.mockRestore();
  hydration.mockRestore();
  jest.useRealTimers();
});
