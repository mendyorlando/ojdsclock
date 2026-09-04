// Regression test for lib/ntag424Provision.ts's crypto primitives, run
// with: node scripts/validate-ntag424-crypto.mjs
//
// Reproduces NXP application note AN12196's own worked examples
// (Table 14: AuthenticateEV2First, Table 18: ChangeFileSettings, Table
// 25/26: ChangeKey) byte-for-byte, using the same pure-JS AES (aes-js)
// this app actually ships with - not Node's crypto module, which isn't
// available on-device. If this script ever fails after editing
// lib/crypto/aes.ts or lib/ntag424Provision.ts, do not trust that code
// against a real tag until it passes again.

import aesjs from "aes-js";

function hex(s) {
  return new Uint8Array(Buffer.from(s.replace(/\s+/g, ""), "hex"));
}
function toHex(bytes) {
  return Buffer.from(bytes).toString("hex").toUpperCase();
}
function xorBytes(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}
function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function aesCbcEncrypt(key, iv, data) {
  return new aesjs.ModeOfOperation.cbc(key, iv).encrypt(data);
}
function aesCbcDecrypt(key, iv, data) {
  return new aesjs.ModeOfOperation.cbc(key, iv).decrypt(data);
}
function aesEcbEncryptBlock(key, block16) {
  return new aesjs.ModeOfOperation.ecb(key).encrypt(block16);
}
function shiftLeft1(bytes) {
  const out = new Uint8Array(bytes.length);
  let carry = 0;
  for (let i = bytes.length - 1; i >= 0; i--) {
    out[i] = ((bytes[i] << 1) | carry) & 0xff;
    carry = bytes[i] & 0x80 ? 1 : 0;
  }
  return out;
}
function double(bytes) {
  const shifted = shiftLeft1(bytes);
  if (bytes[0] & 0x80) shifted[shifted.length - 1] ^= 0x87;
  return shifted;
}
function aesCmac(key, message) {
  const L = aesEcbEncryptBlock(key, new Uint8Array(16));
  const K1 = double(L);
  const K2 = double(K1);
  const n = Math.ceil(message.length / 16) || 1;
  const isCompleteLastBlock = message.length > 0 && message.length % 16 === 0;
  const M = message.slice(0, (n - 1) * 16);
  const lastChunk = message.slice((n - 1) * 16);
  let lastBlock;
  if (isCompleteLastBlock) {
    lastBlock = xorBytes(lastChunk, K1);
  } else {
    const padded = new Uint8Array(16);
    padded.set(lastChunk);
    padded[lastChunk.length] = 0x80;
    lastBlock = xorBytes(padded, K2);
  }
  let X = new Uint8Array(16);
  for (let i = 0; i < n - 1; i++) X = aesEcbEncryptBlock(key, xorBytes(X, M.slice(i * 16, (i + 1) * 16)));
  return aesEcbEncryptBlock(key, xorBytes(X, lastBlock));
}
function truncateMac(full) {
  const mac = new Uint8Array(8);
  for (let i = 0; i < 8; i++) mac[i] = full[i * 2 + 1];
  return mac;
}
function jamcrc32LE(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  const v = crc >>> 0;
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
}
function pad80(bytes) {
  const rem = bytes.length % 16;
  if (rem === 0) return bytes;
  const out = new Uint8Array(bytes.length + (16 - rem));
  out.set(bytes);
  out[bytes.length] = 0x80;
  return out;
}
function rotl1(b) {
  return concat(b.slice(1), b.slice(0, 1));
}

