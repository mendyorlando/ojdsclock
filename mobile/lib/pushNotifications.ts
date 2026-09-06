import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { apiFetch } from "@/lib/api";

/**
 * Registers this device for push notifications and sends the token to
 * the server - admin-only, since the only thing that pushes today is the
 * Requests tab (device sign-in / hour correction requests).
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

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  await apiFetch("/api/push/register", {
    method: "POST",
    body: JSON.stringify({ token }),
  }).catch(() => {});
}
