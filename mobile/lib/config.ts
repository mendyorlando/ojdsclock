// EXPO_PUBLIC_-prefixed vars are inlined at build time by Expo. Falls back
// to the live production API so a plain `expo start` / TestFlight build
// works without any local setup.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://ojdsclock.vercel.app";

// Must exactly match the server's NTAG_SDM_META_KEY/NTAG_SDM_FILE_KEY
// (both the same value there). Needed on-device to configure new tags -
// the phone has to know this secret to authenticate to the tag at all.
// No fallback on purpose: this is a real secret, not something safe to
// commit a default value for (an earlier version of this file did, and
// that value must now be treated as burned - it was briefly present in
// this public repo's history). Set it in .env.local for local builds.
if (!process.env.EXPO_PUBLIC_NTAG_KEY) {
  throw new Error(
    "EXPO_PUBLIC_NTAG_KEY is not set. Add it to mobile/.env.local (see NTAG_SDM_META_KEY on the server) before building.",
  );
}
export const NTAG_KEY_HEX = process.env.EXPO_PUBLIC_NTAG_KEY;

// Real physical door tags - the choices offered on the tag-provisioning screen.
export const KNOWN_TAGS = [
  { id: "chabad-door", label: "Chabad Door" },
  { id: "ojds-door", label: "OJDS Door" },
];

// Display labels for every tagId that can show up in history, including
// the non-door special cases the web app also produces (mirrors
// src/lib/tags.ts's TAG_LABELS - kept in sync by hand since the two apps
// don't share a package).
const TAG_LABELS: Record<string, string> = {
  ...Object.fromEntries(KNOWN_TAGS.map((t) => [t.id, t.label])),
  "reminder-confirm": "Confirmed via reminder",
  "manual-entry": "Manual entry",
};

export function tagLabel(tagId: string): string {
  return TAG_LABELS[tagId] || tagId;
}
