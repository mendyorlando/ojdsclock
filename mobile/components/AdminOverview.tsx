import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { apiFetch } from "@/lib/api";

type TeacherRow = {
  id: string;
  name: string;
  title: string | null;
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

/**
 * What an admin sees instead of the personal "Hours" view (admins don't
 * clock in themselves) - a staff-wide summary plus a roster to drill into
 * any one teacher's hours. Mirrors the website's /admin overview page.
 */
export function AdminOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#17ab9d" />}
    >
      <Text style={styles.greeting}>Staff overview</Text>
      <Text style={styles.status}>
        {overview.clockedInNow} of {overview.totalStaff} currently clocked in
      </Text>

      <View style={styles.statsCard}>
        <Text style={styles.statsLabel}>This month</Text>
        <Text style={styles.statsValue}>{overview.totalHoursThisMonth}h</Text>
        <View style={styles.statsRow}>
          <View style={styles.statsCell}>
            <Text style={styles.statsCellValue}>{overview.totalHoursThisWeek}</Text>
            <Text style={styles.statsCellLabel}>Hours this week</Text>
          </View>
          <View style={styles.statsCell}>
            <Text style={styles.statsCellValue}>{overview.avgHoursThisMonth}</Text>
            <Text style={styles.statsCellLabel}>Avg per teacher</Text>
          </View>
          <View style={styles.statsCell}>
            <Text style={styles.statsCellValue}>{overview.topStreak}</Text>
            <Text style={styles.statsCellLabel}>Best streak</Text>
          </View>
        </View>
      </View>

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
              {row.hoursThisMonth}h this month{row.streak > 0 ? ` · ${row.streak}-day streak` : ""}
            </Text>
          </View>
          <View style={[styles.statusPill, row.currentlyIn ? styles.statusIn : styles.statusOut]}>
            <Text style={[styles.statusPillText, row.currentlyIn ? styles.statusInText : styles.statusOutText]}>
              {row.currentlyIn ? "In" : "Out"}
            </Text>
          </View>
        </Pressable>
      ))}
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
  statsCard: { backgroundColor: "#0f766e", borderRadius: 20, padding: 20, marginBottom: 24 },
  statsLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  statsValue: { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: 4 },
  statsRow: { flexDirection: "row", marginTop: 16, gap: 16 },
  statsCell: { flex: 1 },
  statsCellValue: { color: "#fff", fontSize: 18, fontWeight: "800" },
  statsCellLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", marginTop: 2 },
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
});
