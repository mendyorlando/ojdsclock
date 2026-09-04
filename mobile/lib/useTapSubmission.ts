import { useCallback, useState } from "react";
import * as Haptics from "expo-haptics";
import { apiFetch, ApiError } from "@/lib/api";

export type ResultData = {
  type: "IN" | "OUT";
  timestamp: string;
  duplicate: boolean;
  hoursThisMonth: number;
  hoursThisYear: number;
  streak: number | null;
  milestone: number | null;
};

export type SubmissionState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "error"; message: string }
  | { phase: "result"; data: ResultData };

export const ERROR_MESSAGES: Record<string, string> = {
  invalid: "That tag isn't valid. Please try again.",
  replayed: "That tag's link has already been used. Please tap again.",
  not_configured: "Something isn't set up right yet. Please contact your administrator.",
  too_far: "You don't seem to be at the school. Please try again once you're there.",
  not_a_nfc_tag: "That doesn't look like the entrance tag. Please try again.",
  read_failed: "Couldn't read the tag. Hold your phone steady over it and try again.",
  not_an_employee: "Admin accounts can't clock in or out.",
  unauthenticated: "Please sign in again.",
};

/**
 * Shared "call the server, show the result" state machine - the part that
 * a live NFC read (tap.tsx), a Universal Link tap (app/c/[tag].tsx), and a
 * geofence-exit confirm (geofence-confirm.tsx) all have in common. They
 * only differ in which endpoint they call and with what body.
 */
function useSubmission<Payload>(call: (payload: Payload) => Promise<ResultData>) {
  const [state, setState] = useState<SubmissionState>({ phase: "idle" });

  const submit = useCallback(
    async (payload: Payload) => {
      setState({ phase: "submitting" });
      try {
        const data = await call(payload);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (data.milestone) {
          setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 200);
        }
        setState({ phase: "result", data });
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        setState({ phase: "error", message: ERROR_MESSAGES[code ?? ""] ?? "Something went wrong. Please try again." });
      }
    },
    [call],
  );

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  // For failures that happen before there's anything to submit (e.g. the
  // NFC read itself failing) - same result UI, no API call involved.
  const setError = useCallback((message: string) => setState({ phase: "error", message }), []);

  return { state, submit, reset, setError };
}

export function useTapSubmission() {
  return useSubmission(async (payload: { tag: string; piccData: string; cmac: string }) =>
    apiFetch<ResultData>(`/api/clock/${payload.tag}`, {
      method: "POST",
      body: JSON.stringify({ piccData: payload.piccData, cmac: payload.cmac }),
    }),
  );
}

/**
 * Clocks the user out with no tag involved - used by the geofence-exit
 * reminder notification. Mirrors the web app's "Still at school? / No,
 * clock me out" reminder-confirm flow server-side (see
 * src/app/api/clock/confirm/route.ts).
 */
export function useConfirmClockOut() {
  return useSubmission<void>(async () => apiFetch<ResultData>("/api/clock/confirm", { method: "POST" }));
}
