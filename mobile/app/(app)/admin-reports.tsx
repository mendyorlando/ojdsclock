import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, Pressable, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { apiFetch, ApiError } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { getStoredSession } from "@/lib/auth";

type ReportRow = { id: string; name: string; payType: "HOURLY" | "JOB"; daysWorked: number; hours: number };
type Report = { from: string; to: string; totalHours: number; rows: ReportRow[] };

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

const RANGES = [
  {
    label: "This week",
    range: () => {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay()); // Sunday-start, matches the website
      return { from: start, to: now };
    },
  },
  {
    label: "This month",
    range: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    },
  },
  {
    label: "This year",
    range: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    },
  },
  {
    label: "All time",
    range: () => ({ from: new Date(2020, 0, 1), to: new Date() }),
  },
];

/** Admin-only: hours-by-teacher over a date range, plus CSV export via the share sheet. */
export default function AdminReportsScreen() {
  const [rangeIndex, setRangeIndex] = useState(1); // "This month", matches the website's default
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const { from, to } = RANGES[rangeIndex].range();
    try {
      const data = await apiFetch<Report>(`/api/admin/reports?from=${toDateInput(from)}&to=${toDateInput(to)}`);
      setReport(data);
      setError(false);
    } catch {
      setError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeIndex]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function onExport() {
    if (!report) return;
    setExporting(true);
    try {
      const session = await getStoredSession();
      const res = await fetch(`${API_BASE_URL}/admin/reports/export?from=${report.from}&to=${report.to}`, {
        headers: session ? { Authorization: `Bearer ${session.sessionId}` } : {},
      });
      if (!res.ok) throw new ApiError(res.status);
      const csv = await res.text();

      const file = new File(Paths.cache, `ojds-hours-${report.from}-to-${report.to}.csv`);
      if (file.exists) file.delete();
      file.create();
      file.write(csv);

      await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Export hours" });
    } catch {
      Alert.alert("Couldn't export", "Please check your connection and try again.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn&apos;t load the report. Check your connection and try again.</Text>
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
      <View style={styles.rangeRow}>
        {RANGES.map((r, i) => (
          <Pressable
            key={r.label}
            style={[styles.rangeChip, i === rangeIndex && styles.rangeChipActive]}
            onPress={() => setRangeIndex(i)}
          >
            <Text style={[styles.rangeChipText, i === rangeIndex && styles.rangeChipTextActive]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsLabel}>Total hours</Text>
        <Text style={styles.statsValue}>{report.totalHours}h</Text>
        <Text style={styles.statsSubtext}>
          Across {report.rows.length} teacher{report.rows.length === 1 ? "" : "s"}
        </Text>
      </View>

      <Pressable style={styles.exportButton} onPress={onExport} disabled={exporting}>
        {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.exportButtonText}>Export CSV</Text>}
      </Pressable>

      <Text style={styles.sectionTitle}>By teacher</Text>
      {report.rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowName}>{row.name}</Text>
            <Text style={styles.rowSub}>
              {row.payType === "HOURLY" ? "Hourly" : "Job"} · {row.daysWorked} day{row.daysWorked === 1 ? "" : "s"}
            </Text>
          </View>
          <Text style={styles.rowHours}>{row.hours}h</Text>
        </View>
      ))}
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
  rangeRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d5e5e3",
  },
  rangeChipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  rangeChipText: { fontWeight: "700", color: "#4b6b68", fontSize: 13 },
  rangeChipTextActive: { color: "#fff" },
  statsCard: { backgroundColor: "#0f766e", borderRadius: 20, padding: 20, marginBottom: 16 },
  statsLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  statsValue: { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: 4 },
  statsSubtext: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600", marginTop: 8 },
  exportButton: {
    backgroundColor: "#17ab9d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 24,
  },
  exportButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0b3b38", marginBottom: 10 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  rowLeft: { gap: 2 },
  rowName: { fontWeight: "700", color: "#0b3b38", fontSize: 14 },
  rowSub: { fontSize: 12, color: "#4b6b68", fontWeight: "600" },
  rowHours: { fontWeight: "800", color: "#0b3b38", fontSize: 15 },
});
