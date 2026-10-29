import {
  fingerprint,
  transcript,
  validateReview,
  VERSION,
} from "../../preview/lib/conversation-review-contract.cjs";
import { useLibrary } from "../state/library";
import { voiceApi } from "./api";
import type {
  ConversationSession,
  ConversationPracticeContext,
} from "../domain/types";
const pending = new Map<string, Promise<void>>();
export function currentReview(session: ConversationSession) {
  try {
    return session.review?.schemaVersion === VERSION &&
      session.review.transcriptFingerprint === fingerprint(session)
      ? session.review
      : undefined;
  } catch {
    return undefined;
  }
}
export function isReviewPending(id: string) {
  return pending.has(id);
}
export function requestReview(id: string): Promise<void> {
  if (pending.has(id)) return pending.get(id)!;
  const session = useLibrary.getState().sessions.find((s) => s.id === id);
  if (!session || currentReview(session)) return Promise.resolve();
  // Defer work one microtask so concurrent screens always see the same promise.
  const task = Promise.resolve().then(async () => {
    const update = (patch: Partial<ConversationSession>) =>
      useLibrary.getState().updateSession(id, patch);
    update({ reviewStatus: "pending", reviewError: undefined });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const input = transcript(session);
      const response = await voiceApi.request("/api/voice/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw Error(
          response.status === 401
            ? "Unlock Talk, then retry your review."
            : data.error ||
                "Review is unavailable. Your conversation is saved.",
        );
      const review = validateReview(data, input);
      const latest = useLibrary.getState().sessions.find((s) => s.id === id);
      if (!latest || fingerprint(latest) !== fingerprint(input))
        throw Error("The transcript changed. Generate a fresh review.");
      update({ review, reviewStatus: "ready", reviewError: undefined });
    } catch (error) {
      update({
        reviewStatus: "error",
        reviewError: controller.signal.aborted
          ? "Review timed out. Your conversation is saved; you can retry."
          : error instanceof Error
            ? error.message
            : "Could not reach review. Your conversation is saved.",
      });
    } finally {
      clearTimeout(timer);
      pending.delete(id);
    }
  });
  pending.set(id, task);
  return task;
}
export function practiceFromSession(
  session: ConversationSession,
): ConversationPracticeContext | undefined {
  const review = currentReview(session);
  if (!review) return;
  const phrases = [
    ...new Set([
      ...review.refinements.map((r) => r.suggestion),
      ...review.expressions.map((e) => e.phrase),
    ]),
  ];
  if (!phrases.length) return;
  return {
    parentSessionId: session.id,
    topic: session.topicTitle || "Your conversation",
    phrases,
  };
}
