import * as Crypto from "expo-crypto";
import {
  aesCbcEncrypt,
  aesCbcDecrypt,
  aesCmac,
  truncateMac,
  jamcrc32LE,
  pad80,
  concatBytes,
  bytesToHex,
} from "./crypto/aes";

// NTAG 424 DNA EV2 secure messaging (AuthenticateEV2First, ChangeKey,
// ChangeFileSettings), ported from NXP application note AN12196 and
// validated byte-for-byte against every worked example in that document
// (Table 14, 18, 25, 26) before ever being run against real hardware.
// This exists so the app can provision a tag directly - no NXP TagWriter,
// no third-party app UI, full control and real error reporting.

const ZERO_IV = new Uint8Array(16);
const NDEF_APP_AID = new Uint8Array([0xd2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01]);

export class Ntag424Error extends Error {}
export class Ntag424StatusError extends Ntag424Error {
  constructor(
    public step: string,
    public sw1: number,
    public sw2: number,
  ) {
    super(`${step} failed: SW=${sw1.toString(16).padStart(2, "0")}${sw2.toString(16).padStart(2, "0")}`);
  }
}
export class Ntag424AuthError extends Ntag424Error {
  constructor() {
    super("Authentication failed - the key doesn't match what's on this tag");
  }
}

export type ApduResponse = { data: Uint8Array; sw1: number; sw2: number };
/** Sends a raw C-APDU and returns the parsed response. Platform-specific (iOS/Android) adapter lives in lib/nfc.ts. */
export type Transceive = (apdu: Uint8Array) => Promise<ApduResponse>;

export type Session = {
  sessionEnc: Uint8Array;
  sessionMac: Uint8Array;
  ti: Uint8Array;
  cmdCtr: number;
};

function rotl1(b: Uint8Array): Uint8Array {
  return concatBytes(b.slice(1), b.slice(0, 1));
}
function rotr1(b: Uint8Array): Uint8Array {
  return concatBytes(b.slice(-1), b.slice(0, -1));
}
function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}
function cmdCtrLE(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}
function assertOk(step: string, resp: ApduResponse, expectedSw1: number, expectedSw2: number) {
  if (resp.sw1 !== expectedSw1 || resp.sw2 !== expectedSw2) {
    throw new Ntag424StatusError(step, resp.sw1, resp.sw2);
  }
}

/** ISO SELECT the NDEF application by DF name - required before any other command. */
export async function selectNdefApplication(transceive: Transceive): Promise<void> {
  const apdu = concatBytes(
    new Uint8Array([0x00, 0xa4, 0x04, 0x0c, NDEF_APP_AID.length]),
    NDEF_APP_AID,
  );
  const resp = await transceive(apdu);
  assertOk("Select NDEF application", resp, 0x90, 0x00);
}

/**
 * AuthenticateEV2First: proves knowledge of the given key and establishes
 * a fresh secure-messaging session (session keys + transaction identifier)
 * used by every subsequent CommMode.Full command in this tap.
 */
