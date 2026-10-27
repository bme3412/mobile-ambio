import { EditionStatus, EditionDownload } from "../../components/EditionStatus";
import { useMemo, useState } from "react";
import {
  RefreshControl,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  findEdition,
  latestEdition,
  useCatalog,
  refreshCatalog,
} from "../../data/catalog";
import {
  editorialArtwork,
  defaultEditorialArtwork,
} from "../../data/editorialArtwork";
import { EditorialImage } from "../../components/EditorialImage";
import { Body, Button, colors, s } from "../../components/ui";
import { WordSheet } from "../../components/WordSheet";
import { useLibrary } from "../../state/library";
import { player, time, usePlayback } from "../../playback/player";
import { stopPronunciation } from "../../playback/pronunciation";
import { normalizeWord } from "../../data/dictionary";
import type { WordToken, TranscriptSegment } from "../../domain/types";

export default function Home() {
  const { loading } = useCatalog();
  const { episode, date, vocabulary } = latestEdition;
  const previewWords = useMemo(() => {
    const seen = new Set<string>();
    return episode.segments
      .flatMap((segment) => segment.words.map((word) => ({ word, segment })))
      .filter(({ word }) => {
        const key = normalizeWord(word.text);
        if (!vocabulary[key] || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  }, [episode, vocabulary]);
  const { activeEpisodeId, selectEpisode } = useLibrary();
  const playback = usePlayback();
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 600 && fontScale < 1.3;
  const [selection, setSelection] = useState<{
    word: WordToken;
    segment: TranscriptSegment;
  } | null>(null);
  const active = findEdition(activeEpisodeId)?.episode;
  const listen = (startMs?: number) => {
    stopPronunciation();
    selectEpisode(episode.id);
    if (startMs !== undefined) player.seek(startMs);
    player.play();
    router.push("/player");
  };
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[s.page, { backgroundColor: "#F5F0E6" }]}
    >
      <ScrollView
        contentContainerStyle={m.page}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              void refreshCatalog();
            }}
          />
        }
      >
        <EditionStatus />
        <View style={m.masthead}>
          <Text accessibilityRole="header" style={m.brand}>
            Ambio
          </Text>
          <Text style={m.kicker}>LE MONDE EN FRANÇAIS</Text>
        </View>
        <Text style={m.kicker}>ÉDITION DU {date.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={m.headline}>
          {episode.title}
        </Text>
        <Body>{episode.subtitle}</Body>
        <Text style={m.meta}>
          French · B1–B2 · 3 stories · {time(episode.durationMs)}
        </Text>
        <Button
          tone="#175745"
          label={`▶ Listen to the edition · ${time(episode.durationMs)}`}
          accessibilityLabel={`Listen to latest edition · ${episode.title}`}
          onPress={() => listen()}
        />
        {active &&
          activeEpisodeId !== episode.id &&
          playback.positionMs > 0 && (
            <View style={m.resume}>
              <Text style={m.kicker}>CONTINUE LISTENING</Text>
              <Text style={m.smallTitle}>{active.title}</Text>
              <Text style={m.meta}>
                {time(playback.positionMs)} of {time(active.durationMs)} · Your
                place is saved
              </Text>
              <Button
                tone="#175745"
                secondary
                label="Continue listening"
                onPress={() => {
                  stopPronunciation();
                  player.play();
                  router.push("/player");
                }}
              />
            </View>
          )}
        <EditionDownload id={episode.id} />
        <View style={m.rule}>
          <Text style={m.kicker}>DANS CETTE ÉDITION</Text>
          <Text style={m.meta}>01 — 03</Text>
        </View>
        <View
          style={{
            flexDirection: columns ? "row" : "column",
            flexWrap: "wrap",
            gap: 28,
          }}
        >
          {episode.stories.map((story, index) => (
            <View
              key={story.id}
              style={{ width: columns && index > 0 ? "47%" : "100%", gap: 12 }}
            >
              <EditorialImage
                artwork={
                  editorialArtwork[episode.id]?.stories[story.id] ??
                  defaultEditorialArtwork
                }
              />
              <Text style={m.kicker}>
                {String(index + 1).padStart(2, "0")} / {story.category}
              </Text>
              <Text
                accessibilityRole="header"
                style={[m.storyTitle, index === 0 && { fontSize: 34 }]}
              >
                {story.title}
              </Text>
              <Body>{story.description}</Body>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Listen to this story · ${story.title}`}
                onPress={() =>
                  listen(
                    episode.segments.find(
                      (segment) => segment.id === story.segmentId,
                    )!.startMs,
                  )
                }
                style={m.storyAction}
              >
                <Text style={m.link}>Listen to this story ↗</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Practice this story · ${story.title}`}
                onPress={() =>
                  router.push({
                    pathname: "/practice",
                    params: { episodeId: episode.id, storyId: story.id },
                  })
                }
                style={m.storyAction}
              >
                <Text style={m.link}>Practice this story ↗</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <View style={m.vocabulary}>
          <Text style={m.kicker}>UN PEU PLUS DE FRANÇAIS</Text>
          <Text accessibilityRole="header" style={m.storyTitle}>
            Words to take with you.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {previewWords.map((item) => (
              <Pressable
                key={item.word.id}
                accessibilityRole="button"
                accessibilityLabel={`Learn ${item.word.text}`}
                onPress={() => setSelection(item)}
                style={m.chip}
              >
                <Text style={{ color: colors.ink, fontSize: 16 }}>
                  {item.word.text}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            tone="#175745"
            secondary
            label="Read transcript & vocabulary →"
            onPress={() => {
              stopPronunciation();
              selectEpisode(episode.id);
              router.push("/transcript");
            }}
          />
        </View>
        <Button
          tone="#175745"
          secondary
          label="Browse episode library →"
          onPress={() => router.push("/library")}
        />
      </ScrollView>
      <WordSheet selection={selection} onClose={() => setSelection(null)} />
    </SafeAreaView>
  );
}
const m = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    padding: 22,
    paddingBottom: 36,
    gap: 20,
  },
  masthead: {
    paddingBottom: 18,
    borderBottomWidth: 2,
    borderColor: "#173E35",
    gap: 4,
  },
  brand: {
    fontFamily: "Georgia",
    fontSize: 49,
    color: "#173E35",
    letterSpacing: -2,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.7,
    fontWeight: "600",
    color: "#36574C",
  },
  headline: {
    fontFamily: "Georgia",
    fontSize: 43,
    lineHeight: 48,
    color: colors.ink,
    letterSpacing: -1,
  },
  meta: { fontSize: 13, color: "#59615E", lineHeight: 20 },
  resume: {
    borderLeftWidth: 3,
    borderColor: "#8C80AD",
    backgroundColor: "#EAE5F0",
    padding: 16,
    gap: 10,
  },
  smallTitle: { fontFamily: "Georgia", fontSize: 22, color: colors.ink },
  rule: {
    borderTopWidth: 1,
    borderColor: "#C9C7BB",
    paddingTop: 20,
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  storyTitle: { fontFamily: "Georgia", fontSize: 28, color: colors.ink },
  storyAction: {
    minHeight: 48,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderColor: "#C9C7BB",
    paddingVertical: 12,
  },
  link: { color: "#175745", fontSize: 16, fontWeight: "600" },
  vocabulary: {
    backgroundColor: "#EAE5F0",
    padding: 18,
    gap: 18,
    marginTop: 12,
  },
  chip: {
    backgroundColor: "#F8F5FB",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 24,
  },
});
