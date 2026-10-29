import { conversation, result } from "./conversation-review-fixture";
import {
  fingerprint,
  validateReview,
  practiceContext,
} from "../preview/lib/conversation-review-contract.cjs";
import { useLibrary } from "../src/state/library";
import {
  requestReview,
  currentReview,
  practiceFromSession,
} from "../src/conversation/review";
import { voiceApi } from "../src/conversation/api";
jest.mock("../src/conversation/api", () => ({
  voiceApi: { request: jest.fn() },
}));
beforeEach(() => {
  jest.clearAllMocks();
  useLibrary.setState({ sessions: [], conversationPhrases: [] });
});
test("validated refinements and expressions retain exact learner evidence", () => {
  const review = validateReview(result(), conversation());
  expect(review.schemaVersion).toBe(1);
  expect(review.refinements[0].kind).toBe("correction");
  expect(review.transcriptFingerprint).toBe(fingerprint(conversation()));
  expect(
    validateReview(
      {
        ...result(),
        refinements: [{ ...result().refinements[0], kind: "alternative" }],
      },
      conversation(),
    ).refinements[0].kind,
  ).toBe("alternative");
});
test.each(["tutor", "unknown"])(
  "cannot attribute a correction to %s speech",
  (turnId) => {
    expect(() =>
      validateReview(
        { ...result(), refinements: [{ ...result().refinements[0], turnId }] },
        conversation(),
      ),
    ).toThrow();
  },
);
test("interrupted or placeholder speech is not corrected; unsupported expressions fail", () => {
  for (const turn of [
    { interrupted: true, text: "Demain, je va au café avec mon ami." },
    { text: "[je va]" },
  ]) {
    const input = conversation();
    Object.assign(input.turns[1], turn);
    expect(() => validateReview(result(), input)).toThrow();
  }
  expect(() =>
    validateReview(
      {
        ...result(),
        expressions: [{ ...result().expressions[0], phrase: "invented" }],
      },
      conversation(),
    ),
  ).toThrow();
});
test("correct French and short speech need not produce any corrections", () => {
  expect(
    validateReview(
      {
        summary: "No confident correction to suggest.",
        refinements: [],
        expressions: [],
      },
      conversation(),
    ).refinements,
  ).toEqual([]);
});
test("oversized transcripts and practice contexts are rejected, never truncated", () => {
  const c = conversation();
  c.turns[1].text = "a".repeat(6001);
  expect(() => fingerprint(c)).toThrow();
  expect(() =>
    practiceContext({
      parentSessionId: "p",
      topic: "t",
      phrases: Array(7).fill("x"),
    }),
  ).toThrow();
});
test("review is deduplicated, cached across reopening, and leaves original turns intact", async () => {
  const session = conversation();
  await useLibrary.getState().saveSession(session);
  jest
    .mocked(voiceApi.request)
    .mockResolvedValue({ ok: true, json: async () => result() } as Response);
  const first = requestReview(session.id);
  expect(requestReview(session.id)).toBe(first);
  await first;
  const stored = useLibrary.getState().sessions[0];
  expect(stored.turns).toEqual(session.turns);
  expect(currentReview(stored)).toBeDefined();
  expect(practiceFromSession(stored)?.phrases).toEqual([
    "je vais",
    "avec mon ami",
  ]);
  await requestReview(session.id);
  expect(voiceApi.request).toHaveBeenCalledTimes(1);
  expect(
    currentReview({
      ...stored,
      turns: [
        ...stored.turns,
        { id: "new", role: "user", text: "Autre chose." },
      ],
    }),
  ).toBeUndefined();
});
test("offline failure preserves the transcript; retry is explicit and can succeed", async () => {
  await useLibrary.getState().saveSession(conversation());
  jest.mocked(voiceApi.request).mockRejectedValueOnce(Error("Offline"));
  await requestReview("review-test");
  expect(useLibrary.getState().sessions[0]).toMatchObject({
    reviewStatus: "error",
    turns: conversation().turns,
  });
  expect(voiceApi.request).toHaveBeenCalledTimes(1);
  jest
    .mocked(voiceApi.request)
    .mockResolvedValue({ ok: true, json: async () => result() } as Response);
  await requestReview("review-test");
  expect(useLibrary.getState().sessions[0].reviewStatus).toBe("ready");
});
test("malformed provider output is not persisted as a review", async () => {
  await useLibrary.getState().saveSession(conversation());
  jest
    .mocked(voiceApi.request)
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        ...result(),
        refinements: [{ ...result().refinements[0], original: "invented" }],
      }),
    } as Response);
  await requestReview("review-test");
  expect(useLibrary.getState().sessions[0].review).toBeUndefined();
});
test("version two library data migrates without changing saved references", () => {
  const migrate = useLibrary.persist.getOptions().migrate!;
  const old = {
    sessions: [conversation()],
    bookmarks: [{ id: "old" }],
    activeEpisodeId: "original",
  };
  expect(migrate(old, 2)).toMatchObject({ ...old, conversationPhrases: [] });
});
