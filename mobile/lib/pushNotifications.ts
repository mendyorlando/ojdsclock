import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { apiFetch } from "@/lib/api";

/**
 * Registers this device for push notifications and sends the token to
 * the server - admin-only, since the only thing that pushes today is the
 * Requests tab (device sign-in / hour correction requests).
 *
 * Android needs Firebase Cloud Messaging credentials set up (a
 * `googleServicesFile` in app.json plus an FCM key uploaded via `eas
 * credentials`) before this can succeed there - not done yet, so this
 * silently no-ops on Android until that's set up. iOS works today via
 * the APNs key already generated through `eas credentials`.
 */
export async function registerForAdminPushNotifications() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiFetch("/api/push/register", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  } catch {
    // See doc comment above - expected on Android until FCM is set up.
  }
}
