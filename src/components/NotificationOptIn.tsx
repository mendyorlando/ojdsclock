"use client";

import { useEffect, useState } from "react";
import { ClockIcon } from "@/components/icons";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type Status = "checking" | "unsupported" | "off" | "on" | "denied" | "working";

export function NotificationOptIn() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    async function check() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        setStatus(existing ? "on" : "off");
      } catch {
        setStatus("unsupported");
      }
    }
    check();
  }, []);

  async function enable() {
    setStatus("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setStatus("unsupported");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setStatus("on");
    } catch {
      setStatus("off");
    }
  }

  if (status === "checking" || status === "unsupported" || status === "on") return null;

  return (
    <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
      <ClockIcon className="h-5 w-5 text-teal-700 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-ink">Get a reminder if you forget to clock out</p>
        <p className="text-xs font-semibold text-ink-soft mt-0.5">
          {status === "denied"
            ? "Notifications are blocked for this site in your phone's settings."
            : "A gentle nudge on this phone if you're clocked in for a very long shift."}
        </p>
      </div>
      {status !== "denied" && (
        <button
          onClick={enable}
          disabled={status === "working"}
          className="btn-teal-gradient rounded-lg px-3.5 py-2 text-xs font-bold text-white whitespace-nowrap cursor-pointer disabled:opacity-60"
        >
          {status === "working" ? "Enabling..." : "Enable"}
        </button>
      )}
    </div>
  );
}
