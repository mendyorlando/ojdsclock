import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { API_BASE_URL, SCHOOL_LAT, SCHOOL_LNG, SCHOOL_RADIUS_METERS } from "@/lib/config";
import { getStoredSession } from "@/lib/auth";

export const GEOFENCE_TASK_NAME = "ojds-school-geofence";
const REGION_ID = "school";

/**
 * Whether the signed-in user is currently clocked in, right now - a
 * direct minimal fetch (not the shared apiFetch helper) since this runs
 * from a background task, where redirecting on a 401 makes no sense.
 */
async function isCurrentlyClockedIn(): Promise<boolean> {
  const session = await getStoredSession();
  if (!session) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/api/me/summary`, {
      headers: { Authorization: `Bearer ${session.sessionId}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.currentlyIn);
  } catch {
    return false;
  }
}

// Registering the task must happen at module load, not inside a
// component - iOS can relaunch the app in the background purely to
// deliver a geofence event, without ever mounting a screen that would
// otherwise call this. This module is imported once from app/_layout.tsx
// so it always registers as early as possible on every launch.
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { eventType } = (data ?? {}) as { eventType?: Location.GeofencingEventType };
  if (eventType !== Location.GeofencingEventType.Exit) return;

  // The OS can redeliver an "exit" for a region you're already outside of
  // (e.g. when monitoring restarts on launch while already away from
  // school) - only worth a reminder if there's actually something open to
  // clock out of.
  if (!(await isCurrentlyClockedIn())) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Looks like you left",
      body: "Tap here to clock out if you're heading home.",
      data: { url: "/geofence-confirm" },
    },
    trigger: null,
  });
});

export async function isGeofenceEnabled(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME).then(
    (registered) => registered && Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME),
    () => false,
  );
}

/**
 * Requests permissions (foreground, then background - iOS requires this
 * order) and starts monitoring the one region around the school. Returns
 * why it didn't start when it didn't, so the UI can show a real message
 * instead of silently doing nothing.
 */
export async function enableGeofence(): Promise<"ok" | "foreground_denied" | "background_denied"> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return "foreground_denied";

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return "background_denied";

  await Notifications.requestPermissionsAsync();

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
    {
      identifier: REGION_ID,
      latitude: SCHOOL_LAT,
      longitude: SCHOOL_LNG,
      radius: SCHOOL_RADIUS_METERS,
      notifyOnEnter: false,
      notifyOnExit: true,
    },
  ]);
  return "ok";
}

export async function disableGeofence(): Promise<void> {
  if (await isGeofenceEnabled()) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
  }
}
