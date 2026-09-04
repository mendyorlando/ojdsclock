import { View, Text, StyleSheet } from "react-native";

// Admin-only tag provisioning (ChangeKey / ChangeFileSettings) lands here
// in a later build phase, retiring NXP TagWriter for good.
export default function ProvisionScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Tag setup tool coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f4faf9" },
  text: { color: "#4b6b68", fontWeight: "600" },
});
