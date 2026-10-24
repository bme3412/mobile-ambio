import { vocabulary } from "../data/vocabulary";
import { normalizeWord } from "../data/dictionary";
import { pronounce, hasPronunciation } from "../playback/pronunciation";
import { LanguageFlag } from "./LanguageFlag";
import { useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  List,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TranscriptSegment, WordToken } from "../domain/types";
import { Body, colors, s } from "./ui";
import { IconButton } from "./IconButton";
import { useLibrary } from "../state/library";
import { episode } from "../data/episode";
import { player } from "../playback/player";

export function WordSheet({
  selection,
  onClose,
}: {
  selection: { word: WordToken; segment: TranscriptSegment } | null;
  onClose: () => void;
}) {
  if (!selection) return null;
  return (
    <WordDetails
      key={selection.word.id}
      selection={selection}
      onClose={onClose}
    />
  );
}

function WordDetails({
  selection,
  onClose,
}: {
  selection: { word: WordToken; segment: TranscriptSegment };
  onClose: () => void;
}) {
  const bookmarks = useLibrary((x) => x.bookmarks);
  const toggle = useLibrary((x) => x.toggle);
  const [exampleOpen, setExampleOpen] = useState(false);
  const { word, segment } = selection;
  const entry = vocabulary[normalizeWord(word.text)];
  const saved = bookmarks.some((b) => b.id === word.id);
  const SaveIcon = saved ? BookmarkCheck : Bookmark;
  const ExpandIcon = exampleOpen ? ChevronUp : ChevronDown;
  const sentence = segment.words.map((w) => w.text).join(" ");
  const actionStyle = {
    ...s.card,
    padding: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 14,
    minHeight: 64,
  };
  const badgeStyle = {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lavender,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#0B193766",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss word details"
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <SafeAreaView
          edges={["bottom"]}
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            padding: 24,
            maxHeight: "85%",
          }}
        >
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 4,
                backgroundColor: "#D3D5DD",
                alignSelf: "center",
              }}
            />
            <View
              style={{
                alignItems: "flex-end",
                marginTop: -4,
                marginRight: -10,
              }}
            >
              <IconButton label="Close" icon="close" onPress={onClose} />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <View style={{ flex: 1, gap: 7 }}>
                <Text
                  accessibilityRole="header"
                  style={{ fontSize: 28, fontWeight: "700", color: colors.ink }}
                >
                  {word.text}
                </Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
                >
                  <LanguageFlag language="fr" width={34} />
                  <Text
                    style={{ fontSize: 14, color: colors.muted, flexShrink: 1 }}
                  >
                    {entry
                      ? `${entry.pronunciation} · ${entry.kind}`
                      : "French · in this episode"}
                  </Text>
                </View>
              </View>
              <View style={{ backgroundColor: "#F0F1F5", borderRadius: 24 }}>
                <IconButton
                  label={
                    hasPronunciation(word.text)
                      ? "Hear French pronunciation"
                      : "Hear word in sentence"
                  }
                  icon="volume"
                  onPress={() => {
                    if (hasPronunciation(word.text)) pronounce(word.text);
                    else player.replay(segment.startMs, segment.endMs);
                    onClose();
                  }}
                />
              </View>
            </View>
            <View
              style={{
                padding: 20,
                borderRadius: 18,
                backgroundColor: "#E6F7EF",
                gap: 8,
              }}
            >
              <Text
                style={{ fontSize: 17, fontWeight: "600", color: "#00694F" }}
              >
                {word.text}
              </Text>
              <Body>
                {word.meaning ??
                  "Explore the sentence translation for this expression."}
              </Body>
            </View>
            <View style={{ ...actionStyle, alignItems: "flex-start" }}>
              <View style={{ backgroundColor: "#F0F1F5", borderRadius: 22 }}>
                <IconButton
                  label="Replay sentence"
                  icon="play"
                  onPress={() => {
                    player.replay(segment.startMs, segment.endMs);
                    onClose();
                  }}
                />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  lineHeight: 23,
                  color: colors.muted,
                }}
              >
                {sentence}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                saved ? "Unsave expression" : "Save expression"
              }
              accessibilityState={{ selected: saved }}
              style={({ pressed }) => [
                actionStyle,
                { opacity: pressed ? 0.65 : 1 },
              ]}
              onPress={() =>
                toggle({
                  id: word.id,
                  episodeId: episode.id,
                  segmentId: segment.id,
                  word,
                  context: sentence,
                  reviewed: false,
                })
              }
            >
              <View style={badgeStyle}>
                <SaveIcon color={colors.purple} size={21} strokeWidth={1.8} />
              </View>
              <Text style={{ flex: 1, color: colors.ink, fontSize: 15 }}>
                {saved ? "Saved to your words" : "Save to review later"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See example & translation"
              accessibilityState={{ expanded: exampleOpen }}
              style={({ pressed }) => [
                actionStyle,
                { opacity: pressed ? 0.65 : 1 },
              ]}
              onPress={() => setExampleOpen(!exampleOpen)}
            >
              <View style={badgeStyle}>
                <List color={colors.purple} size={21} strokeWidth={1.8} />
              </View>
              <Text style={{ flex: 1, color: colors.ink, fontSize: 15 }}>
                {exampleOpen
                  ? "Hide example & translation"
                  : "See example & translation"}
              </Text>
              <ExpandIcon color={colors.muted} size={18} />
            </Pressable>
            {exampleOpen && (
              <View
                style={{
                  padding: 18,
                  borderRadius: 16,
                  backgroundColor: colors.lavender,
                  gap: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <LanguageFlag language="en" width={34} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: colors.purple,
                    }}
                  >
                    ENGLISH · IN CONTEXT
                  </Text>
                </View>
                {entry && <Text style={s.body}>{entry.example}</Text>}
                <Body>{entry?.translation ?? segment.translation}</Body>
              </View>
            )}
            <Text style={[s.note, { textAlign: "center", marginTop: 4 }]}>
              ElevenLabs French voices · timestamped transcript
            </Text>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
