import {
  ReactNode,
  ComponentRef,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { currentPhrase, episodePhrases } from "../data/phrases";
import { teleprompterOffset } from "../domain/teleprompter";
import audioTiming from "../data/audio-timing.json";
import { episode } from "../data/episode";
import { TranscriptSegment, WordToken } from "../domain/types";
import { player, usePlayback } from "../playback/player";
import { useReader } from "../state/reader";
import { PlaybackControls } from "./PlaybackControls";
import { RevealWord } from "./RevealWord";
import { Button, colors, s } from "./ui";

export function PhraseReader({
  onWord,
  children,
  followPhrase = true,
}: {
  onWord: (word: WordToken, segment: TranscriptSegment) => void;
  children?: ReactNode;
  followPhrase?: boolean;
}) {
  const { positionMs, playing, replayEndMs } = usePlayback();
  const { english, toggleEnglish } = useReader();
  const music = audioTiming.musicOnlyRanges.find(
    (range) => positionMs >= range.startMs && positionMs < range.endMs,
  );
  const readingPositionMs = music ? Math.max(0, music.startMs - 1) : positionMs;
  const phrase = currentPhrase(readingPositionMs);
  const index = episodePhrases.indexOf(phrase);
  const [manual, setManual] = useState(false);
  const manualRef = useRef(false);
  const [height, setHeight] = useState(0);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef<Record<number, { y: number; height: number }>>({});
  const scrollY = useRef(0);
  const frame = useRef<number | null>(null);
  const wordHandler = useRef(onWord);
  useLayoutEffect(() => {
    wordHandler.current = onWord;
  }, [onWord]);
  const lookup = useCallback((word: WordToken, segment: TranscriptSegment) => {
    player.pause();
    wordHandler.current(word, segment);
  }, []);
  const cancelScroll = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const browse = () => {
    manualRef.current = true;
    setManual(true);
    cancelScroll();
  };
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
      cancelScroll();
    };
  }, [cancelScroll]);
  useEffect(() => {
    cancelScroll();
    const row = offsets.current[index];
    if (manualRef.current || !followPhrase || !height || !row) return;
    const next = episodePhrases[index + 1];
    const target = teleprompterOffset({
      positionMs: readingPositionMs,
      startMs: phrase.words[0].startMs,
      nextStartMs: next?.words[0].startMs ?? episode.durationMs,
      top: row.y,
      nextTop: offsets.current[index + 1]?.y ?? row.y + row.height,
      anchor: height * 0.3,
      reduceMotion,
    });
    // Audio timestamps set the destination; animation only smooths the display.
    // Seeks and reduced-motion updates land immediately, without a long crawl.
    if (
      reduceMotion ||
      !playing ||
      Math.abs(target - scrollY.current) > height
    ) {
      scrollY.current = target;
      scroll.current?.scrollTo({ y: target, animated: false });
      return;
    }
    const step = () => {
      if (manualRef.current) return;
      const delta = target - scrollY.current;
      scrollY.current =
        Math.abs(delta) < 0.5 ? target : scrollY.current + delta * 0.18;
      scroll.current?.scrollTo({ y: scrollY.current, animated: false });
      if (Math.abs(delta) >= 0.5) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return cancelScroll;
  }, [
    readingPositionMs,
    playing,
    index,
    phrase,
    height,
    layoutVersion,
    english,
    reduceMotion,
    manual,
    followPhrase,
    cancelScroll,
  ]);
  const finished = positionMs >= episode.durationMs;
  return (
    <View style={{ flex: 1, minHeight: 0, gap: 8 }}>
      <View style={s.row}>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="English translation"
          accessibilityState={{ checked: english }}
          onPress={toggleEnglish}
          style={{
            minHeight: 44,
            paddingHorizontal: 14,
            justifyContent: "center",
            borderRadius: 22,
            backgroundColor: english ? colors.tint : colors.line,
          }}
        >
          <Text style={{ color: colors.ink }}>
            English · {english ? "On" : "Off"}
          </Text>
        </Pressable>
        <Text style={s.note}>
          {finished
            ? "Episode complete"
            : playing
              ? replayEndMs
                ? "Replaying phrase"
                : manual
                  ? "Browsing · audio continues"
                  : "Following audio"
              : "Paused"}
        </Text>
      </View>
      {followPhrase ? (
        <>
          <ScrollView
            ref={scroll}
            testID="teleprompter"
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{
              paddingTop: height * 0.3,
              paddingBottom: height * 0.8,
            }}
            onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
            onScrollBeginDrag={browse}
            {...(Platform.OS === "web" ? { onWheel: browse } : {})}
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
          >
            {episodePhrases.map((item, rowIndex) => (
              <View
                key={item.words[0].id}
                onLayout={(event) => {
                  const { y, height: rowHeight } = event.nativeEvent.layout;
                  const previous = offsets.current[rowIndex];
                  if (previous?.y !== y || previous?.height !== rowHeight) {
                    offsets.current[rowIndex] = { y, height: rowHeight };
                    setLayoutVersion((version) => version + 1);
                  }
                }}
              >
                <PhraseRow
                  phrase={item}
                  active={rowIndex === index}
                  past={rowIndex < index}
                  currentWord={
                    rowIndex === index && !music
                      ? item.words.findLast(
                          (word) => word.startMs <= positionMs,
                        )?.id
                      : undefined
                  }
                  english={english}
                  onWord={lookup}
                />
              </View>
            ))}
          </ScrollView>
          {manual && (
            <Button
              secondary
              label="↓ Back to Live"
              onPress={() => {
                manualRef.current = false;
                setManual(false);
              }}
            />
          )}
          {children}
        </>
      ) : (
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ gap: 20, paddingVertical: 12 }}
        >
          {children}
        </ScrollView>
      )}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingTop: 8,
          gap: 8,
        }}
      >
        <PlaybackControls compact />
        <Button
          secondary
          label="Replay phrase"
          onPress={() =>
            player.replay(
              phrase.words[0].startMs,
              phrase.words[phrase.words.length - 1].endMs,
            )
          }
        />
      </View>
    </View>
  );
}

const PhraseRow = memo(function PhraseRow({
  phrase,
  active,
  past,
  currentWord,
  english,
  onWord,
}: {
  phrase: (typeof episodePhrases)[number];
  active: boolean;
  past: boolean;
  currentWord?: string;
  english: boolean;
  onWord: (word: WordToken, segment: TranscriptSegment) => void;
}) {
  return (
    <View
      style={{
        gap: 12,
        paddingHorizontal: 4,
        paddingBottom: 28,
        opacity: active ? 1 : past ? 0.48 : 0.62,
      }}
    >
      <Text
        testID={active ? "reader-phrase" : undefined}
        style={{ fontSize: 28, lineHeight: 40, color: colors.ink }}
      >
        {phrase.words.map((word) =>
          /[a-zàâéèêëîïôùûüç]/i.test(word.text) ? (
            <RevealWord
              key={word.id}
              word={word}
              positionMs={0}
              playing={false}
              current={word.id === currentWord}
              onPress={() => onWord(word, phrase.segment)}
            />
          ) : (
            <Text key={word.id}>{word.text} </Text>
          ),
        )}
      </Text>
      {english && (
        <Text
          testID={active ? "focus-translation" : undefined}
          style={{
            fontSize: 19,
            lineHeight: 28,
            color: colors.muted,
            borderLeftWidth: 2,
            borderLeftColor: colors.green,
            paddingLeft: 14,
          }}
        >
          {phrase.translation}
        </Text>
      )}
    </View>
  );
});
