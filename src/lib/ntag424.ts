import { createDecipheriv, timingSafeEqual } from "crypto";
import { AesCmac } from "aes-cmac";

// NTAG 424 DNA Secure Dynamic Messaging (SDM), ported from NXP application
// note AN12196 (and cross-checked against the reference implementation at
// github.com/lucashenning/ntag424-backend). Each physical tap re-encrypts
// the tag's UID and read counter into the tag's own NDEF URL using two
// AES-128 keys only we and the tag know, so a captured/bookmarked URL
// can never be replayed: the counter in it has already been consumed the
// moment the real tap that produced it was accepted.

const SV2_PREFIX = Buffer.from([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80]);

function padToBlock(buf: Buffer): Buffer {
  const remainder = buf.length % 16;
  if (remainder === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(16 - remainder)]);
}

async function calculateSdmMac(metaReadKey: Buffer, piccPlain: Buffer): Promise<Buffer> {
  const sv2 = padToBlock(Buffer.concat([SV2_PREFIX, piccPlain]));
  const sessionKey = Buffer.from(await new AesCmac(metaReadKey).calculate(sv2));
  const full = Buffer.from(await new AesCmac(sessionKey).calculate(Buffer.alloc(0)));
  // NXP truncates the full 16-byte CMAC to 8 bytes by taking every
  // odd-indexed byte (1, 3, 5, ... 15), not just the first 8 bytes.
  const mac = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) mac[i] = full[i * 2 + 1];
  return mac;
}

export type SunMessage = { uidHex: string; counter: number };

/**
 * Verifies a tap's picc_data + cmac query params against the two SDM keys
 * provisioned on the physical tag. Returns the tag's UID and read counter
 * if genuine, or null if the message is malformed, forged, or signed with
 * the wrong key.
 */
export async function verifySunMessage(
  piccEncHex: string,
  cmacHex: string,
  metaReadKey: Buffer,
  fileReadKey: Buffer,
): Promise<SunMessage | null> {
  if (!/^[0-9a-fA-F]{32}$/.test(piccEncHex) || !/^[0-9a-fA-F]{16}$/.test(cmacHex)) {
    return null;
  }

  const piccEnc = Buffer.from(piccEncHex, "hex");
  const tagCmac = Buffer.from(cmacHex, "hex");

  let plain: Buffer;
  try {
    const decipher = createDecipheriv("aes-128-cbc", fileReadKey, Buffer.alloc(16));
    decipher.setAutoPadding(false);
    plain = Buffer.concat([decipher.update(piccEnc), decipher.final()]);
  } catch {
    return null;
  }

  const tag = plain[0];
  const uidMirrorEnabled = (tag & 0x80) === 0x80;
  const counterMirrorEnabled = (tag & 0x40) === 0x40;
  const uidLength = tag & 0x0f;

  if (!uidMirrorEnabled || !counterMirrorEnabled || uidLength !== 7) return null;

  const uid = plain.subarray(1, 8);
  const counterBytes = plain.subarray(8, 11);
  const counter = counterBytes[0] | (counterBytes[1] << 8) | (counterBytes[2] << 16);

  const expectedMac = await calculateSdmMac(metaReadKey, Buffer.concat([uid, counterBytes]));

  if (expectedMac.length !== tagCmac.length || !timingSafeEqual(expectedMac, tagCmac)) {
    return null;
  }

  return { uidHex: uid.toString("hex").toUpperCase(), counter };
}
