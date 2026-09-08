import { useCallback, useState } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";

type TeacherRow = { id: string; name: string; currentlyIn: boolean };
type Overview = { rows: TeacherRow[] };

/**
 * A large, quick-to-scan list of who's currently clocked in - meant to be
 * usable at a glance in a real emergency (fire drill, etc.), not just a
 * filtered version of the roster table on Overview.
 */
export default function WhosInScreen() {
  const [names, setNames] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Overview>("/api/admin/overview");
      setNames(data.rows.filter((r) => r.currentlyIn).map((r) => r.name));
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

  // Set on every branch (loading/error/loaded) - Expo Router falls back to
  // the raw route filename and parent group folder name as the header
  // title/back-button label until a screen's own <Stack.Screen> renders,
  // which otherwise flashes "admin-whos-in" / "(app)" while this loads.
  const screenOptions = <Stack.Screen options={{ title: "Who's In", headerBackTitle: "Overview" }} />;

  if (loading) {
    return (
      <View style={styles.center}>
        {screenOptions}
        <ActivityIndicator />
      </View>
    );
  }

  if (error || names === null) {
    return (
      <View style={styles.center}>
        {screenOptions}
        <Text style={styles.errorText}>Couldn&apos;t load who&apos;s in. Check your connection and try again.</Text>
        <Pressable style={styles.retryButton} onPress={() => load()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      {screenOptions}
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={names}
        keyExtractor={(name, i) => `${name}-${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#17ab9d" />}
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <Ionicons name="people" size={28} color="#fff" />
            <Text style={styles.headerCount}>{names.length}</Text>
            <Text style={styles.headerLabel}>
              {names.length === 1 ? "person" : "people"} currently in the building
            </Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No one is currently clocked in.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={22} color="#178a52" />
            <Text style={styles.rowName}>{item}</Text>
          </View>
        )}
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
  headerCard: {
    backgroundColor: "#0f766e",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  headerCount: { color: "#fff", fontSize: 40, fontWeight: "800", marginTop: 8 },
  headerLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "700", marginTop: 2 },
  empty: { textAlign: "center", color: "#4b6b68", marginTop: 20, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  rowName: { fontWeight: "700", color: "#0b3b38", fontSize: 17 },
});