export async function authenticateEV2First(
  transceive: Transceive,
  keyNo: number,
  key: Uint8Array,
): Promise<Session> {
  const part1 = concatBytes(new Uint8Array([0x90, 0x71, 0x00, 0x00, 0x02, keyNo, 0x00, 0x00]));
  const resp1 = await transceive(part1);
  assertOk("AuthenticateEV2First part 1", resp1, 0x91, 0xaf);
  if (resp1.data.length !== 16) throw new Ntag424Error("Unexpected response length from tag (part 1)");

  const encRndB = resp1.data;
  const RndB = aesCbcDecrypt(key, ZERO_IV, encRndB);
  const RndA = await Crypto.getRandomBytesAsync(16);
  const RndBp = rotl1(RndB);
  const encRndA_RndBp = aesCbcEncrypt(key, ZERO_IV, concatBytes(RndA, RndBp));

  const part2 = concatBytes(new Uint8Array([0x90, 0xaf, 0x00, 0x00, 0x20]), encRndA_RndBp, new Uint8Array([0x00]));
  const resp2 = await transceive(part2);
  assertOk("AuthenticateEV2First part 2", resp2, 0x91, 0x00);
  if (resp2.data.length !== 32) throw new Ntag424Error("Unexpected response length from tag (part 2)");

  const dec = aesCbcDecrypt(key, ZERO_IV, resp2.data);
  const ti = dec.slice(0, 4);
  const RndAp = dec.slice(4, 20);

  if (bytesToHex(rotr1(RndAp)) !== bytesToHex(RndA)) {
    throw new Ntag424AuthError();
  }

  const svHeader = (b0: number, b1: number) =>
    new Uint8Array([b0, b1, 0x00, 0x01, 0x00, 0x80]);
  // NXP's RndX[n] notation indexes from the LSB (n=0 is the last byte in
  // memory), so RndA[15:14] is the first 2 bytes in memory order, etc.
  const buildSV = (hdr: Uint8Array) =>
    concatBytes(
      hdr,
      RndA.slice(0, 2),
      xorBytes(RndA.slice(2, 8), RndB.slice(0, 6)),
      RndB.slice(6, 16),
      RndA.slice(8, 16),
    );
  const SV1 = buildSV(svHeader(0xa5, 0x5a));
  const SV2 = buildSV(svHeader(0x5a, 0xa5));

  return {
    sessionEnc: aesCmac(key, SV1),
    sessionMac: aesCmac(key, SV2),
    ti,
    cmdCtr: 0,
  };
}

/**
 * Wraps and sends one CommMode.Full command (encrypted CmdData + CMAC),
 * verifies the response's MAC, and advances the session's command counter.
 * Used by both ChangeKey and ChangeFileSettings - they only differ in
 * `cmd` and `cmdData`.
 */
async function sendFullCommand(
  transceive: Transceive,
  session: Session,
  step: string,
  cmd: number,
  cmdHeader: Uint8Array,
  cmdData: Uint8Array,
): Promise<ApduResponse> {
  const ctr = cmdCtrLE(session.cmdCtr);

  const ivInput = concatBytes(new Uint8Array([0xa5, 0x5a]), session.ti, ctr, new Uint8Array(8));
  const ivc = aesCbcEncrypt(session.sessionEnc, ZERO_IV, ivInput);
  const encCmdData = cmdData.length > 0 ? aesCbcEncrypt(session.sessionEnc, ivc, pad80(cmdData)) : new Uint8Array(0);

  const macInput = concatBytes(new Uint8Array([cmd]), ctr, session.ti, cmdHeader, encCmdData);
  const macT = truncateMac(aesCmac(session.sessionMac, macInput));

  const dataField = concatBytes(cmdHeader, encCmdData, macT);
  const apdu = concatBytes(
    new Uint8Array([0x90, cmd, 0x00, 0x00, dataField.length]),
    dataField,
    new Uint8Array([0x00]),
  );

  const resp = await transceive(apdu);
  assertOk(step, resp, 0x91, 0x00);

  // Response MAC covers Status || CmdCtr+1 || TI || (encrypted response data, if any)
  const respData = resp.data.length >= 8 ? resp.data.slice(0, -8) : new Uint8Array(0);
  const respMacT = resp.data.length >= 8 ? resp.data.slice(-8) : resp.data;
  const respMacInput = concatBytes(new Uint8Array([0x00]), cmdCtrLE(session.cmdCtr + 1), session.ti, respData);
  const expectedRespMacT = truncateMac(aesCmac(session.sessionMac, respMacInput));
  if (bytesToHex(expectedRespMacT) !== bytesToHex(respMacT)) {
    throw new Ntag424Error(`${step}: response MAC did not verify - message may have been tampered with`);
  }

  session.cmdCtr += 1;
  return resp;
}

