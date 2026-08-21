export const TAG_LABELS: Record<string, string> = {
  "chabad-door": "Chabad Door",
  "ojds-door": "OJDS Door",
  "reminder-confirm": "Confirmed via reminder",
  "manual-entry": "Manual entry",
};

export function tagLabel(tagId: string) {
  return TAG_LABELS[tagId] || tagId;
}
