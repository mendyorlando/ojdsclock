import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/lib/AuthContext";

export default function AppLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="tap" options={{ title: "Clock In/Out" }} />
      <Tabs.Screen name="dashboard" options={{ title: "Hours" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen
        name="provision"
        options={{ title: "Setup Tag", href: user.role === "ADMIN" ? undefined : null }}
      />
    </Tabs>
  );
}
