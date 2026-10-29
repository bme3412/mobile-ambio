import {
  listeningCredit,
  emptyDay,
  frenchWords,
  learningSummary,
  mergeIntervals,
} from "../src/activity/learning";
import { useActivity } from "../src/state/activity";
import { localDay } from "../src/activity/model";
test("overlapping activity contributes time only once", () => {
  const day = emptyDay(),
    now = new Date(2026, 9, 28, 12);
  day.intervals.listening = [[0, 60000]];
  day.intervals.talk = [[30000, 90000]];
  const result = learningSummary({ [localDay(now)]: day }, now);
  expect(result.milliseconds).toBe(90000);
  expect(result.byKind.talk).toBe(60000);
  expect(
    mergeIntervals([
      [10, 20],
      [0, 15],
      [30, 40],
    ]),
  ).toEqual([
    [0, 20],
    [30, 40],
  ]);
});
test("counts French word forms and deduplicates contributed utterances", () => {
  useActivity.setState({ days: {} });
  const store = useActivity.getState();
  store.words("same", "Bonjour à vous", "spoken");
  store.words("same", "Bonjour à vous", "spoken");
  store.words("typed", "Très bien", "typed");
  store.words("failed", "[Speech could not be transcribed]", "spoken");
  store.words("encountered", "Café café l’été", "encountered");
  const x = learningSummary(useActivity.getState().days);
  expect(x.spoken).toBe(3);
  expect(x.typed).toBe(2);
  expect(x.encountered).toBe(2);
  expect(frenchWords("Été, l’été !")).toEqual(["été", "l’été"]);
});
test("splits time at local midnight and refuses long suspended intervals", () => {
  useActivity.setState({ days: {} });
  const start = new Date(2026, 9, 28, 23, 59, 58).getTime();
  useActivity.getState().track("practice", start, start + 4000);
  expect(
    learningSummary(useActivity.getState().days, new Date(start)).milliseconds,
  ).toBe(2000);
  expect(
    learningSummary(useActivity.getState().days, new Date(start + 4000))
      .milliseconds,
  ).toBe(2000);
  useActivity.getState().track("talk", start, start + 120000);
  expect(
    learningSummary(useActivity.getState().days, new Date(start)).milliseconds,
  ).toBe(2000);
});

test("listening excludes seeking and buffering, and respects playback speed", () => {
  const before = { positionMs: 0, playing: true };
  expect(
    listeningCredit(before, { positionMs: 2000, rate: 2 }, 1000, true),
  ).toBe(1000);
  expect(listeningCredit(before, { positionMs: 0, rate: 1 }, 1000, true)).toBe(
    0,
  );
  expect(
    listeningCredit(before, { positionMs: 1000, rate: 1 }, 1000, false),
  ).toBe(0);
  expect(
    listeningCredit(before, { positionMs: 60000, rate: 1 }, 1000, true),
  ).toBe(0);
  expect(
    listeningCredit(before, { positionMs: 200, rate: 1 }, 1000, true),
  ).toBe(200);
});
