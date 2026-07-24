// Shared helpers for signing and building the session cookie (Node runtime, ESM).
import crypto from "crypto";

export const COOKIE_NAME = "portal_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function signSession(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function buildSessionCookie(email, secret) {
  const now = Math.floor(Date.now() / 1000);
  const value = signSession({ email, iat: now, exp: now + SESSION_TTL_SECONDS }, secret);
  return [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join("; ");
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
