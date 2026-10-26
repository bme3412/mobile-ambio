import { useState } from "react";
import { Image, Text, View } from "react-native";
import type { EditorialArtwork } from "../data/editorialArtwork";

export function EditorialImage({ artwork }: { artwork?: EditorialArtwork }) {
  const [failedSource, setFailedSource] =
    useState<EditorialArtwork["source"]>();
  const available = artwork && failedSource !== artwork.source;
  return (
    <View style={{ gap: 6 }}>
      {available ? (
        <View
          style={{
            width: "100%",
            aspectRatio: artwork.aspectRatio,
            overflow: "hidden",
          }}
        >
          <Image
            source={artwork.source}
            resizeMode="cover"
            accessible
            accessibilityRole="image"
            accessibilityLabel={artwork.description}
            onError={() => setFailedSource(artwork.source)}
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              backgroundColor: "#E8E3DA",
            }}
          />
        </View>
      ) : (
        <View
          accessibilityRole="image"
          accessibilityLabel="Illustration unavailable"
          style={{
            width: "100%",
            aspectRatio: artwork?.aspectRatio ?? 1.5,
            backgroundColor: "#E8E3DA",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#595F61" }}>Ambio · Illustration</Text>
        </View>
      )}
      <Text style={{ color: "#62635F", fontSize: 11, letterSpacing: 1 }}>
        {artwork?.label ?? "Illustration"}
      </Text>
    </View>
  );
}
