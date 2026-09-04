import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/AuthContext";

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Redirect href="/(app)/dashboard" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
