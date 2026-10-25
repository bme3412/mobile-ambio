import { RotateCcw } from "lucide-react-native";
import { episodePhrases as phrases } from "../data/phrases";
import { LanguageFlag } from "./LanguageFlag";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { episode } from "../data/episode";
import { TranscriptSegment, WordToken } from "../domain/types";
import { player, time, usePlayback } from "../playback/player";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "./IconButton";
import { RevealWord } from "./RevealWord";
import { colors, Label, s } from "./ui";

export function FocusReader({
  visible,
  returnLabel = "Full transcript",
  onClose,
  onWord,
}: {
  visible: boolean;
  returnLabel?: string;
  onClose: () => void;
  onWord: (word: WordToken, segment: TranscriptSegment) => void;
}) {
  const [english, setEnglish] = useState(false);
  const { positionMs, playing, rate, error, replayEndMs } = usePlayback();
  const insets = useSafeAreaInsets();
  const index = Math.max(
    0,
    phrases.findLastIndex(({ words }) => words[0].startMs <= positionMs),
  );
  const [opacity] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(true);
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
    };
  }, []);
  useLayoutEffect(() => {
    // Replace the phrase immediately at its audio boundary. Only its
    // presentation fades; neither timestamps nor word selection are delayed.
    opacity.stopAnimation();
    if (!visible || reduceMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.55);
    const fade = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    fade.start();
    return () => fade.stop();
  }, [index, visible, reduceMotion, opacity]);
  const current = phrases[index].words.findLastIndex(
    (word) => word.startMs <= positionMs,
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(11,25,55,0.45)",
          justifyContent: "center",
          paddingHorizontal: 6,
          paddingTop: Math.max(8, insets.top),
          paddingBottom: Math.max(8, insets.bottom),
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 560,
            alignSelf: "center",
            borderRadius: 28,
            padding: 16,
            backgroundColor: colors.paper,
            gap: 10,
          }}
        >
          <View style={s.row}>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 22, color: colors.ink, fontWeight: "600" }}
            >
              Focus reader
            </Text>
            <IconButton
              icon="close"
              label="Close focus reader"
              onPress={onClose}
            />
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="English translation"
            accessibilityState={{ checked: english }}
            onPress={() => setEnglish(!english)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              gap: 12,
              minHeight: 44,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: english ? colors.tint : colors.line,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <LanguageFlag language="en" width={28} />
              <Text style={{ color: colors.ink }}>English</Text>
            </View>
            <Text style={{ color: "#007B60", fontWeight: "600" }}>
              {english ? "On" : "Off"}
            </Text>
          </Pressable>
          <ScrollView
            key={index}
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              gap: 18,
              paddingVertical: 24,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {phrases
              .slice(index, index + 1)
              .map(({ segment, words, translation }, offset) => (
                <Animated.View key={words[0].id} style={{ gap: 8, opacity }}>
                  <Label>{segment.speaker}</Label>
                  <Text
                    style={{
                      fontSize: 24,
                      lineHeight: 34,
                      color: colors.ink,
                    }}
                  >
                    {words.map((word) =>
                      /[a-zàâéèêëîïôùûüç]/i.test(word.text) ? (
                        <RevealWord
                          key={word.id}
                          word={word}
                          positionMs={positionMs}
                          playing={playing}
                          current={
                            offset === 0 &&
                            word.id === phrases[index].words[current]?.id
                          }
                          onPress={() => onWord(word, segment)}
                        />
                      ) : (
                        <Text key={word.id}>{word.text} </Text>
                      ),
                    )}
                  </Text>
                  {english && (
                    <Text
                      testID="focus-translation"
                      style={{
                        fontSize: 19,
                        lineHeight: 28,
                        color: colors.muted,
                        borderLeftWidth: 2,
                        borderLeftColor: colors.green,
                        paddingLeft: 12,
                      }}
                    >
                      {translation}
                    </Text>
                  )}
                </Animated.View>
              ))}
          </ScrollView>
          {error && (
            <Text accessibilityRole="alert" style={s.note}>
              {error}
            </Text>
          )}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.line,
              paddingTop: 8,
              gap: 4,
            }}
          >
            <View style={s.row}>
              <Text style={s.note}>
                {time(positionMs)} / {time(episode.durationMs)}
              </Text>
              <Text style={s.note}>
                {playing
                  ? replayEndMs
                    ? "Replaying phrase"
                    : "Following audio"
                  : "Paused"}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-around",
              }}
            >
              <IconButton
                icon="rewind"
                label="−15 s"
                onPress={() => player.seek(positionMs - 15000)}
              />
              <IconButton
                icon={playing ? "pause" : "play"}
                label={playing ? "Pause" : "▶ Play"}
                size={52}
                filled
                onPress={() => (playing ? player.pause() : player.play())}
              />
              <IconButton
                icon="forward"
                label="+15 s"
                onPress={() => player.seek(positionMs + 15000)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${rate}× speed`}
                onPress={() => player.setRate(rate >= 2 ? 0.75 : rate + 0.25)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 10,
                  justifyContent: "center",
                }}
              >
                <Text style={s.link}>{rate}×</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Replay phrase"
              onPress={() => {
                const words = phrases[index].words;
                player.replay(words[0].startMs, words[words.length - 1].endMs);
              }}
              style={{
                minHeight: 44,
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 16,
                backgroundColor: colors.tint,
              }}
            >
              <RotateCcw size={18} color="#007B60" />
              <Text style={{ color: "#007B60", fontWeight: "600" }}>
                Replay phrase
              </Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              returnLabel === "Full transcript"
                ? "Return to full transcript"
                : returnLabel
            }
            onPress={onClose}
            style={{
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#007B60", fontWeight: "600" }}>
              {returnLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
