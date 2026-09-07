import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { apiFetch, ApiError } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { getStoredSession } from "@/lib/auth";
import { toDateInput } from "@/lib/dates";

type ReportRow = { id: string; name: string; payType: "HOURLY" | "PER_JOB"; daysWorked: number; hours: number };
type Report = { from: string; to: string; totalHours: number; rows: ReportRow[] };

function formatDateLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PRESETS = [
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
  const [customFrom, setCustomFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [customTo, setCustomTo] = useState(() => new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  // Separate from `loading`: true only while re-fetching after the range
  // changes (or on refocus) when we already have a report on screen, so
  // switching ranges doesn't blank the whole screen back to a spinner.
  const [rangeLoading, setRangeLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const hasLoadedOnce = useRef(false);

  const isCustom = rangeIndex === PRESETS.length;
  // Memoized so this only recomputes when the actual selection changes -
  // PRESETS[i].range() captures `new Date()` as "to", so recomputing it on
  // every render (it's not memoized otherwise) makes the value drift by a
  // few ms each time, which kept `load` looking "new" to useFocusEffect
  // below and retriggered it in an infinite loop.
  const activeRange = useMemo(
    () => (isCustom ? { from: customFrom, to: customTo } : PRESETS[rangeIndex].range()),
    [isCustom, rangeIndex, customFrom, customTo],
  );

  const load = useCallback(async () => {
    const { from, to } = activeRange;
    try {
      const data = await apiFetch<Report>(`/api/admin/reports?from=${toDateInput(from)}&to=${toDateInput(to)}`);
      setReport(data);
      setError(false);
    } catch {
      setError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRange.from.getTime(), activeRange.to.getTime()]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) {
        load().finally(() => {
          setLoading(false);
          hasLoadedOnce.current = true;
        });
      } else {
        setRangeLoading(true);
        load().finally(() => setRangeLoading(false));
      }
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function pickFromDate() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: customFrom,
        mode: "date",
        onChange: (_e, date) => {
          if (date) setCustomFrom(date);
        },
      });
    } else {
      setShowFromPicker(true);
    }
  }

  function pickToDate() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: customTo,
        mode: "date",
        onChange: (_e, date) => {
          if (date) setCustomTo(date);
        },
      });
    } else {
      setShowToPicker(true);
    }
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
        {PRESETS.map((r, i) => (
          <Pressable
            key={r.label}
            style={[styles.rangeChip, i === rangeIndex && styles.rangeChipActive]}
            onPress={() => setRangeIndex(i)}
          >
            <Text style={[styles.rangeChipText, i === rangeIndex && styles.rangeChipTextActive]}>{r.label}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.rangeChip, isCustom && styles.rangeChipActive]}
          onPress={() => setRangeIndex(PRESETS.length)}
        >
          <Text style={[styles.rangeChipText, isCustom && styles.rangeChipTextActive]}>Custom</Text>
        </Pressable>
        {rangeLoading && <ActivityIndicator style={styles.rangeLoadingSpinner} />}
      </View>

      {isCustom && (
        <View style={styles.customRow}>
          <Pressable style={styles.dateField} onPress={pickFromDate}>
            <Text style={styles.dateFieldLabel}>From</Text>
            <Text style={styles.dateFieldValue}>{formatDateLabel(customFrom)}</Text>
          </Pressable>
          <Pressable style={styles.dateField} onPress={pickToDate}>
            <Text style={styles.dateFieldLabel}>To</Text>
            <Text style={styles.dateFieldValue}>{formatDateLabel(customTo)}</Text>
          </Pressable>
        </View>
      )}

      {Platform.OS === "ios" && showFromPicker && (
        <DateTimePicker
          value={customFrom}
          mode="date"
          display="spinner"
          onChange={(_e, date) => {
            setShowFromPicker(false);
            if (date) setCustomFrom(date);
          }}
        />
      )}
      {Platform.OS === "ios" && showToPicker && (
        <DateTimePicker
          value={customTo}
          mode="date"
          display="spinner"
          onChange={(_e, date) => {
            setShowToPicker(false);
            if (date) setCustomTo(date);
          }}
        />
      )}

      <View style={[styles.statsCard, rangeLoading && styles.statsCardLoading]}>
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
      <View style={rangeLoading && styles.statsCardLoading}>
        {report.rows.map((row) => (
          <Pressable
            key={row.id}
            style={styles.row}
            onPress={() => router.push({ pathname: "/admin-teacher/[id]", params: { id: row.id } })}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowName}>{row.name}</Text>
              <Text style={styles.rowSub}>
                {row.payType === "HOURLY" ? "Hourly" : "Job"} · {row.daysWorked} day{row.daysWorked === 1 ? "" : "s"}
              </Text>
            </View>
            <Text style={styles.rowHours}>{row.hours}h</Text>
          </Pressable>
        ))}
      </View>
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
  rangeRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" },
  rangeLoadingSpinner: { marginLeft: 4 },
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
  customRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  dateField: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d5e5e3",
  },
  dateFieldLabel: { fontSize: 10, fontWeight: "700", color: "#4b6b68", letterSpacing: 0.5, textTransform: "uppercase" },
  dateFieldValue: { fontSize: 14, fontWeight: "700", color: "#0b3b38", marginTop: 4 },
  statsCard: { backgroundColor: "#0f766e", borderRadius: 20, padding: 20, marginBottom: 16 },
  statsCardLoading: { opacity: 0.5 },
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
