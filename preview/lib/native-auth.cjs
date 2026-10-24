const { createHmac, randomBytes, timingSafeEqual } = require("node:crypto");
const { Buffer } = require("node:buffer");
const lifetime = 7 * 86400000;
const equal = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const signature = (payload, secret, audience) =>
  createHmac("sha256", secret)
    .update(`ambio-native-voice-v1:${audience}:${payload}`)
    .digest("hex");
function issue(secret, audience, now = Date.now()) {
  const payload = `${now + lifetime}.${randomBytes(24).toString("hex")}`;
  return `${payload}.${signature(payload, secret, audience)}`;
}
function verify(token, secret, audience, now = Date.now()) {
  if (
    typeof token !== "string" ||
    !/^\d{13}\.[a-f0-9]{48}\.[a-f0-9]{64}$/.test(token)
  )
    return false;
  const [expires, nonce, mac] = token.split(".");
  if (Number(expires) <= now || Number(expires) > now + lifetime) return false;
  return equal(mac, signature(`${expires}.${nonce}`, secret, audience));
}
const loginAttempts = new Map();
function allowLogin(req, now = Date.now()) {
  const key =
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.socket?.remoteAddress ||
    "default";
  if (loginAttempts.size > 200) {
    for (const [k, entry] of loginAttempts) {
      if (now - entry.windowStart > 60000) loginAttempts.delete(k);
    }
  }
  const current = loginAttempts.get(key);
  if (!current || now - current.windowStart > 60000) {
    loginAttempts.set(key, { windowStart: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= 20;
}
async function login(req, res, secret, audience) {
  const json = (status, data) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  };
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });
  // This credential exchange is for native clients, not cross-origin browsers.
  if (req.headers.origin) return json(403, { error: "Forbidden." });
  if (!req.headers["content-type"]?.startsWith("application/json"))
    return json(415, { error: "Expected JSON." });
  if (!allowLogin(req))
    return json(429, { error: "Please try again in a minute." });
  try {
    let body = req.body;
    if (body === undefined) {
      body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 2048)
          return json(413, { error: "Request too large." });
      }
    }
    if (Buffer.isBuffer(body)) body = body.toString("utf8");
    if (typeof body === "string") {
      if (Buffer.byteLength(body) > 2048)
        return json(413, { error: "Request too large." });
      body = JSON.parse(body);
    }
    if (
      !body ||
      typeof body.password !== "string" ||
      body.password.length > 128
    )
      return json(400, { error: "Invalid password request." });
    if (!equal(body.password, secret))
      return json(401, { error: "Incorrect password." });
    return json(200, {
      token: issue(secret, audience),
      expiresIn: lifetime / 1000,
    });
  } catch {
    return json(400, { error: "Invalid password request." });
  }
}
module.exports = { issue, verify, login };
