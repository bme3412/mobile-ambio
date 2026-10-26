import { LanguageFlag } from "../../components/LanguageFlag";
import { cafeArtwork } from "../../data/artwork";
import { LinearGradient } from "expo-linear-gradient";
import { Leaf, ChevronDown, Clock3, Orbit, Cookie } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { episode as fixture } from "../../data/episode";
import { Body, Button, colors, s } from "../../components/ui";
import { player, time, usePlayback } from "../../playback/player";
import { WordSheet } from "../../components/WordSheet";
import { vocabulary } from "../../data/vocabulary";
import { normalizeWord } from "../../data/dictionary";
import { WordToken, TranscriptSegment } from "../../domain/types";
const storyIcons = [Clock3, Orbit, Cookie];
export default function Home() {
  const playback = usePlayback();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selection, setSelection] = useState<{
    word: WordToken;
    segment: TranscriptSegment;
  } | null>(null);
  const [languageOpen, setLanguageOpen] = useState(false);
  const {
    data: episode = fixture,
    isPending,
    isError,
    refetch,
  } = useQuery({ queryKey: ["episode", "demo"], queryFn: async () => fixture });
  if (isPending)
    return (
      <SafeAreaView
        style={[
          s.page,
          { justifyContent: "center", alignItems: "center", gap: 16 },
        ]}
      >
        <ActivityIndicator accessibilityLabel="Loading episode" />
        <Body>Preparing your daily edition…</Body>
      </SafeAreaView>
    );
  if (isError)
    return (
      <SafeAreaView
        style={[s.page, { padding: 24, justifyContent: "center", gap: 16 }]}
      >
        <Body>Your edition could not be loaded.</Body>
        <Button
          label="Retry loading episode"
          onPress={() => {
            void refetch();
          }}
        />
      </SafeAreaView>
    );
  const starts = episode.stories.map(
    (story) =>
      episode.segments.find((segment) => segment.id === story.segmentId)!
        .startMs,
  );
  const selectedStory = episode.stories[selectedIndex];
  const storyEnd = starts[selectedIndex + 1] ?? episode.durationMs;
  const seen = new Set<string>();
  const previewWords = episode.segments
    .filter(
      (segment) =>
        segment.startMs >= starts[selectedIndex] && segment.startMs < storyEnd,
    )
    .flatMap((segment) => segment.words.map((word) => ({ word, segment })))
    .filter(({ word }) => {
      const key = normalizeWord(word.text);
      if (!vocabulary[key] || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
  const finished = playback.positionMs >= episode.durationMs;
  const playLabel = playback.playing
    ? "Open player"
    : finished
      ? "Replay episode"
      : playback.positionMs > 0
        ? "Resume episode"
        : "Play episode";
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.page}>
      <ScrollView
        contentContainerStyle={{
          maxWidth: 680,
          width: "100%",
          alignSelf: "center",
          paddingBottom: 24,
        }}
      >
        <ImageBackground
          source={cafeArtwork}
          imageStyle={{ width: "100%", height: "100%" }}
          style={{
            height: languageOpen ? 680 : 510,
            overflow: "hidden",
            justifyContent: "space-between",
            backgroundColor: "#4B594F",
          }}
        >
          <LinearGradient
            pointerEvents="none"
            colors={["#FFF8EBC9", "#FFF8EB00", "#201D1833", "#181B20B0"]}
            locations={[0, 0.25, 0.48, 1]}
            style={{ position: "absolute", inset: 0 }}
          />
          <View style={{ ...s.row, padding: 22 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#FFFFFFDD",
                padding: 8,
                borderRadius: 20,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 42,
                  backgroundColor: colors.ink,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Leaf color="#B4AAFF" size={25} strokeWidth={1.4} />
              </View>
              <Text
                style={{
                  fontFamily: "Georgia",
                  fontSize: 28,
                  color: colors.ink,
                }}
              >
                Ambio
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="French ⌄"
              onPress={() => setLanguageOpen(!languageOpen)}
              style={{
                backgroundColor: "white",
                padding: 12,
                borderRadius: 24,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <LanguageFlag language="fr" width={28} />
                <Text style={{ color: colors.ink }}>French</Text>
                <ChevronDown size={15} color={colors.ink} />
              </View>
            </Pressable>
          </View>
          {languageOpen && (
            <View style={{ ...s.card, margin: 20 }}>
              <Body>
                French · Intermediate. More languages arrive after this demo.
              </Body>
              <Button
                secondary
                label="Done"
                onPress={() => setLanguageOpen(false)}
              />
            </View>
          )}
          <View
            style={{
              padding: 24,
              paddingTop: 40,
              paddingBottom: 60,
              gap: 10,
            }}
          >
            <Text style={{ color: "white", fontSize: 13, letterSpacing: 2 }}>
              AMBIO DAILY · 24 OCTOBRE 2026
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "Georgia",
                fontSize: 43,
                lineHeight: 47,
                color: "white",
              }}
            >
              Le monde{"\n"}autrement,{"\n"}en français.
            </Text>
            <Text style={{ color: "white", fontSize: 17, lineHeight: 24 }}>
              Three stories. Real curiosity.{"\n"}A little more French, every
              day.
            </Text>
          </View>
        </ImageBackground>
        <View style={{ paddingHorizontal: 20, marginTop: -18 }}>
          <Button
            label={`▶ ${playLabel} · ${time(episode.durationMs)}`}
            onPress={() => {
              if (finished) player.seek(0);
              if (!playback.playing) player.play();
              router.push("/player");
            }}
          />
        </View>
        {playback.positionMs > 0 && (
          <View style={{ marginHorizontal: 20, marginTop: 14, gap: 6 }}>
            <Text style={s.note}>
              Listening position · {time(playback.positionMs)} of{" "}
              {time(episode.durationMs)}
            </Text>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.line,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 4,
                  backgroundColor: colors.green,
                  width: `${Math.min(100, (playback.positionMs / episode.durationMs) * 100)}%`,
                }}
              />
            </View>
          </View>
        )}
        <View style={{ flexDirection: "row", padding: 20, gap: 10 }}>
          {episode.stories.map((story, i) => {
            const StoryIcon = storyIcons[i];
            const selected = i === selectedIndex;
            const end = starts[i + 1] ?? episode.durationMs;
            const playing =
              playback.playing &&
              playback.positionMs >= starts[i] &&
              playback.positionMs < end;
            return (
              <Pressable
                key={story.id}
                accessibilityRole="button"
                accessibilityLabel={`Select ${story.title}`}
                accessibilityState={{ selected }}
                onPress={() => setSelectedIndex(i)}
                style={{
                  flex: 1,
                  gap: 7,
                  padding: 10,
                  borderRadius: 14,
                  backgroundColor: selected ? colors.tint : "#F2F7F4",
                  borderWidth: 2,
                  borderColor: selected ? colors.green : "transparent",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 4,
                  }}
                >
                  <StoryIcon size={25} color={colors.green} strokeWidth={1.5} />
                  <Text style={s.note}>{time(end - starts[i])}</Text>
                </View>
                <Text
                  style={{ fontSize: 13, fontWeight: "600", color: colors.ink }}
                >
                  {i + 1} · {story.title}
                </Text>
                <Text style={s.note}>{story.category.toLowerCase()}</Text>
                <Text style={{ ...s.note, color: colors.ink }}>
                  {playing ? "Playing" : selected ? "Selected" : "View story"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ ...s.card, marginHorizontal: 20 }}>
          <Text style={s.note}>
            STORY {selectedIndex + 1} · {time(storyEnd - starts[selectedIndex])}
          </Text>
          <Text accessibilityRole="header" style={s.subheading}>
            {selectedStory.title}
          </Text>
          <Body>{selectedStory.description}</Body>
          <Text style={s.note}>
            French B1–B2 · Real stories · Synthetic French narration
          </Text>
          <Text style={{ color: colors.ink, fontWeight: "600" }}>
            Words to discover
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {previewWords.map((item) => (
              <Pressable
                key={item.word.id}
                accessibilityRole="button"
                accessibilityLabel={`Learn ${item.word.text}`}
                onPress={() => setSelection(item)}
                style={{
                  backgroundColor: colors.lavender,
                  borderRadius: 24,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: colors.ink }}>{item.word.text}</Text>
              </Pressable>
            ))}
          </View>
          <Button
            secondary
            label={`▶ Play story ${selectedIndex + 1}`}
            onPress={() => {
              player.seek(starts[selectedIndex]);
              player.play();
              router.push("/player");
            }}
          />
          <Button
            secondary
            label="Read transcript & vocabulary →"
            onPress={() => router.push("/transcript")}
          />
        </View>
      </ScrollView>
      <WordSheet selection={selection} onClose={() => setSelection(null)} />
    </SafeAreaView>
  );
}
