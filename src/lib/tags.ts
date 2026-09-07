// The two physical entrances - also what a printed QR code fallback links
// to (see /admin/qr-codes), same tag ids the NFC tags themselves use.
export const DOOR_TAGS = ["chabad-door", "ojds-door"] as const;

export const TAG_LABELS: Record<string, string> = {
  "chabad-door": "Chabad Door",
  "ojds-door": "OJDS Door",
  "reminder-confirm": "Confirmed via reminder",
  "manual-entry": "Manual entry",
};

export function tagLabel(tagId: string) {
  return TAG_LABELS[tagId] || tagId;
}
