import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet, AppState } from "react-native";
import { useFocusEffect, useIsFocused } from "expo-router";
import NfcManager from "react-native-nfc-manager";
import { scanEntranceTag, NfcCancelledError, NfcInvalidTagError } from "@/lib/nfc";
import { useTapSubmission, ERROR_MESSAGES } from "@/lib/useTapSubmission";
import { TapResultView } from "@/components/TapResultView";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";

type NfcReadState = { phase: "checking" } | { phase: "unsupported" } | { phase: "idle" } | { phase: "scanning" };

export default function TapScreen() {
  const { user } = useAuth();
  const [nfcState, setNfcState] = useState<NfcReadState>({ phase: "checking" });
  const { state, submit, reset, setError } = useTapSubmission();
  const isFocused = useIsFocused();
  const [currentlyIn, setCurrentlyIn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ currentlyIn: boolean }>("/api/me/summary")
        .then((d) => setCurrentlyIn(d.currentlyIn))
        .catch(() => {});
    }, []),
  );

  // Reflect the tap's outcome immediately instead of waiting for the
  // next focus-triggered refetch.
  useEffect(() => {
    if (state.phase === "result") setCurrentlyIn(state.data.type === "IN");
  }, [state]);

  useEffect(() => {
    NfcManager.isSupported()
      .then((supported) => setNfcState(supported ? { phase: "idle" } : { phase: "unsupported" }))
      .catch(() => setNfcState({ phase: "unsupported" }));
  }, []);

  const handleTap = useCallback(async () => {
    setNfcState({ phase: "scanning" });

    let payload;
    try {
      payload = await scanEntranceTag();
    } catch (err) {
      setNfcState({ phase: "idle" });
      if (err instanceof NfcCancelledError) {
        reset();
        return;
      }
      const message = err instanceof NfcInvalidTagError ? ERROR_MESSAGES.not_a_nfc_tag : ERROR_MESSAGES.read_failed;
      setError(message);
      return;
    }

    setNfcState({ phase: "idle" });
    await submit(payload);
  }, [submit, reset, setError]);

  // Keep a reader session open the whole time this tab is on screen (and
  // the app is in the foreground), so tapping the tag works right away -
  // no "start scan" button press needed. Re-armed automatically after
  // every read (success or read failure) as long as we're still here;
  // paused while a result/error card is showing, or while backgrounded.
  const handleTapRef = useRef(handleTap);
  handleTapRef.current = handleTap;

  useEffect(() => {
    if (!isFocused || nfcState.phase !== "idle" || state.phase !== "idle") return;
    if (AppState.currentState !== "active") return;

    let cancelled = false;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && !cancelled) handleTapRef.current();
    });
    handleTapRef.current();

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [isFocused, nfcState.phase, state.phase]);

  // Navigating away mid-scan leaves the reader session running (Core NFC
  // isn't tied to which tab is showing) - tear it down explicitly so the
  // system "Hold near reader" sheet doesn't linger over another tab.
  useEffect(() => {
    if (!isFocused) NfcManager.cancelTechnologyRequest().catch(() => {});
  }, [isFocused]);

  if (nfcState.phase === "checking") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (nfcState.phase === "unsupported") {
    return (
      <View style={styles.center}>
        <Text style={styles.unsupportedText}>
          This device doesn&apos;t support NFC, so tap-to-clock isn&apos;t available here.
        </Text>
      </View>
    );
  }

  if (state.phase !== "idle") {
    return (
      <View style={styles.screen}>
        <TapResultView
          state={state}
          firstName={user?.name.split(" ")[0] ?? ""}
          onRetry={handleTap}
          onDone={reset}
        />
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Image source={require("@/assets/ojds-logo.png")} style={styles.logo} resizeMode="contain" />
      <Pressable
        style={[styles.tapButton, nfcState.phase === "scanning" && styles.tapButtonBusy]}
        onPress={handleTap}
        disabled={nfcState.phase === "scanning"}
      >
        {nfcState.phase === "idle" ? (
          <Text style={styles.tapButtonText}>Tap to{"\n"}Clock In/Out</Text>
        ) : (
          <ActivityIndicator color="#fff" size="large" />
        )}
      </Pressable>
      {nfcState.phase === "scanning" && <Text style={styles.hint}>Hold your phone near the entrance tag</Text>}
      {currentlyIn !== null && (
        <Text style={styles.statusText}>{currentlyIn ? "Currently clocked in" : "Currently clocked out"}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b3b38" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b3b38", padding: 32 },
  unsupportedText: { color: "#fff", textAlign: "center", fontWeight: "600" },
  logo: { width: 96, height: 96, marginBottom: 28 },
  tapButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#17ab9d",
    alignItems: "center",
    justifyContent: "center",
  },
  tapButtonBusy: { opacity: 0.7 },
  tapButtonText: { color: "#fff", fontWeight: "800", fontSize: 22, textAlign: "center" },
  hint: { color: "rgba(255,255,255,0.7)", marginTop: 20, fontWeight: "600" },
  statusText: { color: "rgba(255,255,255,0.8)", marginTop: 24, fontWeight: "700", fontSize: 13 },
});
