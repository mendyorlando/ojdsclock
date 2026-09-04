import { useCallback, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { apiFetch } from "@/lib/api";

type ClockEvent = { id: string; type: "IN" | "OUT"; timestamp: string; tagId: string };
type HistoryPage = { events: ClockEvent[]; nextCursor: string | null };

const TAG_LABELS: Record<string, string> = {
  "chabad-door": "Chabad Door",
  "ojds-door": "OJDS Door",
  "reminder-confirm": "Confirmed via reminder",
  "manual-entry": "Manual entry",
};

function tagLabel(tagId: string) {
  return TAG_LABELS[tagId] || tagId;
}

export default function HistoryScreen() {
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFirstPage = useCallback(async () => {
    const page = await apiFetch<HistoryPage>("/api/me/history");
    setEvents(page.events);
    setCursor(page.nextCursor);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFirstPage().finally(() => setLoading(false));
    }, [loadFirstPage]),
  );

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const page = await apiFetch<HistoryPage>(`/api/me/history?cursor=${cursor}`);
    setEvents((prev) => [...prev, ...page.events]);
    setCursor(page.nextCursor);
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={events}
      keyExtractor={(e) => e.id}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text style={styles.empty}>No clock events yet.</Text>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4faf9" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },
  empty: { textAlign: "center", color: "#4b6b68", marginTop: 40, fontWeight: "600" },
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
