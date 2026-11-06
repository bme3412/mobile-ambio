import { colors } from "./theme";
import { Text } from "react-native";
import { WordToken } from "../domain/types";
import { wordRevealOpacity } from "../domain/transcript";

export function RevealWord({
  word,
  positionMs,
  playing,
  current,
  onPress,
}: {
  word: WordToken;
  positionMs: number;
  playing: boolean;
  current: boolean;
  onPress: () => void;
}) {
  return (
    <Text
      accessibilityRole="button"
      accessibilityLabel={`Look up ${word.text}`}
      accessibilityState={{ selected: current }}
      onPress={onPress}
      style={{
        opacity: wordRevealOpacity(word.startMs, positionMs, playing),
        color: current ? "#006B52" : "#344158",
        backgroundColor: current ? colors.tint : "transparent",
        // Constant weight avoids shifting the line as the highlight advances.
        fontWeight: "500",
      }}
    >
      {word.text}{" "}
    </Text>
  );
}
