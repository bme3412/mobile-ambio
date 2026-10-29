import { useLearningTime } from "../../activity/useLearningTime";
import { requestReview, practiceFromSession } from "../../conversation/review";
import type { ConversationPracticeContext } from "../../domain/types";
import {
  localDate,
  topicsForDate,
} from "../../../preview/lib/conversation-topics.cjs";
import { AudioLines } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Platform,
  Switch,
  Text,
  TextInput,
  View,
  AppState,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Body,
  Button,
  colors,
  Label,
  Page,
  s,
  Title,
} from "../../components/ui";
import { useLibrary } from "../../state/library";
import { player } from "../../playback/player";
import { voiceApi } from "../../conversation/api";
import { stopPronunciation } from "../../playback/pronunciation";
import { VoiceConversation } from "../../conversation/realtime";

function ConversationContent() {
  const params = useLocalSearchParams<{
    practiceSessionId?: string;
    practiceRequest?: string;
    typing?: string;
  }>();
  const [focused, setFocused] = useState(false);
  const consumed = useRef<string | null>(null);
  const [parentSessionId, setParentSessionId] = useState<string | undefined>();
  const saving = useRef(false);
  const [today, setToday] = useState(localDate);
  const suggestions = topicsForDate(today);
  const [typing, setTyping] = useState(false);
  const [settings, setSettings] = useState(false);
  const [sessionTopic, setSessionTopic] = useState("Just talk");
  const [voice] = useState(() => new VoiceConversation(voiceApi.request));
  const state = useSyncExternalStore(
    voice.subscribe,
    voice.getSnapshot,
    voice.getSnapshot,
  );
  useLearningTime(
    "talk",
    ["listening", "thinking", "speaking"].includes(state.status),
    state.turns,
  );
  const [captions, setCaptions] = useState(true);
  const [fullTranscript, setFullTranscript] = useState(true);
  const [draft, setDraft] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [healthCheck, setHealthCheck] = useState(0);
  const save = useLibrary((x) => x.saveSession);
  const active = ["listening", "thinking", "speaking"].includes(state.status);
  const connecting = state.status === "connecting";
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    void voiceApi
      .request("/api/voice/health", { signal: controller.signal })
      .then(async (response) => {
        if (!mounted) return;
        setNeedsSignIn(response.status === 401);
        const data = response.ok ? await response.json() : null;
        if (mounted) {
          setAvailable(
            Boolean(data?.available) && Boolean(data?.generalConversation),
          );
          setServiceError(
            response.status === 401
              ? null
              : !response.ok
                ? "Talk’s server could not respond. Please try again."
                : !data?.available
                  ? "Talk is temporarily unavailable on the server. Please try again shortly."
                  : !data?.generalConversation
                    ? "Talk needs the updated conversation service. Please try again shortly."
                    : null,
          );
        }
      })
      .catch(() => {
        if (mounted) {
          setAvailable(false);
          setServiceError(
            controller.signal.aborted
              ? "Talk took too long to respond. Please try again."
              : "Could not reach Talk. Check your connection and retry.",
          );
        }
      })
      .finally(() => clearTimeout(timer));
    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [healthCheck]);
  const signIn = async () => {
    setSigningIn(true);
    setServiceError(null);
    try {
      await voiceApi.signIn(password);
      setPassword("");
      setNeedsSignIn(false);
      setAvailable(null);
      setHealthCheck((value) => value + 1);
    } catch (error) {
      setServiceError(
        error instanceof Error ? error.message : "Could not sign in.",
      );
    } finally {
      setSigningIn(false);
    }
  };
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setToday(localDate());
      setHealthCheck((value) => value + 1);
      const leave = () => voice.end();
      const visible = () => {
        if (document.visibilityState === "visible") {
          setToday(localDate());
          voice.resumeAudio();
        }
      };
      if (Platform.OS === "web") {
        window.addEventListener("pagehide", leave);
        document.addEventListener("visibilitychange", visible);
      }
      const appState =
        Platform.OS !== "web"
          ? AppState.addEventListener("change", (value) => {
              if (value === "background") voice.end();
              if (value === "active") {
                setToday(localDate());
                setHealthCheck((v) => v + 1);
              }
            })
          : null;
      return () => {
        setFocused(false);
        appState?.remove();
        voice.end();
        if (Platform.OS === "web") {
          window.removeEventListener("pagehide", leave);
          document.removeEventListener("visibilitychange", visible);
        }
      };
    }, [voice]),
  );
  const start = useCallback(
    (
      microphone: boolean,
      topic = { id: "open", label: "Just talk" },
      practiceContext?: ConversationPracticeContext,
    ) => {
      player.pause();
      stopPronunciation();
      setDraft("");
      setParentSessionId(practiceContext?.parentSessionId);
      setSessionTopic(topic.label);
      void voice
        .start(
          microphone,
          undefined,
          { id: topic.id, date: today },
          practiceContext,
        )
        .then(() => {
          if (voice.getSnapshot().status === "error")
            setHealthCheck((v) => v + 1);
        });
    },
    [
      today,
      voice,
      setDraft,
      setParentSessionId,
      setSessionTopic,
      setHealthCheck,
    ],
  );
  useEffect(() => {
    if (
      !focused ||
      available !== true ||
      !params.practiceRequest ||
      !params.practiceSessionId ||
      consumed.current === params.practiceRequest
    )
      return;
    let cancelled = false;
    // Start the external voice connection after the route has committed; a blur
    // or Strict Mode cleanup cancels this handoff before microphone acquisition.
    void Promise.resolve().then(() => {
      if (cancelled) return;
      consumed.current = params.practiceRequest ?? null;
      const parent = useLibrary
        .getState()
        .sessions.find((s) => s.id === params.practiceSessionId);
      const context = parent && practiceFromSession(parent);
      if (!context) {
        setServiceError(
          "This review is no longer available. Open the saved conversation and generate a review first.",
        );
        return;
      }
      setTyping(params.typing === "1");
      start(
        params.typing !== "1",
        { id: "open", label: `Practice · ${context.topic}` },
        context,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [
    focused,
    available,
    params.practiceRequest,
    params.practiceSessionId,
    params.typing,
    start,
  ]);
  const finish = async () => {
    if (saving.current) return;
    saving.current = true;
    voice.end();
    const snapshot = voice.getSnapshot();
    const id = `voice-${Date.now()}`;
    await save({
      id,
      parentSessionId,
      episodeId: "",
      topicTitle: sessionTopic,
      createdAt: new Date().toISOString(),
      isMock: false,
      turns: snapshot.turns.filter((t) => t.text.trim()),
      observations: snapshot.observations,
    });
    void requestReview(id);
    router.push({ pathname: "/recap", params: { id } });
    saving.current = false;
  };
  return (
    <Page>
      <Label>TALK · AI VOICE</Label>
      <Title>{active ? "À vous de parler." : "On en parle ?"}</Title>
      <Body>
        {active || connecting
          ? sessionTopic
          : `${suggestions.day} · A little French, about your day.`}
      </Body>
      {(active || connecting || state.status === "ended") && (
        <View style={{ alignItems: "center", gap: 14, paddingVertical: 16 }}>
          <View
            style={{
              width: 108,
              height: 108,
              borderRadius: 54,
              backgroundColor:
                state.status === "speaking" ? colors.lavender : colors.tint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AudioLines size={50} color={colors.green} />
          </View>
          <Text accessibilityLiveRegion="polite" style={s.label}>
            {connecting
              ? "CONNECTING…"
              : state.status === "speaking"
                ? "AMBIO IS SPEAKING"
                : state.status === "thinking"
                  ? "THINKING…"
                  : active
                    ? state.muted
                      ? "MICROPHONE MUTED"
                      : state.microphone
                        ? "LISTENING · TAKE YOUR TIME"
                        : "TYPE YOUR REPLY BELOW"
                    : state.status === "ended"
                      ? "CONVERSATION ENDED"
                      : "YOUR FRENCH COMPANION"}
          </Text>
        </View>
      )}
      {state.error && (
        <View style={s.card}>
          <Text accessibilityRole="alert" style={s.body}>
            {state.error}
          </Text>
        </View>
      )}
      {!active && !connecting && (
        <>
          {serviceError && (
            <Text accessibilityRole="alert" style={s.body}>
              {serviceError}
            </Text>
          )}
          {needsSignIn ? (
            <View style={s.card}>
              <Body>
                Unlock Practice and Talk with your beta password to start a
                conversation in Ambio.
              </Body>
              <TextInput
                accessibilityLabel="Preview password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                value={password}
                onChangeText={setPassword}
                editable={!signingIn}
                maxLength={128}
                style={s.input}
              />
              <Button
                label={signingIn ? "Signing in…" : "Sign in to voice"}
                disabled={signingIn || !password}
                onPress={() => void signIn()}
              />
            </View>
          ) : available === false ? (
            <>
              <Button
                label="Retry voice service"
                onPress={() => {
                  setAvailable(null);
                  setHealthCheck((value) => value + 1);
                }}
              />
            </>
          ) : (
            <>
              <View style={s.row}>
                <Body>Type instead of speaking</Body>
                <Switch
                  accessibilityLabel="Type instead of speaking"
                  value={typing}
                  onValueChange={setTyping}
                />
              </View>
              <Button
                label={available === null ? "Connecting to Talk…" : "Just talk"}
                disabled={available !== true}
                onPress={() => start(!typing)}
              />
              <Label>A FEW IDEAS FOR {suggestions.day.toUpperCase()}</Label>
              {suggestions.topics.map((topic) => (
                <Button
                  key={topic.id}
                  secondary
                  label={topic.label}
                  disabled={available !== true}
                  onPress={() => start(!typing, topic)}
                />
              ))}
            </>
          )}
          {voiceApi.native && !needsSignIn && available === true && (
            <Button
              secondary
              label={settings ? "Hide account options" : "Account options"}
              onPress={() => setSettings(!settings)}
            />
          )}
          {settings &&
            voiceApi.native &&
            !needsSignIn &&
            available === true && (
              <Button
                secondary
                label="Sign out of voice"
                onPress={() => {
                  voice.end();
                  void voiceApi
                    .signOut()
                    .then(() => {
                      setNeedsSignIn(true);
                      setAvailable(false);
                    })
                    .catch(() =>
                      setServiceError("Could not sign out. Please try again."),
                    );
                }}
              />
            )}
        </>
      )}
      {connecting && (
        <Button
          secondary
          label="Cancel connection"
          onPress={() => voice.end()}
        />
      )}
      {(active || state.turns.length > 0) && (
        <>
          <View style={s.row}>
            <Body>Conversation captions</Body>
            <Switch
              accessibilityLabel="Show conversation captions"
              value={captions}
              onValueChange={setCaptions}
            />
          </View>
          {captions &&
            (fullTranscript ? state.turns : state.turns.slice(-3)).map(
              (turn) => (
                <View
                  style={{
                    ...s.card,
                    backgroundColor:
                      turn.role === "user" ? colors.tint : colors.paper,
                  }}
                  key={turn.id}
                >
                  <Label>{turn.role === "user" ? "YOU" : "AMBIO"}</Label>
                  <Text style={s.body}>{turn.text || "Transcribing…"}</Text>
                  {turn.interrupted && (
                    <Text style={s.note}>
                      Interrupted · some text may not have been spoken.
                    </Text>
                  )}
                </View>
              ),
            )}
        </>
      )}
      {captions && state.turns.length > 3 && (
        <Button
          secondary
          label={
            fullTranscript ? "Show recent replies" : "Show full conversation"
          }
          onPress={() => setFullTranscript(!fullTranscript)}
        />
      )}
      {active && (
        <>
          {state.audioBlocked && (
            <Button
              label="Enable spoken replies"
              onPress={() => voice.resumeAudio()}
            />
          )}
          {state.microphone && (
            <Button
              secondary
              label={state.muted ? "Unmute microphone" : "Mute microphone"}
              onPress={() => voice.mute()}
            />
          )}
          {(state.status === "speaking" || state.status === "thinking") && (
            <Button
              secondary
              label="Interrupt tutor"
              onPress={() => voice.interrupt()}
            />
          )}
          <TextInput
            accessibilityLabel="Your French response"
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder="Or type your reply in French…"
            style={[s.input, { minHeight: 80 }]}
            maxLength={2000}
          />
          <Button
            label="Send response"
            disabled={!draft.trim()}
            onPress={() => {
              voice.sendText(draft);
              setDraft("");
            }}
          />
          <Button
            secondary
            label="Help me understand"
            onPress={() =>
              voice.sendText(
                "Peux-tu expliquer brièvement ta dernière question en anglais, puis la répéter plus simplement en français ?",
              )
            }
          />
          <Button
            secondary
            label="Speak more slowly"
            onPress={() =>
              voice.sendText(
                "Peux-tu parler plus lentement, avec des phrases plus courtes ?",
              )
            }
          />
        </>
      )}
      {state.observations.length > 0 && (
        <View style={s.card}>
          <Label>A MORE NATURAL WAY</Label>
          {state.observations.map((note) => (
            <View key={note.id} style={{ gap: 6 }}>
              <Body>
                {note.original} → {note.suggestion}
              </Body>
              <Text style={s.note}>{note.explanation}</Text>
            </View>
          ))}
        </View>
      )}
      {state.turns.length > 0 && (
        <Button secondary label="End & save conversation" onPress={finish} />
      )}
      {active && (
        <Button
          secondary
          label="End without saving"
          onPress={() => voice.end()}
        />
      )}
    </Page>
  );
}

export default function Conversation() {
  return <ConversationContent />;
}
