import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

/** Bundled vector flags; independent of platform emoji fonts. */
export function LanguageFlag({
  language,
  width = 30,
}: {
  language: "fr" | "en";
  width?: number;
}) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        language === "fr" ? "French flag" : "UK flag for English"
      }
      style={{
        width,
        height: (width * 2) / 3,
        borderRadius: 4,
        overflow: "hidden",
        flexShrink: 0,
        borderWidth: 0.5,
        borderColor: "#0B193726",
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 60 40">
        {language === "fr" ? (
          <>
            <Rect width="20" height="40" fill="#002395" />
            <Rect x="20" width="20" height="40" fill="#FFFFFF" />
            <Rect x="40" width="20" height="40" fill="#ED2939" />
          </>
        ) : (
          <>
            <Rect width="60" height="40" fill="#012169" />
            <Path d="M0 0L60 40M60 0L0 40" stroke="#FFFFFF" strokeWidth="9" />
            <Path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" strokeWidth="3" />
            <Path d="M30 0V40M0 20H60" stroke="#FFFFFF" strokeWidth="13" />
            <Path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth="7" />
          </>
        )}
      </Svg>
    </View>
  );
}
