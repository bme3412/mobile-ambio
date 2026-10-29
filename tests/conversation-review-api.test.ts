import { conversation, result } from "./conversation-review-fixture";
const handler = jest.requireActual("../preview/lib/conversation-review.cjs");
const voice = jest.requireActual("../preview/lib/voice.cjs");
const res = () => ({ statusCode: 0, setHeader: jest.fn(), end: jest.fn() });
let identity = 0;
const req = (body: unknown) => ({
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer test-${identity++}`,
  },
  body,
});
test("review endpoint requests structured output without storing transcript, validates response", async () => {
  const fetchImpl = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      status: "completed",
      output: [
        { content: [{ type: "output_text", text: JSON.stringify(result()) }] },
      ],
    }),
  }));
  const response = res();
  await handler(req(conversation()), response, {
    env: { OPENAI_API_KEY: "test" },
    fetchImpl,
  });
  expect(response.statusCode).toBe(200);
  const body = JSON.parse(
    (fetchImpl.mock.calls[0] as unknown as [string, { body: string }])[1].body,
  );
  expect(body.store).toBe(false);
  expect(body.text.format.strict).toBe(true);
  expect(body.model).toBe("gpt-5.4-mini-2026-03-17");
  expect(
    JSON.parse(response.end.mock.calls[0][0]).refinements[0].original,
  ).toBe("je va");
});
test("tutor-only or unusable input does not spend a provider call", async () => {
  const fetchImpl = jest.fn();
  const input = conversation();
  input.turns = input.turns.filter((t) => t.role === "tutor");
  const response = res();
  await handler(req(input), response, {
    env: { OPENAI_API_KEY: "test" },
    fetchImpl,
  });
  expect(response.statusCode).toBe(200);
  expect(fetchImpl).not.toHaveBeenCalled();
});
test("invalid and oversized requests fail before paid work", async () => {
  const fetchImpl = jest.fn();
  for (const input of [
    {},
    { ...conversation(), turns: Array(201).fill(conversation().turns[0]) },
  ]) {
    const response = res();
    await handler(req(input), response, {
      env: { OPENAI_API_KEY: "test" },
      fetchImpl,
    });
    expect(response.statusCode).toBe(400);
  }
  expect(fetchImpl).not.toHaveBeenCalled();
});
test("provider failures do not retry automatically; repeated requests are rate limited", async () => {
  const fetchImpl = jest.fn(async () => ({ ok: false, status: 429 }));
  const request = req(conversation());
  const first = res();
  await handler(request, first, { env: { OPENAI_API_KEY: "test" }, fetchImpl });
  expect(first.statusCode).toBe(429);
  const second = res();
  await handler(request, second, {
    env: { OPENAI_API_KEY: "test" },
    fetchImpl,
  });
  expect(second.statusCode).toBe(429);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
test("review route rejects cross-origin browser requests before review", async () => {
  const response = res();
  await voice(
    {
      ...req(conversation()),
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
    },
    response,
    new URL("https://ambio.example/api/voice/review"),
  );
  expect(response.statusCode).toBe(403);
});
test("practice prompt treats supplied context as data and retains native protection", () => {
  const { sessionConfig } = jest.requireActual(
    "../preview/lib/voice-config.cjs",
  );
  const config = sessionConfig(undefined, undefined, {
    topicId: "open",
    autoInterrupt: false,
    practiceContext: {
      parentSessionId: "review-test",
      topic: "Café",
      phrases: ["je vais", "avec mon ami"],
    },
  });
  expect(config.instructions).toContain("untrusted learning material");
  expect(config.instructions).toContain("roughly three exchanges");
  expect(config.instructions).toContain("je vais");
  expect(config.audio.input.turn_detection.interrupt_response).toBe(false);
});

test("unsupported expressions are omitted while valid feedback is retained", async () => {
  const output = result();
  output.expressions.push({
    ...output.expressions[0],
    phrase: "je va",
    sourceQuote: "je va",
  });
  output.expressions.push({
    ...output.expressions[0],
    phrase: "invented",
    sourceQuote: "invented",
  });
  const response = res();
  await handler(req(conversation()), response, {
    env: { OPENAI_API_KEY: "test" },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        status: "completed",
        output: [
          { content: [{ type: "output_text", text: JSON.stringify(output) }] },
        ],
      }),
    }),
  });
  expect(response.statusCode).toBe(200);
  const review = JSON.parse(response.end.mock.calls[0][0]);
  expect(review.refinements).toHaveLength(1);
  expect(review.expressions).toHaveLength(1);
  expect(review.expressions[0].phrase).toBe("avec mon ami");
});
