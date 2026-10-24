import { cafeArtwork } from "../data/artwork";
import { Play, ArrowUpRight, ArrowDown } from "lucide-react-native";
import { MiniPlayer } from "./MiniPlayer";
import { selectionAsync } from "expo-haptics";
import React, { PropsWithChildren, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export const colors = {
  paper: "#FCFBF9",
  ink: "#0B1937",
  green: "#00A980",
  muted: "#63738F",
  line: "#E9EAF0",
  tint: "#D8FAE9",
  lavender: "#F1EEFF",
  purple: "#6250FA",
};
export function Page({
  children,
  scroll = true,
  mini = false,
}: PropsWithChildren<{ scroll?: boolean; mini?: boolean }>) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
        {mini && <MiniPlayer />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Label({ children }: PropsWithChildren) {
  return <Text style={s.label}>{children}</Text>;
}
export function Title({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={s.title}>
      {children}
    </Text>
  );
}
export function Body({ children }: PropsWithChildren) {
  return <Text style={s.body}>{children}</Text>;
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const Icon = label.startsWith("▶")
    ? Play
    : label.endsWith("↗")
      ? ArrowUpRight
      : label.startsWith("↓")
        ? ArrowDown
        : null;
  const displayLabel = label.replace(/[▶↗↓]/g, "").trim();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== "web") void selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      {Icon && (
        <Icon
          size={20}
          color={secondary ? colors.ink : "white"}
          fill={Icon === Play ? "white" : "none"}
        />
      )}
      <Text style={[s.buttonText, secondary && { color: colors.ink }]}>
        {displayLabel}
      </Text>
    </Pressable>
  );
}
export function Cover({ compact = false }: { compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[s.cover, { height: compact ? 180 : 280 }]}>
      {!failed ? (
        <Image
          accessibilityLabel="A warm Paris café terrace overlooking the Eiffel Tower"
          source={cafeArtwork}
          style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
          onError={() => setFailed(true)}
        />
      ) : (
        <Title>Paris, autrement.</Title>
      )}
    </View>
  );
}
export function DemoNote() {
  return (
    <Text style={s.note}>
      LOCAL EDITION · AI voices: Lucie & Loïc · No account needed
    </Text>
  );
}
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 18,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: "Georgia",
    color: colors.ink,
  },
  body: { fontSize: 16, lineHeight: 25, color: colors.muted },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.green,
  },
  button: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.green,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 15,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: "#F3F3F6" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cover: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.tint,
    justifyContent: "center",
    padding: 20,
  },
  coverTag: {
    position: "absolute",
    left: 18,
    bottom: 18,
    backgroundColor: "#172C35CC",
    padding: 9,
    borderRadius: 5,
  },
  note: { fontSize: 11, lineHeight: 18, color: colors.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  card: {
    backgroundColor: "#FFFDF8",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  divider: { height: 1, backgroundColor: colors.line },
  subheading: { fontSize: 23, fontFamily: "Georgia", color: colors.ink },
  link: {
    color: colors.green,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 12,
  },
  input: {
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
  },
});
