import { Platform } from "react-native";
import NfcManager, { NfcTech, Ndef, NfcError } from "react-native-nfc-manager";
import type { ApduResponse, Transceive } from "./ntag424Provision";

let started = false;

/** Call once, at app startup. Safe to call more than once. */
export async function initNfc() {
  if (started) return;
  started = true;
  await NfcManager.start();
}

export type TapPayload = { tag: string; piccData: string; cmac: string };

function parseQueryParams(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const [key, value = ""] = pair.split("=");
    params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, " "));
  }
  return params;
}

/** Extracts {tag, piccData, cmac} from a tap URL like https://host/c/chabad-door?picc_data=...&cmac=... */
function parseTapUrl(rawUrl: string): TapPayload | null {
  const [pathAndQuery] = rawUrl.split("#");
  const [path, query = ""] = pathAndQuery.split("?");
  const segments = path.split("/").filter(Boolean);
  const tag = segments[segments.length - 1];
  const params = parseQueryParams(query);

  if (!tag || !params.picc_data || !params.cmac) return null;
  return { tag, piccData: params.picc_data, cmac: params.cmac };
}

export class NfcCancelledError extends Error {}
export class NfcInvalidTagError extends Error {}

/**
 * Opens a foreground NFC session, reads the tapped tag's NDEF URI record,
 * and extracts the SDM-mirrored picc_data/cmac the tag encoded into it -
 * the same values the web flow would have received via the URL a browser
 * opened. Verification happens server-side, unchanged from the web flow.
 */
export async function scanEntranceTag(): Promise<TapPayload> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: "Hold your phone near the entrance tag",
    });

    const tag = await NfcManager.getTag();
    const uriRecord = tag?.ndefMessage?.find((r) => Ndef.isType(r, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI));
    if (!uriRecord) throw new NfcInvalidTagError();

    const uri = Ndef.uri.decodePayload(Uint8Array.from(uriRecord.payload as number[]));
    const payload = parseTapUrl(uri);
    if (!payload) throw new NfcInvalidTagError();

    if (Platform.OS === "ios") {
      await NfcManager.setAlertMessageIOS("Tag read successfully").catch(() => {});
    }

    return payload;
  } catch (err) {
    if (err instanceof NfcError.UserCancel) {
      throw new NfcCancelledError();
    }
    if (Platform.OS === "ios") {
      await NfcManager.invalidateSessionWithErrorIOS("Couldn't read that tag").catch(() => {});
    }
    throw err;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

const iosTransceive: Transceive = async (apdu) => {
  const { response, sw1, sw2 } = await NfcManager.sendCommandAPDUIOS(Array.from(apdu));
  return { data: Uint8Array.from(response), sw1, sw2 };
};

const androidTransceive: Transceive = async (apdu) => {
  const raw = await NfcManager.isoDepHandler.transceive(Array.from(apdu));
  if (raw.length < 2) throw new Error("Tag returned an unexpectedly short response");
  return {
    data: Uint8Array.from(raw.slice(0, -2)),
    sw1: raw[raw.length - 2],
    sw2: raw[raw.length - 1],
  };
};

/**
 * Opens a foreground raw-APDU (ISO-DEP) session against whatever tag is
 * tapped next, runs `body` with a platform-appropriate `Transceive`
 * function, and always tears the session down afterward - used for tag
 * provisioning (AuthenticateEV2First / ChangeKey / ChangeFileSettings),
 * as opposed to `scanEntranceTag`'s plain NDEF read for everyday taps.
 */
export async function runIsoDepSession<T>(body: (transceive: Transceive) => Promise<T>): Promise<T> {
  try {
    await NfcManager.requestTechnology(NfcTech.IsoDep, {
      alertMessage: "Hold your phone near the tag to configure",
    });

    const transceive = Platform.OS === "ios" ? iosTransceive : androidTransceive;
    const result = await body(transceive);

    if (Platform.OS === "ios") {
      await NfcManager.setAlertMessageIOS("Done").catch(() => {});
    }
    return result;
  } catch (err) {
    if (err instanceof NfcError.UserCancel) {
      throw new NfcCancelledError();
    }
    if (Platform.OS === "ios") {
      await NfcManager.invalidateSessionWithErrorIOS("Something went wrong").catch(() => {});
    }
    throw err;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}
