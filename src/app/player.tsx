import { EditionGate } from "../components/EditionStatus";
import { useEpisodeData } from "../data/catalog";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PhraseReader } from "../components/PhraseReader";
import { WordSheet } from "../components/WordSheet";
import { Body, Button, DemoNote, colors, Label, s } from "../components/ui";
import { normalizeWord } from "../data/dictionary";
import { WordToken, TranscriptSegment } from "../domain/types";
import { player } from "../playback/player";
import { useLibrary } from "../state/library";

function PlayerContent() {
  const { episode, episodeSources, speakingPrompt, vocabulary, verifiedAt } =
    useEpisodeData();
  const [selection, setSelection] = useState<{
    word: WordToken;
    segment: TranscriptSegment;
  } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const saved = useLibrary((state) => state.transcripts.includes(episode.id));
  const toggle = useLibrary((state) => state.toggleTranscript);
  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={s.page}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 680,
          alignSelf: "center",
          paddingHorizontal: 20,
          paddingBottom: 8,
          gap: 8,
        }}
      >
        <PhraseReader
          followPhrase={!detailsOpen}
          onWord={(word, segment) => setSelection({ word, segment })}
        >
          <View style={s.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Full transcript"
              onPress={() => router.push("/transcript")}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: "#007B60", fontWeight: "600" }}>
                Full transcript ↗
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Episode details"
              accessibilityState={{ expanded: detailsOpen }}
              onPress={() => setDetailsOpen(!detailsOpen)}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: colors.ink }}>
                Episode details {detailsOpen ? "−" : "+"}
              </Text>
            </Pressable>
          </View>
          {detailsOpen && (
            <View style={{ gap: 18 }}>
              <Button
                secondary
                label={
                  saved
                    ? "Unsave episode transcript"
                    : "Save episode transcript"
                }
                onPress={() => toggle(episode.id)}
              />
              <Button
                secondary
                label="Talk about this episode"
                onPress={() => router.push("/conversation")}
              />
              <View style={s.card}>
                <Label>À VOUS · ONE MINUTE ALOUD</Label>
                <Body>{speakingPrompt}</Body>
                <Text style={s.note}>
                  Try: « J’aimerais comprendre… », « ce qui m’intéresse, c’est…
                  »
                </Text>
              </View>
              <Label>12 WORDS TO TAKE WITH YOU</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {Object.keys(vocabulary).map((key) => {
                  const segment = episode.segments.find((s) =>
                    s.words.some((w) => normalizeWord(w.text) === key),
                  );
                  const word = segment?.words.find(
                    (w) => normalizeWord(w.text) === key,
                  );
                  return word && segment ? (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Study ${word.text}`}
                      onPress={() => {
                        player.pause();
                        setSelection({ word, segment });
                      }}
                      style={{
                        padding: 12,
                        borderRadius: 20,
                        backgroundColor: colors.tint,
                      }}
                    >
                      <Text style={{ color: colors.ink }}>
                        {word.text.replace(/[.,!?]$/, "")}
                      </Text>
                    </Pressable>
                  ) : null;
                })}
              </View>
              <Label>SOURCES · DATED STORIES, NOT A LIVE NEWS BULLETIN</Label>
              {verifiedAt && (
                <Text style={s.note}>
                  Sources checked · {new Date(verifiedAt).toLocaleString()}
                </Text>
              )}
              {episodeSources.map((source) => (
                <Pressable
                  key={source.url}
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(source.url)}
                  style={{ paddingVertical: 10, gap: 4 }}
                >
                  <Text style={{ color: colors.green, fontWeight: "600" }}>
                    {source.publisher}
                  </Text>
                  <Text style={s.note}>{source.title}</Text>
                </Pressable>
              ))}
              <DemoNote />
            </View>
          )}
        </PhraseReader>
      </View>
      <WordSheet
        selection={selection}
        onClose={() => {
          setSelection(null);
        }}
      />
    </SafeAreaView>
  );
}

export default function Player() {
  return (
    <EditionGate>
      <PlayerContent />
    </EditionGate>
  );
}
