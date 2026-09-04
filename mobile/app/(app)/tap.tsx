import { View, Text, StyleSheet } from "react-native";

// NFC tap-to-clock flow lands here in the next build phase.
export default function TapScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Tap-to-clock coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f4faf9" },
  text: { color: "#4b6b68", fontWeight: "600" },
});
