import { Pressable, Text, View } from "react-native";
import {
  Play,
  Pause,
  X,
  Ellipsis,
  RotateCcw,
  RotateCw,
  Volume2,
} from "lucide-react-native";
const icons = {
  volume: Volume2,
  play: Play,
  pause: Pause,
  close: X,
  more: Ellipsis,
  rewind: RotateCcw,
  forward: RotateCw,
};
export function IconButton({
  label,
  icon,
  onPress,
  filled = false,
  size = 44,
  tint,
}: {
  label: string;
  icon: keyof typeof icons;
  onPress: () => void;
  filled?: boolean;
  size?: number;
  tint?: string;
}) {
  const Icon = icons[icon];
  const skip = icon === "rewind" || icon === "forward";
  const color = filled ? "white" : (tint ?? "#0B1937");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: filled ? "#0B1937" : "transparent",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon
        size={skip ? 34 : size > 60 ? 30 : 22}
        color={color}
        strokeWidth={1.8}
        fill={icon === "play" || icon === "pause" ? color : "none"}
      />
      {skip && (
        <View pointerEvents="none" style={{ position: "absolute", top: 17 }}>
          <Text style={{ fontSize: 10, fontWeight: "600", color }}>15</Text>
        </View>
      )}
    </Pressable>
  );
}
