import { FocusReader } from "../components/FocusReader";
import { RevealWord } from "../components/RevealWord";
import { WordSheet } from "../components/WordSheet";
import { vocabulary } from "../data/vocabulary";
import { normalizeWord } from "../data/dictionary";
import { WordToken, TranscriptSegment } from "../domain/types";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Body,
  Button,
  Cover,
  DemoNote,
  colors,
  Label,
  Page,
  s,
  Title,
} from "../components/ui";
import { PlaybackControls } from "../components/PlaybackControls";
import { episode, episodeSources, speakingPrompt } from "../data/episode";
import { usePlayback } from "../playback/player";
import { activeSegment, spokenSentence } from "../domain/transcript";
import { useLibrary } from "../state/library";
export default function Player() {
  const [selection, setSelection] = useState<{
    word: WordToken;
    segment: TranscriptSegment;
  } | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const { positionMs, playing } = usePlayback();
  const segment =
    episode.segments[Math.max(0, activeSegment(episode.segments, positionMs))];
  // Keep the last spoken word lit through short pauses between aligned words.
  const wordIndex = segment.words.findLastIndex(
    (word) => word.startMs <= positionMs,
  );
  const liveWords = spokenSentence(segment.words, positionMs);
  const saved = useLibrary((s) => s.transcripts.includes(episode.id));
  const toggle = useLibrary((s) => s.toggleTranscript);
  return (
    <Page>
      <Cover compact={expanded} />
      <Title>{episode.title}</Title>
      {!expanded && <Body>{episode.subtitle}</Body>}
      {expanded && (
        <View
          style={{
            backgroundColor: colors.lavender,
            borderRadius: 20,
            padding: 16,
            gap: 10,
            minHeight: 156,
          }}
        >
          <View style={s.row}>
            <Label>{segment.speaker}</Label>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {playing ? "Following audio" : "Live words · press play"}
            </Text>
          </View>
          <Text style={{ fontSize: 21, lineHeight: 31, color: colors.ink }}>
            {liveWords.map((word) =>
              /[a-zàâéèêëîïôùûüç]/i.test(word.text) ? (
                <RevealWord
                  key={word.id}
                  word={word}
                  positionMs={positionMs}
                  playing={playing}
                  current={word.id === segment.words[wordIndex]?.id}
                  onPress={() => setSelection({ word, segment })}
                />
              ) : (
                <Text key={word.id}>{word.text} </Text>
              ),
            )}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Tap any word for its meaning
          </Text>
        </View>
      )}
      <Button
        secondary
        label="Focus reader"
        onPress={() => setFocusMode(true)}
      />
      <PlaybackControls />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open synchronized transcript ↗"
          onPress={() => router.push("/transcript")}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.green,
            borderRadius: 15,
            paddingVertical: 15,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#007B60" }}>Transcript</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Collapse transcript" : "Expand transcript"
          }
          onPress={() => setExpanded(!expanded)}
          style={{
            flex: 1,
            backgroundColor: "#F3F3F6",
            borderRadius: 15,
            paddingVertical: 15,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.ink }}>
            {expanded ? "Hide words" : "Live words"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            saved ? "Unsave episode transcript" : "Save episode transcript"
          }
          onPress={() => toggle(episode.id)}
          style={{
            flex: 1,
            backgroundColor: saved ? colors.tint : "#F3F3F6",
            borderRadius: 15,
            paddingVertical: 15,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.ink }}>{saved ? "Saved" : "Save"}</Text>
        </Pressable>
      </View>
      <Button
        secondary
        label="Talk about this episode"
        onPress={() => router.push("/conversation")}
      />
      <View style={s.card}>
        <Label>À VOUS · ONE MINUTE ALOUD</Label>
        <Body>{speakingPrompt}</Body>
        <Text style={s.note}>
          Try: « J’aimerais comprendre… », « ce qui m’intéresse, c’est… »
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
              onPress={() => setSelection({ word, segment })}
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
      <FocusReader
        visible={focusMode}
        returnLabel="Back to player"
        onClose={() => setFocusMode(false)}
        onWord={(word, segment) => {
          setFocusMode(false);
          setSelection({ word, segment });
        }}
      />
      <WordSheet selection={selection} onClose={() => setSelection(null)} />
      <Label>SOURCES · DATED STORIES, NOT A LIVE NEWS BULLETIN</Label>
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
    </Page>
  );
}
