import { findEdition } from "../data/catalog";
import { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bookmark } from "../domain/types";
import { Body, Button, colors, Label, s, Title } from "./ui";
import { useLibrary } from "../state/library";
export function PracticeSheet({
  items,
  onClose,
}: {
  items: Bookmark[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0),
    [revealed, setRevealed] = useState(false);
  const review = useLibrary((x) => x.review);
  const item = items[index];
  const episode = item ? findEdition(item.episodeId)?.episode : undefined;
  const next = () => {
    setIndex((i) => i + 1);
    setRevealed(false);
  };
  return (
    <Modal animationType="none" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.row}>
            <Label>YOUR WORDS · QUICK PRACTICE</Label>
            <Button secondary label="Close practice" onPress={onClose} />
          </View>
          {item ? (
            <>
              <Body>
                {index + 1} of {items.length}
              </Body>
              <Title>{item.word.text}</Title>
              <Body>Can you recall the meaning before revealing it?</Body>
              <View style={s.card}>
                <Body>{item.context}</Body>
              </View>
              {revealed ? (
                <>
                  <Title>{item.word.meaning ?? "In this sentence"}</Title>
                  {!item.word.meaning && (
                    <Body>
                      {(item.episodeId === episode?.id
                        ? episode?.segments.find((s) => s.id === item.segmentId)
                            ?.translation
                        : undefined) ?? item.context}
                    </Body>
                  )}
                  <Button
                    label="Got it · next"
                    onPress={() => {
                      if (
                        !useLibrary
                          .getState()
                          .bookmarks.find((b) => b.id === item.id)?.reviewed
                      )
                        review(item.id);
                      next();
                    }}
                  />
                  <Button
                    secondary
                    label="Revisit later"
                    onPress={() => {
                      if (
                        useLibrary
                          .getState()
                          .bookmarks.find((b) => b.id === item.id)?.reviewed
                      )
                        review(item.id);
                      next();
                    }}
                  />
                </>
              ) : (
                <Button
                  label="Reveal meaning"
                  onPress={() => setRevealed(true)}
                />
              )}
            </>
          ) : (
            <>
              <Title>A little more familiar.</Title>
              <Body>
                You’ve revisited this collection. Your review statuses are saved
                on this device.
              </Body>
              <Button label="Back to saved expressions" onPress={onClose} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
