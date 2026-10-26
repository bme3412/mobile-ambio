import { Tabs } from "expo-router";
import { House, Bookmark, Mic, Library } from "lucide-react-native";
import { colors } from "../../components/ui";
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <House color={color} size={23} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Episodes",
          tabBarIcon: ({ color }) => (
            <Library color={color} size={23} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color }) => (
            <Bookmark color={color} size={23} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="conversation"
        options={{
          title: "Talk",
          tabBarIcon: ({ color }) => (
            <Mic color={color} size={23} strokeWidth={1.8} />
          ),
        }}
      />
    </Tabs>
  );
}
