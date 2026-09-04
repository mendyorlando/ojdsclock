import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import NfcManager from "react-native-nfc-manager";
import * as Haptics from "expo-haptics";
import { scanEntranceTag, NfcCancelledError, NfcInvalidTagError } from "@/lib/nfc";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

type ResultData = {
  type: "IN" | "OUT";
  timestamp: string;
  duplicate: boolean;
  hoursThisMonth: number;
  hoursThisYear: number;
  streak: number | null;
  milestone: number | null;
};

type State =
  | { phase: "checking" }
  | { phase: "unsupported" }
  | { phase: "idle" }
  | { phase: "scanning" }
  | { phase: "submitting" }
  | { phase: "error"; message: string }
  | { phase: "result"; data: ResultData };

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "That tag isn't valid. Please try again.",
  replayed: "That tag's link has already been used. Please tap again.",
  not_configured: "Something isn't set up right yet. Please contact your administrator.",
  too_far: "You don't seem to be at the school. Please try again once you're there.",
  not_a_nfc_tag: "That doesn't look like the entrance tag. Please try again.",
  read_failed: "Couldn't read the tag. Hold your phone steady over it and try again.",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function TapScreen() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ phase: "checking" });

  useEffect(() => {
    NfcManager.isSupported()
      .then((supported) => setState(supported ? { phase: "idle" } : { phase: "unsupported" }))
      .catch(() => setState({ phase: "unsupported" }));
  }, []);

  const handleTap = useCallback(async () => {
    setState({ phase: "scanning" });

    let payload;
    try {
      payload = await scanEntranceTag();
    } catch (err) {
      if (err instanceof NfcCancelledError) {
        setState({ phase: "idle" });
        return;
      }
      const message = err instanceof NfcInvalidTagError ? ERROR_MESSAGES.not_a_nfc_tag : ERROR_MESSAGES.read_failed;
      setState({ phase: "error", message });
      return;
    }

    setState({ phase: "submitting" });

    try {
      const data = await apiFetch<ResultData>(`/api/clock/${payload.tag}`, {
        method: "POST",
        body: JSON.stringify({ piccData: payload.piccData, cmac: payload.cmac }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (data.milestone) {
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 200);
      }
      setState({ phase: "result", data });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setState({ phase: "error", message: ERROR_MESSAGES[code ?? ""] ?? "Something went wrong. Please try again." });
    }
  }, []);

  if (state.phase === "checking") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state.phase === "unsupported") {
    return (
      <View style={styles.center}>
        <Text style={styles.unsupportedText}>
          This device doesn&apos;t support NFC, so tap-to-clock isn&apos;t available here.
        </Text>
      </View>
    );
  }

  if (state.phase === "result") {
    const { data } = state;
    const isIn = data.type === "IN";
    return (
      <View style={styles.center}>
        <View style={[styles.badge, isIn ? styles.badgeIn : styles.badgeOut]}>
          <Text style={styles.badgeText}>{isIn ? "IN" : "OUT"}</Text>
        </View>
        <Text style={styles.resultTitle}>
          {data.duplicate
            ? `Already recorded, ${user?.name.split(" ")[0]}`
            : isIn
              ? `You're in, ${user?.name.split(" ")[0]}!`
              : `You're out, ${user?.name.split(" ")[0]}!`}
        </Text>
        <Text style={styles.resultSubtitle}>{isIn ? "Clocked in" : "Clocked out"} at {formatTime(data.timestamp)}</Text>

        {isIn && data.milestone && (
          <View style={styles.milestoneCard}>
            <Text style={styles.milestoneText}>{data.milestone}-day streak!</Text>
          </View>
        )}
        {isIn && !data.milestone && data.streak !== null && data.streak > 0 && (
          <Text style={styles.streakText}>{data.streak}-day streak</Text>
        )}
        {!isIn && (
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>This month</Text>
            <Text style={styles.statsValue}>{data.hoursThisMonth} hours</Text>
          </View>
        )}

        <Pressable style={styles.button} onPress={() => setState({ phase: "idle" })}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  if (state.phase === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Couldn&apos;t clock you in</Text>
        <Text style={styles.errorMessage}>{state.message}</Text>
        <Pressable style={styles.button} onPress={handleTap}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Pressable
        style={[styles.tapButton, state.phase !== "idle" && styles.tapButtonBusy]}
        onPress={handleTap}
        disabled={state.phase !== "idle"}
      >
        {state.phase === "idle" ? (
          <Text style={styles.tapButtonText}>Tap to{"\n"}Clock In/Out</Text>
        ) : (
          <ActivityIndicator color="#fff" size="large" />
        )}
      </Pressable>
      {state.phase === "scanning" && <Text style={styles.hint}>Hold your phone near the entrance tag</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
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
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  badgeIn: { backgroundColor: "#17ab9d" },
  badgeOut: { backgroundColor: "#b5651d" },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  resultTitle: { color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center" },
  resultSubtitle: { color: "rgba(255,255,255,0.6)", marginTop: 8, fontWeight: "600" },
  milestoneCard: { backgroundColor: "#d9782a", borderRadius: 16, paddingHorizontal: 20, paddingVertical: 12, marginTop: 20 },
  milestoneText: { color: "#fff", fontWeight: "800" },
  streakText: { color: "#ffb066", fontWeight: "700", marginTop: 16 },
  statsCard: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, marginTop: 20, minWidth: 200 },
  statsLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  statsValue: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 4 },
  errorTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  errorMessage: { color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 8, fontWeight: "600" },
  button: { marginTop: 24, backgroundColor: "#17ab9d", borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  buttonText: { color: "#fff", fontWeight: "700" },
});
