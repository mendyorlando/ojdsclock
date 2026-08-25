export function formatDeviceLabel(userAgent: string) {
  if (!userAgent) return "Unknown device";
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/Android/i.test(userAgent)) return "Android phone";
  // Modern iPadOS Safari identifies itself identically to a Mac unless a
  // specific setting is changed, so this can't be told apart reliably from
  // the user-agent string alone.
  if (/Macintosh/i.test(userAgent)) return "Mac or iPad";
  if (/Windows/i.test(userAgent)) return "Windows PC";
  return userAgent.slice(0, 40);
}
