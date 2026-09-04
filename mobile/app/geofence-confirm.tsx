import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect, router } from "expo-router";
import { useAuth } from "@/lib/AuthContext";
import { useConfirmClockOut } from "@/lib/useTapSubmission";
import { TapResultView } from "@/components/TapResultView";

/**
 * Where the geofence-exit notification's tap lands. No tag involved -
 * just confirms the clock-out server-side (a no-op if they weren't
 * clocked in), same result UI as a real tap.
 */
export default function GeofenceConfirmScreen() {
  const { user, isLoading } = useAuth();
  const { state, submit } = useConfirmClockOut();
  const submitted = useRef(false);

  useEffect(() => {
    if (isLoading || !user || submitted.current) return;
    submitted.current = true;
    submit();
  }, [isLoading, user, submit]);

  const goToDashboard = () => router.replace("/(app)/dashboard");

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0b3b38", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0b3b38" }}>
      <TapResultView state={state} firstName={user.name.split(" ")[0]} onRetry={goToDashboard} onDone={goToDashboard} />
    </View>
  );
}
