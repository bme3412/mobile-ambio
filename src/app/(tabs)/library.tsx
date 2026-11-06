import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Bookmark, Play, Search } from "lucide-react-native";
import { router } from "expo-router";
import { EditionStatus } from "../../components/EditionStatus";
import { EditorialImage } from "../../components/EditorialImage";
import { Masthead } from "../../components/Masthead";
import { artworkForEpisode } from "../../data/editorialArtwork";
import {
  visibleEditions,
  useCatalog,
  refreshCatalog,
  loadOlderEditions,
} from "../../data/catalog";
import { useLibrary } from "../../state/library";
import { player, time, usePlayback } from "../../playback/player";
import { stopPronunciation } from "../../playback/pronunciation";
import {
  Body,
  Button,
  colors,
  Page,
  s,
  Title,
  Label,
} from "../../components/ui";
import type { Episode } from "../../domain/types";

export default function Library() {
  const { loading, nextCursor } = useCatalog();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const {
    activeEpisodeId,
    progressByEpisode,
    selectEpisode,
    transcripts,
    toggleTranscript,
  } = useLibrary();
  const playback = usePlayback();
  const position = (id: string) =>
    id === activeEpisodeId
      ? playback.positionMs
      : (progressByEpisode[id]?.positionMs ?? 0);
  const visible = visibleEditions().filter(({ episode, date }) => {
    const match =
      `${episode.title} ${episode.subtitle} ${date} ${episode.stories.map((s) => s.title).join(" ")}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase());
    const ms = position(episode.id);
    return (
      match &&
      (filter === "All" ||
        (filter === "In progress"
          ? ms > 0 && ms < episode.durationMs
          : ms >= episode.durationMs))
    );
  });
  const featured =
    visible.find(
      ({ episode }) =>
        episode.id === activeEpisodeId &&
        position(episode.id) > 0 &&
        position(episode.id) < episode.durationMs,
    ) ?? visible[0];
  const others = visible.filter((item) => item !== featured);
  const action = (episode: Episode) =>
    position(episode.id) >= episode.durationMs
      ? "Listen again"
      : position(episode.id) > 0
        ? "Continue listening"
        : "Start listening";
  const open = (episode: Episode, play = false) => {
    stopPronunciation();
    selectEpisode(episode.id);
    if (play) {
      if (position(episode.id) >= episode.durationMs) player.seek(0);
      player.play();
      router.push("/player");
    } else router.push({ pathname: "/player", params: { details: "1" } });
  };
  return (
    <Page mini refreshing={loading} onRefresh={() => void refreshCatalog()}>
      <Masthead />
      <Title>EPISODES.</Title>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderBottomWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Search size={18} color={colors.muted} />
        <TextInput
          accessibilityLabel="Search episodes"
          placeholder="Find a story, place, or idea"
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={colors.muted}
          style={{ flex: 1, minHeight: 48, fontSize: 16, color: colors.ink }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 24,
          borderBottomWidth: 1,
          borderColor: colors.line,
        }}
      >
        {["All", "In progress", "Finished"].map((label) => (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: filter === label }}
            onPress={() => setFilter(label)}
            style={{
              minHeight: 48,
              justifyContent: "center",
              borderBottomWidth: 2,
              borderColor: filter === label ? colors.blue : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: filter === label ? colors.blue : colors.muted,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <EditionStatus />
      {featured && (
        <View style={{ gap: 16 }}>
          <View style={s.row}>
            <Label>
              {action(featured.episode) === "Continue listening"
                ? "PICK UP WHERE YOU LEFT OFF"
                : "YOUR NEXT LISTEN"}
            </Label>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                transcripts.includes(featured.episode.id)
                  ? "Unsave episode transcript"
                  : "Save episode transcript"
              }
              accessibilityState={{
                selected: transcripts.includes(featured.episode.id),
              }}
              onPress={() => toggleTranscript(featured.episode.id)}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bookmark
                size={20}
                color={colors.ink}
                fill={
                  transcripts.includes(featured.episode.id)
                    ? colors.ink
                    : "none"
                }
              />
            </Pressable>
          </View>
          <EditorialImage artwork={artworkForEpisode(featured.episode)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open edition · ${featured.episode.title}`}
            onPress={() => open(featured.episode)}
            style={{ minHeight: 44, gap: 10 }}
          >
            <Text
              accessibilityRole="header"
              style={[s.title, { fontSize: 30 }]}
            >
              {featured.episode.title}
            </Text>
            <Text style={s.note}>
              {featured.date.toUpperCase()} · {featured.episode.stories.length}{" "}
              stories · B1–B2
            </Text>
          </Pressable>
          <View style={s.row}>
            <Text style={s.note}>
              {position(featured.episode.id) >= featured.episode.durationMs
                ? "Finished"
                : "Your place is saved"}
            </Text>
            <Text style={s.note}>
              {time(position(featured.episode.id))} /{" "}
              {time(featured.episode.durationMs)}
            </Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`${featured.episode.title} listening progress`}
            accessibilityValue={{
              min: 0,
              max: featured.episode.durationMs,
              now: Math.min(
                position(featured.episode.id),
                featured.episode.durationMs,
              ),
            }}
            style={{ height: 3, backgroundColor: colors.line }}
          >
            <View
              style={{
                height: 3,
                backgroundColor: colors.blue,
                width: `${Math.min(100, (position(featured.episode.id) / featured.episode.durationMs) * 100)}%`,
              }}
            />
          </View>
          <Button
            label={`${action(featured.episode)} · ${time(Math.max(0, featured.episode.durationMs - position(featured.episode.id)))} left`}
            accessibilityLabel={`${action(featured.episode)} · ${featured.episode.title}`}
            onPress={() => open(featured.episode, true)}
          />
        </View>
      )}
      {others.length > 0 && (
        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.ink,
            paddingTop: 20,
            gap: 8,
          }}
        >
          <View style={s.row}>
            <Label>MORE TO DISCOVER</Label>
            <Text style={s.note}>{others.length} editions</Text>
          </View>
          {others.map(({ episode, date }) => (
            <View
              key={episode.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderColor: colors.line,
              }}
            >
              <View style={{ width: 64 }}>
                <EditorialImage artwork={artworkForEpisode(episode)} compact />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open edition · ${episode.title}`}
                onPress={() => open(episode)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}
                >
                  {episode.title}
                </Text>
                <Text style={s.note}>
                  {date} · {time(episode.durationMs)} ·{" "}
                  {position(episode.id) >= episode.durationMs
                    ? "Finished"
                    : position(episode.id) > 0
                      ? "In progress"
                      : `${episode.stories.length} stories`}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${action(episode)} · ${episode.title}`}
                onPress={() => open(episode, true)}
                style={{
                  width: 44,
                  minHeight: 48,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Play size={19} color={colors.ink} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {!visible.length && (
        <View style={s.card}>
          <Body>No episodes here yet. Try another search or choose All.</Body>
          <Button
            secondary
            label="Show all episodes"
            onPress={() => {
              setQuery("");
              setFilter("All");
            }}
          />
        </View>
      )}
      {nextCursor && (
        <Button
          secondary
          disabled={loading}
          label="Load older editions"
          onPress={() => void loadOlderEditions()}
        />
      )}
    </Page>
  );
}
