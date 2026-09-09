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
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, ApiError } from "@/lib/api";

type RosterRow = { id: string; name: string; title: string | null };
type Overview = { rows: RosterRow[] };
type DeactivatedRow = { id: string; name: string; title: string | null };
type UploadResult = { created: number; updated: number; skipped: number };

/**
 * Everything admin-only that isn't day-to-day staff monitoring: adding,
 * removing, and editing employees (edit reuses the existing
 * admin-teacher/[id] screen), importing a roster CSV, and setting up a new
 * NFC tag. Replaces the old standalone "Setup Tag" tab.
 */
export default function SettingsScreen() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [payType, setPayType] = useState<"HOURLY" | "PER_JOB">("HOURLY");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [addedNames, setAddedNames] = useState<string[]>([]);

  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [deactivated, setDeactivated] = useState<DeactivatedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [overview, deactivatedResult] = await Promise.all([
        apiFetch<Overview>("/api/admin/overview"),
        apiFetch<{ rows: DeactivatedRow[] }>("/api/admin/teacher/deactivated"),
      ]);
      setRoster(overview.rows);
      setDeactivated(deactivatedResult.rows);
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

  async function onAddEmployee() {
    setUsernameError(null);
    if (!name.trim() || !username.trim() || !password.trim()) {
      Alert.alert("Missing info", "Name, username, and password are all required.");
      return;
    }
    setAddingEmployee(true);
    try {
      await apiFetch("/api/admin/teacher/create", {
        method: "POST",
        body: JSON.stringify({ name, username, password, title, payType }),
      });
      setAddedNames((prev) => [...prev, name.trim()]);
      setName("");
      setUsername("");
      setPassword("");
      setTitle("");
      setPayType("HOURLY");
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.code === "username_taken") {
        setUsernameError("That username is already taken.");
      } else {
        Alert.alert("Couldn't add employee", "Please check the fields and try again.");
      }
    } finally {
      setAddingEmployee(false);
    }
  }

  function onRemove(id: string, teacherName: string) {
    Alert.alert(`Remove ${teacherName}?`, "They won't be able to sign in and won't show on the active roster - but all their past hours stay on record. You can reactivate them later.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusyId(id);
          try {
            await apiFetch(`/api/admin/teacher/${id}/deactivate`, { method: "POST" });
            await load();
          } catch {
            Alert.alert("Something went wrong", "Please try again.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  async function onReactivate(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/api/admin/teacher/${id}/reactivate`, { method: "POST" });
      await load();
    } catch {
      Alert.alert("Something went wrong", "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onUploadRoster() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "public.comma-separated-values-text"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    setUploading(true);
    try {
      const csv = await fetch(picked.assets[0].uri).then((r) => r.text());
      const result = await apiFetch<UploadResult>("/api/admin/roster/upload", {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      Alert.alert(
        "Roster updated",
        `Created ${result.created} new teacher${result.created === 1 ? "" : "s"}. Updated ${result.updated}.` +
          (result.skipped > 0 ? ` Skipped ${result.skipped} row(s).` : ""),
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

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn&apos;t load settings. Check your connection and try again.</Text>
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
      <Text style={styles.sectionTitle}>Add employee</Text>
      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
        <Text style={styles.fieldLabel}>Username</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />
        {usernameError && <Text style={styles.error}>{usernameError}</Text>}
        <Text style={styles.fieldLabel}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry />
        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Kindergarten Teacher" />
        <Text style={styles.fieldLabel}>Pay type</Text>
        <View style={styles.payTypeRow}>
          <Pressable
            style={[styles.payTypeChip, payType === "HOURLY" && styles.payTypeChipActive]}
            onPress={() => setPayType("HOURLY")}
          >
            <Text style={[styles.payTypeChipText, payType === "HOURLY" && styles.payTypeChipTextActive]}>Hourly</Text>
          </Pressable>
          <Pressable
            style={[styles.payTypeChip, payType === "PER_JOB" && styles.payTypeChipActive]}
            onPress={() => setPayType("PER_JOB")}
          >
            <Text style={[styles.payTypeChipText, payType === "PER_JOB" && styles.payTypeChipTextActive]}>Job</Text>
          </Pressable>
        </View>
        <Pressable style={styles.saveButton} onPress={onAddEmployee} disabled={addingEmployee}>
          {addingEmployee ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Add employee</Text>}
        </Pressable>
        {addedNames.length > 0 && (
          <Text style={styles.addedText}>Added this session: {addedNames.join(", ")}</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Manage employees ({roster.length})</Text>
      {roster.length === 0 && <Text style={styles.empty}>No active staff yet.</Text>}
      {roster.map((row) => (
        <View key={row.id} style={styles.teacherRow}>
          <Pressable
            style={styles.teacherRowInfo}
            onPress={() => router.push({ pathname: "/admin-teacher/[id]", params: { id: row.id } })}
          >
            <Text style={styles.teacherName}>{row.name}</Text>
            {row.title && <Text style={styles.teacherTitle}>{row.title}</Text>}
          </Pressable>
          <Pressable style={styles.removeButton} onPress={() => onRemove(row.id, row.name)} disabled={busyId === row.id}>
            {busyId === row.id ? (
              <ActivityIndicator size="small" color="#b5443a" />
            ) : (
              <Text style={styles.removeButtonText}>Remove</Text>
            )}
          </Pressable>
        </View>
      ))}

      {deactivated.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Deactivated staff</Text>
          {deactivated.map((row) => (
            <View key={row.id} style={styles.teacherRow}>
              <View style={styles.teacherRowInfo}>
                <Text style={styles.teacherName}>{row.name}</Text>
                {row.title && <Text style={styles.teacherTitle}>{row.title}</Text>}
              </View>
              <Pressable
                style={styles.reactivateButton}
                onPress={() => onReactivate(row.id)}
                disabled={busyId === row.id}
              >
                {busyId === row.id ? (
                  <ActivityIndicator size="small" color="#17ab9d" />
                ) : (
                  <Text style={styles.reactivateButtonText}>Reactivate</Text>
                )}
              </Pressable>
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Import roster (CSV)</Text>
      <View style={styles.uploadCard}>
        <Text style={styles.uploadSubtitle}>
          A CSV with columns: name, username, password, payType (Hourly or Job), and an optional title. Existing
          usernames are updated, new ones are created.
        </Text>
        <Pressable style={styles.uploadButton} onPress={onUploadRoster} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadButtonText}>Choose CSV file</Text>}
        </Pressable>
      </View>

      <Pressable style={styles.setupTagCard} onPress={() => router.push("/provision")}>
        <Ionicons name="construct-outline" size={20} color="#0f766e" />
        <Text style={styles.setupTagText}>Set up tag</Text>
        <Ionicons name="chevron-forward" size={18} color="#4b6b68" />
      </Pressable>
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
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0b3b38", marginBottom: 10, marginTop: 20 },
  empty: { color: "#4b6b68", fontWeight: "600", marginBottom: 10 },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
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
    marginTop: 10,
  },
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
  error: { color: "#b5443a", fontWeight: "600", fontSize: 12, marginTop: 6 },
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
  addedText: { color: "#4b6b68", fontWeight: "600", fontSize: 12, marginTop: 12 },
  teacherRow: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5efee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teacherRowInfo: { flex: 1, marginRight: 12 },
  teacherName: { fontWeight: "800", color: "#0b3b38", fontSize: 14 },
  teacherTitle: { color: "#4b6b68", fontSize: 12, marginTop: 2, fontWeight: "600" },
  removeButton: { backgroundColor: "#fde8e6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  removeButtonText: { color: "#b5443a", fontWeight: "700", fontSize: 12 },
  reactivateButton: { backgroundColor: "#e3f7f4", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  reactivateButtonText: { color: "#17ab9d", fontWeight: "700", fontSize: 12 },
  uploadCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  uploadSubtitle: { color: "#4b6b68", fontSize: 12, marginBottom: 12, fontWeight: "600" },
  uploadButton: { backgroundColor: "#17ab9d", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  uploadButtonText: { color: "#fff", fontWeight: "700" },
  setupTagCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#e5efee",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  setupTagText: { flex: 1, fontWeight: "800", color: "#0b3b38", fontSize: 14 },
});
