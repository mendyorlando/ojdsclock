import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import type { SubmissionState } from "@/lib/useTapSubmission";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function TapResultView({
  state,
  firstName,
  onRetry,
  onDone,
}: {
  state: SubmissionState;
  firstName: string;
  onRetry: () => void;
  onDone: () => void;
}) {
  if (state.phase === "submitting" || state.phase === "idle") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (state.phase === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Couldn&apos;t clock you in</Text>
        <Text style={styles.errorMessage}>{state.message}</Text>
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const { data } = state;
  const isIn = data.type === "IN";

  return (
    <View style={styles.center}>
      <View style={[styles.badge, isIn ? styles.badgeIn : styles.badgeOut]}>
        <Text style={styles.badgeText}>{isIn ? "IN" : "OUT"}</Text>
      </View>
      <Text style={styles.resultTitle}>
        {data.duplicate
          ? `Already recorded, ${firstName}`
          : isIn
            ? `You're in, ${firstName}!`
            : `You're out, ${firstName}!`}
      </Text>
      <Text style={styles.resultSubtitle}>
        {isIn ? "Clocked in" : "Clocked out"} at {formatTime(data.timestamp)}
      </Text>

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

      <Pressable style={styles.button} onPress={onDone}>
        <Text style={styles.buttonText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  badgeIn: { backgroundColor: "#17ab9d" },
  badgeOut: { backgroundColor: "#b5651d" },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  resultTitle: { color: "#fff", fontSize: 24, fontWeight: "800", textAlign: "center" },
  resultSubtitle: { color: "rgba(255,255,255,0.6)", marginTop: 8, fontWeight: "600" },
  milestoneCard: {
    backgroundColor: "#d9782a",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 20,
  },
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
