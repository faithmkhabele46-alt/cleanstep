import crypto from "node:crypto";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "./supabase-server";
import { normalizeWhatsAppNumber } from "./loyalty";

const LOYALTY_COOKIE_NAME = "cleanstep_loyalty_session";
const LOYALTY_SESSION_DAYS = 30;

function getLoyaltySecret() {
  return (
    process.env.LOYALTY_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.PAYSTACK_SECRET_KEY ||
    "cleanstep-loyalty-development-secret"
  );
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
    crypto.createHmac("sha256", getLoyaltySecret()).update(payload).digest("hex"),
  );
}

export function hashLoyaltyPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return {
    salt,
    hash,
  };
}

export function verifyLoyaltyPassword(password, salt, expectedHash) {
  const { hash } = hashLoyaltyPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"));
}

export function createLoyaltySessionToken({ customerId, whatsAppNumber }) {
  const payload = JSON.stringify({
    customerId,
    whatsAppNumber: normalizeWhatsAppNumber(whatsAppNumber),
    expiresAt: Date.now() + LOYALTY_SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
  const encodedPayload = base64UrlEncode(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function parseLoyaltySessionToken(token = "") {
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

    if (!payload.customerId || !payload.whatsAppNumber || !payload.expiresAt) {
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

export async function setLoyaltySessionCookie({ customerId, whatsAppNumber }) {
  const cookieStore = await cookies();
  const token = createLoyaltySessionToken({ customerId, whatsAppNumber });

  cookieStore.set(LOYALTY_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LOYALTY_SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearLoyaltySessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(LOYALTY_COOKIE_NAME);
}

export async function getAuthenticatedLoyaltyCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get(LOYALTY_COOKIE_NAME)?.value;
  const session = parseLoyaltySessionToken(token);

  if (!session) {
    return null;
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data: account, error } = await supabase
    .from("loyalty_accounts")
    .select(
      "customer_id, loyalty_customers(id, customer_name, whatsapp_number)",
    )
    .eq("customer_id", session.customerId)
    .single();

  if (error || !account?.loyalty_customers) {
    return null;
  }

  return {
    customerId: account.loyalty_customers.id,
    customerName: account.loyalty_customers.customer_name,
    whatsAppNumber: account.loyalty_customers.whatsapp_number,
  };
}
