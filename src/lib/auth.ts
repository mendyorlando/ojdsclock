import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "ojds_session";
// Teachers sign in once on their own phone and every tap after that should
// just work, so sessions are effectively permanent until they sign out.
const SESSION_DAYS = 3650;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: { userId, expiresAt },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  return session.id;
}

// The mobile app has no cookie jar shared with the browser, so it
// authenticates with the same session id sent as a bearer token instead.
async function resolveSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (cookieToken) return cookieToken;

  const authHeader = (await headers()).get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return null;
}

export async function getCurrentUser() {
  const token = await resolveSessionToken();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
}

export async function destroySession() {
  const token = await resolveSessionToken();
  if (token) {
    await prisma.session.deleteMany({ where: { id: token } });
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
