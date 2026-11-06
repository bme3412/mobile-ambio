import { colors } from "./theme";
import { Text, View } from "react-native";
import { useActivity } from "../state/activity";
import { learningSummary } from "../activity/learning";
import { Body, Label } from "./ui";
export function DailyProgress({
  now = new Date(),
  compact = false,
}: {
  now?: Date;
  compact?: boolean;
}) {
  const days = useActivity((s) => s.days);
  const x = learningSummary(days, now),
    goal = 600000;
  const minutes = (ms: number) => (ms / 60000).toFixed(1);
  return (
    <View
      style={{
        backgroundColor: colors.lavender,
        padding: 22,
        borderRadius: 0,
        gap: 14,
      }}
    >
      <Label>YOUR FRENCH TODAY</Label>
      <Text style={{ fontSize: 32, color: colors.ink }}>
        {minutes(x.milliseconds)} / 10 min
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Daily French activity"
        accessibilityValue={{
          min: 0,
          max: 10,
          now: Math.min(10, x.milliseconds / 60000),
          text: `${minutes(x.milliseconds)} of 10 minutes`,
        }}
        style={{
          height: 9,
          borderRadius: 8,
          backgroundColor: colors.line,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            backgroundColor: colors.blue,
            width: `${Math.min(100, (x.milliseconds / goal) * 100)}%`,
          }}
        />
      </View>
      <Body>
        Listening {minutes(x.byKind.listening)} min · Talk{" "}
        {minutes(x.byKind.talk)} min · Practice {minutes(x.byKind.practice)} min
      </Body>
      <Body>
        {x.encountered} distinct words encountered · {x.spoken} words spoken in
        Talk{x.typed ? ` · ${x.typed} typed` : ""}
      </Body>
      {!compact && (
        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
          Time reflects active use; overlapping activities count once. Words
          encountered come from played transcript passages and revealed phrases.
          Spoken words are transcription estimates, not a mastery score.
        </Text>
      )}
    </View>
  );
}
