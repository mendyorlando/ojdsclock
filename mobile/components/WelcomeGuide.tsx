import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

/**
 * Shown once, the first time a teacher reaches the dashboard. Explains the
 * tap-to-clock flow and - most importantly - primes them for the iOS
 * location prompt that follows right after this closes, since "Always
 * Allow" isn't the default choice iOS suggests and a confused "While Using"
 * tap would silently break the clock-out reminder.
 */
export function WelcomeGuide({ visible, onDismiss }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Welcome to OJDS Clock</Text>
          <Text style={styles.subtitle}>Two things to know before you start.</Text>

          <View style={styles.card}>
            <Ionicons name="hand-left-outline" size={22} color="#0f766e" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Clocking in is automatic</Text>
              <Text style={styles.cardBody}>
                Just tap your phone on the tag by the entrance when you arrive, and again when you leave. No need
                to open the app or press anything.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Ionicons name="navigate-outline" size={22} color="#0f766e" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Turn on Location - choose &quot;Always&quot;</Text>
              <Text style={styles.cardBody}>
                Next, your phone will ask to use your location. Please choose{" "}
                <Text style={styles.bold}>Always Allow</Text> (not &quot;While Using the App&quot;). This lets OJDS
                Clock notice when you&apos;ve left the building, so it can remind you to clock out if you forget.
              </Text>
              <Text style={[styles.cardBody, styles.emphasis]}>
                We never see, track, or store your actual location. The app only checks whether you&apos;re near
                the school - nobody, not even your admin, can see where you are.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#0f766e" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>If your phone asks again in a few days</Text>
              <Text style={styles.cardBody}>
                iOS sometimes double-checks background location permissions a few days after you first grant them.
                If a reminder pops up, please keep <Text style={styles.bold}>Always Allow</Text> selected - it&apos;s
                the same permission just being confirmed, not a new request.
              </Text>
            </View>
          </View>

          <Text style={styles.footnote}>
            You can turn the clock-out reminder on or off anytime from your dashboard.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.button} onPress={onDismiss}>
            <Text style={styles.buttonText}>Got it - continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4faf9" },
  content: { padding: 24, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: "#0b3b38" },
  subtitle: { color: "#4b6b68", fontWeight: "600", marginTop: 4, marginBottom: 24 },
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e5efee",
  },
  cardText: { flex: 1 },
  cardTitle: { fontWeight: "800", color: "#0b3b38", fontSize: 15, marginBottom: 6 },
  cardBody: { color: "#4b6b68", fontSize: 13, lineHeight: 19, fontWeight: "500" },
  emphasis: { color: "#0b3b38", fontWeight: "700", marginTop: 8 },
  bold: { fontWeight: "800", color: "#0b3b38" },
  footnote: { color: "#9db3b0", fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 8 },
  footer: { padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#e5efee" },
  button: { backgroundColor: "#17ab9d", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
