import { vocabulary } from "../src/data/vocabulary";
import { normalizeWord } from "../src/data/dictionary";
import { createSimulatedPlayer } from "../src/playback/adapter";
import {
  activeSegment,
  activeWord,
  shouldFollow,
} from "../src/domain/transcript";
import { episode } from "../src/data/episode";
test("play, pause, rate, seek and end preserve clock bounds", () => {
  const p = createSimulatedPlayer(10000);
  p.play();
  p.tick(1000);
  expect(p.getSnapshot().positionMs).toBe(1000);
  p.pause();
  p.tick(1000);
  expect(p.getSnapshot().positionMs).toBe(1000);
  p.setRate(1.5);
  p.play();
  p.tick(1000);
  expect(p.getSnapshot().positionMs).toBe(2500);
  p.seek(-100);
  expect(p.getSnapshot().positionMs).toBe(0);
  p.seek(9999);
  p.tick(100);
  expect(p.getSnapshot()).toMatchObject({ positionMs: 10000, playing: false });
  p.play();
  expect(p.getSnapshot().positionMs).toBe(0);
});
test("word highlight uses half-open audio timing and never selection", () => {
  const seg = episode.segments[0];
  expect(activeSegment(episode.segments, 0)).toBe(0);
  expect(activeWord(seg, seg.words[0].startMs)).toBe(seg.words[0].id);
  expect(activeWord(seg, seg.words[0].endMs)).not.toBe(seg.words[0].id);
  expect(activeWord(seg, seg.words[1].startMs)).toBe(seg.words[1].id);
  expect(activeWord(seg, seg.endMs)).toBeUndefined();
});
test("manual browsing and search prevent tracking", () => {
  expect(shouldFollow(true, "")).toBe(false);
  expect(shouldFollow(false, "jardin")).toBe(false);
  expect(shouldFollow(false, "")).toBe(true);
});
test("fixture has unique stable IDs and monotonic timing", () => {
  const words = episode.segments.flatMap((s) => s.words);
  expect(new Set(words.map((w) => w.id)).size).toBe(words.length);
  words.forEach((w, i) => {
    expect(w.endMs).toBeGreaterThan(w.startMs);
    if (i) expect(w.startMs).toBeGreaterThanOrEqual(words[i - 1].endMs);
  });
});

test("word and sentence replay stop at their boundary; normal play clears the range", () => {
  const p = createSimulatedPlayer(10000);
  p.replay(2000, 3000);
  p.tick(5000);
  expect(p.getSnapshot()).toMatchObject({ positionMs: 3000, playing: false });
  p.play();
  p.tick(1000);
  expect(p.getSnapshot()).toMatchObject({
    positionMs: 4000,
    playing: true,
    replayEndMs: null,
  });
});
test("curated vocabulary has definitions and matching transcript tokens", () => {
  Object.keys(vocabulary).forEach((key) => {
    const word = episode.segments
      .flatMap((s) => s.words)
      .find((w) => normalizeWord(w.text) === key);
    expect(word?.meaning).toBeTruthy();
  });
});
test("tracking stays on the last turn during silence and at the end", () => {
  expect(activeSegment(episode.segments, episode.segments[0].endMs + 1)).toBe(
    0,
  );
  expect(activeSegment(episode.segments, episode.durationMs)).toBe(
    episode.segments.length - 1,
  );
});

test("all words use valid provider-aligned times within their audio turn", () => {
  episode.segments.forEach((segment) => {
    segment.words.forEach((word) => {
      expect(word.startMs).toBeGreaterThanOrEqual(segment.startMs);
      expect(word.endMs).toBeLessThanOrEqual(segment.endMs + 2);
      expect(word.endMs).toBeGreaterThan(word.startMs);
    });
  });
});
