import { cafeArtwork } from "../data/artwork";
import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { episode } from "../data/episode";
import { player, time, usePlayback } from "../playback/player";
import { IconButton } from "./IconButton";
export function MiniPlayer({ always = false }: { always?: boolean }) {
  const p = usePlayback();
  if (!always && !p.playing && p.positionMs === 0) return null;
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderColor: "#E9EAF0",
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
      }}
    >
      <Image
        source={cafeArtwork}
        style={{
          width: 52,
          height: 52,
          borderRadius: 10,
          backgroundColor: "#D8FAE9",
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open current episode"
        onPress={() => router.push("/player")}
        style={{ flex: 1, minHeight: 44, justifyContent: "center", gap: 4 }}
      >
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: "600", color: "#0B1937" }}
        >
          {episode.title}
        </Text>
        <Text style={{ fontSize: 12, color: "#63738F" }}>
          {time(p.positionMs)} / {time(episode.durationMs)}
        </Text>
      </Pressable>
      <IconButton
        filled
        label={p.playing ? "Pause current episode" : "Resume current episode"}
        icon={p.playing ? "pause" : "play"}
        onPress={() => (p.playing ? player.pause() : player.play())}
      />
    </View>
  );
}
