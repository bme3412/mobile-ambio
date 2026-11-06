import { Play, ArrowUpRight, ArrowDown } from "lucide-react-native";
import { MiniPlayer } from "./MiniPlayer";
import { selectionAsync } from "expo-haptics";
import React, { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./theme";
export { colors } from "./theme";
export function Page({
  children,
  scroll = true,
  mini = false,
  refreshing = false,
  onRefresh,
}: PropsWithChildren<{
  scroll?: boolean;
  mini?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              ) : undefined
            }
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
  accessibilityLabel,
  onPress,
  secondary = false,
  disabled = false,
  tone,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  tone?: string;
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
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== "web") void selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        s.button,
        tone && !secondary ? { backgroundColor: tone } : undefined,
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
    padding: 20,
    paddingBottom: 40,
    gap: 18,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
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
    borderRadius: 0,
    paddingHorizontal: 20,
    paddingVertical: 15,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: colors.lavender },
  buttonText: { flexShrink: 1, color: "#fff", fontSize: 16, fontWeight: "600" },
  cover: {
    borderRadius: 0,
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
    backgroundColor: colors.paper,
    padding: 20,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  divider: { height: 1, backgroundColor: colors.line },
  subheading: { fontSize: 23, fontWeight: "800", color: colors.ink },
  link: {
    color: colors.green,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 12,
  },
  input: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
  },
});
