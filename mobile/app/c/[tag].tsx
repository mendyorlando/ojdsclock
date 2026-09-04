import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, Redirect, router } from "expo-router";
import { useAuth } from "@/lib/AuthContext";
import { useTapSubmission } from "@/lib/useTapSubmission";
import { TapResultView } from "@/components/TapResultView";

/**
 * Where a Universal Link (a tag tapped in the background, app closed)
 * lands: https://ojdsclock.vercel.app/c/chabad-door?picc_data=...&cmac=...
 * Same submission/result logic as a live NFC read in tap.tsx - this
 * screen just already has the payload from the URL instead of scanning
 * for it.
 */
export default function TapLinkScreen() {
  const { user, isLoading } = useAuth();
  const params = useLocalSearchParams<{ tag: string; picc_data?: string; cmac?: string }>();
  const { state, submit } = useTapSubmission();

  // A used-up link can't just be retried (its counter is already
  // consumed) - send them to the tap screen to scan fresh instead.
  const goToTapScreen = () => router.replace("/(app)/tap");
  const submitted = useRef(false);

  useEffect(() => {
    if (isLoading || !user || submitted.current) return;
    if (!params.tag || !params.picc_data || !params.cmac) return;

    submitted.current = true;
    submit({ tag: params.tag, piccData: params.picc_data, cmac: params.cmac });
  }, [isLoading, user, params.tag, params.picc_data, params.cmac, submit]);

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

  if (!params.picc_data || !params.cmac) {
    return <Redirect href="/(app)/tap" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0b3b38" }}>
      <TapResultView state={state} firstName={user.name.split(" ")[0]} onRetry={goToTapScreen} onDone={goToTapScreen} />
    </View>
  );
}
