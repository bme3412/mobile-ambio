import { SpokenCoach } from "../src/practice/coach";
import { VoiceTransportEvents } from "../src/conversation/transport-types";
import { editions } from "../src/data/catalog";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { coachConfig } = require("../preview/lib/coach-config.cjs");
const registry = require("../preview/lib/practice-phrases.json");
function setup(status = 200) {
  let events!: VoiceTransportEvents;
  const transport = {
    offer: jest.fn(async () => "v=0\nm=audio"),
    answer: jest.fn(async () => {}),
    send: jest.fn((_data: string) => true),
    mute: jest.fn(),
    close: jest.fn(),
    resumeAudio: jest.fn(async () => {}),
  };
  const request = jest.fn(
    async (path: string) =>
      ({
        status,
        ok: status === 200,
        json: async () => ({ available: true }),
        text: async () => "answer",
      }) as Response,
  );
  const factory = jest.fn((e: VoiceTransportEvents) => {
    events = e;
    return transport;
  });
  const completed = jest.fn();
  const coach = new SpokenCoach(request, factory, completed);
  return {
    coach,
    completed,
    transport,
    request,
    factory,
    event: (type: string, fields = {}) =>
      events.message(JSON.stringify({ type, ...fields })),
    open: () => events.open(),
  };
}
afterEach(() => jest.useRealTimers());
test("one spoken response per phrase, muted while coaching, closes after audible output ends", async () => {
  const s = setup();
  await s.coach.start("episode", "phrase");
  s.open();
  expect(s.coach.getSnapshot().status).toBe("listening");
  expect(s.transport.send).not.toHaveBeenCalled();
  s.event("input_audio_buffer.speech_started");
  expect(s.coach.getSnapshot().speechDetected).toBe(true);
  s.event("input_audio_buffer.committed");
  s.event("input_audio_buffer.committed");
  expect(s.transport.send).toHaveBeenCalledTimes(1);
  expect(s.transport.mute).toHaveBeenLastCalledWith(true);
  s.event("response.output_audio_transcript.delta", {
    delta: "Try this: Brésil.",
  });
  s.event("output_audio_buffer.started");
  s.event("response.done", { response: { status: "completed" } });
  expect(s.transport.close).not.toHaveBeenCalled();
  expect(s.completed).not.toHaveBeenCalled();
  s.event("output_audio_buffer.stopped");
  expect(s.transport.close).toHaveBeenCalledTimes(1);
  expect(s.coach.getSnapshot()).toMatchObject({
    status: "feedback",
    caption: "Try this: Brésil.",
  });
  expect(s.completed).toHaveBeenCalledTimes(1);
  expect(s.completed).toHaveBeenCalledWith(
    expect.objectContaining({ episodeId: "episode", phraseId: "phrase" }),
  );
  s.event("output_audio_buffer.stopped");
  expect(s.completed).toHaveBeenCalledTimes(1);
  s.event("error");
  expect(s.coach.getSnapshot().status).toBe("feedback");
});
test("locked access never opens microphone", async () => {
  const s = setup(401);
  await s.coach.start("episode", "phrase");
  expect(s.factory).not.toHaveBeenCalled();
  expect(s.coach.getSnapshot().status).toBe("locked");
  expect(s.completed).not.toHaveBeenCalled();
});
test("manual finish commits only once and tolerates VAD race", async () => {
  const s = setup();
  await s.coach.start("episode", "phrase");
  s.open();
  s.coach.finish();
  s.coach.finish();
  s.event("input_audio_buffer.committed");
  s.event("error", { error: { code: "input_audio_buffer_commit_empty" } });
  expect(s.transport.send.mock.calls.map((c) => c[0])).toEqual([
    JSON.stringify({ type: "input_audio_buffer.commit" }),
    JSON.stringify({ type: "response.create" }),
  ]);
  expect(s.coach.getSnapshot().status).toBe("thinking");
  s.coach.stop();
});
test("stop ignores late connection and releases microphone", async () => {
  const s = setup();
  await s.coach.start("episode", "phrase");
  s.coach.stop();
  s.open();
  s.event("input_audio_buffer.committed");
  expect(s.coach.getSnapshot().status).toBe("ready");
  expect(s.completed).not.toHaveBeenCalled();
  expect(s.transport.send).not.toHaveBeenCalled();
});
test("silence has actionable timeout and releases microphone", async () => {
  jest.useFakeTimers();
  const s = setup();
  await s.coach.start("episode", "phrase");
  s.open();
  jest.advanceTimersByTime(60000);
  expect(s.coach.getSnapshot().status).toBe("error");
  expect(s.transport.close).toHaveBeenCalledTimes(1);
});
test("server registry exactly covers catalog and rejects unknown/cross-edition phrases", () => {
  for (const edition of editions) {
    expect(Object.keys(registry[edition.episode.id])).toHaveLength(
      edition.episodePhrases.length,
    );
    for (const phrase of edition.episodePhrases) {
      const text = phrase.words.map((w) => w.text).join(" ");
      expect(registry[edition.episode.id][phrase.words[0].id]).toBe(text);
      const config = coachConfig(edition.episode.id, phrase.words[0].id);
      expect(config.instructions).toContain(JSON.stringify(text));
      expect(config.audio.input.turn_detection.create_response).toBe(false);
    }
  }
  expect(() => coachConfig("__proto__", "constructor")).toThrow();
  expect(() =>
    coachConfig(
      editions[0].episode.id,
      editions[1].episodePhrases[0].words[0].id,
    ),
  ).toThrow();
});
