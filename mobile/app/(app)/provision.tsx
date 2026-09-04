import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import { runIsoDepSession, NfcCancelledError } from "@/lib/nfc";
import { provisionTag, Ntag424AuthError, Ntag424StatusError, Ntag424Error } from "@/lib/ntag424Provision";
import { hexToBytes } from "@/lib/crypto/aes";
import { NTAG_KEY_HEX, KNOWN_TAGS, API_BASE_URL } from "@/lib/config";

const KEY_SLOT = 1;

type StepState = "pending" | "active" | "done" | "failed";
type Step = { label: string; state: StepState };

function initialSteps(): Step[] {
  return [
    { label: "Selecting the tag's NDEF application", state: "pending" },
    { label: "Writing the tag's URL", state: "pending" },
    { label: "Authenticating with the factory-default key", state: "pending" },
    { label: "Setting the real secret key", state: "pending" },
    { label: "Configuring secure tap mirroring", state: "pending" },
  ];
}

export default function ProvisionScreen() {
  const [tagIndex, setTagIndex] = useState(0);
  const [steps, setSteps] = useState<Step[]>(initialSteps());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedTag = KNOWN_TAGS[tagIndex];

  async function handleProvision() {
    setRunning(true);
    setError(null);
    setSuccess(false);
    const freshSteps = initialSteps();
    setSteps(freshSteps);

    try {
      await runIsoDepSession(async (transceive) => {
        await provisionTag(
          transceive,
          {
            baseUrl: `${API_BASE_URL}/c/${selectedTag.id}`,
            key: hexToBytes(NTAG_KEY_HEX),
            keyNo: KEY_SLOT,
          },
          (label) => {
            setSteps((prev) => {
              const next = prev.map((s) => (s.state === "active" ? { ...s, state: "done" as StepState } : s));
              const idx = next.findIndex((s) => s.label === label);
              if (idx !== -1) next[idx] = { ...next[idx], state: "active" };
              return next;
            });
          },
        );
      });
      setSteps((prev) => prev.map((s) => ({ ...s, state: "done" as StepState })));
      setSuccess(true);
    } catch (err) {
      setSteps((prev) => prev.map((s) => (s.state === "active" ? { ...s, state: "failed" as StepState } : s)));

      if (err instanceof NfcCancelledError) {
        setError(null);
      } else if (err instanceof Ntag424AuthError) {
        setError(
          "This tag's master key doesn't match the factory default. It may already be configured, or from a " +
            "previous attempt - try a brand new, never-touched tag.",
        );
      } else if (err instanceof Ntag424StatusError) {
        setError(`The tag rejected this step (status ${err.sw1.toString(16)}${err.sw2.toString(16)}). ${err.message}`);
      } else if (err instanceof Ntag424Error) {
        setError(err.message);
      } else {
        setError("Couldn't complete setup. Make sure this is a genuine NTAG 424 DNA tag and try again.");
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set Up a New Tag</Text>
      <Text style={styles.subtitle}>
        Writes the tap URL, sets the tag's secret key, and configures secure mirroring - all in one tap. Use a
        brand new, never-configured tag.
      </Text>

      <Text style={styles.sectionLabel}>WHICH DOOR</Text>
      <View style={styles.tagRow}>
        {KNOWN_TAGS.map((tag, i) => (
          <Pressable
            key={tag.id}
            style={[styles.tagChip, i === tagIndex && styles.tagChipActive]}
            onPress={() => setTagIndex(i)}
            disabled={running}
          >
            <Text style={[styles.tagChipText, i === tagIndex && styles.tagChipTextActive]}>{tag.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.stepsCard}>
        {steps.map((step) => (
          <View key={step.label} style={styles.stepRow}>
            <Text style={styles.stepIcon}>
              {step.state === "done" ? "✓" : step.state === "failed" ? "✕" : step.state === "active" ? "…" : "○"}
            </Text>
            <Text
              style={[
                styles.stepText,
                step.state === "done" && styles.stepTextDone,
                step.state === "failed" && styles.stepTextFailed,
                step.state === "active" && styles.stepTextActive,
              ]}
            >
              {step.label}
            </Text>
          </View>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {success && <Text style={styles.success}>Tag configured successfully. Try tapping it on the Clock In/Out tab.</Text>}

      <Pressable style={[styles.button, running && styles.buttonDisabled]} onPress={handleProvision} disabled={running}>
        {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Hold Tag to Configure</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4faf9" },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: "800", color: "#0b3b38" },
  subtitle: { fontSize: 13, color: "#4b6b68", marginTop: 6, marginBottom: 20, fontWeight: "600" },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#4b6b68", letterSpacing: 1, marginBottom: 8 },
  tagRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d5e5e3",
  },
  tagChipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  tagChipText: { fontWeight: "700", color: "#4b6b68", fontSize: 13 },
  tagChipTextActive: { color: "#fff" },
  stepsCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5efee" },
  stepRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 },
  stepIcon: { width: 20, textAlign: "center", fontWeight: "800", color: "#c3d3d1" },
  stepText: { fontSize: 13, fontWeight: "600", color: "#c3d3d1" },
  stepTextActive: { color: "#0f766e" },
  stepTextDone: { color: "#0b3b38" },
  stepTextFailed: { color: "#b5443a" },
  error: { color: "#b5443a", fontWeight: "600", marginTop: 16, textAlign: "center" },
  success: { color: "#1a8f5e", fontWeight: "600", marginTop: 16, textAlign: "center" },
  button: {
    marginTop: 24,
    backgroundColor: "#17ab9d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
