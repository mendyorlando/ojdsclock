import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, Pressable, Alert } from "react-native";
import { useFocusEffect, router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

type TeacherRow = {
  id: string;
  name: string;
  title: string | null;
  payType: "HOURLY" | "PER_JOB";
  currentlyIn: boolean;
  streak: number;
  hoursThisWeek: number;
  hoursThisMonth: number;
  hoursThisYear: number;
};

type Overview = {
  totalStaff: number;
  clockedInNow: number;
  totalHoursThisWeek: number;
  totalHoursThisMonth: number;
  avgHoursThisMonth: number;
  topStreak: number;
  rows: TeacherRow[];
};

type UploadResult = { created: number; updated: number; skipped: number };

/**
 * What an admin sees instead of the personal "Hours" view (admins don't
 * clock in themselves) - a staff-wide summary plus a roster to drill into
 * any one teacher's hours. Mirrors the website's /admin page.
 */
export function AdminOverview() {
  const { signOut } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Overview>("/api/admin/overview");
      setOverview(data);
      setError(false);
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

  async function onUploadRoster() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "public.comma-separated-values-text"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    setUploading(true);
    try {
      const csv = await fetch(picked.assets[0].uri).then((r) => r.text());
      const result = await apiFetch<UploadResult>("/api/admin/roster/upload", {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      Alert.alert(
        "Roster updated",
        `Created ${result.created} new teacher${result.created === 1 ? "" : "s"}. Updated ${result.updated}.` +
          (result.skipped > 0 ? ` Skipped ${result.skipped} row(s).` : ""),
      );
      await load();
    } catch {
      Alert.alert("Couldn't upload", "Please check the file and your connection, then try again.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !overview) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn&apos;t load staff overview. Check your connection and try again.</Text>
        <Pressable style={styles.retryButton} onPress={() => load()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const cards = [
    { label: "Total staff", value: String(overview.totalStaff), color: "#0b3b38" },
    { label: "Clocked in now", value: String(overview.clockedInNow), color: "#178a52" },
    { label: "Hours this week", value: String(overview.totalHoursThisWeek), color: "#0b3b38" },
    { label: "Hours this month", value: String(overview.totalHoursThisMonth), color: "#0b3b38" },
    { label: "Avg hrs / teacher", value: String(overview.avgHoursThisMonth), color: "#0b3b38" },
    { label: "Best streak", value: String(overview.topStreak), color: "#c2570a" },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#17ab9d" />}
    >
      <Text style={styles.greeting}>Staff overview</Text>
      <Text style={styles.status}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </Text>

      <View style={styles.cardsGrid}>
        {cards.map((c) => (
          <View key={c.label} style={styles.card}>
            <Text style={[styles.cardValue, { color: c.color }]}>{c.value}</Text>
            <Text style={styles.cardLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.whosInButton} onPress={() => router.push("/admin-whos-in")}>
        <Text style={styles.whosInButtonText}>See who&apos;s in the building</Text>
        <Text style={styles.whosInButtonArrow}>›</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Staff ({overview.totalStaff})</Text>
      {overview.rows.map((row) => (
        <Pressable
          key={row.id}
          style={styles.teacherCard}
          onPress={() => router.push({ pathname: "/admin-teacher/[id]", params: { id: row.id } })}
        >
          <View style={styles.teacherLeft}>
            <Text style={styles.teacherName}>{row.name}</Text>
            <Text style={styles.teacherSub}>
              {row.payType === "HOURLY" ? "Hourly" : "Job"} · {row.hoursThisWeek}h this week ·{" "}
              {row.hoursThisMonth}h this month
              {row.streak > 0 ? ` · ${row.streak}-day streak` : ""}
            </Text>
          </View>
          <View style={[styles.statusPill, row.currentlyIn ? styles.statusIn : styles.statusOut]}>
            <Text style={[styles.statusPillText, row.currentlyIn ? styles.statusInText : styles.statusOutText]}>
              {row.currentlyIn ? "In" : "Out"}
            </Text>
          </View>
        </Pressable>
      ))}

      <View style={styles.uploadCard}>
        <Text style={styles.uploadTitle}>Import teacher roster</Text>
        <Text style={styles.uploadSubtitle}>
          A CSV with columns: name, username, password, payType (Hourly or Job), and an optional title. Existing
          usernames are updated, new ones are created.
        </Text>
        <Pressable style={styles.uploadButton} onPress={onUploadRoster} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadButtonText}>Choose CSV file</Text>}
        </Pressable>
      </View>

      <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4faf9" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { color: "#4b6b68", fontWeight: "600", textAlign: "center", marginBottom: 16 },
  retryButton: { backgroundColor: "#17ab9d", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryButtonText: { color: "#fff", fontWeight: "700" },
  content: { padding: 20, paddingBottom: 48 },
  greeting: { fontSize: 22, fontWeight: "800", color: "#0b3b38" },
  status: { fontSize: 13, color: "#4b6b68", marginTop: 4, marginBottom: 20, fontWeight: "600" },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  card: {
    width: "31%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  cardValue: { fontSize: 20, fontWeight: "800" },
  cardLabel: { fontSize: 10, fontWeight: "700", color: "#4b6b68", marginTop: 2 },
  whosInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f766e",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 20,
  },
  whosInButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  whosInButtonArrow: { color: "#fff", fontWeight: "800", fontSize: 20 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0b3b38", marginBottom: 10 },
  teacherCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5efee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teacherLeft: { flex: 1, marginRight: 12 },
  teacherName: { fontWeight: "800", color: "#0b3b38", fontSize: 15 },
  teacherSub: { color: "#4b6b68", fontSize: 12, marginTop: 2, fontWeight: "600" },
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  statusIn: { backgroundColor: "#e3f7ec" },
  statusOut: { backgroundColor: "#f0f5f4" },
  statusPillText: { fontSize: 12, fontWeight: "800" },
  statusInText: { color: "#178a52" },
  statusOutText: { color: "#4b6b68" },
  uploadCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  uploadTitle: { fontWeight: "800", color: "#0b3b38", fontSize: 14 },
  uploadSubtitle: { color: "#4b6b68", fontSize: 12, marginTop: 4, marginBottom: 12, fontWeight: "600" },
  uploadButton: { backgroundColor: "#17ab9d", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  uploadButtonText: { color: "#fff", fontWeight: "700" },
  signOut: { marginTop: 32, alignItems: "center" },
  signOutText: { color: "#b5443a", fontWeight: "700" },
});
