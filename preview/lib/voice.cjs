const { Buffer } = require("node:buffer");
const { sessionConfig } = require("./voice-config.cjs");
const lastSessions = new Map();
function allowSession(req, now = Date.now()) {
  const key =
    req.headers.authorization ||
    req.headers.cookie ||
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.socket?.remoteAddress ||
    "default";
  if (lastSessions.size > 200) {
    for (const [k, timestamp] of lastSessions) {
      if (now - timestamp >= 3000) lastSessions.delete(k);
    }
  }
  const previous = lastSessions.get(key) || 0;
  if (now - previous < 3000) return false;
  lastSessions.set(key, now);
  return true;
}
module.exports = async (req, res, url, { native = false } = {}) => {
  const json = (status, body) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/api/voice/health" && req.method === "GET")
    return json(200, { available: !!process.env.OPENAI_API_KEY });
  if (url.pathname !== "/api/voice/session")
    return json(404, { error: "Not found." });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });
  if (
    (!native && req.headers.origin !== url.origin) ||
    (native && req.headers.origin && req.headers.origin !== url.origin)
  )
    return json(403, { error: "Forbidden." });
  if (!process.env.OPENAI_API_KEY)
    return json(503, { error: "Voice is temporarily unavailable." });
  if (!req.headers["content-type"]?.startsWith("application/sdp"))
    return json(415, { error: "Expected an audio connection offer." });
  try {
    let body = req.body;
    if (body === undefined) {
      body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 64000)
          return json(413, { error: "Offer too large." });
      }
    }
    if (Buffer.isBuffer(body)) body = body.toString("utf8");
    if (typeof body !== "string") return json(400, { error: "Invalid offer." });
    if (Buffer.byteLength(body) > 64000)
      return json(413, { error: "Offer too large." });
    if (!body.startsWith("v=0") || !body.includes("m=audio"))
      return json(400, { error: "Invalid offer." });
    // Best-effort per-client reconnect throttle for this warm function instance.
    if (!allowSession(req))
      return json(429, {
        error: "Please wait a few seconds before reconnecting.",
      });
    const form = new FormData();
    form.set("sdp", body);
    form.set("session", JSON.stringify(sessionConfig()));
    const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok)
      return json(502, {
        error:
          upstream.status === 429
            ? "Voice quota or rate limit reached. Please try again later."
            : "Could not connect to the voice service. Please try again.",
      });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/sdp");
    return res.end(await upstream.text());
  } catch {
    return json(502, {
      error: "Voice connection timed out or failed. Please try again.",
    });
  }
};
