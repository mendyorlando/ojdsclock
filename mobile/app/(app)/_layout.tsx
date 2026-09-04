import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/lib/AuthContext";

export default function AppLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const isAdmin = user.role === "ADMIN";

  return (
    <Tabs screenOptions={{ headerShown: true }}>
      {/* Tapping in/out is an employee action - admins get "not_an_employee" from the server anyway. */}
      <Tabs.Screen name="tap" options={{ title: "Clock In/Out", href: isAdmin ? null : undefined }} />
      <Tabs.Screen name="dashboard" options={{ title: "Hours" }} />
      <Tabs.Screen name="history" options={{ title: "History" }} />
      <Tabs.Screen name="provision" options={{ title: "Setup Tag", href: isAdmin ? undefined : null }} />
    </Tabs>
  );
}
