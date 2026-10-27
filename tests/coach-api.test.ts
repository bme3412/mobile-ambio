/** @jest-environment node */
const voiceHandler = jest.requireActual("../preview/lib/voice.cjs");
const makeResponse = () => ({
  statusCode: 0,
  setHeader: jest.fn(),
  end: jest.fn(),
});
const originalFetch = global.fetch;
const originalKey = process.env.OPENAI_API_KEY;
beforeEach(() => {
  process.env.OPENAI_API_KEY = "server-secret";
});
afterEach(() => {
  global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});
test("coach endpoint sends exact server phrase, audio config and no secret to the client", async () => {
  const mockFetch = jest.fn(async () => ({
    ok: true,
    text: async () => "answer-sdp",
  }));
  global.fetch = mockFetch as unknown as typeof fetch;
  const res = makeResponse();
  await voiceHandler(
    {
      method: "POST",
      headers: {
        "content-type": "application/sdp",
        authorization: "unique-coach-client",
      },
      body: "v=0\nm=audio",
    },
    res,
    new URL(
      "https://example.com/api/voice/practice/session?episodeId=daily-fr-2026-10-26&phraseId=daily20261026-s2-w0",
    ),
    { native: true },
  );
  expect(res.statusCode).toBe(200);
  expect(res.end).toHaveBeenCalledWith("answer-sdp");
  const call = (mockFetch.mock.calls as unknown as [string, RequestInit][])[0];
  const config = JSON.parse(
    (call[1].body as FormData).get("session") as string,
  );
  expect(config.instructions).toContain("Commençons par le Brésil.");
  expect(config.audio.input.turn_detection.create_response).toBe(false);
  expect(config.output_modalities).toEqual(["audio"]);
});
test("unknown phrase and hostile web origin cannot reach upstream", async () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch;
  const res = makeResponse();
  const req = {
    method: "POST",
    headers: {
      "content-type": "application/sdp",
      authorization: "unknown-phrase-client",
    },
    body: "v=0\nm=audio",
  };
  await voiceHandler(
    req,
    res,
    new URL(
      "https://example.com/api/voice/practice/session?episodeId=daily-fr-2026-10-26&phraseId=made-up",
    ),
    { native: true },
  );
  expect(res.statusCode).toBe(400);
  await voiceHandler(
    { ...req, headers: { ...req.headers, origin: "https://evil.example" } },
    res,
    new URL("https://example.com/api/voice/practice/session"),
    { native: false },
  );
  expect(res.statusCode).toBe(403);
  expect(mockFetch).not.toHaveBeenCalled();
});
