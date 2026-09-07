import { NextResponse } from "next/server";
import { getCurrentUser, serializeCurrentUser } from "@/lib/auth";

// Lets the mobile app re-fetch its own user object - specifically for a
// session that signed in before some field (like school) existed on it,
// since the app only ever persists whatever the login response contained
// at the time. See ensureSchoolLoaded() in mobile/lib/auth.ts.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  return NextResponse.json(serializeCurrentUser(user));
}
