import { localDay } from "./model";
export type ActivityKind = "listening" | "talk" | "practice";
export type Interval = [number, number];
export type LearningDay = {
  intervals: Record<ActivityKind, Interval[]>;
  encountered: string[];
  contributions: Record<string, { words: number; mode: "spoken" | "typed" }>;
};
export const emptyDay = (): LearningDay => ({
  intervals: { listening: [], talk: [], practice: [] },
  encountered: [],
  contributions: {},
});
export const frenchWords = (text: string) =>
  text.toLocaleLowerCase("fr").match(/[\p{L}]+(?:[’'-][\p{L}]+)*/gu) ?? [];
export function mergeIntervals(items: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const [start, end] of items
    .filter(([a, b]) => Number.isFinite(a) && b > a)
    .sort((a, b) => a[0] - b[0])) {
    const last = result[result.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else result.push([start, end]);
  }
  return result;
}
export function learningSummary(
  days: Record<string, LearningDay>,
  now = new Date(),
) {
  const day = days[localDay(now)] ?? emptyDay();
  const duration = (intervals: Interval[]) =>
    mergeIntervals(intervals).reduce((n, [a, b]) => n + b - a, 0);
  const byKind = Object.fromEntries(
    Object.entries(day.intervals).map(([k, v]) => [k, duration(v)]),
  ) as Record<ActivityKind, number>;
  const contributions = Object.values(day.contributions);
  return {
    milliseconds: duration(Object.values(day.intervals).flat()),
    byKind,
    encountered: day.encountered.length,
    spoken: contributions
      .filter((x) => x.mode === "spoken")
      .reduce((n, x) => n + x.words, 0),
    typed: contributions
      .filter((x) => x.mode === "typed")
      .reduce((n, x) => n + x.words, 0),
  };
}
// Wall time supported by actual media movement; buffering and seek jumps earn none.
export function listeningCredit(
  previous: { positionMs: number; playing: boolean },
  current: { positionMs: number; rate: number },
  elapsed: number,
  uninterrupted: boolean,
) {
  const advanced = current.positionMs - previous.positionMs;
  if (
    !uninterrupted ||
    !previous.playing ||
    elapsed <= 0 ||
    elapsed > 5000 ||
    current.rate <= 0 ||
    advanced <= 0 ||
    advanced > elapsed * current.rate + 500
  )
    return 0;
  return Math.min(elapsed, advanced / current.rate);
}
