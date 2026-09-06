import { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, useFocusEffect, router, Stack } from "expo-router";
import { apiFetch } from "@/lib/api";
import { tagLabel } from "@/lib/config";

type DaySummary = { label: string; isToday: boolean; isFuture: boolean; hours: number; inProgress: boolean };

type TeacherSummary = {
  name: string;
  title: string | null;
  days: DaySummary[];
  streak: number;
  hoursThisWeek: number;
  hoursThisMonth: number;
  hoursThisYear: number;
  daysThisYear: number;
  currentlyIn: boolean;
};

type ClockEvent = { id: string; type: "IN" | "OUT"; timestamp: string; tagId: string };
type HistoryPage = { events: ClockEvent[]; nextCursor: string | null };

/** Admin-only: a read-only view of one teacher's hours and history. */
export default function AdminTeacherScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [summary, setSummary] = useState<TeacherSummary | null>(null);
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summaryData, historyData] = await Promise.all([
        apiFetch<TeacherSummary>(`/api/admin/teacher/${id}`),
        apiFetch<HistoryPage>(`/api/admin/teacher/${id}/history`),
      ]);
      setSummary(summaryData);
      setEvents(historyData.events);
      setCursor(historyData.nextCursor);
      setError(false);
    } catch {
      setError(true);
    }
  }, [id]);

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

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<HistoryPage>(`/api/admin/teacher/${id}/history?cursor=${cursor}`);
      setEvents((prev) => [...prev, ...page.events]);
      setCursor(page.nextCursor);
    } catch {
      // Leave `cursor` as-is so the next scroll-to-end retries the same page.
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !summary) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn&apos;t load this teacher&apos;s hours. Check your connection and try again.</Text>
        <Pressable style={styles.retryButton} onPress={() => load()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: summary.name, headerBackTitle: "Overview" }} />
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={events}
        keyExtractor={(e) => e.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#17ab9d" />}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        ListEmptyComponent={<Text style={styles.empty}>No clock events yet.</Text>}
        ListHeaderComponent={
          <View>
            <Text style={styles.status}>{summary.currentlyIn ? "Currently clocked in" : "Not clocked in right now"}</Text>

            <View style={styles.statsCard}>
              <Text style={styles.statsLabel}>This month</Text>
              <Text style={styles.statsValue}>{summary.hoursThisMonth}h</Text>
              <View style={styles.statsRow}>
                <View style={styles.statsCell}>
                  <Text style={styles.statsCellValue}>{summary.hoursThisWeek}</Text>
                  <Text style={styles.statsCellLabel}>This week</Text>
                </View>
                <View style={styles.statsCell}>
                  <Text style={styles.statsCellValue}>{summary.hoursThisYear}</Text>
                  <Text style={styles.statsCellLabel}>This year</Text>
                </View>
                <View style={styles.statsCell}>
                  <Text style={styles.statsCellValue}>{summary.daysThisYear}</Text>
                  <Text style={styles.statsCellLabel}>Days this year</Text>
                </View>
              </View>
            </View>

            <View style={styles.streakCard}>
              <Text style={styles.streakText}>{summary.streak}-day streak</Text>
            </View>

            <View style={styles.weekCard}>
              <Text style={styles.weekTitle}>This week</Text>
              {summary.days.map((day) => (
                <View key={day.label} style={[styles.dayRow, day.isToday && styles.dayRowToday]}>
                  <Text style={styles.dayLabel}>{day.label}</Text>
                  <Text style={styles.dayHours}>
                    {day.isFuture ? "Not yet" : day.hours > 0 ? `${day.hours}h` : day.inProgress ? "In progress" : "-"}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>All history</Text>
          </View>
        }
        renderItem={({ item }) => {
          const date = new Date(item.timestamp);
          return (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.date}>
                  {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
                <Text style={styles.tag}>{tagLabel(item.tagId)}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.type, item.type === "IN" ? styles.typeIn : styles.typeOut]}>{item.type}</Text>
                <Text style={styles.time}>
                  {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4faf9" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#f4faf9" },
  errorText: { color: "#4b6b68", fontWeight: "600", textAlign: "center", marginBottom: 16 },
  retryButton: { backgroundColor: "#17ab9d", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryButtonText: { color: "#fff", fontWeight: "700" },
  content: { padding: 20, paddingBottom: 48 },
  status: { fontSize: 13, color: "#4b6b68", marginBottom: 16, fontWeight: "600" },
  statsCard: { backgroundColor: "#0f766e", borderRadius: 20, padding: 20, marginBottom: 16 },
  statsLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  statsValue: { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: 4 },
  statsRow: { flexDirection: "row", marginTop: 16, gap: 16 },
  statsCell: { flex: 1 },
  statsCellValue: { color: "#fff", fontSize: 18, fontWeight: "800" },
  statsCellLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", marginTop: 2 },
  streakCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  streakText: { fontWeight: "800", color: "#0b3b38", fontSize: 15 },
  weekCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#e5efee", marginBottom: 20 },
  weekTitle: { fontWeight: "800", color: "#0b3b38", marginBottom: 10 },
  dayRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10 },
  dayRowToday: { backgroundColor: "#fff3e8" },
  dayLabel: { fontWeight: "700", color: "#4b6b68", fontSize: 12 },
  dayHours: { fontWeight: "700", color: "#0b3b38" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0b3b38", marginBottom: 10 },
  empty: { textAlign: "center", color: "#4b6b68", marginTop: 20, fontWeight: "600" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  rowLeft: { gap: 2 },
  rowRight: { alignItems: "flex-end", gap: 2 },
  date: { fontWeight: "700", color: "#0b3b38" },
  tag: { fontSize: 12, color: "#4b6b68", fontWeight: "600" },
  type: { fontWeight: "800", fontSize: 12 },
  typeIn: { color: "#1a8f5e" },
  typeOut: { color: "#4b6b68" },
  time: { fontSize: 12, color: "#4b6b68", fontWeight: "600" },
});