/**
 * Changes one AES key slot (0-4) to a new 16-byte key.
 * `oldKey` must be the CURRENT value of the slot being changed (needed
 * for the XOR diversification NXP requires when changing a key other
 * than the one you authenticated with - harmless/ignored by the tag
 * when keyNo equals the authenticated key).
 */
export async function changeKey(
  transceive: Transceive,
  session: Session,
  keyNo: number,
  oldKey: Uint8Array,
  newKey: Uint8Array,
  keyVersion: number,
  authenticatedKeyNo: number,
): Promise<void> {
  let cmdData: Uint8Array;
  if (keyNo === authenticatedKeyNo) {
    cmdData = concatBytes(newKey, new Uint8Array([keyVersion]));
  } else {
    const xored = xorBytes(oldKey, newKey);
    const crc = jamcrc32LE(newKey);
    cmdData = concatBytes(xored, new Uint8Array([keyVersion]), crc);
  }

  await sendFullCommand(transceive, session, "ChangeKey", 0xc4, new Uint8Array([keyNo]), cmdData);
}

export type SdmConfig = {
  /**
   * Key slot (0-4) holding the shared secret used for the tap. This app
   * writes the same key value to both the "meta read" (PICCData decrypt)
   * and "file read" (MAC) roles, matching the server's
   * NTAG_SDM_META_KEY/NTAG_SDM_FILE_KEY being the same value - so a
   * single slot number covers both.
   */
  keyNo: number;
  /** Byte offset within the NDEF URI text where PICCData hex should be mirrored. */
  piccDataOffset: number;
  /** Byte offset where the SDM MAC hex should be mirrored. */
  macOffset: number;
  /** Byte offset the MAC calculation starts covering from (== macOffset when there's no extra mirrored file data). */
  macInputOffset: number;
};

/** Configures SDM mirroring (UID + counter + MAC) on the NDEF file (file 0x02). */
export async function changeFileSettingsForSdm(
  transceive: Transceive,
  session: Session,
  config: SdmConfig,
): Promise<void> {
  const fileOption = 0x40; // SDM and mirroring enabled, CommMode plain
  // AccessRights: ReadWrite=0x0, Change=0x0, Read=0xE (free), Write=0x0 - wire order is [0x00, 0xE0].
  const accessRights = new Uint8Array([0x00, 0xe0]);
  const sdmOptions = 0xc1; // UID mirror + SDMReadCtr + ASCII encoding, no SDMReadCtrLimit, no SDMENCFileData
  const keyNibble = config.keyNo & 0x0f;
  // byte0 = RFU(0xF) || SDMCtrRet ; byte1 = SDMMetaRead || SDMFileRead
  const sdmAccessRights = new Uint8Array([0xf0 | keyNibble, (keyNibble << 4) | keyNibble]);
  const offset3 = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]);

  const cmdData = concatBytes(
    new Uint8Array([fileOption]),
    accessRights,
    new Uint8Array([sdmOptions]),
    sdmAccessRights,
    offset3(config.piccDataOffset),
    offset3(config.macOffset),
    offset3(config.macInputOffset),
  );

  await sendFullCommand(
    transceive,
    session,
    "ChangeFileSettings",
    0x5f,
    new Uint8Array([0x02]), // FileNo 0x02 = the NDEF file
    cmdData,
  );
}

function asciiToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const HTTPS_URI_CODE = 0x04; // NFC Forum well-known URI abbreviation for "https://"

/** Builds a Type-4-Tag NDEF file's raw bytes (NLEN + one short URI record). */
function buildNdefUriFileContent(urlWithoutScheme: string): Uint8Array {
  const textBytes = asciiToBytes(urlWithoutScheme);
  const payload = concatBytes(new Uint8Array([HTTPS_URI_CODE]), textBytes);
  if (payload.length > 0xff) {
    throw new Ntag424Error("URL is too long to fit in a short NDEF record");
  }
  const record = concatBytes(new Uint8Array([0xd1, 0x01, payload.length, 0x55]), payload);
  const nlen = new Uint8Array([(record.length >> 8) & 0xff, record.length & 0xff]);
  return concatBytes(nlen, record);
}

