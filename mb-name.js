// Vercel serverless function: returns the name of a Metabase question/dashboard.
// The browser calls this same-origin (/api/mb-name) so there is no CORS problem.
// It fetches from Metabase server-side and returns just { name }.
//
// Env vars (set in Vercel > Project > Settings > Environment Variables):
//   METABASE_BASE_URL  - your Metabase URL (defaults to the value below)
//   METABASE_API_KEY   - optional. Only needed to resolve names of INTERNAL
//                        (non-public) questions/dashboards. Public links work
//                        without any key. Create one in Metabase under
//                        Admin > Settings > Authentication > API keys.

const DEFAULT_BASE = "https://splose.metabaseapp.com";

export default async function handler(req, res) {
  const base = (process.env.METABASE_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const apiKey = process.env.METABASE_API_KEY || "";

  const { type, kind, id } = req.query || {};

  // ---- validate inputs (prevents this endpoint being used as an open proxy) ----
  const safeKind = kind === "dashboard" ? "dashboard" : "card";
  let path;
  if (type === "public") {
    if (!/^[0-9a-fA-F-]{36}$/.test(id || "")) {
      return res.status(400).json({ error: "Invalid public id" });
    }
    path = `/api/public/${safeKind}/${id}`;
  } else {
    if (!/^[0-9]+$/.test(id || "")) {
      return res.status(400).json({ error: "Invalid id" });
    }
    path = `/api/${safeKind}/${id}`;
  }

  try {
    const headers = { Accept: "application/json" };
    // API key is only sent to the configured Metabase host, and only for
    // internal lookups (public endpoints don't need it).
    if (apiKey && type !== "public") headers["x-api-key"] = apiKey;

    const r = await fetch(base + path, { headers });
    if (!r.ok) {
      return res.status(r.status).json({ error: `Metabase responded ${r.status}` });
    }
    const data = await r.json();
    const name = data && typeof data.name === "string" ? data.name.trim() : null;

    // cache at the edge for a day; names rarely change
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ name: name || null });
  } catch (e) {
    return res.status(502).json({ error: "Could not reach Metabase" });
  }
}
