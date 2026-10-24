import { wordRevealOpacity , sentenceWords, spokenSentence } from "../src/domain/transcript";

import { episode } from "../src/data/episode";

test("audio reveal retains spoken words and reverses immediately on seek", () => {
  expect(wordRevealOpacity(1000, 0, true)).toBe(0.25);
  expect(wordRevealOpacity(1000, 1000, true)).toBeCloseTo(0.7);
  expect(wordRevealOpacity(1000, 1080, true)).toBe(1);
  expect(wordRevealOpacity(1000, 9000, true)).toBe(1);
  expect(wordRevealOpacity(1000, 0, true)).toBe(0.25);
});
test("paused text is fully readable even before it is spoken", () => {
  expect(wordRevealOpacity(9000, 0, false)).toBe(1);
});

test("sentences preserve every word and remain stable until the next sentence starts", () => {
  const words = episode.segments[0].words;
  const sentences = sentenceWords(words);
  expect(sentences.flat()).toEqual(words);
  expect(sentences.length).toBeGreaterThan(1);
  expect(spokenSentence(words, sentences[0].at(-1)!.startMs)).toEqual(sentences[0]);
  expect(spokenSentence(words, sentences[1][0].startMs)).toEqual(sentences[1]);
  expect(spokenSentence(words, 0)).toEqual(sentences[0]);
});

test("every French sentence has a corresponding complete English translation", () => {
  const translations = require("../src/data/sentence-translations.json");
  episode.segments.forEach((segment, index) => {
    expect(translations[index]).toHaveLength(sentenceWords(segment.words).length);
    expect(translations[index].join(" ")).toBe(segment.translation);
  });
});
