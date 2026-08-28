import { prisma } from "@/lib/prisma";
import { verifySunMessage } from "@/lib/ntag424";

function sdmKeys() {
  const metaHex = process.env.NTAG_SDM_META_KEY;
  const fileHex = process.env.NTAG_SDM_FILE_KEY;
  if (!metaHex || !fileHex) return null;
  return { metaKey: Buffer.from(metaHex, "hex"), fileKey: Buffer.from(fileHex, "hex") };
}

export type TapVerifyResult =
  | { ok: true; label: string }
  | { ok: false; reason: "not_configured" | "invalid" | "replayed" };

/**
 * Verifies a tap's SDM parameters against the tag's cryptographic message,
 * then checks it against that physical tag's own history: the first ever
 * valid tap from a given tag UID registers it (using the URL path as its
 * label), and every tap after that must show a strictly higher read
 * counter than the last one accepted, so a captured/bookmarked URL can
 * never be reused, it was already consumed by the tap that produced it.
 */
export async function verifyTap(
  piccData: string,
  cmac: string,
  fallbackLabel: string,
): Promise<TapVerifyResult> {
  const keys = sdmKeys();
  if (!keys) return { ok: false, reason: "not_configured" };

  const message = await verifySunMessage(piccData, cmac, keys.metaKey, keys.fileKey);
  if (!message) return { ok: false, reason: "invalid" };

  // Atomic: only accept if this counter is strictly newer than the last
  // one recorded for this physical tag. A captured/bookmarked URL's
  // counter never advances, so this closes the door on replaying it even
  // if a request for it races the real tap that produced it.
  const claimed = await prisma.nfcTag.updateMany({
    where: { uid: message.uidHex, lastCounter: { lt: message.counter } },
    data: { lastCounter: message.counter },
  });

  if (claimed.count > 0) {
    const tag = await prisma.nfcTag.findUnique({ where: { uid: message.uidHex } });
    return { ok: true, label: tag?.label ?? fallbackLabel };
  }

  // Nothing was updated: either this tag's UID has never been seen
  // before (register it now, using the URL path as its label), or it has
  // been seen and this counter isn't actually newer, a genuine replay.
  try {
    await prisma.nfcTag.create({
      data: { uid: message.uidHex, label: fallbackLabel, lastCounter: message.counter },
    });
    return { ok: true, label: fallbackLabel };
  } catch {
    return { ok: false, reason: "replayed" };
  }
}
