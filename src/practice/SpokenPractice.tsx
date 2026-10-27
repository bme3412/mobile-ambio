import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Body, Button, Label } from "../components/ui";
import { createVoiceTransport } from "../conversation/transport";
import { coachRequest, unlockPractice } from "./api";
import { SpokenCoach } from "./coach";
import { practiceMaterial } from "./model";
import { recordPractice } from "../state/activity";
import { localDay } from "../activity/model";

type Material = NonNullable<ReturnType<typeof practiceMaterial>>;
export default function SpokenPractice({
  material,
  active,
  referenceError,
  referencePlaying,
  stopReference,
  playReference,
}: {
  material: Material;
  active: boolean;
  referenceError: string | null;
  referencePlaying: boolean;
  stopReference: () => void;
  playReference: (start: number, end: number) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showHeard, setShowHeard] = useState(false);
  const coach = useMemo(
    () =>
      new SpokenCoach(coachRequest, createVoiceTransport, (attempt) => {
        const now = new Date();
        void recordPractice({
          ...attempt,
          completedAt: now.toISOString(),
          day: localDay(now),
        });
      }),
    [],
  );
  const state = useSyncExternalStore(
    coach.subscribe,
    coach.getSnapshot,
    coach.getSnapshot,
  );
  const phrase = material.phrases[index];
  const busy = ["connecting", "listening", "thinking", "speaking"].includes(
    state.status,
  );
  useEffect(() => () => coach.stop(), [coach]);
  useEffect(() => {
    if (!active) {
      coach.stop();
    }
  }, [active, coach]);
  const move = (next: number) => {
    coach.stop();
    stopReference();
    setIndex(next);
    setShowHeard(false);
    setPassword("");
    setUnlockError(null);
  };
  const start = () => {
    stopReference();
    setShowHeard(false);
    void coach.start(material.episodeId, phrase.id);
  };
  const unlock = async () => {
    setUnlocking(true);
    setUnlockError(null);
    const result = await unlockPractice(password);
    setPassword("");
    setUnlocking(false);
    if (result.error) setUnlockError(result.error);
    else coach.stop();
  };
  const status = {
    ready: "Your turn, when you’re ready",
    connecting: "Connecting your coach…",
    listening: "Read aloud now",
    thinking: "Your coach is listening back…",
    speaking: "Listen to your coach",
    feedback: "Try it again, or continue",
    error: "Let’s try again",
    locked: "Unlock your spoken coach",
  }[state.status];
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Label>
          SPOKEN PRACTICE · {index + 1} / {material.phrases.length}
        </Label>
        <Text style={styles.title} accessibilityRole="header">
          {material.title}
        </Text>
        <Text style={styles.phrase} accessibilityLanguage="fr-FR">
          {phrase.text}
        </Text>
        <Button
          secondary
          label={showTranslation ? "Hide English" : "Show English"}
          onPress={() => setShowTranslation(!showTranslation)}
        />
        {showTranslation && <Body>{phrase.translation}</Body>}
        <Button
          secondary
          label={referencePlaying ? "Stop example" : "Hear the original phrase"}
          disabled={busy || !active}
          onPress={() => {
            if (referencePlaying) stopReference();
            else
              void playReference(
                phrase.words[0].startMs,
                phrase.words.at(-1)!.endMs,
              ).catch(() => {});
          }}
        />
        {referenceError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {referenceError}
          </Text>
        )}
        <View style={styles.coach}>
          <Text
            style={styles.status}
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
          >
            {status}
          </Text>
          <Body>
            {state.status === "listening"
              ? `${state.speechDetected ? "I can hear you. " : ""}Read the French phrase, then pause. Your coach will respond aloud.`
              : state.status === "connecting"
                ? "Wait for “Read aloud now” before speaking."
                : state.status === "thinking" || state.status === "speaking"
                  ? "Your microphone is muted during feedback."
                  : "Read one phrase. Hear one short tip and a French example. No scores."}
          </Body>
          {!!state.caption && (
            <Text style={styles.caption}>{state.caption}</Text>
          )}
          {!!state.error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {state.error}
            </Text>
          )}
          {state.audioBlocked && (
            <Button
              label="Play coach audio"
              onPress={() => void coach.resumeAudio()}
            />
          )}
          {state.status === "locked" ? (
            <>
              <Body>
                Use your Ambio preview password here. This also unlocks Talk.
              </Body>
              <TextInput
                accessibilityLabel="Preview password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                placeholder="Preview password"
                style={styles.input}
                editable={!unlocking}
                onSubmitEditing={() => {
                  if (password && !unlocking) void unlock();
                }}
              />
              {!!unlockError && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {unlockError}
                </Text>
              )}
              <Button
                label={unlocking ? "Unlocking…" : "Unlock practice"}
                disabled={!password || unlocking || !active}
                onPress={() => void unlock()}
              />
            </>
          ) : (
            !busy && (
              <Button
                label={
                  state.status === "feedback" || state.status === "error"
                    ? "Try this phrase again"
                    : "Read to my coach"
                }
                onPress={start}
                disabled={!active}
              />
            )
          )}
          {state.status === "listening" && (
            <Button label="I’ve finished reading" onPress={coach.finish} />
          )}
          {busy && (
            <Button secondary label="Stop practice" onPress={coach.stop} />
          )}
          {!!state.heard && (
            <>
              <Button
                secondary
                label={
                  showHeard ? "Hide what was heard" : "Show what was heard"
                }
                onPress={() => setShowHeard(!showHeard)}
              />
              {showHeard && <Body>{state.heard}</Body>}
            </>
          )}
        </View>
        <View style={styles.navigation}>
          <Button
            secondary
            label="Previous phrase"
            disabled={index === 0 || unlocking}
            onPress={() => move(index - 1)}
          />
          <Button
            label={
              index === material.phrases.length - 1
                ? "Practise again from the start"
                : "Next phrase"
            }
            disabled={unlocking}
            onPress={() => move((index + 1) % material.phrases.length)}
          />
        </View>
        <Text style={styles.note}>
          An AI voice coach listens to your attempt. Feedback can be imperfect;
          use the original phrase as your reference. Audio is sent for coaching
          only when you start an attempt.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  content: {
    padding: 22,
    paddingBottom: 40,
    gap: 18,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  title: { fontSize: 19, color: "#44534B", fontWeight: "600" },
  phrase: {
    fontSize: 32,
    lineHeight: 44,
    color: "#183A31",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    marginVertical: 14,
  },
  coach: { backgroundColor: "#EEE9F5", borderRadius: 20, padding: 20, gap: 16 },
  status: { fontSize: 20, fontWeight: "700", color: "#183A31" },
  caption: { fontSize: 19, lineHeight: 29, color: "#183A31" },
  error: { color: "#8B2635", fontSize: 16, lineHeight: 24 },
  navigation: { gap: 12 },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#63738F",
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    minHeight: 50,
  },
  note: { fontSize: 14, lineHeight: 21, color: "#54635B" },
});
