import { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "@/lib/AuthContext";
import { initNfc } from "@/lib/nfc";
// Import for its side effect: registers the geofencing background task.
// Must happen at module load (not inside a component) since iOS can
// relaunch the app in the background purely to deliver a geofence event.
import "@/lib/geofence";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function useNotificationTapRedirect() {
  useEffect(() => {
    function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (typeof url === "string") router.push(url as never);
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification) redirect(response.notification);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification);
    });

    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  useNotificationTapRedirect();
  useEffect(() => {
    initNfc().catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="c/[tag]" />
        <Stack.Screen name="geofence-confirm" />
      </Stack>
    </AuthProvider>
  );
}
