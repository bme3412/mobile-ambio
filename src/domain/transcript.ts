import { TranscriptSegment, WordToken } from "./types";
export const activeSegment = (
  segments: TranscriptSegment[],
  positionMs: number,
) => segments.findLastIndex((s) => positionMs >= s.startMs);
export const activeWord = (segment: TranscriptSegment, positionMs: number) =>
  segment.words.find((w) => positionMs >= w.startMs && positionMs < w.endMs)
    ?.id;
export const shouldFollow = (manual: boolean, query: string) =>
  !manual && !query.trim();

// Derived solely from media time: rewind and seek need no animation reset.
// Paused reading exposes all words; spoken words never fade away.
export const wordRevealOpacity = (
  startMs: number,
  positionMs: number,
  playing: boolean,
) =>
  playing
    ? 0.25 + 0.75 * Math.min(1, Math.max(0, (positionMs - startMs + 120) / 200))
    : 1;

// Punctuation stays attached to its sentence, including French closing quotes.
export function sentenceWords(words: WordToken[]): WordToken[][] {
  const sentences: WordToken[][] = [];
  let sentence: WordToken[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    sentence.push(word);
    if (/[.!?][»”"’)]*$/.test(word.text)) {
      // French typography separates closing guillemets with a space.
      // Keep them with their sentence; template ellipses are not boundaries.
      while (i + 1 < words.length && /^[»”"’).!?]+$/.test(words[i + 1].text)) {
        sentence.push(words[++i]);
      }
      sentences.push(sentence);
      sentence = [];
    }
  }
  if (sentence.length) sentences.push(sentence);
  return sentences;
}
export function spokenSentence(words: WordToken[], positionMs: number) {
  const sentences = sentenceWords(words);
  return (
    sentences[
      Math.max(
        0,
        sentences.findLastIndex(
          (sentence) => sentence[0].startMs <= positionMs,
        ),
      )
    ] ?? []
  );
}
