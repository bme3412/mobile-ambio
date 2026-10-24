import { episode } from "../src/data/episode";
import editorial from "../src/data/editorial.json";
import timing from "../src/data/audio-timing.json";
import { vocabulary } from "../src/data/vocabulary";
import { normalizeWord } from "../src/data/dictionary";
import { sentenceWords } from "../src/domain/transcript";

test("new episode has complete provider word alignment and valid chapter boundaries", () => {
  expect(timing.provider).toBe("elevenlabs");
  expect(timing.segments).toHaveLength(editorial.turns.length);
  let previousEnd = 0;
  episode.segments.forEach((segment, index) => {
    expect(segment.words.map((w) => w.text).join(" ")).toBe(
      editorial.turns[index][1],
    );
    expect(timing.segments[index].words).toHaveLength(segment.words.length);
    expect(segment.startMs).toBeGreaterThanOrEqual(previousEnd);
    segment.words.forEach((word) => {
      expect(word.startMs).toBeGreaterThanOrEqual(segment.startMs);
      expect(word.endMs).toBeGreaterThanOrEqual(word.startMs);
      expect(word.endMs).toBeLessThanOrEqual(segment.endMs + 30);
    });
    previousEnd = segment.endMs;
  });
  expect(episode.durationMs).toBeGreaterThanOrEqual(previousEnd);
  for (const story of episode.stories) {
    expect(episode.segments.some((s) => s.id === story.segmentId)).toBe(true);
  }
  const words = new Set(
    episode.segments.flatMap((s) => s.words.map((w) => normalizeWord(w.text))),
  );
  Object.keys(vocabulary).forEach((key) => expect(words.has(key)).toBe(true));
  const selectableWords = episode.segments.flatMap((s) =>
    s.words.filter((w) => /[a-zàâéèêëîïôùûüç]/i.test(w.text)),
  );
  expect(selectableWords.length).toBeGreaterThan(0);
  for (const word of selectableWords) {
    expect(word.meaning).toBeTruthy();
  }
});

test("Focus reader keeps separated closing quotes and spoken templates together", () => {
  const questions = sentenceWords(episode.segments[32].words);
  expect(questions).toHaveLength(4);
  expect(questions[2].at(-1)?.text).toBe("»");
  expect(questions[3].at(-1)?.text).toBe("»");
  const template = sentenceWords(episode.segments[39].words);
  expect(template).toHaveLength(1);
  expect(template[0].map((w) => w.text).join(" ")).toContain("parce que…");
});
