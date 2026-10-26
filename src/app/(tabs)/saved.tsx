import { hasPronunciation, pronounce } from "../../playback/pronunciation";
import { findEdition, editions } from "../../data/catalog";
import { IconButton } from "../../components/IconButton";
import { useState } from "react";
import { PracticeSheet } from "../../components/PracticeSheet";
import { Bookmark } from "../../domain/types";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Body, Button, colors, Page, s } from "../../components/ui";
import { useLibrary } from "../../state/library";
import { player } from "../../playback/player";
export default function Saved() {
  const {
    bookmarks: allBookmarks,
    sessions,
    review,
    toggle,
    storageError,
    transcripts,
  } = useLibrary();
  const bookmarks = allBookmarks;
  const reviewedCount = bookmarks.filter((b) => b.reviewed).length;
  const remainingCount = bookmarks.length - reviewedCount;
  const [practice, setPractice] = useState<Bookmark[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const visible = bookmarks.filter(
    (b) =>
      filter === "All" || (filter === "To review" ? !b.reviewed : b.reviewed),
  );
  return (
    <Page mini>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 19,
          fontWeight: "600",
          color: colors.ink,
          textAlign: "center",
          paddingVertical: 10,
        }}
      >
        Saved Words
      </Text>
      {storageError && (
        <Body>
          Local storage is unavailable. Changes may not survive a restart.
        </Body>
      )}
      <View style={[s.card, { backgroundColor: colors.tint, gap: 14 }]}>
        <Text style={{ ...s.note, letterSpacing: 2 }}>
          YOUR FRENCH, COLLECTED
        </Text>
        <Text accessibilityRole="header" style={s.subheading}>
          A few words. A little closer.
        </Text>
        <Body>
          {bookmarks.length === 0
            ? "Keep the expressions that catch your ear. Come back and make them your own."
            : remainingCount > 0
              ? `${remainingCount} ${remainingCount === 1 ? "expression is" : "expressions are"} waiting for another look. Recall the meaning, then check yourself.`
              : "You’ve reviewed every saved expression. Revisit them whenever you want a refresher."}
        </Body>
        {bookmarks.length > 0 && (
          <>
            <Text style={{ color: colors.green, fontWeight: "600" }}>
              {reviewedCount} of {bookmarks.length} reviewed
            </Text>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Saved expressions reviewed"
              accessibilityValue={{
                min: 0,
                max: bookmarks.length,
                now: reviewedCount,
              }}
              style={{
                height: 6,
                backgroundColor: colors.line,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 6,
                  backgroundColor: colors.green,
                  width: `${(reviewedCount / bookmarks.length) * 100}%`,
                }}
              />
            </View>
          </>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["All", "To review", "Reviewed"].map((f) => (
          <Pressable
            key={f}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)}
            style={{
              backgroundColor: filter === f ? colors.tint : "#F3F3F6",
              paddingVertical: 12,
              paddingHorizontal: 16,
              flex: 1,
              alignItems: "center",
              borderRadius: 24,
            }}
          >
            <Text style={{ color: colors.ink }}>{f}</Text>
          </Pressable>
        ))}
      </View>
      {visible.length > 0 && (
        <View style={{ gap: 8 }}>
          <Button
            label={
              filter === "All"
                ? "Practice saved expressions"
                : filter === "To review"
                  ? "Practice words to review"
                  : "Practice reviewed words"
            }
            onPress={() => setPractice([...visible])}
          />
          <Text style={{ ...s.note, textAlign: "center" }}>
            {visible.length}{" "}
            {visible.length === 1 ? "expression" : "expressions"} · Recall,
            reveal, repeat
          </Text>
        </View>
      )}
      {bookmarks.length === 0 ? (
        <View style={s.card}>
          <Text style={s.subheading}>Something will stay with you.</Text>
          <Body>
            Tap any word in the transcript, then save it here with its original
            context.
          </Body>
          <Button
            label="Explore the transcript"
            onPress={() => router.push("/transcript")}
          />
        </View>
      ) : (
        visible.map((b, index) => (
          <View
            key={b.id}
            style={{
              paddingVertical: 12,
              marginTop: index === 0 ? 0 : -18,
              borderBottomWidth: 1,
              borderColor: colors.line,
              gap: 10,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              {findEdition(b.episodeId) && (
                <View
                  style={{ backgroundColor: colors.lavender, borderRadius: 24 }}
                >
                  <IconButton
                    label={`Replay ${b.word.text}`}
                    icon="volume"
                    tint={colors.purple}
                    onPress={() => {
                      useLibrary.getState().selectEpisode(b.episodeId);
                      const segment = findEdition(
                        b.episodeId,
                      )?.episode.segments.find((s) => s.id === b.segmentId);
                      if (hasPronunciation(b.word.text)) pronounce(b.word.text);
                      else if (segment)
                        player.replay(segment.startMs, segment.endMs);
                      router.push("/transcript");
                    }}
                  />
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Details for ${b.word.text}`}
                onPress={() => setExpanded(expanded === b.id ? null : b.id)}
                style={{
                  flex: 1,
                  gap: 7,
                  minHeight: 44,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "500", color: colors.ink }}
                >
                  {b.word.text}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 13, color: colors.muted }}
                >
                  {b.context}
                </Text>
              </Pressable>
              <IconButton
                label={`Options for ${b.word.text}`}
                icon="more"
                onPress={() => setExpanded(expanded === b.id ? null : b.id)}
              />
            </View>
            {expanded === b.id && (
              <View
                style={{
                  marginLeft: 56,
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: colors.tint,
                  gap: 8,
                }}
              >
                <Body>{b.word.meaning}</Body>
                <Text style={s.note}>
                  {findEdition(b.episodeId)?.episode.title ?? "Earlier edition"}{" "}
                  · {b.reviewed ? "Reviewed" : "To review"}
                </Text>
                <Button
                  secondary
                  label={b.reviewed ? "Mark for review" : "Mark reviewed"}
                  onPress={() => review(b.id)}
                />
                <Button
                  secondary
                  label="Remove expression"
                  onPress={() => toggle(b)}
                />
              </View>
            )}
          </View>
        ))
      )}
      {bookmarks.length > 0 && visible.length === 0 && (
        <Body>No words in this view yet.</Body>
      )}
      <View style={[s.divider, { marginTop: 12 }]} />
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.muted }}>
        Saved transcripts
      </Text>
      {editions
        .filter(({ episode }) => transcripts.includes(episode.id))
        .map(({ episode }) => (
          <Button
            key={episode.id}
            secondary
            label={`${episode.title} · transcript`}
            onPress={() => {
              useLibrary.getState().selectEpisode(episode.id);
              router.push("/transcript");
            }}
          />
        ))}
      {transcripts.length === 0 && (
        <Body>Save an episode transcript from the player to keep it here.</Body>
      )}
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.muted }}>
        Conversation history
      </Text>
      {sessions.length === 0 ? (
        <Body>Your saved conversation recaps will appear here.</Body>
      ) : (
        sessions.map((session) => (
          <Button
            key={session.id}
            secondary
            label={`${session.isMock ? "Demo session" : "Voice conversation"} · ${new Date(session.createdAt).toLocaleDateString()}`}
            onPress={() =>
              router.push({ pathname: "/recap", params: { id: session.id } })
            }
          />
        ))
      )}
      {practice && (
        <PracticeSheet items={practice} onClose={() => setPractice(null)} />
      )}
    </Page>
  );
}
