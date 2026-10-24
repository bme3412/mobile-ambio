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
import { player, time } from "../../playback/player";
const storyIcons = [Clock3, Orbit, Cookie];
export default function Home() {
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
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
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
              paddingBottom: 42,
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
            label={`▶ Play episode · ${time(episode.durationMs)}`}
            onPress={() => {
              player.play();
              router.push("/player");
            }}
          />
        </View>
        <View style={{ flexDirection: "row", padding: 20, gap: 10 }}>
          {episode.stories.map((story, i) => {
            const StoryIcon = storyIcons[i];
            return (
              <Pressable
                key={story.id}
                accessibilityRole="button"
                accessibilityLabel={`Listen to ${story.title}`}
                onPress={() => {
                  player.seek(
                    episode.segments.find((s) => s.id === story.segmentId)!
                      .startMs,
                  );
                  player.play();
                  router.push("/player");
                }}
                style={{ flex: 1, gap: 5 }}
              >
                <View
                  style={{
                    height: 86,
                    borderRadius: 12,
                    backgroundColor: colors.tint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <StoryIcon size={32} color={colors.green} strokeWidth={1.5} />
                </View>
                <Text
                  style={{ fontSize: 12, fontWeight: "600", color: colors.ink }}
                >
                  {i + 1} · {story.title}
                </Text>
                <Text style={s.note}>{story.category.toLowerCase()}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Text style={s.subheading}>{episode.title}</Text>
          <Text style={s.note}>
            French B1–B2 · Real stories · Synthetic French narration
          </Text>
          <Button
            secondary
            label="Continue listening ↗"
            onPress={() => router.push("/player")}
          />
          <Button
            secondary
            label="Start talking ↗"
            onPress={() => router.push("/conversation")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
