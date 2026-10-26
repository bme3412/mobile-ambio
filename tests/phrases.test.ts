import { episode } from "../src/data/episode";
import { episodePhrases, currentPhrase } from "../src/data/phrases";
import pairs from "../src/data/phrase-translations.json";

test("every timed French token has exactly one short translated phrase", () => {
  expect(episodePhrases.flatMap((p) => p.words)).toEqual(
    episode.segments.flatMap((s) => s.words),
  );
  episode.segments.forEach((segment, index) => {
    expect(pairs[index].map(([fr]) => fr).join(" ")).toBe(
      segment.words.map((w) => w.text).join(" "),
    );
  });
  for (const phrase of episodePhrases) {
    expect(phrase.words.length).toBeGreaterThan(0);
    expect(phrase.words.length).toBeLessThanOrEqual(8);
    expect(phrase.translation.split(" ").length).toBeLessThanOrEqual(9);
    expect(phrase.translation.trim()).not.toBe("");
  }
});

test("French and English switch together on exact word boundaries, including rewind", () => {
  for (let i = 1; i < episodePhrases.length; i++) {
    const next = episodePhrases[i];
    expect(currentPhrase(next.words[0].startMs - 1)).toBe(
      episodePhrases[i - 1],
    );
    expect(currentPhrase(next.words[0].startMs)).toBe(next);
  }
  expect(currentPhrase(0)).toBe(episodePhrases[0]);
});

test("v4 phrase replay and teleprompter positions use the new provider clock", () => {
  for (const phrase of episodePhrases) {
    const start = phrase.words[0].startMs;
    const end = phrase.words.at(-1)!.endMs;
    expect(start).toBeGreaterThanOrEqual(phrase.segment.startMs);
    expect(end).toBeLessThanOrEqual(phrase.segment.endMs + 30);
    expect(end).toBeGreaterThan(start);
    expect(currentPhrase(start)).toBe(phrase);
  }
});
