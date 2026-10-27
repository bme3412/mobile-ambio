import { EditionGate } from "../../components/EditionStatus";
import { useEpisodeData } from "../../data/catalog";
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
  Linking,
  AppState,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
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
  const { episode } = useEpisodeData();
  const sessionEpisode = useRef(episode.id);
  const [voice] = useState(() => new VoiceConversation(voiceApi.request));
  const state = useSyncExternalStore(
    voice.subscribe,
    voice.getSnapshot,
    voice.getSnapshot,
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
        setNeedsSignIn(voiceApi.native && response.status === 401);
        const data = response.ok ? await response.json() : null;
        if (mounted) {
          const supportsEpisode = Array.isArray(data?.episodeIds)
            ? data.episodeIds.includes(episode.id)
            : episode.id === "daily-fr-2026-10-24";
          setAvailable(Boolean(data?.available) && supportsEpisode);
          setServiceError(
            data?.available && !supportsEpisode
              ? "Talk for this edition needs the updated voice service. Listening and word practice are ready."
              : null,
          );
        }
      })
      .catch((error) => {
        if (mounted) {
          setAvailable(false);
          setServiceError(
            error instanceof Error
              ? error.message
              : "Could not reach voice service.",
          );
        }
      })
      .finally(() => clearTimeout(timer));
    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [healthCheck, episode.id]);
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
      setHealthCheck((value) => value + 1);
      const leave = () => voice.end();
      const visible = () => {
        if (document.visibilityState === "visible") voice.resumeAudio();
      };
      if (Platform.OS === "web") {
        window.addEventListener("pagehide", leave);
        document.addEventListener("visibilitychange", visible);
      }
      const appState =
        Platform.OS !== "web"
          ? AppState.addEventListener("change", (value) => {
              if (value === "background") voice.end();
            })
          : null;
      return () => {
        appState?.remove();
        voice.end();
        if (Platform.OS === "web") {
          window.removeEventListener("pagehide", leave);
          document.removeEventListener("visibilitychange", visible);
        }
      };
    }, [voice]),
  );
  const start = (microphone: boolean) => {
    player.pause();
    stopPronunciation();
    setDraft("");
    sessionEpisode.current = episode.id;
    void voice.start(microphone, episode.id).then(() => {
      if (voice.getSnapshot().status === "error")
        setHealthCheck((value) => value + 1);
    });
  };
  const finish = () => {
    voice.end();
    const snapshot = voice.getSnapshot();
    const id = `voice-${Date.now()}`;
    save({
      id,
      episodeId: sessionEpisode.current,
      createdAt: new Date().toISOString(),
      isMock: false,
      turns: snapshot.turns.filter((t) => t.text.trim()),
      observations: snapshot.observations,
    });
    router.push({ pathname: "/recap", params: { id } });
  };
  return (
    <Page>
      <Label>CONVERSATION STUDIO · LIVE FRENCH</Label>
      <Title>
        {active ? "À vous de parler." : "A story is just\nthe beginning."}
      </Title>
      <Body>{episode.title} · French, B1–B2</Body>
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
      {state.error && (
        <View style={s.card}>
          <Text accessibilityRole="alert" style={s.body}>
            {state.error}
          </Text>
        </View>
      )}
      {!active && !connecting && (
        <>
          <View style={s.card}>
            <Text style={s.subheading}>Your ideas. A real conversation.</Text>
            <Body>
              Talk about the extra hour, the journey to Phobos, or chocolate.
              Ambio listens, replies in French, and gently suggests a more
              natural phrase when it helps.
            </Body>
          </View>
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
              <Body>
                Voice is unavailable. Check your connection and try again.
              </Body>
              <Button
                label="Retry voice service"
                onPress={() => {
                  setAvailable(null);
                  setHealthCheck((value) => value + 1);
                }}
              />
              {!voiceApi.native && (
                <Button
                  label="Sign in to private preview"
                  onPress={() =>
                    void Linking.openURL(
                      "https://ambio-daily-preview.vercel.app/conversation",
                    )
                  }
                />
              )}
            </>
          ) : (
            <>
              <Button
                label={
                  available === null
                    ? "Checking voice service…"
                    : "Start voice conversation"
                }
                disabled={available !== true}
                onPress={() => start(true)}
              />
              <Button
                secondary
                label="Type instead · hear spoken replies"
                disabled={available !== true}
                onPress={() => start(false)}
              />
            </>
          )}
          {voiceApi.native && !needsSignIn && available === true && (
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
          <Text style={s.note}>
            Starting sends your voice or typed messages and the episode context
            to OpenAI and uses API credits. Replies use an AI voice. Captions
            and saved recaps stay on this device; this app does not save audio
            recordings. There is no app timer: tap End when you are finished.
            Leaving this conversation screen also ends the session.{" "}
            {voiceApi.native
              ? "Switching apps or locking your phone ends the conversation and releases the microphone. You can still save its recap when you return."
              : "Switching apps or locking your phone does not end practice; your microphone stays enabled unless muted. Safari may temporarily suspend audio or microphone access in the background."}
          </Text>
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
  return (
    <EditionGate>
      <ConversationContent />
    </EditionGate>
  );
}
