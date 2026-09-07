import { Platform, type ColorValue } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/AuthContext";

function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );
}

export default function AppLayout() {
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const isAdmin = user.role === "ADMIN";

  // Android's default tab bar sits right against the gesture/nav bar with
  // little breathing room, unlike iOS which already reserves space for the
  // home indicator - give it some extra bottom padding to match.
  const tabBarStyle =
    Platform.OS === "android" ? { height: 56 + insets.bottom + 12, paddingBottom: insets.bottom + 12 } : undefined;

  return (
    <Tabs screenOptions={{ headerShown: true, tabBarStyle }}>
      {/* Tapping in/out is an employee action - admins get "not_an_employee" from the server anyway. */}
      <Tabs.Screen
        name="tap"
        options={{ title: "Clock In/Out", href: isAdmin ? null : undefined, tabBarIcon: tabIcon("time-outline") }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{ title: isAdmin ? "Overview" : "Hours", tabBarIcon: tabIcon("reader-outline") }}
      />
      {/* Personal clock history doesn't apply to admins - they drill into
          any teacher's history from the Overview tab instead. */}
      <Tabs.Screen
        name="history"
        options={{ title: "History", href: isAdmin ? null : undefined, tabBarIcon: tabIcon("calendar-outline") }}
      />
      <Tabs.Screen
        name="admin-requests"
        options={{
          title: "Requests",
          href: isAdmin ? undefined : null,
          tabBarIcon: tabIcon("checkmark-done-outline"),
        }}
      />
      <Tabs.Screen
        name="admin-reports"
        options={{ title: "Reports", href: isAdmin ? undefined : null, tabBarIcon: tabIcon("bar-chart-outline") }}
      />
      <Tabs.Screen
        name="admin-calendar"
        options={{ title: "Calendar", href: isAdmin ? undefined : null, tabBarIcon: tabIcon("calendar-outline") }}
      />
      <Tabs.Screen
        name="provision"
        options={{ title: "Setup Tag", href: isAdmin ? undefined : null, tabBarIcon: tabIcon("construct-outline") }}
      />
    </Tabs>
  );
}
