import { IconButton } from "./IconButton";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { player, time, usePlayback } from "../playback/player";
import { episode } from "../data/episode";
import { colors, s } from "./ui";
export function PlaybackControls({ compact = false }: { compact?: boolean }) {
  const state = usePlayback();
  const [width, setWidth] = useState(1);
  return (
    <View style={{ gap: compact ? 8 : 16 }}>
      {state.loading && (
        <Text accessibilityRole="status" style={s.note}>
          Preparing episode…
        </Text>
      )}
      {state.error && (
        <Text accessibilityRole="alert" style={s.body}>
          {state.error}
        </Text>
      )}
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(event) =>
          player.seek(
            (event.nativeEvent.locationX / width) * episode.durationMs,
          )
        }
        onResponderMove={(event) =>
          player.seek(
            (event.nativeEvent.locationX / width) * episode.durationMs,
          )
        }
        accessible
        accessibilityLabel="Playback position"
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: 0,
          max: episode.durationMs,
          now: state.positionMs,
          text: time(state.positionMs),
        }}
        accessibilityActions={[
          { name: "increment", label: "Forward 15 seconds" },
          { name: "decrement", label: "Back 15 seconds" },
        ]}
        onAccessibilityAction={(event) =>
          player.seek(
            state.positionMs +
              (event.nativeEvent.actionName === "increment" ? 15000 : -15000),
          )
        }
        style={{ height: 28, justifyContent: "center" }}
      >
        <View
          style={{ height: 4, backgroundColor: colors.line, borderRadius: 4 }}
        >
          <View
            style={{
              height: 4,
              width: `${(state.positionMs / episode.durationMs) * 100}%`,
              backgroundColor: colors.green,
              borderRadius: 4,
            }}
          />
        </View>
        <View
          style={{
            position: "absolute",
            left: `${Math.min(98, (state.positionMs / episode.durationMs) * 100)}%`,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.green,
          }}
        />
      </View>
      {!compact && (
        <View style={s.row}>
          <Text style={s.note}>{time(state.positionMs)}</Text>
          <Text style={s.note}>
            {state.replayEndMs
              ? "Passage replay"
              : `−${time(episode.durationMs - state.positionMs)}`}
          </Text>
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        <IconButton
          label="−15 s"
          icon="rewind"
          onPress={() => player.seek(state.positionMs - 15000)}
        />
        <IconButton
          size={76}
          filled
          label={state.playing ? "Pause" : "▶ Play"}
          icon={state.playing ? "pause" : "play"}
          onPress={() => (state.playing ? player.pause() : player.play())}
        />
        <IconButton
          label="+15 s"
          icon="forward"
          onPress={() => player.seek(state.positionMs + 15000)}
        />
      </View>
      <View style={s.row}>
        <Text style={s.note}>
          {compact
            ? `${time(state.positionMs)} / ${time(episode.durationMs)}`
            : "ElevenLabs · Lucie & Loïc"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${state.rate}× speed`}
          onPress={() =>
            player.setRate(state.rate >= 2 ? 0.75 : state.rate + 0.25)
          }
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 12,
          }}
        >
          <Text style={s.link}>{state.rate}× speed</Text>
        </Pressable>
      </View>
    </View>
  );
}
