"use client";

import { useRef } from "react";
import { loginAction } from "./actions";

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const deviceRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    const key = "ojds_device_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(key, id);
    }
    if (deviceRef.current) deviceRef.current.value = id;
  }

  return (
    <form
      action={loginAction}
      onSubmit={handleSubmit}
      className="glass-dark rounded-[2rem] p-7 space-y-4"
    >
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="deviceId" ref={deviceRef} />

      {error && (
        <p className="text-sm font-semibold text-orange-200 bg-orange-500/15 rounded-xl px-3.5 py-2.5">
          {error === "missing"
            ? "Enter your username and password."
            : error === "device"
            ? "This account is locked to a different phone. An admin needs to approve this device before you can sign in here."
            : "That username or password isn't right."}
        </p>
      )}

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-teal-100/50 mb-1.5">
          Username
        </label>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="off"
          autoFocus
          className="field-dark w-full rounded-xl px-4 py-3 text-sm font-semibold"
          placeholder="rklein"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-teal-100/50 mb-1.5">
          Password
        </label>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          className="field-dark w-full rounded-xl px-4 py-3 text-sm font-semibold"
          placeholder="Password"
        />
      </div>

      <button
        type="submit"
        className="btn-gradient w-full rounded-xl py-3.5 text-sm font-bold text-white mt-2 cursor-pointer"
      >
        Sign in
      </button>

      <p className="text-center text-xs text-teal-100/40 pt-1">
        Stays signed in on this phone, so the next tap clocks you right in.
      </p>
    </form>
  );
}
