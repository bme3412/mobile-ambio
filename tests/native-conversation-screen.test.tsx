import { act, fireEvent, render } from "@testing-library/react-native";
import { AppState, AppStateStatus } from "react-native";
import Conversation from "../src/app/(tabs)/conversation";
import { useLibrary } from "../src/state/library";
import type { VoiceTransportEvents } from "../src/conversation/transport-types";
let mockEvents: VoiceTransportEvents;
const mockClose = jest.fn();
jest.mock("../src/conversation/transport", () => ({
  createVoiceTransport: (events: VoiceTransportEvents) => {
    mockEvents = events;
    return {
      offer: async () => "offer",
      answer: async () => {},
      send: () => true,
      mute: jest.fn(),
      close: mockClose,
      resumeAudio: async () => {},
    };
  },
}));
jest.mock("../src/conversation/api", () => ({
  voiceApi: {
    native: true,
    request: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ available: true }),
      text: async () => "answer",
    }),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => () => void) => {
    const React = jest.requireActual("react");
    React.useEffect(callback, [callback]);
  },
}));
test("backgrounding releases a native conversation and leaves its recap saveable", async () => {
  useLibrary.setState({ sessions: [] });
  let background!: (state: AppStateStatus) => void;
  const listener = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, callback) => {
      background = callback;
      return { remove: jest.fn() };
    });
  try {
    const ui = await render(<Conversation />);
    await fireEvent.press(await ui.findByLabelText("Start voice conversation"));
    await act(async () => {
      mockEvents.open();
      mockEvents.message(
        JSON.stringify({
          type: "conversation.item.input_audio_transcription.completed",
          item_id: "user",
          transcript: "Bonjour.",
        }),
      );
    });
    expect(ui.getByText("LISTENING · TAKE YOUR TIME")).toBeTruthy();
    await act(async () => background("background"));
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(ui.getByText("CONVERSATION ENDED")).toBeTruthy();
    await fireEvent.press(ui.getByLabelText("End & save conversation"));
    expect(useLibrary.getState().sessions[0].turns[0].text).toBe("Bonjour.");
    await ui.unmount();
  } finally {
    listener.mockRestore();
  }
});
