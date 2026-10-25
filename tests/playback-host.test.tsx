import { act, render } from "@testing-library/react-native";
import { AppState, AppStateStatus, Platform } from "react-native";
import { PlaybackHost } from "../src/components/PlaybackHost";
import { player } from "../src/playback/player";

jest.mock("expo-audio", () => ({ setAudioModeAsync: jest.fn(async () => {}) }));
jest.mock("../src/playback/player", () => ({
  player: {
    seek: jest.fn(),
    setRate: jest.fn(),
    pause: jest.fn(),
    tick: jest.fn(),
    dispose: jest.fn(),
    getSnapshot: () => ({ positionMs: 66000, rate: 1, playing: true }),
  },
}));

const originalOS = Platform.OS;
afterEach(() => {
  Platform.OS = originalOS;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each(["web", "ios", "android"] as const)(
  "%s visibility transitions preserve the appropriate playback behavior",
  async (platform) => {
    jest.useFakeTimers();
    Platform.OS = platform;
    let onChange!: (state: AppStateStatus) => void;
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, fn) => {
        onChange = fn;
        return { remove: jest.fn() };
      });
    const ui = await render(<PlaybackHost />);
    jest.mocked(player.pause).mockClear();
    await act(async () => {
      onChange("background");
    });
    if (platform === "web") expect(player.pause).not.toHaveBeenCalled();
    else expect(player.pause).toHaveBeenCalledTimes(1);
    jest.mocked(player.tick).mockClear();
    await act(async () => {
      onChange("active");
    });
    expect(player.tick).toHaveBeenCalledWith(0);
    await ui.unmount();
  },
);
