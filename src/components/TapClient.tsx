"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon, FlameIcon } from "@/components/icons";
import { tagLabel } from "@/lib/tags";

type ResultData = {
  type: "IN" | "OUT";
  timestamp: string;
  duplicate: boolean;
  hoursThisMonth: number;
  hoursThisYear: number;
  streak: number | null;
  milestone: number | null;
};

type State = { phase: "submitting" } | { phase: "error"; message: string } | { phase: "result"; data: ResultData };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "That link isn't valid. Please tap the entrance tag again.",
  replayed: "That link has already been used. Please tap the entrance tag again to clock in.",
  not_configured: "Something isn't set up right yet. Please contact your administrator.",
};

type SubmitOutcome = { ok: true; data: ResultData } | { ok: false; errorCode?: string };

// Keyed by tag+piccData+cmac, outside React's render lifecycle: this
// tag's own SDM counter makes every real tap's payload unique, but React
// (in development) can mount this component twice for the exact same
// props. Sharing one in-flight request's resolved outcome per key means
// a double-mount reuses the first request's result instead of firing a
// second POST, which the server would then correctly reject as a replay
// of the first tap.
const inFlightTaps = new Map<string, Promise<SubmitOutcome>>();

export function TapClient({
  tag,
  firstName,
  piccData,
  cmac,
}: {
  tag: string;
  firstName: string;
  piccData?: string;
  cmac?: string;
}) {
  const [state, setState] = useState<State>({ phase: "submitting" });

  useEffect(() => {
    if (!piccData || !cmac) {
      setState({ phase: "error", message: "That link isn't valid on its own. Please tap the entrance tag to clock in." });
      return;
    }

    let cancelled = false;

    async function submit() {
      const key = `${tag}:${piccData}:${cmac}`;
      let outcome = inFlightTaps.get(key);

      if (!outcome) {
        outcome = (async (): Promise<SubmitOutcome> => {
          const res = await fetch(`/api/clock/${tag}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ piccData, cmac }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return { ok: false, errorCode: body?.error };
          }
          return { ok: true, data: (await res.json()) as ResultData };
        })();
        inFlightTaps.set(key, outcome);
      }

      try {
        const result = await outcome;
        if (cancelled) return;

        if (!result.ok) {
          const message = ERROR_MESSAGES[result.errorCode ?? ""] ?? "Something went wrong. Please tap the entrance tag again.";
          setState({ phase: "error", message });
          return;
        }

        setState({ phase: "result", data: result.data });
      } catch {
        if (!cancelled) {
          setState({ phase: "error", message: "Couldn't reach the server. Check your connection and try again." });
        }
      }
    }

    submit();
    return () => {
      cancelled = true;
    };
  }, [tag, piccData, cmac]);

  useEffect(() => {
    if (state.phase !== "result" || !("vibrate" in navigator)) return;
    navigator.vibrate(state.data.milestone ? [40, 60, 40, 60, 120] : 45);
  }, [state]);

  if (state.phase === "submitting") {
    return (
      <div className="text-center">
        <div className="relative mx-auto mb-6 h-36 w-36">
          <div className="absolute inset-0 rounded-full border-2 border-teal-300/30 animate-[ping_2.4s_ease-out_infinite]" />
          <div className="absolute inset-3 rounded-full grid place-items-center bg-gradient-to-br from-teal-500 to-teal-900 shadow-2xl">
            <div className="h-9 w-9 rounded-full border-[3px] border-white/30 border-t-white animate-spin" />
          </div>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight text-balance">Hi {firstName}, one second...</h1>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 h-20 w-20 rounded-full glass-dark grid place-items-center">
          <span className="text-3xl">!</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight text-balance">Couldn&apos;t clock you in</h1>
        <p className="text-teal-100/60 text-sm mt-2 font-semibold">{state.message}</p>
        <Link href="/dashboard" className="btn-teal-gradient inline-flex mt-7 rounded-xl px-6 py-3 text-sm font-bold text-white">
          Go to my hours
        </Link>
      </div>
    );
  }

  const { data } = state;
  const isIn = data.type === "IN";
  const milestone = data.milestone;

  const confettiColors = ["#17ab9d", "#ff8f4d", "#7fd8cc", "#ffc48c"];

  return (
    <div className="text-center">
      <div className="relative mx-auto mb-6 h-36 w-36">
        {milestone && (
          <div className="pointer-events-none absolute -inset-x-10 -top-6 h-24 overflow-visible">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="confetti-piece absolute h-2 w-2 rounded-sm"
                style={{
                  left: `${8 + i * 7.5}%`,
                  top: 0,
                  background: confettiColors[i % confettiColors.length],
                  animation: `confetti-fall ${0.9 + (i % 4) * 0.15}s ease-in ${i * 0.05}s 1`,
                }}
              />
            ))}
          </div>
        )}
        <div className="absolute inset-0 rounded-full border-2 border-teal-300/30 animate-[ping_2.4s_ease-out_infinite]" />
        <div
          className={`pop-in absolute inset-3 rounded-full grid place-items-center shadow-2xl ${
            isIn ? "bg-gradient-to-br from-teal-500 to-teal-900" : "bg-gradient-to-br from-orange-500 to-orange-700"
          }`}
          style={{
            boxShadow: "inset 0 2px 0 rgba(255,255,255,.25), 0 20px 40px -12px rgba(0,0,0,.55)",
            animation: "pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 1",
          }}
        >
          <CheckIcon className="h-14 w-14 text-white" />
        </div>
        <span className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full glass-dark grid place-items-center text-white text-[11px] font-extrabold">
          {isIn ? "IN" : "OUT"}
        </span>
      </div>

      <h1 className="text-3xl font-extrabold text-white tracking-tight text-balance">
        {data.duplicate ? `Already recorded, ${firstName}` : isIn ? `You're in, ${firstName}!` : `You're out, ${firstName}!`}
      </h1>

      <p className="text-teal-100/60 text-sm mt-2 font-semibold">
        {data.duplicate
          ? `Clocked ${isIn ? "in" : "out"} at ${formatTime(data.timestamp)}, just moments ago`
          : `${isIn ? "Clocked in" : "Clocked out"} at ${formatTime(data.timestamp)} on ${formatDate(data.timestamp)}`}
      </p>

      <p className="text-teal-100/40 text-xs mt-1 font-bold uppercase tracking-wider">{tagLabel(tag)}</p>

      {isIn && milestone && (
        <div
          className="pop-in mt-4 inline-flex flex-col items-center gap-0.5 rounded-2xl px-5 py-3"
          style={{
            background: "linear-gradient(155deg, var(--color-orange-500), var(--color-orange-700))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.3), 0 16px 30px -12px rgba(217,95,28,.55)",
            animation: "pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both",
          }}
        >
          <span className="flex items-center gap-1.5 text-white text-sm font-extrabold">
            <FlameIcon className="h-4 w-4 text-white" />
            {milestone}-day streak!
          </span>
          <span className="text-orange-100 text-[11px] font-bold">That&apos;s a milestone. Keep it up.</span>
        </div>
      )}

      {isIn && !milestone && data.streak !== null && data.streak > 0 && (
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 text-orange-200 text-xs font-bold px-3.5 py-1.5">
          <FlameIcon className="h-3.5 w-3.5 text-orange-400" />
          {data.streak}-day streak
        </span>
      )}

      {!isIn && (
        <div className="glass-dark rounded-2xl mt-6 px-5 py-4 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wider text-teal-100/50">This month</p>
          <p className="text-white font-extrabold text-lg mt-0.5">{data.hoursThisMonth} hours</p>
          <p className="text-teal-100/50 text-xs mt-0.5">{data.hoursThisYear} hours this year</p>
        </div>
      )}

      {isIn && (
        <div className="glass-dark rounded-2xl mt-6 px-5 py-4 text-left">
          <p className="text-sm text-teal-100/70 font-semibold">
            Tap the entrance tag again on your way out to clock out automatically.
          </p>
        </div>
      )}

      <Link href="/dashboard" className="btn-teal-gradient inline-flex mt-7 rounded-xl px-6 py-3 text-sm font-bold text-white">
        Go to my hours
      </Link>
    </div>
  );
}
