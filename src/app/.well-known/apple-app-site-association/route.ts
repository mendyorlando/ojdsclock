import { NextResponse } from "next/server";

// Lets iOS route https://ojdsclock.vercel.app/c/* links straight into the
// OJDS Clock app (Universal Links) instead of opening Safari, once a tag
// is tapped in the background with the app closed. Must be served at
// exactly this path, over HTTPS, with no redirects, as application/json
// (no .json extension) - iOS fetches it directly, not through a browser.
const APP_ID = "WN48H47YZX.org.ojds.clock";

export async function GET() {
  return NextResponse.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: APP_ID,
          paths: ["/c/*"],
        },
      ],
    },
  });
}
