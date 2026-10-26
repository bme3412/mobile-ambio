import { useEpisodeData } from "../data/catalog";
import { AudioLines } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Body, Button, colors, Label, Page, s, Title } from "../components/ui";
import { useLibrary } from "../state/library";
import { player } from "../playback/player";
import { ConversationSession } from "../domain/types";
import { appendResponse, correction, prompts } from "../conversation/demo";
export default function Conversation() {
  const { episode } = useEpisodeData();
  const [started, setStarted] = useState(false),
    [captions, setCaptions] = useState(true),
    [step, setStep] = useState(0),
    [draft, setDraft] = useState(""),
    [speaking, setSpeaking] = useState(false),
    [help, setHelp] = useState(false);
  const [turns, setTurns] = useState<ConversationSession["turns"]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = useLibrary((x) => x.saveSession);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    setSpeaking(false);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const start = () => {
    player.pause();
    setStarted(true);
    setStep(0);
    setTurns([{ id: "opening", role: "tutor", text: prompts[0].question }]);
    setDraft("");
    setHelp(false);
  };
  const respond = (text: string) => {
    if (!text.trim() || step >= prompts.length) return;
    setTurns((t) => appendResponse(t, text.trim(), step));
    setStep((n) => n + 1);
    setDraft("");
    setHelp(false);
    setSpeaking(true);
    timer.current = setTimeout(() => setSpeaking(false), 1400);
  };
  const end = () => {
    stop();
    const session: ConversationSession = {
      id: `demo-${Date.now()}`,
      episodeId: episode.id,
      createdAt: new Date().toISOString(),
      isMock: true,
      turns,
      observations: turns.some(
        (t) => t.role === "user" && t.text.includes(correction.original),
      )
        ? [correction]
        : [],
    };
    save(session);
    setStarted(false);
    router.push({ pathname: "/recap", params: { id: session.id } });
  };
  return (
    <Page>
      <Label>CONVERSATION STUDIO · LOCAL DEMO</Label>
      <Title>
        {started
          ? "Let the conversation flow."
          : "A story is just\nthe beginning."}
      </Title>
      <Body>{episode.title} · French, B1–B2</Body>
      <View style={{ alignItems: "center", gap: 12, paddingVertical: 8 }}>
        <View
          style={{
            width: 116,
            height: 116,
            borderRadius: 58,
            backgroundColor: colors.tint,
            borderWidth: 1,
            borderColor: colors.line,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AudioLines size={54} color={colors.green} strokeWidth={1.5} />
        </View>
        <Label>
          {!started
            ? "YOUR FRENCH COMPANION"
            : speaking
              ? "TUTOR RESPONSE · SIMULATED"
              : step >= 3
                ? "A MOMENT TO REFLECT"
                : "YOUR TURN"}
        </Label>
      </View>
      {!started ? (
        <>
          <View style={s.card}>
            <Text style={s.subheading}>Find your own words.</Text>
            <Body>
              Choose what you would explore with an extra hour: the clock
              change, the mission to Phobos, or chocolate craftsmanship. Speak
              for one minute, then write your answer in three guided turns.
            </Body>
          </View>
          <Button label="Start demo conversation" onPress={start} />
        </>
      ) : (
        <>
          <View style={s.row}>
            <Text style={s.note}>Turn {Math.min(step + 1, 3)} of 3</Text>
            <View style={s.row}>
              <Body>Captions</Body>
              <Switch
                accessibilityLabel="Show demo captions"
                value={captions}
                onValueChange={setCaptions}
              />
            </View>
          </View>
          {captions ? (
            <View style={s.card}>
              <Label>AMBiO · SCRIPTED PROMPT</Label>
              <Text accessibilityLiveRegion="polite" style={s.subheading}>
                {turns.at(-1)?.text}
              </Text>
            </View>
          ) : (
            <Body>
              Captions are hidden. Turn them on to read the scripted tutor
              prompt.
            </Body>
          )}
          {speaking ? (
            <Button secondary label="Interrupt tutor" onPress={stop} />
          ) : step < 3 ? (
            <>
              <TextInput
                accessibilityLabel="Your French response"
                value={draft}
                onChangeText={setDraft}
                placeholder="Write your reply in French…"
                multiline
                style={[s.input, { minHeight: 90 }]}
              />
              <Button
                label="Send response"
                disabled={!draft.trim()}
                onPress={() => respond(draft)}
              />
              <Button
                secondary
                label="Use sample response"
                onPress={() => respond(prompts[step].sample)}
              />
              <Button
                secondary
                label={help ? "Hide language help" : "Help me understand"}
                onPress={() => setHelp(!help)}
              />
              {help && (
                <View style={s.card}>
                  <Label>A LITTLE HELP</Label>
                  <Body>{prompts[step].help}</Body>
                </View>
              )}
            </>
          ) : (
            <View style={s.card}>
              <Text style={s.subheading}>Keep the conversation with you.</Text>
              <Body>
                Your three responses are ready to revisit. Finish to save the
                transcript and sample learning notes.
              </Body>
            </View>
          )}
          <Button secondary label="End & save demo recap" onPress={end} />
        </>
      )}
      <Body>
        Interactive scripted preview. Replies stay on this device. No microphone
        or AI is used; tutor replies are prewritten, not personalized.
      </Body>
    </Page>
  );
}
