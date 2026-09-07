import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { apiFetch } from "@/lib/api";
import { toDateInput } from "@/lib/dates";

type Closure = { id: string; date: string; label: string | null };
type CalendarData = { upcoming: Closure[]; past: Closure[] };
type UploadResult = { added: number; skipped: number };

function formatClosureDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

/** Admin-only: school closures (don't count against anyone's streak). Mirrors /admin/calendar. */
export default function AdminCalendarScreen() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newDate, setNewDate] = useState(() => new Date());
  const [newLabel, setNewLabel] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<CalendarData>("/api/admin/calendar");
      setData(result);
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

  async function onAdd() {
    setBusy(true);
    try {
      await apiFetch("/api/admin/calendar", {
        method: "POST",
        body: JSON.stringify({ date: toDateInput(newDate), label: newLabel }),
      });
      setNewLabel("");
      await load();
    } catch {
      Alert.alert("Couldn't add", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/calendar/${id}`, { method: "DELETE" });
      await load();
    } catch {
      Alert.alert("Couldn't remove", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadCsv() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "public.comma-separated-values-text"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    setUploading(true);
    try {
      const csv = await fetch(picked.assets[0].uri).then((r) => r.text());
      const result = await apiFetch<UploadResult>("/api/admin/calendar/upload", {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      Alert.alert(
        "Calendar updated",
        `Added ${result.added} date${result.added === 1 ? "" : "s"}.` +
          (result.skipped > 0 ? ` Skipped ${result.skipped} unreadable row(s).` : ""),
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

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn&apos;t load the calendar. Check your connection and try again.</Text>
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
      <Text style={styles.greeting}>School calendar</Text>
      <Text style={styles.status}>Dates here don&apos;t count against anyone&apos;s streak, same as Shabbos already doesn&apos;t.</Text>

      <Text style={styles.sectionTitle}>Upcoming closures</Text>
      {data.upcoming.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No upcoming closures on the calendar.</Text>
        </View>
      ) : (
        data.upcoming.map((c) => (
          <View key={c.id} style={styles.closureRow}>
            <View style={styles.closureLeft}>
              <Text style={styles.closureDate}>{formatClosureDate(c.date)}</Text>
              <Text style={styles.closureLabel}>{c.label || "—"}</Text>
            </View>
            <Pressable style={styles.removeButton} disabled={busy} onPress={() => onRemove(c.id)}>
              <Text style={styles.removeButtonText}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}

      {data.past.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Past</Text>
          {data.past.map((c) => (
            <View key={c.id} style={styles.closureRow}>
              <View style={styles.closureLeft}>
                <Text style={styles.closureDatePast}>{formatClosureDate(c.date)}</Text>
                <Text style={styles.closureLabel}>{c.label || "—"}</Text>
              </View>
              <Pressable style={styles.removeButton} disabled={busy} onPress={() => onRemove(c.id)}>
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Add one date</Text>
      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Date</Text>
        <Pressable
          style={styles.pickerField}
          onPress={() =>
            Platform.OS === "android"
              ? DateTimePickerAndroid.open({ value: newDate, mode: "date", onChange: (_e, d) => d && setNewDate(d) })
              : setShowDatePicker(true)
          }
        >
          <Text style={styles.pickerFieldText}>
            {newDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </Pressable>
        {Platform.OS === "ios" && showDatePicker && (
          <DateTimePicker
            value={newDate}
            mode="date"
            display="spinner"
            onChange={(_e, d) => {
              setShowDatePicker(false);
              if (d) setNewDate(d);
            }}
          />
        )}
        <Text style={styles.fieldLabel}>Label (optional)</Text>
        <TextInput style={styles.input} value={newLabel} onChangeText={setNewLabel} placeholder="e.g. Winter Break" />
        <Pressable style={styles.addButton} onPress={onAdd} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.addButtonText}>Add</Text>}
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Upload a calendar</Text>
      <View style={styles.formCard}>
        <Text style={styles.fieldSubtext}>
          A CSV with columns: date (YYYY-MM-DD), and an optional label. Existing dates get their label updated, new
          ones are added.
        </Text>
        <Pressable style={styles.addButton} onPress={onUploadCsv} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.addButtonText}>Choose CSV file</Text>}
        </Pressable>
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
  greeting: { fontSize: 22, fontWeight: "800", color: "#0b3b38" },
  status: { fontSize: 13, color: "#4b6b68", marginTop: 4, marginBottom: 20, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0b3b38", marginBottom: 10 },
  emptyCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5efee" },
  emptyText: { color: "#4b6b68", fontWeight: "600", fontSize: 13 },
  closureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  closureLeft: { flex: 1, marginRight: 12 },
  closureDate: { fontWeight: "700", color: "#0b3b38", fontSize: 13 },
  closureDatePast: { fontWeight: "700", color: "#4b6b68", fontSize: 13 },
  closureLabel: { fontSize: 12, color: "#4b6b68", fontWeight: "600", marginTop: 2 },
  removeButton: { backgroundColor: "#fde8e6", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  removeButtonText: { color: "#b5443a", fontWeight: "700", fontSize: 12 },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4b6b68",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 4,
  },
  fieldSubtext: { fontSize: 12, color: "#4b6b68", fontWeight: "600", marginBottom: 12 },
  input: {
    backgroundColor: "#f4faf9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#0b3b38",
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  pickerField: {
    backgroundColor: "#f4faf9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  pickerFieldText: { fontSize: 14, fontWeight: "700", color: "#0b3b38" },
  addButton: { backgroundColor: "#17ab9d", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  addButtonText: { color: "#fff", fontWeight: "700" },
});
