import { useCallback, useEffect, useState } from "react";
import { View, Text, Image, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, Pressable, Switch, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { enableGeofence, disableGeofence, isGeofenceEnabled } from "@/lib/geofence";
import { AdminOverview } from "@/components/AdminOverview";

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

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

// Admins don't clock in themselves, so this personal hours view doesn't
// apply to them - they get the staff-wide overview instead. Split into
// two components (rather than an early-return inside one) so neither
// branch ever conditionally skips a hook.
export default function DashboardScreen() {
  const { user } = useAuth();
  if (user?.role === "ADMIN") return <AdminOverview />;
  return <TeacherDashboard />;
}

function TeacherDashboard() {
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
      <LinearGradient colors={["#17ab9d", "#0f766e"]} style={styles.hero}>
        <Image source={require("@/assets/full-ojds-logo.png")} style={styles.heroLogo} resizeMode="contain" />
        <Text style={styles.greeting}>
          {timeOfDayGreeting()}, {user?.name.split(" ")[0]}
        </Text>
        <View style={[styles.statusPill, summary.currentlyIn ? styles.statusPillIn : styles.statusPillOut]}>
          <Ionicons
            name={summary.currentlyIn ? "checkmark-circle" : "moon-outline"}
            size={15}
            color={summary.currentlyIn ? "#0b3b38" : "#fff"}
          />
          <Text style={[styles.statusPillText, summary.currentlyIn ? styles.statusPillTextIn : styles.statusPillTextOut]}>
            {summary.currentlyIn ? "Currently clocked in" : "Not clocked in right now"}
          </Text>
        </View>
      </LinearGradient>

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

      <View style={[styles.streakCard, summary.streak > 0 && styles.streakCardActive]}>
        <Ionicons
          name={summary.streak > 0 ? "flame" : "flame-outline"}
          size={22}
          color={summary.streak > 0 ? "#c2570a" : "#9db3b0"}
        />
        <Text style={[styles.streakText, summary.streak > 0 && styles.streakTextActive]}>
          {summary.streak > 0 ? `${summary.streak}-day streak` : "No streak yet - tap in today to start one"}
        </Text>
      </View>

      {summary.daysThisYear === 0 && (
        <View style={styles.welcomeCard}>
          <Ionicons name="hand-left-outline" size={22} color="#0f766e" />
          <Text style={styles.welcomeText}>
            Welcome to OJDS Clock! Tap your phone on the entrance tag to log your first hours.
          </Text>
        </View>
      )}

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
  hero: {
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  heroLogo: { width: 190, height: 90, marginBottom: 12 },
  greeting: { fontSize: 22, fontWeight: "800", color: "#fff", textAlign: "center" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 16,
  },
  statusPillIn: { backgroundColor: "#a7f3d0" },
  statusPillOut: { backgroundColor: "rgba(255,255,255,0.12)" },
  statusPillText: { fontSize: 13, fontWeight: "700" },
  statusPillTextIn: { color: "#0b3b38" },
  statusPillTextOut: { color: "#fff" },
  statsCard: { backgroundColor: "#0f766e", borderRadius: 20, padding: 20, marginBottom: 16 },
  statsLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  statsValue: { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: 4 },
  statsRow: { flexDirection: "row", marginTop: 16, gap: 16 },
  statsCell: { flex: 1 },
  statsCellValue: { color: "#fff", fontSize: 18, fontWeight: "800" },
  statsCellLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", marginTop: 2 },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  streakCardActive: { backgroundColor: "#fff3e8", borderColor: "#fbd9b5" },
  streakText: { fontWeight: "700", color: "#4b6b68", fontSize: 14 },
  streakTextActive: { fontWeight: "800", color: "#0b3b38" },
  welcomeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#e6f4f2",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  welcomeText: { flex: 1, color: "#0b3b38", fontWeight: "600", fontSize: 13, lineHeight: 18 },
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
