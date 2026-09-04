// EXPO_PUBLIC_-prefixed vars are inlined at build time by Expo. Falls back
// to the live production API so a plain `expo start` / TestFlight build
// works without any local setup.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://ojdsclock.vercel.app";

// Must exactly match the server's NTAG_SDM_META_KEY/NTAG_SDM_FILE_KEY
// (both the same value there). Needed on-device to configure new tags -
// the phone has to know this secret to authenticate to the tag at all.
export const NTAG_KEY_HEX = process.env.EXPO_PUBLIC_NTAG_KEY || "AC17FFB2F3DBC45DDBD8561B33E8DE17";

export const KNOWN_TAGS = [
  { id: "chabad-door", label: "Chabad Door" },
  { id: "ojds-door", label: "OJDS Door" },
];
