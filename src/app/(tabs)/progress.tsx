import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Body, Button, Label, Page, Title, s } from "../../components/ui";
import { useActivity } from "../../state/activity";
import { useLibrary } from "../../state/library";
import { practiceSummary } from "../../activity/model";
import {
  useCatalog,
  editions,
  findEdition,
  latestEdition,
} from "../../data/catalog";

export default function Progress() {
  useCatalog((s) => s.version);
  const attempts = useActivity((state) => state.attempts);
  const storageError = useActivity((state) => state.storageError);
  const bookmarks = useLibrary((state) => state.bookmarks);
  const progress = useLibrary((state) => state.progressByEpisode);
  const sessions = useLibrary((state) => state.sessions);
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const timer = setInterval(() => setNow(new Date()), 60000);
      return () => clearInterval(timer);
    }, []),
  );
  const summary = practiceSummary(attempts, now);
  const goal = 3;
  return (
    <Page mini>
      <Label>YOUR FRENCH, DAY BY DAY</Label>
      <Title>A little more fluent.</Title>
      <Body>Small moments of listening and speaking add up.</Body>
      {storageError && (
        <Text accessibilityRole="alert">
          Activity could not be saved on this device. Your totals may not
          survive restarting the app.
        </Text>
      )}
      <View style={styles.hero}>
        <Label>TODAY’S PRACTICE</Label>
        <Text style={styles.number}>
          {summary.todayPhrases}{" "}
          <Text style={styles.denominator}>/ {goal} phrases</Text>
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Daily practice goal: ${summary.todayPhrases} of ${goal} different phrases coached today`}
          accessibilityValue={{
            min: 0,
            max: goal,
            now: Math.min(goal, summary.todayPhrases),
            text: `${summary.todayPhrases} different phrases coached today; goal ${goal}`,
          }}
          style={styles.track}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${Math.min(100, (summary.todayPhrases / goal) * 100)}%`,
              },
            ]}
          />
        </View>
        <Body>
          {summary.todayPhrases >= goal
            ? "You made time for French today. Keep going if you feel like it."
            : "Try three different phrases today. Take your time, and repeat whenever it helps."}
        </Body>
        <Button
          label="Practise a story"
          onPress={() =>
            router.push({
              pathname: "/practice",
              params: {
                episodeId: latestEdition.episode.id,
                storyId: latestEdition.episode.stories[0].id,
              },
            })
          }
        />
      </View>
      <Text accessibilityRole="header" style={s.subheading}>
        Your last seven days
      </Text>
      <View style={styles.week}>
        {summary.week.map((day) => (
          <View
            key={day.day}
            style={styles.day}
            accessible
            accessibilityLabel={`${day.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${day.attempts} coached attempts`}
          >
            <Text style={styles.dayLabel}>
              {day.date.toLocaleDateString(undefined, { weekday: "narrow" })}
            </Text>
            <View
              style={[
                styles.dot,
                day.attempts > 0 && styles.activeDot,
                day.day === summary.today && styles.today,
              ]}
            >
              <Text
                style={[styles.count, day.attempts > 0 && { color: "white" }]}
              >
                {day.attempts || "–"}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Body>
        {summary.activeDays} of 7 days with spoken practice. Each count is an
        attempt with completed coach feedback.
      </Body>
      <View style={styles.metrics}>
        <Metric value={attempts.length} label="Coached attempts" />
        <Metric value={summary.phrases} label="Different phrases" />
        <Metric value={bookmarks.length} label="Saved words & phrases" />
        <Metric
          value={bookmarks.filter((b) => b.reviewed).length}
          label="Marked reviewed"
        />
        <Metric
          value={sessions.filter((session) => !session.isMock).length}
          label="Saved Talk sessions"
        />
      </View>
      <Text accessibilityRole="header" style={s.subheading}>
        Your listening place
      </Text>
      <Body>Resume positions, not a measure of time listened or mastery.</Body>
      {editions.map((edition) => {
        const percent = Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((progress[edition.episode.id]?.positionMs ?? 0) /
                edition.episode.durationMs) *
                100,
            ),
          ),
        );
        return (
          <View key={edition.episode.id} style={s.card}>
            <Label>{edition.date}</Label>
            <Text style={styles.episode}>{edition.episode.title}</Text>
            <Body>
              {percent === 0 ? "Not started" : `Saved at ${percent}%`}
            </Body>
          </View>
        );
      })}
      <Text accessibilityRole="header" style={s.subheading}>
        Recent practice
      </Text>
      {attempts.length === 0 ? (
        <Body>
          Your first completed coaching attempt will appear here. Earlier
          practice wasn’t tracked.
        </Body>
      ) : (
        attempts.slice(0, 8).map((attempt) => {
          const edition = findEdition(attempt.episodeId);
          const phrase = edition?.episodePhrases.find(
            (p) => p.words[0].id === attempt.phraseId,
          );
          return (
            <View key={attempt.id} style={s.card}>
              <Label>
                {new Date(attempt.completedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}{" "}
                ·{" "}
                {new Date(attempt.completedAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Label>
              <Text style={styles.episode}>
                {phrase?.words.map((w) => w.text).join(" ") ??
                  "Phrase practice"}
              </Text>
              <Body>
                {edition?.episode.title ?? "Earlier edition"} · Coach feedback
                completed
              </Body>
            </View>
          );
        })
      )}
      <Body>
        Activity stays on this device. Practice totals measure participation,
        not pronunciation accuracy.
      </Body>
    </Page>
  );
}
function Metric({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Body>{label}</Body>
    </View>
  );
}
const styles = StyleSheet.create({
  hero: { backgroundColor: "#EEE9F5", padding: 22, borderRadius: 22, gap: 16 },
  number: { fontSize: 46, color: "#183A31", fontWeight: "600" },
  denominator: { fontSize: 20, fontWeight: "400" },
  track: {
    height: 9,
    borderRadius: 8,
    backgroundColor: "#DAD4E4",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: "#26785F" },
  week: { flexDirection: "row", gap: 4 },
  day: { flex: 1, alignItems: "center", gap: 9 },
  dayLabel: { fontSize: 14, color: "#54635B" },
  dot: {
    width: "100%",
    maxWidth: 42,
    minHeight: 36,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#EEEBE6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  activeDot: { backgroundColor: "#26785F" },
  today: { borderColor: "#6250A0" },
  count: { color: "#54635B", fontSize: 14, fontWeight: "600" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: {
    flexGrow: 1,
    flexBasis: "44%",
    backgroundColor: "#F4F1EB",
    padding: 18,
    borderRadius: 16,
    gap: 6,
  },
  metricValue: { fontSize: 30, color: "#183A31" },
  episode: { fontSize: 19, lineHeight: 28, color: "#183A31" },
});
