import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, router, Stack } from "expo-router";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { apiFetch } from "@/lib/api";
import { tagLabel } from "@/lib/config";

type PendingRequest = { id: string; requestedStart: string; requestedEnd: string; reason: string };

type DaySummary = { label: string; isToday: boolean; isFuture: boolean; hours: number; inProgress: boolean };

type TeacherSummary = {
  name: string;
  username: string;
  title: string | null;
  payType: "HOURLY" | "PER_JOB";
  hasBoundDevice: boolean;
  pendingRequests: PendingRequest[];
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

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

function toTimeInput(d: Date) {
  return d.toTimeString().slice(0, 5);
}

function formatDateLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const t1 = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const t2 = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${t1} to ${t2}`;
}

/** Admin-only: a full editable view of one teacher - hours, history, info, device lock. */
export default function AdminTeacherScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [summary, setSummary] = useState<TeacherSummary | null>(null);
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const [filterFrom, setFilterFrom] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [filterTo, setFilterTo] = useState(() => new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Teacher-info edit form fields.
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [payType, setPayType] = useState<"HOURLY" | "PER_JOB">("HOURLY");

  // Add-hours form fields.
  const [addDate, setAddDate] = useState(() => new Date());
  const [addStart, setAddStart] = useState(() => new Date());
  const [addEnd, setAddEnd] = useState(() => new Date());
  const [showAddDatePicker, setShowAddDatePicker] = useState(false);
  const [showAddStartPicker, setShowAddStartPicker] = useState(false);
  const [showAddEndPicker, setShowAddEndPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summaryData, historyData] = await Promise.all([
        apiFetch<TeacherSummary>(`/api/admin/teacher/${id}`),
        apiFetch<HistoryPage>(
          `/api/admin/teacher/${id}/history?from=${toDateInput(filterFrom)}&to=${toDateInput(filterTo)}`,
        ),
      ]);
      setSummary(summaryData);
      setName(summaryData.name);
      setUsername(summaryData.username);
      setTitle(summaryData.title || "");
      setPayType(summaryData.payType);
      setEvents(historyData.events);
      setCursor(historyData.nextCursor);
      setError(false);
    } catch {
      setError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, filterFrom.getTime(), filterTo.getTime()]);

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
      const page = await apiFetch<HistoryPage>(
        `/api/admin/teacher/${id}/history?from=${toDateInput(filterFrom)}&to=${toDateInput(filterTo)}&cursor=${cursor}`,
      );
      setEvents((prev) => [...prev, ...page.events]);
      setCursor(page.nextCursor);
    } catch {
      // Leave `cursor` as-is so the next scroll-to-end retries the same page.
    } finally {
      setLoadingMore(false);
    }
  }

  async function onSaveInfo() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/teacher/${id}/update`, {
        method: "POST",
        body: JSON.stringify({ name, username, title, payType }),
      });
      await load();
      Alert.alert("Saved", "Teacher info updated.");
    } catch {
      Alert.alert("Couldn't save", "That username may already be taken, or something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onAddHours() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/teacher/${id}/hours`, {
        method: "POST",
        body: JSON.stringify({
          date: toDateInput(addDate),
          startTime: toTimeInput(addStart),
          endTime: toTimeInput(addEnd),
        }),
      });
      await load();
      Alert.alert("Added", "Hours added (only time not already on record).");
    } catch {
      Alert.alert("Couldn't add hours", "Make sure the end time is after the start time.");
    } finally {
      setBusy(false);
    }
  }

  async function onUnbindDevice() {
    Alert.alert("Unbind device?", "The next phone this account signs in from becomes its new locked device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unbind",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await apiFetch(`/api/admin/teacher/${id}/unbind-device`, { method: "POST" });
            await load();
          } catch {
            Alert.alert("Something went wrong", "Please try again.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  async function onResolveRequest(requestId: string, action: "approve" | "deny") {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/requests/${requestId}/${action}`, { method: "POST" });
      await load();
    } catch {
      Alert.alert("Something went wrong", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Teacher", headerBackTitle: "Overview" }} />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </>
    );
  }

  if (error || !summary) {
    return (
      <>
        <Stack.Screen options={{ title: "Teacher", headerBackTitle: "Overview" }} />
        <View style={styles.center}>
          <Text style={styles.errorText}>Couldn&apos;t load this teacher&apos;s hours. Check your connection and try again.</Text>
          <Pressable style={styles.retryButton} onPress={() => load()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </>
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
        ListEmptyComponent={<Text style={styles.empty}>No clock events in this range.</Text>}
        ListHeaderComponent={
          <View>
            <Text style={styles.status}>{summary.currentlyIn ? "Currently clocked in" : "Not clocked in right now"}</Text>

            {summary.pendingRequests.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.sectionTitle}>Pending requests</Text>
                {summary.pendingRequests.map((r) => (
                  <View key={r.id} style={styles.requestCard}>
                    <Text style={styles.requestRange}>{formatRange(r.requestedStart, r.requestedEnd)}</Text>
                    <Text style={styles.requestReason}>&quot;{r.reason}&quot;</Text>
                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.approveButton}
                        disabled={busy}
                        onPress={() => onResolveRequest(r.id, "approve")}
                      >
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </Pressable>
                      <Pressable style={styles.denyButton} disabled={busy} onPress={() => onResolveRequest(r.id, "deny")}>
                        <Text style={styles.denyButtonText}>Deny</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

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

            <Text style={styles.sectionTitle}>Filter history</Text>
            <View style={styles.customRow}>
              <Pressable
                style={styles.dateField}
                onPress={() =>
                  Platform.OS === "android"
                    ? DateTimePickerAndroid.open({
                        value: filterFrom,
                        mode: "date",
                        onChange: (_e, d) => d && setFilterFrom(d),
                      })
                    : setShowFromPicker(true)
                }
              >
                <Text style={styles.dateFieldLabel}>From</Text>
                <Text style={styles.dateFieldValue}>{formatDateLabel(filterFrom)}</Text>
              </Pressable>
              <Pressable
                style={styles.dateField}
                onPress={() =>
                  Platform.OS === "android"
                    ? DateTimePickerAndroid.open({
                        value: filterTo,
                        mode: "date",
                        onChange: (_e, d) => d && setFilterTo(d),
                      })
                    : setShowToPicker(true)
                }
              >
                <Text style={styles.dateFieldLabel}>To</Text>
                <Text style={styles.dateFieldValue}>{formatDateLabel(filterTo)}</Text>
              </Pressable>
            </View>
            {Platform.OS === "ios" && showFromPicker && (
              <DateTimePicker
                value={filterFrom}
                mode="date"
                display="spinner"
                onChange={(_e, d) => {
                  setShowFromPicker(false);
                  if (d) setFilterFrom(d);
                }}
              />
            )}
            {Platform.OS === "ios" && showToPicker && (
              <DateTimePicker
                value={filterTo}
                mode="date"
                display="spinner"
                onChange={(_e, d) => {
                  setShowToPicker(false);
                  if (d) setFilterTo(d);
                }}
              />
            )}

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>All history</Text>
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
        ListFooterComponentStyle={{ marginTop: 8 }}
        ListFooterComponent={() => (
          <View>
            {loadingMore && <ActivityIndicator style={{ marginVertical: 16 }} />}

            <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Teacher info</Text>
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} />
              <Text style={styles.fieldLabel}>Username</Text>
              <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Kindergarten Teacher"
              />
              <Text style={styles.fieldLabel}>Pay type</Text>
              <View style={styles.payTypeRow}>
                <Pressable
                  style={[styles.payTypeChip, payType === "HOURLY" && styles.payTypeChipActive]}
                  onPress={() => setPayType("HOURLY")}
                >
                  <Text style={[styles.payTypeChipText, payType === "HOURLY" && styles.payTypeChipTextActive]}>
                    Hourly
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.payTypeChip, payType === "PER_JOB" && styles.payTypeChipActive]}
                  onPress={() => setPayType("PER_JOB")}
                >
                  <Text style={[styles.payTypeChipText, payType === "PER_JOB" && styles.payTypeChipTextActive]}>
                    Job
                  </Text>
                </Pressable>
              </View>
              <Pressable style={styles.saveButton} onPress={onSaveInfo} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Add hours</Text>
            <View style={styles.formCard}>
              <Text style={styles.fieldSubtext}>Only adds time not already on record for that window.</Text>
              <Text style={styles.fieldLabel}>Date</Text>
              <Pressable
                style={styles.pickerField}
                onPress={() =>
                  Platform.OS === "android"
                    ? DateTimePickerAndroid.open({
                        value: addDate,
                        mode: "date",
                        onChange: (_e, d) => d && setAddDate(d),
                      })
                    : setShowAddDatePicker(true)
                }
              >
                <Text style={styles.pickerFieldText}>{formatDateLabel(addDate)}</Text>
              </Pressable>
              {Platform.OS === "ios" && showAddDatePicker && (
                <DateTimePicker
                  value={addDate}
                  mode="date"
                  display="spinner"
                  onChange={(_e, d) => {
                    setShowAddDatePicker(false);
                    if (d) setAddDate(d);
                  }}
                />
              )}
              <View style={styles.timeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>From</Text>
                  <Pressable
                    style={styles.pickerField}
                    onPress={() =>
                      Platform.OS === "android"
                        ? DateTimePickerAndroid.open({
                            value: addStart,
                            mode: "time",
                            onChange: (_e, d) => d && setAddStart(d),
                          })
                        : setShowAddStartPicker(true)
                    }
                  >
                    <Text style={styles.pickerFieldText}>{toTimeInput(addStart)}</Text>
                  </Pressable>
                  {Platform.OS === "ios" && showAddStartPicker && (
                    <DateTimePicker
                      value={addStart}
                      mode="time"
                      display="spinner"
                      onChange={(_e, d) => {
                        setShowAddStartPicker(false);
                        if (d) setAddStart(d);
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>To</Text>
                  <Pressable
                    style={styles.pickerField}
                    onPress={() =>
                      Platform.OS === "android"
                        ? DateTimePickerAndroid.open({
                            value: addEnd,
                            mode: "time",
                            onChange: (_e, d) => d && setAddEnd(d),
                          })
                        : setShowAddEndPicker(true)
                    }
                  >
                    <Text style={styles.pickerFieldText}>{toTimeInput(addEnd)}</Text>
                  </Pressable>
                  {Platform.OS === "ios" && showAddEndPicker && (
                    <DateTimePicker
                      value={addEnd}
                      mode="time"
                      display="spinner"
                      onChange={(_e, d) => {
                        setShowAddEndPicker(false);
                        if (d) setAddEnd(d);
                      }}
                    />
                  )}
                </View>
              </View>
              <Pressable style={styles.saveButton} onPress={onAddHours} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Add hours</Text>}
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Device lock</Text>
            <View style={styles.formCard}>
              <Text style={styles.fieldSubtext}>
                {summary.hasBoundDevice
                  ? "Locked to the phone this account first signed in on. Signing in from any other phone gets flagged on the Requests tab instead of letting them in."
                  : "Not bound yet. The next phone this account signs in from becomes its locked device."}
              </Text>
              {summary.hasBoundDevice && (
                <Pressable style={styles.unbindButton} onPress={onUnbindDevice} disabled={busy}>
                  <Text style={styles.unbindButtonText}>Unbind device</Text>
                </Pressable>
              )}
            </View>
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
  status: { fontSize: 13, color: "#4b6b68", marginBottom: 16, fontWeight: "600" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0b3b38", marginBottom: 10 },
  requestCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  requestRange: { fontWeight: "700", color: "#0b3b38", fontSize: 13 },
  requestReason: { color: "#4b6b68", fontSize: 13, marginTop: 4, fontStyle: "italic" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  approveButton: { flex: 1, backgroundColor: "#17ab9d", borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  approveButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  denyButton: { flex: 1, backgroundColor: "#fde8e6", borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  denyButtonText: { color: "#b5443a", fontWeight: "700", fontSize: 13 },
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
  customRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  dateField: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#d5e5e3" },
  dateFieldLabel: { fontSize: 10, fontWeight: "700", color: "#4b6b68", letterSpacing: 0.5, textTransform: "uppercase" },
  dateFieldValue: { fontSize: 14, fontWeight: "700", color: "#0b3b38", marginTop: 4 },
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
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#4b6b68", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6, marginTop: 10 },
  fieldSubtext: { fontSize: 12, color: "#4b6b68", fontWeight: "600", marginBottom: 8 },
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
  payTypeRow: { flexDirection: "row", gap: 8 },
  payTypeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#f4faf9",
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  payTypeChipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  payTypeChipText: { fontWeight: "700", color: "#4b6b68", fontSize: 13 },
  payTypeChipTextActive: { color: "#fff" },
  saveButton: { backgroundColor: "#17ab9d", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  saveButtonText: { color: "#fff", fontWeight: "700" },
  pickerField: {
    backgroundColor: "#f4faf9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  pickerFieldText: { fontSize: 14, fontWeight: "700", color: "#0b3b38" },
  timeRow: { flexDirection: "row", gap: 10 },
  unbindButton: { backgroundColor: "#fde8e6", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  unbindButtonText: { color: "#b5443a", fontWeight: "700" },
});
