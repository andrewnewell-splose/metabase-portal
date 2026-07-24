// GET /api/auth/callback
// Exchanges the authorization code for tokens, enforces the splose.com domain,
// and sets the signed session cookie. (ESM)
import { buildSessionCookie } from "../../lib/session.js";

export default async function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  const allowedDomain = (process.env.ALLOWED_DOMAIN || "splose.com").toLowerCase();

  if (!clientId || !clientSecret || !sessionSecret) {
    return res.status(500).json({ error: "Auth environment variables not set" });
  }

  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  // CSRF check: state must match the cookie set at /api/auth/login.
  const cookieHeader = req.headers.cookie || "";
  const stateMatch = cookieHeader.match(/(?:^|;\s*)oauth_state=([^;]+)/);
  if (!stateMatch || stateMatch[1] !== state) {
    return res.status(403).send("Invalid state");
  }

  // Recover the post-login destination embedded in the state.
  let next = "/";
  const dot = state.indexOf(".");
  if (dot !== -1) {
    try {
      const decoded = Buffer.from(state.slice(dot + 1), "base64url").toString("utf8");
      if (decoded.startsWith("/") && !decoded.startsWith("//")) next = decoded;
    } catch {
      /* fall back to '/' */
    }
  }

  // Exchange the code for tokens directly with Google over TLS.
  const origin = `https://${req.headers.host}`;
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/auth/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResp.ok) {
    return res.status(401).send("Token exchange failed");
  }

  const tokens = await tokenResp.json();

  // The id_token came directly from Google's token endpoint over TLS,
  // so decoding its payload without signature verification is safe here.
  let claims;
  try {
    const payloadB64 = tokens.id_token.split(".")[1];
    claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return res.status(401).send("Invalid ID token");
  }

  const email = (claims.email || "").toLowerCase();
  const emailDomain = email.split("@")[1] || "";
  const hostedDomain = (claims.hd || "").toLowerCase();

  // Enforcement: verified email, correct domain, and Workspace hd claim.
  const authorised =
    claims.email_verified === true &&
    emailDomain === allowedDomain &&
    hostedDomain === allowedDomain;

  if (!authorised) {
    res.setHeader("Set-Cookie", [
      "oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    ]);
    return res
      .status(403)
      .send(
        `Access restricted to @${allowedDomain} Google accounts. You signed in as ${email || "an unknown account"}.`,
      );
  }

  res.setHeader("Set-Cookie", [
    buildSessionCookie(email, sessionSecret),
    "oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  ]);
  res.statusCode = 302;
  res.setHeader("Location", next);
  res.end();
}
