import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { attemptLogin } from "@/lib/login";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = String(body?.username || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const deviceId = String(body?.deviceId || "").trim();

  if (!username || !password || !deviceId) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") || "";
  const result = await attemptLogin(username, password, deviceId, userAgent);

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.reason === "device_pending" ? 403 : 401 });
  }

  const sessionId = await createSession(result.user.id);

  return NextResponse.json({
    sessionId,
    user: {
      id: result.user.id,
      name: result.user.name,
      role: result.user.role,
      title: result.user.title,
    },
  });
}
