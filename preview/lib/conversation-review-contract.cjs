// Shared validation; no provider or platform dependencies.
const VERSION = 1;
function text(value, max = 600, empty = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!empty && !value.trim())
  )
    throw Error("Invalid review text");
  return value;
}
function transcript(input) {
  text(input?.id, 160);
  text(input.topicTitle ?? "", 200, true);
  if (!Array.isArray(input.turns) || input.turns.length > 200)
    throw Error(
      "This conversation is too long to review. Your full transcript is still saved.",
    );
  const ids = new Set();
  const turns = input.turns.map((t) => {
    text(t.id, 160);
    text(t.text, 6000, true);
    if (
      ids.has(t.id) ||
      !["user", "tutor"].includes(t.role) ||
      (t.interrupted !== undefined && typeof t.interrupted !== "boolean")
    )
      throw Error("Invalid conversation turns");
    ids.add(t.id);
    return {
      id: t.id,
      role: t.role,
      text: t.text,
      interrupted: !!t.interrupted,
    };
  });
  const result = { id: input.id, topicTitle: input.topicTitle ?? "", turns };
  if (JSON.stringify(result).length > 40000)
    throw Error(
      "This conversation is too long to review. Your full transcript is still saved.",
    );
  return result;
}
// An exact canonical fingerprint avoids hash collisions and works offline on native and web.
function fingerprint(input) {
  return JSON.stringify(transcript(input));
}
function usable(turn) {
  return (
    !!turn &&
    !turn.interrupted &&
    !!turn.text.trim() &&
    !/\[[^\]]*\]/.test(turn.text)
  );
}
function validateReview(value, input) {
  const source = transcript(input);
  text(value?.summary, 600);
  if (
    !Array.isArray(value.refinements) ||
    value.refinements.length > 3 ||
    !Array.isArray(value.expressions) ||
    value.expressions.length > 3
  )
    throw Error("Invalid review result");
  const refinements = value.refinements.map((r, index) => {
    const turn = source.turns.find((t) => t.id === r.turnId);
    text(r.original);
    text(r.suggestion);
    text(r.explanation);
    if (
      !usable(turn) ||
      turn.role !== "user" ||
      !turn.text.includes(r.original) ||
      !["correction", "alternative"].includes(r.kind) ||
      r.original === r.suggestion
    )
      throw Error("Review quote does not match learner speech");
    return {
      id: `refinement-${index}`,
      turnId: turn.id,
      original: r.original,
      suggestion: r.suggestion,
      explanation: r.explanation,
      kind: r.kind,
    };
  });
  const expressions = value.expressions.map((e, index) => {
    text(e.phrase, 200);
    text(e.meaning, 400);
    text(e.example, 600);
    text(e.sourceQuote, 600);
    const turn = source.turns.find((t) => t.id === e.turnId);
    const corrected = refinements
      .filter((r) => r.turnId === e.turnId)
      .some((r) => r.suggestion.includes(e.sourceQuote));
    if (
      !usable(turn) ||
      !(turn.text.includes(e.sourceQuote) || corrected) ||
      !e.sourceQuote.includes(e.phrase)
    )
      throw Error("Expression has no supporting conversation quote");
    return {
      id: `expression-${index}`,
      turnId: turn.id,
      phrase: e.phrase,
      meaning: e.meaning,
      example: e.example,
      sourceQuote: e.sourceQuote,
    };
  });
  return {
    schemaVersion: VERSION,
    transcriptFingerprint: fingerprint(source),
    summary: value.summary,
    refinements,
    expressions,
  };
}
function practiceContext(value) {
  text(value?.parentSessionId, 160);
  text(value.topic, 200, true);
  if (
    !Array.isArray(value.phrases) ||
    value.phrases.length < 1 ||
    value.phrases.length > 6
  )
    throw Error("Invalid practice phrases");
  return {
    parentSessionId: value.parentSessionId,
    topic: value.topic,
    phrases: value.phrases.map((p) => text(p, 600)),
  };
}
module.exports = {
  VERSION,
  transcript,
  fingerprint,
  usable,
  validateReview,
  practiceContext,
};
