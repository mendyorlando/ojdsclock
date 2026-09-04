import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { login as loginRequest } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Incorrect username or password.",
  device_pending: "This device needs admin approval before you can sign in. Ask your administrator to approve it.",
  network: "Couldn't reach the server. Check your connection and try again.",
};

export default function LoginScreen() {
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!username.trim() || !password) return;
    setSubmitting(true);
    setError(null);

    const result = await loginRequest(username.trim(), password);

    if (!result.ok) {
      setError(ERROR_MESSAGES[result.reason]);
      setSubmitting(false);
      return;
    }

    await refresh();
    router.replace("/(app)/dashboard");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text style={styles.title}>OJDS Clock</Text>
          <Text style={styles.subtitle}>Sign in to clock in or out</Text>

          <View style={styles.field}>
            <Text style={styles.label}>USERNAME</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              editable={!submitting}
              onSubmitEditing={handleSubmit}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>

          <Text style={styles.hint}>Stays signed in on this phone, so the next tap clocks you right in.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b3b38" },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", textAlign: "center" },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 6, marginBottom: 32 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.5)", letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
  },
  error: { color: "#ff8f8f", fontSize: 13, fontWeight: "600", marginBottom: 12, textAlign: "center" },
  button: {
    backgroundColor: "#17ab9d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hint: { color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center", marginTop: 16 },
});
