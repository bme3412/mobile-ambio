export type WordAssessment = {
  word: string;
  accuracy: number | null;
  error: string;
};
export type Assessment = { heard: string; words: WordAssessment[] };
export function parseAssessment(json: string): Assessment {
  const data = JSON.parse(json);
  if (
    data.RecognitionStatus !== "Success" ||
    !Array.isArray(data.NBest?.[0]?.Words) ||
    data.NBest[0].Words.length === 0
  )
    throw Error("No clear speech was assessed. Try again in a quieter place.");
  const best = data.NBest[0];
  return {
    heard: typeof best.Display === "string" ? best.Display : "",
    words: best.Words.map(
      (w: {
        Word?: unknown;
        PronunciationAssessment?: {
          AccuracyScore?: unknown;
          ErrorType?: unknown;
        };
      }) => ({
        word: typeof w.Word === "string" ? w.Word : "",
        accuracy:
          typeof w.PronunciationAssessment?.AccuracyScore === "number" &&
          Number.isFinite(w.PronunciationAssessment.AccuracyScore)
            ? Math.max(
                0,
                Math.min(100, w.PronunciationAssessment.AccuracyScore),
              )
            : null,
        error:
          typeof w.PronunciationAssessment?.ErrorType === "string"
            ? w.PronunciationAssessment.ErrorType
            : "Unknown",
      }),
    ),
  };
}
export const normalize = (text: string) =>
  text.toLocaleLowerCase("fr").replace(/[^\p{L}\p{N}]/gu, "");
// Ordered matching avoids applying a score to a later repeated word or guessing
// alignment when the recognizer splits French contractions differently.
export function alignAssessment(
  reference: string[],
  assessed: WordAssessment[],
) {
  const result: (WordAssessment | null)[] = reference.map(() => null);
  let cursor = 0;
  for (const item of assessed) {
    if (item.error === "Insertion") continue;
    const index = reference.findIndex(
      (word, i) => i >= cursor && normalize(word) === normalize(item.word),
    );
    if (index < 0) continue;
    result[index] = item;
    cursor = index + 1;
  }
  return result;
}
export function practiceTarget(words: (WordAssessment | null)[]) {
  return words.findIndex(
    (w) =>
      w &&
      (w.error === "Mispronunciation" ||
        w.error === "Omission" ||
        (w.accuracy !== null && w.accuracy < 60)),
  );
}
