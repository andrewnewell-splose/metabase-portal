// GET /api/auth/login
// Redirects the browser to Google's OAuth consent screen. (ESM)
import crypto from "crypto";

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: "GOOGLE_CLIENT_ID not set" });
  }

  const origin = `https://${req.headers.host}`;
  const redirectUri = `${origin}/api/auth/callback`;

  // CSRF state: random value stored in a short-lived cookie, echoed back by Google.
  // The post-login destination rides along inside the state payload.
  const next =
    typeof req.query.next === "string" && req.query.next.startsWith("/")
      ? req.query.next
      : "/";
  const state = `${crypto.randomBytes(16).toString("base64url")}.${Buffer.from(next).toString("base64url")}`;

  res.setHeader("Set-Cookie", [
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  ]);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    hd: process.env.ALLOWED_DOMAIN || "splose.com", // UI hint only; enforced in callback
    prompt: "select_account",
    state,
  });

  res.statusCode = 302;
  res.setHeader("Location", `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.end();
}
