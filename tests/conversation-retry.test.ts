import { retryFromSession } from "../src/conversation/review";
import { conversation, result } from "./conversation-review-fixture";
import {
  practiceContext,
  validateReview,
} from "../preview/lib/conversation-review-contract.cjs";

test("retry selects exact adjacent turns without changing original and works without a review", () => {
  const parent = conversation();
  const before = JSON.stringify(parent);
  expect(retryFromSession(parent, "learner")).toMatchObject({
    mode: "retry",
    parentSessionId: parent.id,
    phrases: [],
    exchange: {
      question: parent.turns[0].text,
      answer: parent.turns[1].text,
      tutorTurnId: "tutor",
      learnerTurnId: "learner",
    },
  });
  expect(retryFromSession(parent, "learner")?.exchange?.hint).toBeUndefined();
  expect(JSON.stringify(parent)).toBe(before);
  expect(retryFromSession(parent, "unknown")).toBeUndefined();
});
test.each(["interrupted", "empty", "placeholder", "wrong-role"])(
  "exclude unusable %s exchanges",
  (kind) => {
    const parent = conversation();
    if (kind === "interrupted") parent.turns[0].interrupted = true;
    if (kind === "empty") parent.turns[1].text = " ";
    if (kind === "placeholder")
      parent.turns[1].text = "[Speech could not be transcribed]";
    if (kind === "wrong-role") parent.turns[0].role = "user";
    expect(retryFromSession(parent, "learner")).toBeUndefined();
  },
);
test("hints use only matching current review material", () => {
  const parent = conversation();
  parent.review = validateReview(result(), parent);
  expect(retryFromSession(parent, "learner")?.exchange?.hint).toBe("je vais");
  parent.turns[1].text += " Autre chose.";
  expect(retryFromSession(parent, "learner")?.exchange?.hint).toBeUndefined();
});
test("backend rejects invalid or oversized retry context and keeps legacy practice", () => {
  const context = retryFromSession(conversation(), "learner")!;
  expect(practiceContext(context)).toEqual(context);
  expect(() =>
    practiceContext({
      ...context,
      exchange: { ...context.exchange, question: "x".repeat(6001) },
    }),
  ).toThrow();
  expect(() => practiceContext({ ...context, exchange: undefined })).toThrow();
  expect(() => practiceContext({ ...context, mode: "other" })).toThrow();
  expect(
    practiceContext({ parentSessionId: "old", topic: "", phrases: ["bonjour"] })
      .phrases,
  ).toEqual(["bonjour"]);
});
test("retry prompt asks original question without grading or automatic ending", () => {
  const { sessionConfig } = require("../preview/lib/voice-config.cjs");
  const config = sessionConfig(undefined, undefined, {
    topicId: "open",
    practiceContext: retryFromSession(conversation(), "learner"),
  });
  expect(config.instructions).toContain(
    "Open by repeating only the supplied exchange question",
  );
  expect(config.instructions).toContain("do not grade");
  expect(config.instructions).toContain("Que faites-vous demain");
});
