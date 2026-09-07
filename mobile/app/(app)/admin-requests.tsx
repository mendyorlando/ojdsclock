import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, Pressable, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import { apiFetch } from "@/lib/api";

type DeviceRequest = { id: string; userId: string; userName: string; deviceLabel: string | null; createdAt: string };
type ResolvedDeviceRequest = DeviceRequest & { status: "APPROVED" | "DENIED"; resolvedAt: string | null };

type CorrectionRequest = {
  id: string;
  userId: string;
  userName: string;
  requestedStart: string;
  requestedEnd: string;
  reason: string;
  createdAt: string;
};
type ResolvedCorrectionRequest = CorrectionRequest & { status: "APPROVED" | "DENIED"; resolvedAt: string | null };

function formatWhen(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

function formatRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const t1 = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const t2 = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${t1} to ${t2}`;
}

/**
 * Admin-only: mirrors src/app/admin/devices and src/app/admin/requests on
 * the website, combined into one screen since both are the same
 * "quick approve/deny from your phone" shape.
 */
export default function AdminRequestsScreen() {
  const [devicePending, setDevicePending] = useState<DeviceRequest[]>([]);
  const [deviceResolved, setDeviceResolved] = useState<ResolvedDeviceRequest[]>([]);
  const [correctionPending, setCorrectionPending] = useState<CorrectionRequest[]>([]);
  const [correctionResolved, setCorrectionResolved] = useState<ResolvedCorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [devices, requests] = await Promise.all([
        apiFetch<{ pending: DeviceRequest[]; resolved: ResolvedDeviceRequest[] }>("/api/admin/devices"),
        apiFetch<{ pending: CorrectionRequest[]; resolved: ResolvedCorrectionRequest[] }>("/api/admin/requests"),
      ]);
      setDevicePending(devices.pending);
      setDeviceResolved(devices.resolved);
      setCorrectionPending(requests.pending);
      setCorrectionResolved(requests.resolved);
      setError(false);
      // Keep the app icon badge in sync with what's actually still
      // pending, so resolving requests here clears it immediately
      // instead of waiting for the next push to recompute it.
      Notifications.setBadgeCountAsync(devices.pending.length + requests.pending.length).catch(() => {});
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function resolve(kind: "devices" | "requests", id: string, action: "approve" | "deny") {
    setBusyId(id);
    try {
      await apiFetch(`/api/admin/${kind}/${id}/${action}`, { method: "POST" });
      await load();
    } catch {
      Alert.alert("Something went wrong", "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn&apos;t load requests. Check your connection and try again.</Text>
        <Pressable style={styles.retryButton} onPress={() => load()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#17ab9d" />}
    >
      <Text style={styles.sectionTitle}>Device sign-in requests</Text>
      {devicePending.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No pending device requests.</Text>
        </View>
      ) : (
        devicePending.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardTitle}>{r.userName}</Text>
            <Text style={styles.cardSubtitle}>Tried to sign in from {r.deviceLabel || "an unrecognized device"}</Text>
            <Text style={styles.cardMeta}>{formatWhen(r.createdAt)}</Text>
            <View style={styles.actionRow}>
              <Pressable
                style={styles.approveButton}
                disabled={busyId === r.id}
                onPress={() => resolve("devices", r.id, "approve")}
              >
                {busyId === r.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.approveButtonText}>Approve this device</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.denyButton}
                disabled={busyId === r.id}
                onPress={() => resolve("devices", r.id, "deny")}
              >
                <Text style={styles.denyButtonText}>Deny</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {deviceResolved.length > 0 && (
        <View style={styles.resolvedCard}>
          {deviceResolved.map((r, i) => (
            <View key={r.id} style={[styles.resolvedRow, i % 2 === 1 && styles.resolvedRowAlt]}>
              <Text style={styles.resolvedName}>{r.userName}</Text>
              <View style={[styles.statusPill, r.status === "APPROVED" ? styles.statusGood : styles.statusBad]}>
                <Text
                  style={[styles.statusPillText, r.status === "APPROVED" ? styles.statusGoodText : styles.statusBadText]}
                >
                  {r.status === "APPROVED" ? "Approved" : "Denied"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Hour correction requests</Text>
      {correctionPending.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No pending requests.</Text>
        </View>
      ) : (
        correctionPending.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardTitle}>{r.userName}</Text>
            <Text style={styles.cardSubtitle}>{formatRange(r.requestedStart, r.requestedEnd)}</Text>
            <Text style={styles.cardReason}>&quot;{r.reason}&quot;</Text>
            <View style={styles.actionRow}>
              <Pressable
                style={styles.approveButton}
                disabled={busyId === r.id}
                onPress={() => resolve("requests", r.id, "approve")}
              >
                {busyId === r.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.approveButtonText}>Approve</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.denyButton}
                disabled={busyId === r.id}
                onPress={() => resolve("requests", r.id, "deny")}
              >
                <Text style={styles.denyButtonText}>Deny</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {correctionResolved.length > 0 && (
        <View style={styles.resolvedCard}>
          {correctionResolved.map((r, i) => (
            <View key={r.id} style={[styles.resolvedRow, i % 2 === 1 && styles.resolvedRowAlt]}>
              <Text style={styles.resolvedName}>{r.userName}</Text>
              <View style={[styles.statusPill, r.status === "APPROVED" ? styles.statusGood : styles.statusBad]}>
                <Text
                  style={[styles.statusPillText, r.status === "APPROVED" ? styles.statusGoodText : styles.statusBadText]}
                >
                  {r.status === "APPROVED" ? "Approved" : "Denied"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4faf9" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#f4faf9" },
  errorText: { color: "#4b6b68", fontWeight: "600", textAlign: "center", marginBottom: 16 },
  retryButton: { backgroundColor: "#17ab9d", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryButtonText: { color: "#fff", fontWeight: "700" },
  content: { padding: 20, paddingBottom: 48 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0b3b38", marginBottom: 10 },
  sectionSpacing: { marginTop: 28 },
  emptyCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5efee" },
  emptyText: { color: "#4b6b68", fontWeight: "600", fontSize: 13 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5efee" },
  cardTitle: { fontWeight: "800", color: "#0b3b38", fontSize: 15 },
  cardSubtitle: { color: "#4b6b68", fontWeight: "600", fontSize: 13, marginTop: 4 },
  cardMeta: { color: "#9db3b0", fontWeight: "600", fontSize: 11, marginTop: 4 },
  cardReason: { color: "#0b3b38", fontWeight: "600", fontSize: 13, marginTop: 6, fontStyle: "italic" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  approveButton: {
    flex: 1,
    backgroundColor: "#17ab9d",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  approveButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  denyButton: {
    flex: 1,
    backgroundColor: "#fde8e6",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  denyButtonText: { color: "#b5443a", fontWeight: "700", fontSize: 13 },
  resolvedCard: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e5efee", overflow: "hidden", marginTop: 4 },
  resolvedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resolvedRowAlt: { backgroundColor: "#f4faf9" },
  resolvedName: { fontWeight: "700", color: "#0b3b38", fontSize: 13 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusGood: { backgroundColor: "#e3f7ec" },
  statusBad: { backgroundColor: "#fde8e6" },
  statusPillText: { fontSize: 11, fontWeight: "800" },
  statusGoodText: { color: "#178a52" },
  statusBadText: { color: "#b5443a" },
});
