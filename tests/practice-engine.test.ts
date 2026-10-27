import { PracticeEngine } from "../src/practice/engine";
const mockTrack = { stop: jest.fn() };
const mockStream = { getTracks: () => [mockTrack] };
const mockGetUserMedia = jest.fn();
const mockCloseAudio = jest.fn();
const mockRecognizer = {
  close: jest.fn(),
  recognizeOnceAsync: jest.fn(),
  recognizing: undefined,
  sessionStarted: undefined,
};
jest.mock("microsoft-cognitiveservices-speech-sdk", () => ({
  SpeechConfig: { fromAuthorizationToken: () => ({}) },
  OutputFormat: { Detailed: 1 },
  AudioConfig: { fromStreamInput: () => ({ close: mockCloseAudio }) },
  SpeechRecognizer: jest.fn(() => mockRecognizer),
  PronunciationAssessmentConfig: jest.fn(() => ({ applyTo: jest.fn() })),
  PronunciationAssessmentGradingSystem: { HundredMark: 1 },
  PronunciationAssessmentGranularity: { Word: 1 },
  PropertyId: { SpeechServiceResponse_JsonResult: 1 },
}));
const events = () => ({
  partial: jest.fn(),
  ready: jest.fn(),
  result: jest.fn(),
  error: jest.fn(),
});
const auth = async () => ({ token: "temporary", region: "eastus" });
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia: mockGetUserMedia } },
  });
  mockGetUserMedia.mockResolvedValue(mockStream);
});
test("cancel during credential lookup never opens the microphone", async () => {
  const engine = new PracticeEngine(async () =>
    jest.requireMock("microsoft-cognitiveservices-speech-sdk"),
  );
  let resolve!: (value: { token: string; region: string }) => void;
  const pending = new Promise<{ token: string; region: string }>((r) => {
    resolve = r;
  });
  const running = engine.start("Bonjour", () => pending, events());
  engine.stop();
  resolve(await auth());
  await running;
  expect(mockGetUserMedia).not.toHaveBeenCalled();
});
test("late permission approval releases its microphone after cancellation", async () => {
  const engine = new PracticeEngine(async () =>
    jest.requireMock("microsoft-cognitiveservices-speech-sdk"),
  );
  let resolve!: (value: typeof mockStream) => void;
  mockGetUserMedia.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const running = engine.start("Bonjour", auth, events());
  for (let i = 0; i < 20 && !resolve; i++) await Promise.resolve();
  expect(resolve).toBeDefined();
  engine.stop();
  resolve(mockStream);
  await running;
  expect(mockTrack.stop).toHaveBeenCalled();
  expect(mockRecognizer.recognizeOnceAsync).not.toHaveBeenCalled();
});
test("a final assessment releases the microphone and ignores stale callbacks", async () => {
  const engine = new PracticeEngine(async () =>
    jest.requireMock("microsoft-cognitiveservices-speech-sdk"),
  );
  const listener = events();
  await engine.start("Bonjour", auth, listener);
  const result = mockRecognizer.recognizeOnceAsync.mock.calls[0][0];
  const data = {
    properties: {
      getProperty: () =>
        JSON.stringify({
          RecognitionStatus: "Success",
          NBest: [
            {
              Display: "Bonjour",
              Words: [
                {
                  Word: "Bonjour",
                  PronunciationAssessment: {
                    AccuracyScore: 90,
                    ErrorType: "None",
                  },
                },
              ],
            },
          ],
        }),
    },
  };
  result(data);
  result(data);
  expect(listener.result).toHaveBeenCalledTimes(1);
  expect(mockTrack.stop).toHaveBeenCalledTimes(1);
  expect(mockRecognizer.close).toHaveBeenCalledTimes(1);
});
test("permission denial returns an actionable error without assessment", async () => {
  mockGetUserMedia.mockRejectedValue(Error("Microphone permission denied"));
  const listener = events();
  await new PracticeEngine(async () =>
    jest.requireMock("microsoft-cognitiveservices-speech-sdk"),
  ).start("Bonjour", auth, listener);
  expect(listener.error).toHaveBeenCalledWith("Microphone permission denied");
  expect(listener.result).not.toHaveBeenCalled();
});
