import { EditionHost } from "../components/EditionStatus";
import { Platform, View, useWindowDimensions } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PlaybackHost } from "../components/PlaybackHost";
import { colors } from "../components/ui";
export { ErrorBoundary } from "expo-router";
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: Infinity } },
});
export default function Root() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 768;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <StatusBar style="dark" />
        <EditionHost />
        <PlaybackHost />
        <View
          style={{
            flex: 1,
            backgroundColor: "#F0F1F3",
            padding: desktop ? 20 : 0,
          }}
        >
          <View
            style={{
              flex: 1,
              width: "100%",
              maxWidth: desktop ? 680 : undefined,
              alignSelf: "center",
              overflow: "hidden",
              borderRadius: desktop ? 24 : 0,
              borderWidth: desktop ? 1 : 0,
              borderColor: colors.line,
            }}
          >
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.paper },
                headerTintColor: colors.ink,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.paper },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="player"
                options={{ title: "Now listening" }}
              />
              <Stack.Screen
                name="transcript"
                options={{ title: "Transcript", headerTitleAlign: "center" }}
              />
              <Stack.Screen name="recap" options={{ title: "Session recap" }} />
            </Stack>
          </View>
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
