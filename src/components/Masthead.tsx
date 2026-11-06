import { Text, View } from "react-native";
import { LanguageFlag } from "./LanguageFlag";
import { colors } from "./theme";
export function Masthead() {
  return (
    <View style={{ gap: 18 }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingBottom: 16,
          borderBottomWidth: 2,
          borderColor: colors.ink,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 30,
            fontWeight: "900",
            letterSpacing: -1.5,
            color: colors.ink,
          }}
        >
          AMBIO
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LanguageFlag language="fr" width={24} />
          <Text style={{ fontSize: 12, color: colors.ink }}>Français</Text>
        </View>
      </View>
      <Text
        style={{
          fontSize: 10,
          letterSpacing: 2,
          color: colors.muted,
          fontWeight: "600",
        }}
      >
        LE MONDE, À VOTRE RYTHME
      </Text>
      <View style={{ width: 32, height: 2, backgroundColor: colors.red }} />
    </View>
  );
}
