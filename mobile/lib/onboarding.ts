import * as SecureStore from "expo-secure-store";

const WELCOME_GUIDE_KEY = "ojds_seen_welcome_guide";

export async function hasSeenWelcomeGuide(): Promise<boolean> {
  return (await SecureStore.getItemAsync(WELCOME_GUIDE_KEY)) === "true";
}

export async function markWelcomeGuideSeen(): Promise<void> {
  await SecureStore.setItemAsync(WELCOME_GUIDE_KEY, "true");
}
