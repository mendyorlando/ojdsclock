import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { apiFetch } from "@/lib/api";

/**
 * Registers this device for push notifications and sends the token to
 * the server - admin-only, since the only thing that pushes today is the
 * Requests tab (device sign-in / hour correction requests).
 */
export async function registerForAdminPushNotifications() {
  console.log("[push] registering...");
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  console.log("[push] existing permission status:", existing);
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
    console.log("[push] requested permission status:", status);
  }
  if (status !== "granted") {
    console.log("[push] permission not granted, aborting");
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  console.log("[push] projectId:", projectId);
  if (!projectId) {
    console.log("[push] no projectId, aborting");
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("[push] got token:", token);

    await apiFetch("/api/push/register", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    console.log("[push] registered with server successfully");
  } catch (err) {
    console.log("[push] ERROR:", err);
  }
}
