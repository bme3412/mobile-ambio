import { getEdition } from "../data/catalog";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Body, Button, Label, Page, s, Title } from "../components/ui";
import { useLibrary } from "../state/library";
export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessions = useLibrary((x) => x.sessions);
  const session = sessions.find((x) => x.id === id);
  const { featuredPhrase } = getEdition(session?.episodeId ?? "");
  const bookmarks = useLibrary((s) => s.bookmarks);
  const toggle = useLibrary((s) => s.toggle);
  const storageError = useLibrary((s) => s.storageError);
  return (
    <Page>
      <Label>YOUR CONVERSATION · RECAP</Label>
      <Title>A little more natural.</Title>
      {!session ? (
        <>
          <Body>
            No saved session found. Start a conversation to create a recap.
          </Body>
          <Button
            label="Start a conversation"
            onPress={() => router.replace("/conversation")}
          />
        </>
      ) : (
        <>
          <Body>
            {storageError
              ? "Saved for this visit only; local storage is unavailable."
              : "Saved on this device."}{" "}
            {session.isMock
              ? "These are scripted learning notes, not an assessment of your French."
              : "AI suggestions from your conversation. Transcripts and corrections can contain mistakes."}
          </Body>
          <Text style={s.subheading}>A useful refinement</Text>
          {session.observations.length === 0 ? (
            <Body>
              No correction was saved for this conversation. Your words are
              preserved below.
            </Body>
          ) : (
            session.observations.map((o) => (
              <View style={s.card} key={o.id}>
                <Label>MORE NATURAL PHRASING</Label>
                <Body>{o.original}</Body>
                <Text style={s.subheading}>→ {o.suggestion}</Text>
                <Body>{o.explanation}</Body>
              </View>
            ))
          )}
          <Text style={s.subheading}>Keep this expression</Text>
          <View style={s.card}>
            <Text style={s.subheading}>{featuredPhrase.word.text}</Text>
            <Body>{featuredPhrase.word.meaning}</Body>
            <Body>{featuredPhrase.example}</Body>
            <Button
              secondary
              label={
                bookmarks.some((b) => b.id === featuredPhrase.id)
                  ? "Unsave this expression"
                  : "Save this expression"
              }
              onPress={() =>
                toggle({
                  id: featuredPhrase.id,
                  episodeId: featuredPhrase.episodeId,
                  segmentId: featuredPhrase.segmentId,
                  context: featuredPhrase.context,
                  word: featuredPhrase.word,
                  reviewed: false,
                })
              }
            />
          </View>
          <Text style={s.subheading}>The full conversation</Text>
          {session.turns.map((t) => (
            <View key={t.id} style={s.card}>
              <Label>{t.role === "user" ? "YOU" : "AMBIO · AI TUTOR"}</Label>
              <Body>{t.text}</Body>
            </View>
          ))}
          <Body>Email delivery will be available in a later phase.</Body>
          <Button
            label="Back to listening"
            onPress={() => router.replace("/")}
          />
        </>
      )}
    </Page>
  );
}
