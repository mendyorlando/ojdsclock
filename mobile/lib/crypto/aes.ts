import aesjs from "aes-js";

// Pure-JS AES-128 (no native crypto module exists in the RN/Hermes
// runtime). Validated against RFC 4493's CMAC test vectors and against
// every step of NXP AN12196's own worked AuthenticateEV2First /
// ChangeFileSettings / ChangeKey examples (see the scratch validation
// script used to build this) before being trusted against real hardware.

export function aesCbcEncrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
  return new aesjs.ModeOfOperation.cbc(key, iv).encrypt(data);
}

export function aesCbcDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array {
  return new aesjs.ModeOfOperation.cbc(key, iv).decrypt(data);
}

function aesEcbEncryptBlock(key: Uint8Array, block16: Uint8Array): Uint8Array {
  return new aesjs.ModeOfOperation.ecb(key).encrypt(block16);
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

function shiftLeft1(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  let carry = 0;
  for (let i = bytes.length - 1; i >= 0; i--) {
    out[i] = ((bytes[i] << 1) | carry) & 0xff;
    carry = bytes[i] & 0x80 ? 1 : 0;
  }
  return out;
}

function double(bytes: Uint8Array): Uint8Array {
  const shifted = shiftLeft1(bytes);
  if (bytes[0] & 0x80) shifted[shifted.length - 1] ^= 0x87;
  return shifted;
}

/** AES-CMAC (RFC 4493), full-length (16-byte) output. */
export function aesCmac(key: Uint8Array, message: Uint8Array): Uint8Array {
  const L = aesEcbEncryptBlock(key, new Uint8Array(16));
  const K1 = double(L);
  const K2 = double(K1);

  const n = Math.ceil(message.length / 16) || 1;
  const isCompleteLastBlock = message.length > 0 && message.length % 16 === 0;

  const M = message.slice(0, (n - 1) * 16);
  const lastChunk = message.slice((n - 1) * 16);

  let lastBlock: Uint8Array;
  if (isCompleteLastBlock) {
    lastBlock = xorBytes(lastChunk, K1);
  } else {
    const padded = new Uint8Array(16);
    padded.set(lastChunk);
    padded[lastChunk.length] = 0x80;
    lastBlock = xorBytes(padded, K2);
  }

  let X: Uint8Array = new Uint8Array(16);
  for (let i = 0; i < n - 1; i++) {
    X = aesEcbEncryptBlock(key, xorBytes(X, M.slice(i * 16, (i + 1) * 16)));
  }
  return aesEcbEncryptBlock(key, xorBytes(X, lastBlock));
}

/** NXP's 8-byte MAC truncation: every odd-indexed byte of the full 16-byte CMAC. */
export function truncateMac(full: Uint8Array): Uint8Array {
  const mac = new Uint8Array(8);
  for (let i = 0; i < 8; i++) mac[i] = full[i * 2 + 1];
  return mac;
}

/** JAMCRC (CRC-32/ISO-HDLC without the final XOR) - used by NXP's ChangeKey key-diversification wire format. */
export function jamcrc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & (mask & 0xffffffff));
    }
  }
  return crc >>> 0;
}

export function jamcrc32LE(buf: Uint8Array): Uint8Array {
  const v = jamcrc32(buf);
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
}

export function pad80(bytes: Uint8Array): Uint8Array {
  const rem = bytes.length % 16;
  if (rem === 0) return bytes;
  const out = new Uint8Array(bytes.length + (16 - rem));
  out.set(bytes);
  out[bytes.length] = 0x80;
  return out;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
