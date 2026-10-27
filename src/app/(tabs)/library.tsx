import { EditorialImage } from "../../components/EditorialImage";
import { editorialArtwork } from "../../data/editorialArtwork";
import { useState } from "react";
import { Text, TextInput, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { editions, LATEST_EPISODE_ID } from "../../data/catalog";
import { useLibrary } from "../../state/library";
import { player, time, usePlayback } from "../../playback/player";
import { stopPronunciation } from "../../playback/pronunciation";
import { Body, Button, colors, Page, s, Title } from "../../components/ui";

export default function Library() {
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 600 && fontScale < 1.3;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const { activeEpisodeId, progressByEpisode, selectEpisode } = useLibrary();
  const playback = usePlayback();
  const position = (id: string) =>
    id === activeEpisodeId
      ? playback.positionMs
      : (progressByEpisode[id]?.positionMs ?? 0);
  const visible = editions.filter(({ episode, date }) => {
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
  return (
    <Page mini>
      <Text
        style={{
          color: "#36574C",
          fontSize: 12,
          letterSpacing: 1,
          fontWeight: "600",
        }}
      >
        YOUR LISTENING LIBRARY
      </Text>
      <Title>The editions.</Title>
      <Body>
        News and culture, one edition at a time. Pick up where you left off.
      </Body>
      <TextInput
        accessibilityLabel="Search episodes"
        placeholder="Search episodes or stories"
        value={query}
        onChangeText={setQuery}
        placeholderTextColor={colors.muted}
        style={{ ...s.card, color: colors.ink, fontSize: 17, minHeight: 52 }}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {["All", "In progress", "Finished"].map((label) => (
          <Button
            tone="#175745"
            key={label}
            label={label}
            secondary={filter !== label}
            onPress={() => setFilter(label)}
          />
        ))}
      </View>
      <View
        style={{
          flexDirection: columns ? "row" : "column",
          flexWrap: "wrap",
          gap: 24,
        }}
      >
        {visible.map(({ episode, date }) => {
          const ms = position(episode.id);
          const finished = ms >= episode.durationMs;
          const action = finished
            ? "Listen again"
            : ms > 0
              ? "Continue listening"
              : "Start listening";
          return (
            <View
              key={episode.id}
              style={[
                s.card,
                {
                  gap: 16,
                  backgroundColor: "#F5F0E6",
                  borderRadius: 0,
                  padding: 16,
                  width:
                    columns && episode.id !== LATEST_EPISODE_ID
                      ? "47%"
                      : "100%",
                },
              ]}
            >
              <EditorialImage artwork={editorialArtwork[episode.id]?.cover} />
              {episode.id === LATEST_EPISODE_ID && (
                <Text
                  style={{
                    color: "#175745",
                    fontSize: 12,
                    fontWeight: "700",
                    letterSpacing: 1,
                  }}
                >
                  LATEST EDITION
                </Text>
              )}
              <Text
                style={{
                  color: "#36574C",
                  fontSize: 12,
                  letterSpacing: 1,
                  fontWeight: "600",
                }}
              >
                {date.toUpperCase()} · {time(episode.durationMs)}
              </Text>
              <Text accessibilityRole="header" style={s.subheading}>
                {episode.title}
              </Text>
              <Body>{episode.subtitle}</Body>
              <Text style={s.note}>
                French · B1–B2 · {episode.stories.length} stories
              </Text>
              {episode.stories.map((story) => (
                <Text
                  key={story.id}
                  style={{ color: colors.ink, fontSize: 15 }}
                >
                  • {story.title}
                </Text>
              ))}
              <Text style={s.note}>
                {finished
                  ? "Finished"
                  : ms > 0
                    ? `${time(ms)} listened · ${time(episode.durationMs - ms)} remaining`
                    : "Ready to discover"}
              </Text>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel={`${episode.title} listening progress`}
                accessibilityValue={{
                  min: 0,
                  max: episode.durationMs,
                  now: ms,
                }}
                style={{
                  height: 4,
                  backgroundColor: colors.line,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: 4,
                    backgroundColor: colors.green,
                    width: `${Math.min(100, (ms / episode.durationMs) * 100)}%`,
                  }}
                />
              </View>
              <Button
                tone="#175745"
                label={action}
                accessibilityLabel={`${action} · ${episode.title}`}
                onPress={() => {
                  stopPronunciation();
                  selectEpisode(episode.id);
                  if (finished) player.seek(0);
                  player.play();
                  router.push("/player");
                }}
              />
              <Button
                tone="#175745"
                secondary
                label="Read transcript"
                accessibilityLabel={`Read transcript · ${episode.title}`}
                onPress={() => {
                  stopPronunciation();
                  selectEpisode(episode.id);
                  router.push("/transcript");
                }}
              />
              <Button
                secondary
                label="Practice this edition"
                accessibilityLabel={`Practice this edition · ${episode.title}`}
                onPress={() =>
                  router.push({
                    pathname: "/practice",
                    params: { episodeId: episode.id },
                  })
                }
              />
              {episode.stories.map((story) => (
                <Button
                  key={story.id}
                  secondary
                  label={`Practice · ${story.title}`}
                  accessibilityLabel={`Practice this story · ${story.title}`}
                  onPress={() =>
                    router.push({
                      pathname: "/practice",
                      params: { episodeId: episode.id, storyId: story.id },
                    })
                  }
                />
              ))}
            </View>
          );
        })}
      </View>
      {visible.length === 0 && (
        <View style={s.card}>
          <Body>No episodes here yet. Try another search or choose All.</Body>
          <Button
            tone="#175745"
            secondary
            label="Show all episodes"
            onPress={() => {
              setQuery("");
              setFilter("All");
            }}
          />
        </View>
      )}
    </Page>
  );
}
