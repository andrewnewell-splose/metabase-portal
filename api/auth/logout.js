// GET /api/auth/logout
// Clears the session cookie and sends the user back to sign-in. (ESM)
import { clearSessionCookie } from "../../lib/session.js";

export default function handler(req, res) {
  res.setHeader("Set-Cookie", [clearSessionCookie()]);
  res.statusCode = 302;
  res.setHeader("Location", "/api/auth/login");
  res.end();
}
