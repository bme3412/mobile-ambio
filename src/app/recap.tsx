import { useState } from "react";
import { Text, View, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Body, Button, Label, Page, s, Title } from "../components/ui";
import { useLibrary } from "../state/library";
import {
  currentReview,
  isReviewPending,
  practiceFromSession,
  requestReview,
} from "../conversation/review";
export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useLibrary((x) => x.sessions.find((s) => s.id === id));
  const phrases = useLibrary((x) => x.conversationPhrases);
  const toggle = useLibrary((x) => x.togglePhrase);
  const storageError = useLibrary((x) => x.storageError);
  const [expanded, setExpanded] = useState(false);
  const [typing, setTyping] = useState(false);
  const review = session ? currentReview(session) : undefined;
  const pending = session?.reviewStatus === "pending" && isReviewPending(id);
  const practice = session ? practiceFromSession(session) : undefined;
  return (
    <Page>
      <Label>YOUR CONVERSATION · RECAP</Label>
      <Title>{session?.topicTitle || "Your French, a little further."}</Title>
      {!session ? (
        <>
          <Body>No saved session found.</Body>
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
              : "Conversation saved on this device."}
          </Body>
          {review ? (
            <>
              <Body>{review.summary}</Body>
              {practice && (
                <>
                  <Button
                    label="Practice these in a conversation"
                    onPress={() =>
                      router.push({
                        pathname: "/conversation",
                        params: {
                          practiceSessionId: id,
                          practiceRequest: String(Date.now()),
                          typing: typing ? "1" : "0",
                        },
                      })
                    }
                  />
                  <View style={s.row}>
                    <Body>Type instead of speaking</Body>
                    <Switch
                      accessibilityLabel="Type instead of speaking"
                      value={typing}
                      onValueChange={setTyping}
                    />
                  </View>
                </>
              )}
              {review.refinements.length > 0 && (
                <Text style={s.subheading}>A few useful refinements</Text>
              )}
              {review.refinements.map((r) => (
                <View style={s.card} key={r.id}>
                  <Label>
                    {r.kind === "correction"
                      ? "A CLEAR CORRECTION"
                      : "AN OPTIONAL ALTERNATIVE"}
                  </Label>
                  <Label>YOU SAID</Label>
                  <Body>{r.original}</Body>
                  <Label>TRY THIS</Label>
                  <Text style={s.subheading}>{r.suggestion}</Text>
                  <Body>{r.explanation}</Body>
                </View>
              ))}
              {review.expressions.length > 0 && (
                <Text style={s.subheading}>Keep these expressions</Text>
              )}
              {review.expressions.map((e) => {
                const phraseId = `conversation:${id}:${e.id}`;
                const saved = phrases.some((p) => p.id === phraseId);
                return (
                  <View style={s.card} key={e.id}>
                    <Text style={s.subheading}>{e.phrase}</Text>
                    <Body>{e.meaning}</Body>
                    <Body>{e.example}</Body>
                    <Button
                      secondary
                      label={saved ? "Unsave phrase" : "Save phrase"}
                      onPress={() =>
                        toggle({
                          source: "conversation",
                          id: phraseId,
                          sessionId: id,
                          topicTitle: session.topicTitle || "Conversation",
                          word: { text: e.phrase, meaning: e.meaning },
                          context: e.example,
                          reviewed: false,
                        })
                      }
                    />
                  </View>
                );
              })}
              {!practice && (
                <Button
                  label="Try another conversation"
                  onPress={() => router.push("/conversation")}
                />
              )}
              <Text style={s.note}>
                Suggestions are based on the transcript, not a pronunciation
                assessment.
              </Text>
            </>
          ) : (
            <View style={s.card}>
              <Text style={s.subheading}>
                {pending
                  ? "Finding a few useful takeaways…"
                  : "Make this conversation useful"}
              </Text>
              <Body>
                {pending
                  ? "Your transcript is already saved. You can leave this screen while the review finishes."
                  : session.reviewError ||
                    (session.reviewStatus === "pending"
                      ? "The last review was interrupted. Your transcript is safe."
                      : "Find useful refinements and expressions from your own conversation.")}
              </Body>
              {!pending && (
                <Button
                  label={
                    session.reviewStatus ? "Retry review" : "Generate review"
                  }
                  onPress={() => void requestReview(id)}
                />
              )}
              <Text style={s.note}>
                Review uses your conversation text with OpenAI. The saved review
                stays on this device.
              </Text>
            </View>
          )}
          <Button
            secondary
            label={
              expanded ? "Hide original transcript" : "Show original transcript"
            }
            onPress={() => setExpanded(!expanded)}
          />
          {expanded &&
            session.turns.map((t) => (
              <View key={t.id} style={s.card}>
                <Label>{t.role === "user" ? "YOU" : "AMBIO · AI TUTOR"}</Label>
                <Body>{t.text}</Body>
                {t.interrupted && (
                  <Text style={s.note}>
                    Interrupted · some text may not have been spoken.
                  </Text>
                )}
              </View>
            ))}
          {session.parentSessionId && (
            <Button
              secondary
              label="View original conversation"
              onPress={() =>
                router.push({
                  pathname: "/recap",
                  params: { id: session.parentSessionId! },
                })
              }
            />
          )}
          <Button
            secondary
            label="Saved conversations"
            onPress={() => router.replace("/saved")}
          />
        </>
      )}
    </Page>
  );
}
