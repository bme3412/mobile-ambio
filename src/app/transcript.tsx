import { FocusReader } from "../components/FocusReader";
import { RevealWord } from "../components/RevealWord";
import { LanguageFlag } from "../components/LanguageFlag";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  FlatList,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { episode } from "../data/episode";
import { Button, colors, s } from "../components/ui";
import { MiniPlayer } from "../components/MiniPlayer";
import { IconButton } from "../components/IconButton";
import { WordSheet } from "../components/WordSheet";
import {
  activeSegment,
  activeWord,
  shouldFollow,
  sentenceWords,
  spokenSentence,
} from "../domain/transcript";
import { TranscriptSegment, WordToken } from "../domain/types";
import { player, time, usePlayback } from "../playback/player";
export default function Transcript() {
  const { positionMs, playing } = usePlayback();
  const [focusMode, setFocusMode] = useState(false);
  const [manual, setManual] = useState(false);
  const manualRef = useRef(false);
  const [query, setQuery] = useState("");
  const [bilingual, setBilingual] = useState(false);
  const [keyPoints, setKeyPoints] = useState(false);
  const [selected, setSelected] = useState<{
    word: WordToken;
    segment: TranscriptSegment;
  } | null>(null);
  const list = useRef<FlatList<TranscriptSegment>>(null);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [liveRequest, setLiveRequest] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);
  const followRef = useRef(() => {});
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);
  const current = activeSegment(episode.segments, positionMs);
  const currentSentence = spokenSentence(
    episode.segments[Math.max(0, current)].words,
    positionMs,
  )[0]?.id;
  const sentenceOffsets = useRef<Record<string, number>>({});
  const data = episode.segments.filter((x) =>
    x.words.some((w) =>
      w.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    ),
  );
  useLayoutEffect(() => {
    followRef.current = () => {
      if (
        !manualRef.current &&
        shouldFollow(manual, query) &&
        !selected &&
        current >= 0
      )
        list.current?.scrollToIndex({
          index: current,
          viewPosition: 0,
          viewOffset: -(sentenceOffsets.current[currentSentence] ?? 0),
          animated: !reduceMotion,
        });
    };
  }, [manual, query, selected, current, currentSentence, reduceMotion]);
  useEffect(() => {
    retries.current = 0;
    followRef.current();
  }, [
    current,
    currentSentence,
    manual,
    query,
    selected,
    reduceMotion,
    liveRequest,
  ]);
  const browse = () => {
    manualRef.current = true;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setManual(true);
  };
  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.paper }}
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["Full transcript", "Focus reader"].map((mode, index) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={mode}
              accessibilityState={{ selected: index === 0 }}
              onPress={() => {
                if (index === 1) setFocusMode(true);
              }}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 16,
                alignItems: "center",
                backgroundColor: index === 0 ? colors.ink : colors.lavender,
              }}
            >
              <Text
                style={{
                  color: index === 0 ? "white" : colors.ink,
                  fontWeight: "600",
                }}
              >
                {mode}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          accessibilityLabel="Search transcript"
          placeholder="Find a word in the story…"
          value={query}
          onChangeText={(value) => {
            browse();
            setQuery(value);
          }}
          style={s.input}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["French", "Bilingual", "Key points"].map((mode, i) => {
            const active =
              i === 2 ? keyPoints : !keyPoints && bilingual === Boolean(i);
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityLabel={
                  i === 2
                    ? "Show key points"
                    : i
                      ? "Show English translation"
                      : "Show French only"
                }
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setKeyPoints(i === 2);
                  if (i < 2) setBilingual(Boolean(i));
                }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 6,
                  alignItems: "center",
                  paddingVertical: 12,
                  borderRadius: 24,
                  backgroundColor: active ? colors.tint : "#F3F3F6",
                }}
              >
                {i < 2 && (
                  <LanguageFlag language={i === 0 ? "fr" : "en"} width={28} />
                )}
                <Text
                  style={{
                    fontSize: 13,
                    color: active ? "#007B60" : colors.ink,
                  }}
                >
                  {mode}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[s.note, { paddingHorizontal: 4 }]}>
          {manual || query
            ? "Browsing · playback continues"
            : "Following the conversation"}
        </Text>
      </View>
      {keyPoints ? (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {episode.stories.map((story, index) => (
            <Pressable
              key={story.id}
              accessibilityRole="button"
              accessibilityLabel={`Listen to ${story.title}`}
              onPress={() => {
                const segment = episode.segments.find(
                  (item) => item.id === story.segmentId,
                );
                if (segment) {
                  player.seek(segment.startMs);
                  player.play();
                  setKeyPoints(false);
                }
              }}
              style={{
                padding: 20,
                borderRadius: 20,
                backgroundColor: index === 0 ? colors.tint : colors.lavender,
                gap: 10,
              }}
            >
              <Text style={s.note}>
                0{index + 1} · {story.category}
              </Text>
              <Text style={s.subheading}>{story.title}</Text>
              <Text style={s.body}>{story.description}</Text>
              <Text style={{ color: "#007B60", fontWeight: "600" }}>
                Listen to this story
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          testID="transcript-list"
          ref={list}
          data={data}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 32,
            gap: 14,
            maxWidth: 680,
            width: "100%",
            alignSelf: "center",
          }}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={browse}
          onTouchStart={browse}
          {...(Platform.OS === "web" ? { onWheel: browse } : {})}
          onContentSizeChange={() => followRef.current()}
          onScrollToIndexFailed={(info) => {
            if (!manualRef.current && !query) {
              list.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: false,
              });
              if (retries.current < 3) {
                retries.current++;
                if (retryTimer.current) clearTimeout(retryTimer.current);
                retryTimer.current = setTimeout(() => followRef.current(), 100);
              }
            }
          }}
          ListEmptyComponent={
            <Text style={s.body}>No matches. Try another word.</Text>
          }
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                padding: 12,
                borderRadius: 14,
                backgroundColor:
                  episode.segments[current]?.id === item.id
                    ? colors.lavender
                    : "transparent",
              }}
            >
              <View style={{ width: 40, alignItems: "center", gap: 6 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color:
                      episode.segments[current]?.id === item.id
                        ? colors.purple
                        : colors.muted,
                  }}
                >
                  {time(item.startMs)}
                </Text>
                <IconButton
                  label={`Replay ${item.speaker}’s sentence`}
                  icon="play"
                  size={32}
                  tint={colors.purple}
                  onPress={() => player.replay(item.startMs, item.endMs)}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={{ fontSize: 12, fontWeight: "600", color: colors.ink }}
                >
                  {item.speaker}
                </Text>
                {sentenceWords(item.words).map((sentence) => (
                  <Text
                    key={sentence[0].id}
                    onLayout={(event) => {
                      sentenceOffsets.current[sentence[0].id] =
                        event.nativeEvent.layout.y;
                      if (sentence[0].id === currentSentence)
                        followRef.current();
                    }}
                    style={{ fontSize: 17, lineHeight: 28, color: colors.ink }}
                  >
                    {sentence.map((word) =>
                      /[a-zàâéèêëîïôùûüç]/i.test(word.text) ? (
                        <RevealWord
                          key={word.id}
                          word={word}
                          positionMs={positionMs}
                          playing={playing && !manual && !query && !selected}
                          current={activeWord(item, positionMs) === word.id}
                          onPress={() => {
                            browse();
                            setSelected({ word, segment: item });
                          }}
                        />
                      ) : (
                        <Text key={word.id}>{word.text} </Text>
                      ),
                    )}
                  </Text>
                ))}
                {bilingual && (
                  <View style={{ gap: 8, marginTop: 6 }}>
                    <LanguageFlag language="en" />
                    <Text style={s.body}>{item.translation}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}
      <View
        style={{
          paddingHorizontal: 70,
          paddingVertical: manual || query.length > 0 ? 8 : 0,
        }}
      >
        {(manual || query.length > 0) && (
          <Button
            label="↓ Back to Live"
            onPress={() => {
              manualRef.current = false;
              setManual(false);
              setQuery("");
              setLiveRequest((x) => x + 1);
            }}
          />
        )}
      </View>
      <MiniPlayer always />
      <FocusReader
        visible={focusMode}
        onClose={() => setFocusMode(false)}
        onWord={(word, segment) => {
          setFocusMode(false);
          browse();
          setSelected({ word, segment });
        }}
      />
      <WordSheet selection={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}
