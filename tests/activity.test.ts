import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  localDay,
  practiceSummary,
  PracticeActivity,
} from "../src/activity/model";
import { recordPractice, useActivity } from "../src/state/activity";
const attempt = (
  id: string,
  phraseId: string,
  day: string,
): PracticeActivity => ({
  id,
  phraseId,
  episodeId: "episode",
  day,
  completedAt: `${day}T12:00:00Z`,
});
test("daily goal counts different phrases while weekly activity includes retries", () => {
  const now = new Date(2026, 9, 26, 12);
  const result = practiceSummary(
    [
      attempt("1", "a", "2026-10-26"),
      attempt("2", "a", "2026-10-26"),
      attempt("3", "b", "2026-10-25"),
      attempt("4", "c", "2026-10-01"),
    ],
    now,
  );
  expect(result.todayPhrases).toBe(1);
  expect(result.phrases).toBe(3);
  expect(result.activeDays).toBe(2);
  expect(result.week.at(-1)?.attempts).toBe(2);
  expect(result.week[0].day).toBe("2026-10-20");
});
test("uses local calendar dates across year boundaries", () => {
  expect(localDay(new Date(2027, 0, 1, 0, 1))).toBe("2027-01-01");
  expect(practiceSummary([], new Date(2027, 0, 1, 12)).week[0].day).toBe(
    "2026-12-26",
  );
});
test("attempts persist across hydration and duplicate completion does not double count", async () => {
  await useActivity.persist.rehydrate();
  useActivity.setState({ attempts: [] });
  const entry = attempt("stable-id", "a", "2026-10-26");
  await recordPractice(entry);
  await recordPractice(entry);
  expect(useActivity.getState().attempts).toHaveLength(1);
  const stored = await AsyncStorage.getItem("ambio-activity-v1");
  expect(JSON.parse(stored!).state.attempts).toEqual([entry]);
  await useActivity.persist.rehydrate();
  expect(useActivity.getState().attempts).toEqual([entry]);
});
