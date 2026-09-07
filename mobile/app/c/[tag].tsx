import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, Redirect, router } from "expo-router";
import * as Location from "expo-location";
import { useAuth } from "@/lib/AuthContext";
import { useTapSubmission } from "@/lib/useTapSubmission";
import { TapResultView } from "@/components/TapResultView";

/**
 * Where a Universal Link lands. Two ways to get here:
 * - A tag tapped in the background (app closed): the link carries the
 *   tag's crypto payload - https://ojdsclock.vercel.app/c/chabad-door
 *   ?picc_data=...&cmac=... - verified the same way a live NFC read is.
 * - A printed QR-code backup scanned with the camera: the link is bare
 *   (no picc_data/cmac, since a QR code can't carry a live signature), so
 *   it's verified by GPS distance from the school instead (see
 *   checkWithinSchoolRadius on the server).
 * Same submission/result logic as a live NFC read in tap.tsx either way.
 */
export default function TapLinkScreen() {
  const { user, isLoading } = useAuth();
  const params = useLocalSearchParams<{ tag: string; picc_data?: string; cmac?: string }>();
  const { state, submit, setError } = useTapSubmission();

  // A used-up link can't just be retried (its counter is already
  // consumed) - send them to the tap screen to scan fresh instead.
  const goToTapScreen = () => router.replace("/(app)/tap");
  // Tapping/scanning a second tag while this screen is still showing the
  // first result updates this same screen's params rather than mounting a
  // fresh instance, so a plain "have we submitted yet" boolean would never
  // reset. Track which exact payload was last submitted instead, so a
  // genuinely new tap/scan (different tag/picc_data/cmac) always goes
  // through.
  const lastSubmittedKey = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !user || !params.tag) return;

    if (params.picc_data && params.cmac) {
      const key = `${params.tag}:${params.picc_data}:${params.cmac}`;
      if (lastSubmittedKey.current === key) return;
      lastSubmittedKey.current = key;
      submit({ tag: params.tag, piccData: params.picc_data, cmac: params.cmac });
      return;
    }

    // No crypto payload - this is a QR-code scan, not a tag tap.
    const key = `${params.tag}:geo`;
    if (lastSubmittedKey.current === key) return;
    lastSubmittedKey.current = key;

    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setError("We need your location to clock you in. Please allow location access and try again.");
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        submit({ tag: params.tag, lat: position.coords.latitude, lng: position.coords.longitude });
      } catch {
        setError("Couldn't get your location. Please try again.");
      }
    })();
  }, [isLoading, user, params.tag, params.picc_data, params.cmac, submit, setError]);

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

  if (!params.tag) {
    return <Redirect href="/(app)/tap" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0b3b38" }}>
      <TapResultView state={state} firstName={user.name.split(" ")[0]} onRetry={goToTapScreen} onDone={goToTapScreen} />
    </View>
  );
}
