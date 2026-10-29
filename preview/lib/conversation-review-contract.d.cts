import type {
  ConversationSession,
  ConversationReview,
  ConversationPracticeContext,
} from "../../src/domain/types";
export const VERSION: number;
export function transcript(
  input: Pick<ConversationSession, "id" | "topicTitle" | "turns">,
): { id: string; topicTitle: string; turns: ConversationSession["turns"] };
export function fingerprint(
  input: Pick<ConversationSession, "id" | "topicTitle" | "turns">,
): string;
export function validateReview(
  value: unknown,
  input: Pick<ConversationSession, "id" | "topicTitle" | "turns">,
): ConversationReview;
export function practiceContext(value: unknown): ConversationPracticeContext;
