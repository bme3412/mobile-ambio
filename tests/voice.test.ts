import { VoiceConversation } from "../src/conversation/realtime";

jest.mock("../src/conversation/transport", () =>
  jest.requireActual("../src/conversation/transport.ts"),
);

test("voice captions use provider item IDs without duplicate turns", () => {
  const voice = new VoiceConversation();
  voice.handle({ type: "input_audio_buffer.committed", item_id: "learner" });
  voice.handle({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "learner",
    transcript: "Je voudrais goûter du chocolat.",
  });
  voice.handle({
    type: "response.output_audio_transcript.delta",
    item_id: "tutor",
    delta: "Bonne ",
  });
  voice.handle({
    type: "response.output_audio_transcript.delta",
    item_id: "tutor",
    delta: "idée.",
  });
  voice.handle({
    type: "response.output_audio_transcript.done",
    item_id: "tutor",
    transcript: "Bonne idée.",
  });
  expect(voice.getSnapshot().turns.map((t) => t.text)).toEqual([
    "Je voudrais goûter du chocolat.",
    "Bonne idée.",
  ]);
});
test("only corrections quoting actual learner words enter the recap", () => {
  const voice = new VoiceConversation();
  voice.handle({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "u",
    transcript: "Si j’aurais une heure, je sortirais.",
  });
  const note = {
    original: "Si j’aurais",
    suggestion: "Si j’avais",
    explanation: "Use the imperfect after si.",
  };
  voice.handle({
    type: "response.function_call_arguments.done",
    name: "record_correction",
    call_id: "c",
    arguments: JSON.stringify(note),
  });
  voice.handle({
    type: "response.function_call_arguments.done",
    name: "record_correction",
    call_id: "d",
    arguments: JSON.stringify({ ...note, original: "invented words" }),
  });
  expect(voice.getSnapshot().observations).toEqual([{ id: "c", ...note }]);
});
test("ending a live session closes media and preserves the transcript for saving", () => {
  const voice = new VoiceConversation();
  voice.handle({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "u",
    transcript: "Bonjour.",
  });
  voice.handle({ type: "output_audio_buffer.started" });
  voice.end();
  expect(voice.getSnapshot()).toMatchObject({
    status: "ended",
    microphone: false,
  });
  expect(voice.getSnapshot().turns[0].text).toBe("Bonjour.");
});

test("cancel while microphone permission is pending stops late-arriving tracks", async () => {
  const names = [
    "window",
    "document",
    "navigator",
    "RTCPeerConnection",
    "fetch",
  ] as const;
  const originals = names.map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  let resolveStream!: (stream: unknown) => void;
  const stop = jest.fn();
  const close = jest.fn();
  const set = (name: string, value: unknown) =>
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  set("window", { isSecureContext: true });
  set("document", {
    createElement: () => ({ setAttribute: jest.fn(), pause: jest.fn() }),
  });
  set("navigator", {
    mediaDevices: {
      getUserMedia: () =>
        new Promise((resolve) => {
          resolveStream = resolve;
        }),
    },
  });
  set(
    "RTCPeerConnection",
    class {
      close = close;
    },
  );
  set(
    "fetch",
    jest.fn(async () => ({
      ok: true,
      json: async () => ({ available: true }),
    })),
  );
  const voice = new VoiceConversation();
  try {
    const connecting = voice.start();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(resolveStream).toBeDefined();
    voice.end();
    resolveStream({ getTracks: () => [{ stop }] });
    await connecting;
    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(voice.getSnapshot().status).toBe("ended");
  } finally {
    voice.end();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});

test.each(["timeout", "cancel"])(
  "health request is aborted on %s",
  async (action) => {
    jest.useFakeTimers();
    const names = ["window", "RTCPeerConnection", "fetch"] as const;
    const originals = names.map(
      (name) =>
        [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
    );
    let signal!: AbortSignal;
    const values = {
      window: { isSecureContext: true },
      RTCPeerConnection: class {},
      fetch: jest.fn(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            signal = options.signal;
            signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      ),
    };
    const voice = new VoiceConversation();
    try {
      for (const name of names)
        Object.defineProperty(globalThis, name, {
          configurable: true,
          writable: true,
          value: values[name],
        });
      const started = voice.start();
      expect(voice.getSnapshot().status).toBe("connecting");
      if (action === "cancel") voice.end();
      else jest.advanceTimersByTime(35000);
      await started;
      expect(signal.aborted).toBe(true);
      expect(voice.getSnapshot().status).toBe(
        action === "cancel" ? "ended" : "error",
      );
      if (action === "timeout")
        expect(voice.getSnapshot().error).toContain("timed out");
    } finally {
      voice.end();
      jest.useRealTimers();
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    }
  },
);

test("learner captions stream before completion and final text replaces partial text", () => {
  const voice = new VoiceConversation();
  voice.handle({ type: "input_audio_buffer.committed", item_id: "u" });
  voice.handle({
    type: "conversation.item.input_audio_transcription.delta",
    item_id: "u",
    delta: "Je voudrais ",
  });
  expect(voice.getSnapshot().turns[0].text).toBe("Je voudrais ");
  voice.handle({
    type: "conversation.item.input_audio_transcription.delta",
    item_id: "u",
    delta: "parler.",
  });
  voice.handle({ type: "input_audio_buffer.committed", item_id: "u" });
  expect(voice.getSnapshot().turns[0].text).toBe("Je voudrais parler.");
  voice.handle({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "u",
    transcript: "Je voudrais parler français.",
  });
  expect(voice.getSnapshot().turns).toEqual([
    { id: "u", role: "user", text: "Je voudrais parler français." },
  ]);
});

test("an empty completed speech transcript does not stay in the transcribing state", () => {
  const voice = new VoiceConversation();
  voice.handle({ type: "input_audio_buffer.committed", item_id: "empty" });
  voice.handle({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "empty",
    transcript: " ",
  });
  expect(voice.getSnapshot().turns[0].text).toBe(
    "[No speech could be transcribed]",
  );
});

test("an older voice server cannot silently discuss the wrong episode", async () => {
  const request = jest.fn(async () => ({
    ok: true,
    json: async () => ({ available: true }),
  })) as unknown as typeof fetch;
  const transport = jest.fn();
  const voice = new VoiceConversation(request, transport);
  await voice.start(false, "daily-fr-2026-10-25");
  expect(transport).not.toHaveBeenCalled();
  expect(voice.getSnapshot().error).toContain("updated voice service");
});