let failed = false;
function eq(label, actual, expected) {
  const a = toHex(actual);
  const e = expected.toUpperCase();
  const ok = a === e;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `\n     got:      ${a}\n     expected: ${e}`}`);
  if (!ok) failed = true;
}

const zeroIv = new Uint8Array(16);

// ---- Table 14: AuthenticateEV2First using Key No 0x00 ----
console.log("\n=== Table 14: AuthenticateEV2First (Key 0x00) ===");
const K0 = new Uint8Array(16);

const encRndB = hex("A04C124213C186F22399D33AC2A30215");
const RndB = aesCbcDecrypt(K0, zeroIv, encRndB);
eq("D(K0, RndB)", RndB, "B9E2FC789B64BF237CCCAA20EC7E6E48");

const RndA = hex("13C5DB8A5930439FC3DEF9A4C675360F");
const RndBp = rotl1(RndB);
eq("RndB' (rotate left 1)", RndBp, "E2FC789B64BF237CCCAA20EC7E6E48B9");

const encRndA_RndBp = aesCbcEncrypt(K0, zeroIv, concat(RndA, RndBp));
eq("E(K0, RndA||RndB')", encRndA_RndBp, "35C3E05A752E0144BAC0DE51C1F22C56B34408A23D8AEA266CAB947EA8E0118D");

const encTiRndAp = hex("3FA64DB5446D1F34CD6EA311167F5E4985B89690C04A05F17FA7AB2F08120663");
const decTiRndAp = aesCbcDecrypt(K0, zeroIv, encTiRndAp);
eq("D(K0, TI||RndA'||PDcap2||PCDcap2)", decTiRndAp, "9D00C4DFC5DB8A5930439FC3DEF9A4C675360F13000000000000000000000000".slice(0, 64));

function buildSV(hdr) {
  const a15_14 = RndA.slice(0, 2);
  const a13_8 = RndA.slice(2, 8);
  const b15_10 = RndB.slice(0, 6);
  const xored = xorBytes(a13_8, b15_10);
  const b9_0 = RndB.slice(6, 16);
  const a7_0 = RndA.slice(8, 16);
  return concat(hdr, a15_14, xored, b9_0, a7_0);
}
const SV1 = buildSV(hex("A55A00010080"));
const SV2 = buildSV(hex("5AA500010080"));
const KSesAuthENC = aesCmac(K0, SV1);
const KSesAuthMAC = aesCmac(K0, SV2);
eq("KSesAuthENC", KSesAuthENC, "1309C877509E5A215007FF0ED19CA564");
eq("KSesAuthMAC", KSesAuthMAC, "4C6626F5E72EA694202139295C7A7FC7");

// ---- Table 18: ChangeFileSettings ----
console.log("\n=== Table 18: ChangeFileSettings ===");
const CmdCtr18 = hex("0100");
const TI18 = hex("9D00C4DF");
const CmdData18 = hex("4000E0C1F121200000430000430000");
const ivInput18 = concat(hex("A55A"), TI18, CmdCtr18, new Uint8Array(8));
const IVc18 = aesCbcEncrypt(KSesAuthENC, zeroIv, ivInput18);
eq("IVc", IVc18, "3E27082AB2ACC1EF55C57547934E9962");
const encCmdData18 = aesCbcEncrypt(KSesAuthENC, IVc18, pad80(CmdData18));
eq("E(KSesAuthENC,IVc,CmdData)", encCmdData18, "61B6D97903566E84C3AE5274467E89EA");
const macInput18 = concat(hex("5F"), CmdCtr18, TI18, hex("02"), encCmdData18);
const fullMac18 = aesCmac(KSesAuthMAC, macInput18);
eq("MACt", truncateMac(fullMac18), "D799B7C1A0EF7A04");

// ---- Table 25: ChangeKey (Case 1, KeyNo != AuthKey) ----
console.log("\n=== Table 25: ChangeKey (Case 1) ===");
const KSesAuthMAC25 = hex("5529860B2FC5FB6154B7F28361D30BF9");
const KSesAuthENC25 = hex("4CF3CB41A22583A61E89B158D252FC53");
const oldKey25 = new Uint8Array(16);
const newKey25 = hex("F3847D627727ED3BC9C4CC050489B966");
const TI25 = hex("7614281A");
const CmdCtr25 = hex("0200");
const xorKey25 = xorBytes(oldKey25, newKey25);
const crc25 = jamcrc32LE(newKey25);
eq("JAMCRC(NewKey) LE", crc25, "789DFADC");
const ivInput25 = concat(hex("A55A"), TI25, CmdCtr25, new Uint8Array(8));
const IVe25 = aesCbcEncrypt(KSesAuthENC25, zeroIv, ivInput25);
eq("IVe", IVe25, "307EDE1814707F30CFE603DD6CA62353");
const keyData25 = pad80(concat(xorKey25, hex("01"), crc25));
const encKeyData25 = aesCbcEncrypt(KSesAuthENC25, IVe25, keyData25);
eq("E(KSesAuthENC,IVe,KeyData)", encKeyData25, "2CF362B7BF4311FF3BE1DAA295E8C68DE09050560D19B9E16C2393AE9CD1FAC7".slice(0, 64));
const cmacInput25 = concat(hex("C4"), CmdCtr25, TI25, hex("02"), encKeyData25);
const fullMac25 = aesCmac(KSesAuthMAC25, cmacInput25);
eq("CMACt", truncateMac(fullMac25), "5D0CE20BCD1D06E6");

// ---- Table 26: ChangeKey (Case 2, KeyNo == AuthKey) ----
console.log("\n=== Table 26: ChangeKey (Case 2) ===");
const KSesAuthMAC26 = hex("5529860B2FC5FB6154B7F28361D30BF9");
const KSesAuthENC26 = hex("4CF3CB41A22583A61E89B158D252FC53");
const newKey26 = hex("5004BF991F408672B1EF00F08F9E8647");
const TI26 = hex("7614281A");
const CmdCtr26 = hex("0300");
const plaintext26 = pad80(concat(newKey26, hex("01")));
const ivInput26 = concat(hex("A55A"), TI26, CmdCtr26, new Uint8Array(8));
const IVc26 = aesCbcEncrypt(KSesAuthENC26, zeroIv, ivInput26);
eq("IVc", IVc26, "01602D579423B2797BE8B478B0B4D27B");
const encData26 = aesCbcEncrypt(KSesAuthENC26, IVc26, plaintext26);
eq("E(KSesAuthENC,IVc,CmdData)", encData26, "C0EB4DEEFEDDF0B513A03A95A754918" + "18580503190D4D05053FF75668A01D6FD");
const macInput26 = concat(hex("C4"), CmdCtr26, TI26, hex("00"), encData26);
const fullMac26 = aesCmac(KSesAuthMAC26, macInput26);
eq("CMACt", truncateMac(fullMac26), "A6610234BDED6432");

console.log(failed ? "\nFAILED - do not trust this crypto against real hardware." : "\nAll AN12196 worked examples verified.");
process.exit(failed ? 1 : 0);
