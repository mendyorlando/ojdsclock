import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, Pressable, Switch, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { enableGeofence, disableGeofence, isGeofenceEnabled } from "@/lib/geofence";

type DaySummary = {
  label: string;
  isToday: boolean;
  isFuture: boolean;
  hours: number;
  inProgress: boolean;
};

type Summary = {
  days: DaySummary[];
  streak: number;
  hoursThisWeek: number;
  hoursThisMonth: number;
  hoursThisYear: number;
  daysThisYear: number;
  currentlyIn: boolean;
};

export default function DashboardScreen() {
  const { user, signOut } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [geofenceOn, setGeofenceOn] = useState(false);
  const [geofenceBusy, setGeofenceBusy] = useState(false);

  useEffect(() => {
    isGeofenceEnabled().then(setGeofenceOn);
  }, []);

  async function onToggleGeofence(next: boolean) {
    setGeofenceBusy(true);
    try {
      if (next) {
        const result = await enableGeofence();
        if (result === "ok") {
          setGeofenceOn(true);
        } else {
          Alert.alert(
            "Location permission needed",
            result === "background_denied"
              ? "To remind you to clock out automatically, please allow location access \"Always\" in Settings."
              : "Please allow location access to enable clock-out reminders.",
          );
        }
      } else {
        await disableGeofence();
        setGeofenceOn(false);
      }
    } finally {
      setGeofenceBusy(false);
    }
  }

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Summary>("/api/me/summary");
      setSummary(data);
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

  if (error || !summary) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn&apos;t load your hours. Check your connection and try again.</Text>
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
      <Text style={styles.greeting}>{user?.name.split(" ")[0]}&apos;s hours</Text>
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

      <View style={styles.geofenceCard}>
        <View style={styles.geofenceTextWrap}>
          <Text style={styles.geofenceTitle}>Clock-out reminder</Text>
          <Text style={styles.geofenceSubtitle}>Get a reminder to clock out when you leave the school</Text>
        </View>
        {geofenceBusy ? (
          <ActivityIndicator />
        ) : (
          <Switch value={geofenceOn} onValueChange={onToggleGeofence} />
        )}
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
  weekCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#e5efee" },
  weekTitle: { fontWeight: "800", color: "#0b3b38", marginBottom: 10 },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  dayRowToday: { backgroundColor: "#fff3e8" },
  dayLabel: { fontWeight: "700", color: "#4b6b68", fontSize: 12 },
  dayHours: { fontWeight: "700", color: "#0b3b38" },
  geofenceCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5efee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  geofenceTextWrap: { flex: 1, marginRight: 12 },
  geofenceTitle: { fontWeight: "800", color: "#0b3b38", fontSize: 14 },
  geofenceSubtitle: { color: "#4b6b68", fontSize: 12, marginTop: 2, fontWeight: "600" },
  signOut: { marginTop: 32, alignItems: "center" },
  signOutText: { color: "#b5443a", fontWeight: "700" },
});
