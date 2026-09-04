import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { SCHOOL_LAT, SCHOOL_LNG, SCHOOL_RADIUS_METERS } from "@/lib/config";

export const GEOFENCE_TASK_NAME = "ojds-school-geofence";
const REGION_ID = "school";

// Registering the task must happen at module load, not inside a
// component - iOS can relaunch the app in the background purely to
// deliver a geofence event, without ever mounting a screen that would
// otherwise call this. This module is imported once from app/_layout.tsx
// so it always registers as early as possible on every launch.
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { eventType } = (data ?? {}) as { eventType?: Location.GeofencingEventType };
  if (eventType !== Location.GeofencingEventType.Exit) return;

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
