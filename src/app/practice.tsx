import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { createAudioPlayer } from "expo-audio";
import { SafeAreaView } from "react-native-safe-area-context";
import SpokenPractice from "../practice/SpokenPractice";
import { practiceMaterial } from "../practice/model";
import { findEdition } from "../data/catalog";
import { createMediaPlayer } from "../playback/mediaAdapter";
import { player } from "../playback/player";
import { stopPronunciation } from "../playback/pronunciation";
import { Body, s } from "../components/ui";

export default function Practice() {
  const params = useLocalSearchParams<{
    episodeId?: string;
    storyId?: string;
    segmentId?: string;
  }>();
  const episodeId =
    typeof params.episodeId === "string" ? params.episodeId : "";
  const storyId =
    typeof params.storyId === "string" ? params.storyId : undefined;
  const segmentId =
    typeof params.segmentId === "string" ? params.segmentId : undefined;
  const material = useMemo(
    () => practiceMaterial(episodeId, storyId, segmentId),
    [episodeId, storyId, segmentId],
  );
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referencePlaying, setReferencePlaying] = useState(false);
  const reference = useRef<ReturnType<typeof createMediaPlayer> | null>(null);
  const [active, setActive] = useState(true);
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      player.pause();
      stopPronunciation();
      setFocused(true);
      return () => {
        setFocused(false);
        reference.current?.pause();
      };
    }, []),
  );
  useEffect(() => {
    const edition = findEdition(episodeId);
    if (!edition) return;
    const audio = createMediaPlayer(edition.episode.durationMs, () =>
      createAudioPlayer(edition.audio, { updateInterval: 50 }),
    );
    reference.current = audio;
    const unsubscribe = audio.subscribe(() => {
      const state = audio.getSnapshot();
      setReferencePlaying(state.playing);
      setReferenceError(state.error);
    });
    const subscription = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state !== "active") audio.pause();
    });
    return () => {
      subscription.remove();
      unsubscribe();
      audio.dispose();
      reference.current = null;
    };
  }, [episodeId]);
  if (!material?.phrases.length)
    return (
      <View style={s.content}>
        <Body>
          This story is unavailable. Return to the library and select a story to
          practise.
        </Body>
      </View>
    );
  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      style={{ flex: 1, backgroundColor: "#F5F0E6" }}
    >
      <Stack.Screen options={{ title: "Spoken practice" }} />
      {focused && (
        <SpokenPractice
          key={`${episodeId}:${storyId ?? "all"}:${segmentId ?? "all"}`}
          material={material}
          active={active}
          referenceError={referenceError}
          referencePlaying={referencePlaying}
          stopReference={async () => {
            reference.current?.pause();
          }}
          playReference={async (start, end) => {
            const audio = reference.current;
            if (!audio || !active || !focused) return;
            audio.replay(start, end);
            if (audio.getSnapshot().error) throw Error("Audio unavailable");
          }}
        />
      )}
    </SafeAreaView>
  );
}
