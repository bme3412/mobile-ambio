import { useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import type { EditorialArtwork } from "../data/editorialArtwork";
import { colors } from "./theme";

export function EditorialImage({
  artwork,
  compact = false,
}: {
  artwork?: EditorialArtwork;
  compact?: boolean;
}) {
  const source = compact
    ? (artwork?.thumbnail ?? artwork?.source)
    : artwork?.source;
  // Compare the URI rather than object identity: selectors may create new objects.
  const key =
    typeof source === "number"
      ? String(source)
      : source && "uri" in source
        ? source.uri
        : undefined;
  const [failedKey, setFailedKey] = useState<string>();
  const [credits, setCredits] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const available = source && key !== failedKey;
  const open = (url: string) => {
    setLinkError(false);
    void Linking.openURL(url).catch(() => setLinkError(true));
  };
  return (
    <View style={{ gap: compact ? 0 : 6 }}>
      <View
        style={{
          width: "100%",
          aspectRatio: compact ? 1 : (artwork?.aspectRatio ?? 1.85),
          backgroundColor: colors.lavender,
          overflow: "hidden",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {available ? (
          <Image
            source={source}
            resizeMode="cover"
            accessible
            accessibilityRole="image"
            accessibilityLabel={artwork?.description}
            onError={() => setFailedKey(key)}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <View
            accessibilityRole="image"
            accessibilityLabel="Photograph unavailable"
            style={{ padding: compact ? 4 : 24, alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                width: compact ? 16 : 28,
                height: 2,
                backgroundColor: colors.line,
              }}
            />
            <Text
              style={{
                color: colors.muted,
                fontSize: compact ? 10 : 12,
                letterSpacing: 1,
              }}
            >
              {compact ? "AMBIO" : "AMBIO · PHOTO UNAVAILABLE"}
            </Text>
          </View>
        )}
      </View>
      {!compact && artwork?.photo && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Photo credit"
            accessibilityState={{ expanded: credits }}
            onPress={() => setCredits(!credits)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Photo: {artwork.photo.creator} ·{" "}
              {credits ? "Hide credit" : "Credit & source"}
            </Text>
          </Pressable>
          {credits && (
            <View
              style={{
                gap: 4,
                borderLeftWidth: 2,
                borderColor: colors.line,
                paddingLeft: 12,
              }}
            >
              <Text
                style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}
              >
                {artwork.photo.caption}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Resized and cropped for display.
              </Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => open(artwork.photo!.sourcePage)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={{ color: colors.blue }}>
                  View photograph on Wikimedia Commons ↗
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={() => open(artwork.photo!.licenseUrl)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={{ color: colors.blue }}>
                  {artwork.photo.license} ↗
                </Text>
              </Pressable>
              {linkError && (
                <Text accessibilityRole="alert" style={{ color: colors.muted }}>
                  Could not open the link. Check your connection and try again.
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}
