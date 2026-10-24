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
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <StatusBar style="dark" />
        <PlaybackHost />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.paper },
            headerTintColor: colors.ink,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.paper },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="player" options={{ title: "Now listening" }} />
          <Stack.Screen
            name="transcript"
            options={{ title: "Transcript", headerTitleAlign: "center" }}
          />
          <Stack.Screen name="recap" options={{ title: "Session recap" }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
