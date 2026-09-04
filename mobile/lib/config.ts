// EXPO_PUBLIC_-prefixed vars are inlined at build time by Expo. Falls back
// to the live production API so a plain `expo start` / TestFlight build
// works without any local setup.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://ojdsclock.vercel.app";
