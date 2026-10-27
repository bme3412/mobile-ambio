import { practiceMaterial } from "../src/practice/model";
import { editions } from "../src/data/catalog";
import {
  alignAssessment,
  parseAssessment,
  practiceTarget,
} from "../src/practice/assessment";

test("every story practice starts and ends within its catalog boundaries", () => {
  for (const { episode, episodePhrases } of editions) {
    expect(practiceMaterial(episode.id)?.phrases).toHaveLength(
      episodePhrases.length,
    );
    episode.stories.forEach((story, i) => {
      const material = practiceMaterial(episode.id, story.id)!;
      const start = episode.segments.find(
        (s) => s.id === story.segmentId,
      )!.startMs;
      const next =
        episode.segments.find((s) => s.id === episode.stories[i + 1]?.segmentId)
          ?.startMs ?? Infinity;
      expect(material.phrases.length).toBeGreaterThan(0);
      expect(material.phrases[0].words[0].startMs).toBeGreaterThanOrEqual(
        start,
      );
      expect(material.phrases.every((p) => p.words.at(-1)!.endMs <= next)).toBe(
        true,
      );
    });
  }
  expect(practiceMaterial("unknown")).toBeNull();
  expect(practiceMaterial(editions[0].episode.id, "unknown")).toBeNull();
});
test("no-match results never create positive pronunciation feedback", () => {
  expect(() =>
    parseAssessment(JSON.stringify({ RecognitionStatus: "NoMatch" })),
  ).toThrow();
});
test("word scores align conservatively, skip insertions, and preserve repeats", () => {
  const words = [
    { word: "oui", accuracy: 95, error: "None" },
    { word: "euh", accuracy: 70, error: "Insertion" },
    { word: "oui", accuracy: 40, error: "Mispronunciation" },
  ];
  const aligned = alignAssessment(["Oui,", "oui", "demain."], words);
  expect(aligned).toEqual([words[0], words[2], null]);
  expect(practiceTarget(aligned)).toBe(1);
  expect(
    alignAssessment(
      ["l’école"],
      [{ word: "école", accuracy: 90, error: "None" }],
    ),
  ).toEqual([null]);
});
test("provider word errors and missing scores remain explicit", () => {
  const result = parseAssessment(
    JSON.stringify({
      RecognitionStatus: "Success",
      NBest: [
        {
          Display: "Bonjour",
          Words: [
            {
              Word: "Bonjour",
              PronunciationAssessment: { AccuracyScore: 81, ErrorType: "None" },
            },
            {
              Word: "demain",
              PronunciationAssessment: { ErrorType: "Omission" },
            },
          ],
        },
      ],
    }),
  );
  expect(result.words[1]).toEqual({
    word: "demain",
    accuracy: null,
    error: "Omission",
  });
  expect(practiceTarget(result.words)).toBe(1);
});

test("passage practice contains only that transcript segment", () => {
  const edition = editions[0];
  const segment = edition.episode.segments[3];
  const material = practiceMaterial(edition.episode.id, undefined, segment.id)!;
  expect(material.phrases.length).toBeGreaterThan(0);
  expect(
    material.phrases.every((p) =>
      p.words.every((w) => segment.words.some((s) => s.id === w.id)),
    ),
  ).toBe(true);
  expect(practiceMaterial(edition.episode.id, undefined, "missing")).toBeNull();
});
