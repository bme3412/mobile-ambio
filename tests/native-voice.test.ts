import { createVoiceTransport } from "../src/conversation/transport.native";
import { VoiceConversation } from "../src/conversation/realtime";
import type { VoiceTransportEvents } from "../src/conversation/transport-types";

const mockTrack = { enabled: true, stop: jest.fn() };
const mockStream = {
  getTracks: () => [mockTrack],
  getAudioTracks: () => [mockTrack],
  release: jest.fn(),
};
const mockChannelEvents: Record<string, (event?: { data: string }) => void> =
  {};
const mockChannel = {
  readyState: "open",
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn((name, listener) => {
    mockChannelEvents[name] = listener;
  }),
};
const mockPeer = {
  connectionState: "new",
  addEventListener: jest.fn(),
  addTrack: jest.fn(),
  addTransceiver: jest.fn(),
  createDataChannel: jest.fn(() => mockChannel),
  createOffer: jest.fn(async () => ({ type: "offer", sdp: "v=0\r\nm=audio" })),
  setLocalDescription: jest.fn(async () => {}),
  setRemoteDescription: jest.fn(async () => {}),
  close: jest.fn(),
};
const mockGetUserMedia = jest.fn(async (_constraints?: unknown) => mockStream);
const mockAudio = {
  start: jest.fn(),
  stop: jest.fn(),
  setKeepScreenOn: jest.fn(),
};
jest.mock("react-native-webrtc", () => ({
  RTCPeerConnection: jest.fn(() => mockPeer),
  RTCSessionDescription: jest.fn((value) => value),
  mediaDevices: {
    getUserMedia: (constraints: unknown) => mockGetUserMedia(constraints),
  },
}));
jest.mock("react-native-incall-manager", () => ({ default: mockAudio }));
const events = (): VoiceTransportEvents => ({
  open: jest.fn(),
  message: jest.fn(),
  closed: jest.fn(),
  connection: jest.fn(),
  audioBlocked: jest.fn(),
});
beforeEach(() => {
  jest.clearAllMocks();
  mockTrack.enabled = true;
  mockGetUserMedia.mockImplementation(async () => mockStream);
});

test("native microphone, speaker routing, data events, mute and cleanup", async () => {
  const callbacks = events();
  const transport = createVoiceTransport(callbacks);
  expect(await transport.offer(true)).toContain("m=audio");
  expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
  expect(mockAudio.start).toHaveBeenCalledWith({ media: "video", auto: true });
  expect(mockPeer.addTrack).toHaveBeenCalledWith(mockTrack, mockStream);
  mockChannelEvents.open();
  mockChannelEvents.message({ data: '{"type":"response.created"}' });
  expect(callbacks.open).toHaveBeenCalled();
  expect(callbacks.message).toHaveBeenCalledWith('{"type":"response.created"}');
  await transport.answer("answer-sdp");
  expect(mockPeer.setRemoteDescription).toHaveBeenCalledWith({
    type: "answer",
    sdp: "answer-sdp",
  });
  transport.mute(true);
  expect(mockTrack.enabled).toBe(false);
  transport.mute(false);
  expect(mockTrack.enabled).toBe(true);
  expect(transport.send("hello")).toBe(true);
  transport.close();
  transport.close();
  expect(mockTrack.stop).toHaveBeenCalledTimes(1);
  expect(mockStream.release).toHaveBeenCalledTimes(1);
  expect(mockAudio.stop).toHaveBeenCalledTimes(1);
  expect(mockPeer.close).toHaveBeenCalledTimes(1);
  expect(transport.send("late")).toBe(false);
});

test("native typed conversation receives audio without requesting microphone", async () => {
  const transport = createVoiceTransport(events());
  await transport.offer(false);
  expect(mockGetUserMedia).not.toHaveBeenCalled();
  expect(mockPeer.addTransceiver).toHaveBeenCalledWith("audio", {
    direction: "recvonly",
  });
  expect(mockAudio.start).toHaveBeenCalled();
  transport.close();
});

test("native cancellation releases a microphone granted after the session ends", async () => {
  let resolve!: (stream: typeof mockStream) => void;
  mockGetUserMedia.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const transport = createVoiceTransport(events());
  const offer = transport.offer(true);
  transport.close();
  resolve(mockStream);
  await expect(offer).rejects.toThrow("cancelled");
  expect(mockTrack.stop).toHaveBeenCalledTimes(1);
  expect(mockStream.release).toHaveBeenCalledTimes(1);
  expect(mockAudio.start).not.toHaveBeenCalled();
});

test("shared conversation establishes native SDP, handles captions and ends cleanly", async () => {
  const request = jest.fn(async () => ({
    ok: true,
    json: async () => ({ available: true }),
    text: async () => "answer-sdp",
  })) as unknown as jest.MockedFunction<typeof fetch>;
  const voice = new VoiceConversation(request, createVoiceTransport);
  await voice.start(true);
  mockChannelEvents.open();
  expect(voice.getSnapshot()).toMatchObject({
    status: "listening",
    microphone: true,
  });
  expect(request).toHaveBeenLastCalledWith(
    "/api/voice/session",
    expect.objectContaining({ method: "POST", body: "v=0\r\nm=audio" }),
  );
  mockChannelEvents.message({
    data: JSON.stringify({
      type: "response.output_audio_transcript.done",
      item_id: "tutor",
      transcript: "Bonjour !",
    }),
  });
  voice.sendText("Bonjour.");
  voice.mute();
  expect(mockTrack.enabled).toBe(false);
  voice.end();
  expect(voice.getSnapshot().turns.map((turn) => turn.text)).toEqual([
    "Bonjour !",
    "Bonjour.",
  ]);
  expect(voice.getSnapshot().status).toBe("ended");
  expect(mockTrack.stop).toHaveBeenCalled();
});

test("native microphone permission denial is actionable and releases the peer", async () => {
  mockGetUserMedia.mockRejectedValue({
    name: "SecurityError",
    message: "Permission denied.",
  });
  const request = jest.fn(async () => ({
    ok: true,
    json: async () => ({ available: true }),
  })) as unknown as typeof fetch;
  const voice = new VoiceConversation(request, createVoiceTransport);
  await voice.start();
  expect(voice.getSnapshot().error).toContain("Microphone access was denied");
  expect(mockPeer.close).toHaveBeenCalled();
  expect(mockAudio.start).not.toHaveBeenCalled();
});
