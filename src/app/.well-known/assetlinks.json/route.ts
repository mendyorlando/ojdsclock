import { NextResponse } from "next/server";

/**
 * Android's equivalent of apple-app-site-association (see the sibling
 * route) - proves this site and the OJDS Clock Android app are the same
 * publisher, so tapping a /c/* link opens the app instead of Chrome.
 *
 * The debug-keystore fingerprint lets this work on a locally-built debug
 * APK today. Once there's a real release keystore (Play Store upload,
 * whether self-signed or Play App Signing), add ITS sha256 fingerprint
 * to this array too - the debug one only matches debug builds.
 */
export async function GET() {
  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "org.ojds.clock",
        sha256_cert_fingerprints: [
          "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C",
        ],
      },
    },
  ]);
}
