// Vercel serverless function: the shared portal list.
//
//   GET  /api/data   -> returns { baseUrl, dashboards }  (open: anyone can read)
//   POST /api/data   -> applies one change, returns the new { baseUrl, dashboards }
//                       (protected: requires the team passcode)
//
// Works with either kind of Vercel Redis integration:
//   - Redis (Redis Cloud): provides REDIS_URL  -> used via the node-redis client
//   - Upstash Redis:        provides KV_REST_API_URL / KV_REST_API_TOKEN -> used over REST
//
// Env vars:
//   REDIS_URL                                  (Redis Cloud) OR
//   KV_REST_API_URL / KV_REST_API_TOKEN        (Upstash)
//   PORTAL_ADMIN_KEY                           - the team passcode you choose

import { createClient } from "redis";

const ADMIN_KEY = process.env.PORTAL_ADMIN_KEY || "";

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL || "";

const DATA_KEY = "portal:data";

const DEFAULT_DATA = {
  baseUrl: "https://splose.metabaseapp.com",
  dashboards: [
    {
      id: "seed-shared-question",
      url: "https://splose.metabaseapp.com/public/question/2f86c6af-86b3-42c9-a860-ff8d5e3006d3",
      name: "Pipeline Slippage Report",
      description: "Public Metabase question.",
      category: "Shared",
      type: "question",
      pinned: true
    }
  ]
};

// ---- storage: prefer REST (Upstash) if present, else a node-redis connection ----
let _client;
async function getClient() {
  if (_client && _client.isOpen) return _client;
  _client = createClient({ url: REDIS_URL });
  _client.on("error", () => {});
  if (!_client.isOpen) await _client.connect();
  return _client;
}
async function restCmd(command) {
  const r = await fetch(REST_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  if (!r.ok) throw new Error("redis rest " + r.status);
  const j = await r.json();
  return j.result;
}
async function kvGet(key) {
  if (REST_URL && REST_TOKEN) return restCmd(["GET", key]);
  const c = await getClient();
  return c.get(key);
}
async function kvSet(key, value) {
  if (REST_URL && REST_TOKEN) { await restCmd(["SET", key, value]); return; }
  const c = await getClient();
  await c.set(key, value);
}

async function readData() {
  const raw = await kvGet(DATA_KEY);
  if (!raw) return { ...DEFAULT_DATA, dashboards: DEFAULT_DATA.dashboards.map(d => ({ ...d })) };
  try { return JSON.parse(raw); } catch (e) { return { ...DEFAULT_DATA }; }
}
async function writeData(data) {
  await kvSet(DATA_KEY, JSON.stringify(data));
  return data;
}

function applyOp(data, body) {
  const op = body.op;
  if (op === "add") {
    const d = body.dashboard || {};
    if (!d.id) d.id = "d" + Date.now().toString(36);
    data.dashboards.push(d);
  } else if (op === "update") {
    const d = data.dashboards.find(x => x.id === body.id);
    if (d) Object.assign(d, body.fields || {});
  } else if (op === "delete") {
    data.dashboards = data.dashboards.filter(x => x.id !== body.id);
  } else if (op === "pin") {
    const d = data.dashboards.find(x => x.id === body.id);
    if (d) d.pinned = !!body.pinned;
  } else if (op === "setBase") {
    if (body.baseUrl) data.baseUrl = body.baseUrl;
  } else if (op === "replaceAll") {
    if (Array.isArray(body.dashboards)) data.dashboards = body.dashboards;
    if (body.baseUrl) data.baseUrl = body.baseUrl;
  } else {
    return { error: "Unknown op" };
  }
  return { data };
}

export default async function handler(req, res) {
  if (!REDIS_URL && !(REST_URL && REST_TOKEN)) {
    return res.status(503).json({ error: "Storage not configured. Add a Redis integration in Vercel." });
  }

  try {
    if (req.method === "GET") {
      const data = await readData();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      if (!ADMIN_KEY) {
        return res.status(503).json({ error: "PORTAL_ADMIN_KEY is not set in Vercel, so editing is disabled." });
      }
      const provided = req.headers["x-portal-key"] || "";
      if (provided !== ADMIN_KEY) {
        return res.status(401).json({ error: "Wrong passcode" });
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const data = await readData();
      const result = applyOp(data, body);
      if (result.error) return res.status(400).json(result);
      await writeData(result.data);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(result.data);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
