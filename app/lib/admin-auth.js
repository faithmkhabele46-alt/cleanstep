import crypto from "node:crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "cleanstep_admin_session";
const ADMIN_SESSION_DAYS = 14;

function getAdminSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.PAYSTACK_SECRET_KEY ||
    "cleanstep-admin-session-development-secret"
  );
}

export function getAdminAccessPassword() {
  return process.env.ADMIN_ACCESS_PASSWORD || process.env.CLEANSTEP_ADMIN_PASSWORD || "";
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function signPayload(payload) {
  return base64UrlEncode(
    crypto.createHmac("sha256", getAdminSessionSecret()).update(payload).digest("hex"),
  );
}

function createAdminSessionToken() {
  const payload = JSON.stringify({
    authenticated: true,
    expiresAt: Date.now() + ADMIN_SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
  const encodedPayload = base64UrlEncode(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseAdminSessionToken(token = "") {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = signPayload(encodedPayload);

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    if (!payload.authenticated || !payload.expiresAt) {
      return null;
    }

    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function setAdminSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return Boolean(parseAdminSessionToken(token));
}
