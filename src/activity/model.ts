export type PracticeActivity = {
  id: string;
  episodeId: string;
  phraseId: string;
  completedAt: string;
  day: string;
};
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function practiceSummary(
  attempts: PracticeActivity[],
  now = new Date(),
) {
  const today = localDay(now);
  const unique = (items: PracticeActivity[]) =>
    new Set(items.map((a) => `${a.episodeId}:${a.phraseId}`)).size;
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6 + i,
      12,
    );
    const day = localDay(date);
    const items = attempts.filter((a) => a.day === day);
    return { day, date, attempts: items.length, phrases: unique(items) };
  });
  return {
    today,
    week,
    todayPhrases: unique(attempts.filter((a) => a.day === today)),
    phrases: unique(attempts),
    activeDays: week.filter((d) => d.attempts > 0).length,
  };
}
