import type { ConversationSession } from "../src/domain/types";
export const conversation = (): ConversationSession => ({
  id: "review-test",
  topicTitle: "A café discovery",
  episodeId: "",
  createdAt: "2026-10-28T20:00:00Z",
  isMock: false,
  observations: [],
  turns: [
    { id: "tutor", role: "tutor", text: "Que faites-vous demain ?" },
    {
      id: "learner",
      role: "user",
      text: "Demain, je va au café avec mon ami.",
    },
  ],
});
export const result = () => ({
  summary: "One verb form to adjust, and a useful phrase to keep.",
  refinements: [
    {
      turnId: "learner",
      original: "je va",
      suggestion: "je vais",
      explanation: "Use vais with je.",
      kind: "correction",
    },
  ],
  expressions: [
    {
      turnId: "learner",
      sourceQuote: "avec mon ami",
      phrase: "avec mon ami",
      meaning: "with my friend",
      example: "Je vais au café avec mon ami.",
    },
  ],
});
