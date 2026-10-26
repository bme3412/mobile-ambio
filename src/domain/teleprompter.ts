export function teleprompterOffset({
  positionMs,
  startMs,
  nextStartMs,
  top,
  nextTop,
  anchor,
  reduceMotion,
}: {
  positionMs: number;
  startMs: number;
  nextStartMs: number;
  top: number;
  nextTop: number;
  anchor: number;
  reduceMotion: boolean;
}) {
  const progress = reduceMotion
    ? 0
    : Math.max(
        0,
        Math.min(
          1,
          (positionMs - startMs) / Math.max(1, nextStartMs - startMs),
        ),
      );
  return Math.max(0, top + (nextTop - top) * progress - anchor);
}
