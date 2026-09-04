import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import NfcManager from "react-native-nfc-manager";
import { scanEntranceTag, NfcCancelledError, NfcInvalidTagError } from "@/lib/nfc";
import { useTapSubmission, ERROR_MESSAGES } from "@/lib/useTapSubmission";
import { TapResultView } from "@/components/TapResultView";
import { useAuth } from "@/lib/AuthContext";

type NfcReadState = { phase: "checking" } | { phase: "unsupported" } | { phase: "idle" } | { phase: "scanning" };

export default function TapScreen() {
  const { user } = useAuth();
  const [nfcState, setNfcState] = useState<NfcReadState>({ phase: "checking" });
  const { state, submit, reset, setError } = useTapSubmission();

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b3b38" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b3b38", padding: 32 },
  unsupportedText: { color: "#fff", textAlign: "center", fontWeight: "600" },
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
});
