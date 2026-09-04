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
 * Shared "send a tap to the server and show the result" logic, used both
 * by a live NFC read (tap.tsx) and a Universal Link opened from a tag
 * detected in the background (app/c/[tag].tsx) - the two only differ in
 * how they get {tag, piccData, cmac}, not in what happens after.
 */
export function useTapSubmission() {
  const [state, setState] = useState<SubmissionState>({ phase: "idle" });

  const submit = useCallback(async (payload: { tag: string; piccData: string; cmac: string }) => {
    setState({ phase: "submitting" });
    try {
      const data = await apiFetch<ResultData>(`/api/clock/${payload.tag}`, {
        method: "POST",
        body: JSON.stringify({ piccData: payload.piccData, cmac: payload.cmac }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (data.milestone) {
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 200);
      }
      setState({ phase: "result", data });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setState({ phase: "error", message: ERROR_MESSAGES[code ?? ""] ?? "Something went wrong. Please try again." });
    }
  }, []);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  // For failures that happen before there's anything to submit (e.g. the
  // NFC read itself failing) - same result UI, no API call involved.
  const setError = useCallback((message: string) => setState({ phase: "error", message }), []);

  return { state, submit, reset, setError };
}