/** Writes the NDEF file's full contents in one shot (CommMode.Plain - no session needed). */
async function writeNdefPlain(transceive: Transceive, fileContent: Uint8Array): Promise<void> {
  const fileNo = 0x02;
  const offset3 = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]);
  const cmdData = concatBytes(
    new Uint8Array([fileNo]),
    offset3(0),
    offset3(fileContent.length),
    fileContent,
  );
  const apdu = concatBytes(
    new Uint8Array([0x90, 0x8d, 0x00, 0x00, cmdData.length]),
    cmdData,
    new Uint8Array([0x00]),
  );
  const resp = await transceive(apdu);
  assertOk("Write tag URL", resp, 0x91, 0x00);
}

export type TapUrlPlan = {
  fileContent: Uint8Array;
  piccDataOffset: number;
  macOffset: number;
  macInputOffset: number;
};

/**
 * Builds the NDEF content and SDM byte offsets for a given base URL
 * (e.g. "https://ojdsclock.vercel.app/c/chabad-door"), matching exactly
 * how the server verifies taps: an empty SDMMAC input (SDMMACInputOffset
 * == SDMMACOffset), same as this app note's own example.
 */
export function planTapUrl(baseUrl: string): TapUrlPlan {
  const scheme = "https://";
  if (!baseUrl.startsWith(scheme)) throw new Ntag424Error("Tag URL must start with https://");

  const piccPlaceholder = "0".repeat(32);
  const cmacPlaceholder = "0".repeat(16);
  const fullUrl = `${baseUrl}?picc_data=${piccPlaceholder}&cmac=${cmacPlaceholder}`;
  const withoutScheme = fullUrl.slice(scheme.length);

  const piccKey = "picc_data=";
  const cmacKey = "cmac=";
  const piccIdx = withoutScheme.indexOf(piccKey);
  const cmacIdx = withoutScheme.indexOf(cmacKey);
  if (piccIdx === -1 || cmacIdx === -1) throw new Ntag424Error("Failed to build tag URL");

  // Fixed bytes before the URI text: 2-byte NLEN + [0xD1,0x01,payloadLen,0x55] + 1-byte URI code.
  const HEADER_LEN = 7;
  const piccDataOffset = HEADER_LEN + piccIdx + piccKey.length;
  const macOffset = HEADER_LEN + cmacIdx + cmacKey.length;

  return {
    fileContent: buildNdefUriFileContent(withoutScheme),
    piccDataOffset,
    macOffset,
    macInputOffset: macOffset,
  };
}

export type ProvisionOptions = {
  baseUrl: string;
  key: Uint8Array;
  keyNo: number;
};

/**
 * Full end-to-end provisioning of a factory-fresh NTAG 424 DNA tag:
 * writes the tap URL, sets the real secret key, and configures SDM
 * mirroring - all from one tap, with a real status callback per step
 * instead of a black-box "Store failed".
 */
export async function provisionTag(
  transceive: Transceive,
  opts: ProvisionOptions,
  onProgress?: (step: string) => void,
): Promise<void> {
  onProgress?.("Selecting the tag's NDEF application");
  await selectNdefApplication(transceive);

  const plan = planTapUrl(opts.baseUrl);

  onProgress?.("Writing the tag's URL");
  await writeNdefPlain(transceive, plan.fileContent);

  onProgress?.("Authenticating with the factory-default key");
  const factoryKey = new Uint8Array(16);
  const session = await authenticateEV2First(transceive, 0, factoryKey);

  onProgress?.("Setting the real secret key");
  await changeKey(transceive, session, opts.keyNo, factoryKey, opts.key, 1, 0);

  onProgress?.("Configuring secure tap mirroring");
  await changeFileSettingsForSdm(transceive, session, {
    keyNo: opts.keyNo,
    piccDataOffset: plan.piccDataOffset,
    macOffset: plan.macOffset,
    macInputOffset: plan.macInputOffset,
  });
}
