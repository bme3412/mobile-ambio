const { Buffer } = require("node:buffer");
const { createHmac, timingSafeEqual } = require("node:crypto");
const { readFile, stat } = require("node:fs/promises");
const path = require("node:path");
const nativeAuth = require("../lib/native-auth.cjs");
const root = path.join(process.cwd(), "private");
const cookieName = "__Host-ambio_preview";
const equal = (a, b) => {
  const x = Buffer.from(a || ""),
    y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
};
const sign = (value, secret, origin) =>
  createHmac("sha256", secret)
    .update(`ambio-web-preview-v1:${origin}:${value}`)
    .digest("hex");
const webLogins = new Map();
function allowWebLogin(req, now = Date.now()) {
  const key =
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.socket?.remoteAddress ||
    "default";
  if (webLogins.size > 200) {
    for (const [k, entry] of webLogins) {
      if (now - entry.windowStart > 60000) webLogins.delete(k);
    }
  }
  const current = webLogins.get(key);
  if (!current || now - current.windowStart > 60000) {
    webLogins.set(key, { windowStart: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= 20;
}
const page = (failed = false) =>
  `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Ambio · Private preview</title><style>body{margin:0;background:#fcfbf9;color:#0b1937;font:17px system-ui;min-height:100svh;display:grid;place-items:center}main{padding:28px;max-width:360px}h1{font:38px Georgia}input,button{box-sizing:border-box;width:100%;padding:16px;border-radius:14px;font:inherit;margin:8px 0}input{border:1px solid #ddd}button{background:#00a980;color:white;border:0}p{line-height:1.5;color:#63738f}</style><main><h1>Ambio Daily</h1><p>Your private listening preview.</p><form method="post" action="/__preview_login"><label for="password">Preview password</label><input id="password" type="password" name="password" autocomplete="current-password" required maxlength="128"><button>Open Ambio</button></form>${failed ? '<p role="alert">That password didn’t match. Try again.</p>' : ""}</main></html>`;
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  const secret = process.env.PREVIEW_PASSWORD;
  if (!secret) {
    res.statusCode = 503;
    return res.end("Preview is locked.");
  }
  const url = new URL(req.url, "https://" + req.headers.host);
  if (url.pathname === "/api/voice/login")
    return nativeAuth.login(req, res, secret, url.origin);
  const authorization = req.headers.authorization;
  if (
    (url.pathname.startsWith("/api/voice/") ||
      url.pathname.startsWith("/api/editions")) &&
    authorization
  ) {
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    if (!nativeAuth.verify(token, secret, url.origin)) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: "Please sign in again." }));
    }
    if (url.pathname.startsWith("/api/editions"))
      return require("../lib/editions.cjs").handler(req, res, url);
    return require("../lib/voice.cjs")(req, res, url, { native: true });
  }
  if (url.pathname === "/__preview_login" && req.method === "POST") {
    if (req.headers.origin !== url.origin) {
      res.statusCode = 403;
      return res.end("Forbidden");
    }
    if (!allowWebLogin(req)) {
      res.statusCode = 429;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end("Please try again in a minute.");
    }
    let body = req.body;
    if (body === undefined) {
      body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 2048) {
          res.statusCode = 413;
          return res.end();
        }
      }
    }
    const password =
      typeof body === "object" && !Buffer.isBuffer(body)
        ? body.password
        : new URLSearchParams(String(body)).get("password");
    if (!equal(password, secret)) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(page(true));
    }
    const expires = String(Date.now() + 30 * 86400000);
    res.setHeader(
      "Set-Cookie",
      cookieName +
        "=" +
        expires +
        "." +
        sign(expires, secret, url.origin) +
        "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000",
    );
    res.statusCode = 303;
    res.setHeader("Location", "/");
    return res.end();
  }
  const cookie =
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) || "";
  const [expires, signature] = cookie.split(".");
  if (
    !expires ||
    !signature ||
    Number(expires) <= Date.now() ||
    !equal(signature, sign(expires, secret, url.origin))
  ) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(page());
  }
  if (url.pathname.startsWith("/api/editions"))
    return require("../lib/editions.cjs").handler(req, res, url);
  if (url.pathname.startsWith("/api/voice/"))
    return require("../lib/voice.cjs")(req, res, url);
  if (!["GET", "HEAD"].includes(req.method)) {
    res.statusCode = 405;
    return res.end();
  }
  let requested;
  try {
    requested = decodeURIComponent(url.pathname);
  } catch {
    res.statusCode = 400;
    return res.end();
  }
  let file = path.resolve(root, "." + requested);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.statusCode = 404;
    return res.end();
  }
  let info;
  try {
    info = await stat(file);
    if (!info.isFile()) throw new Error();
  } catch {
    if (path.extname(requested)) {
      res.statusCode = 404;
      return res.end();
    }
    file = path.join(root, "index.html");
    info = await stat(file);
  }
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".mp3": "audio/mpeg",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
  };
  res.setHeader(
    "Content-Type",
    types[path.extname(file)] || "application/octet-stream",
  );
  res.setHeader("Accept-Ranges", "bytes");
  let start = 0,
    end = info.size - 1;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) {
      res.statusCode = 416;
      return res.end();
    }
    start = match[1]
      ? Number(match[1])
      : Math.max(0, info.size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(end, Number(match[2])) : end;
    if (start > end || start >= info.size) {
      res.statusCode = 416;
      res.setHeader("Content-Range", "bytes */" + info.size);
      return res.end();
    }
    end = Math.min(end, start + 1024 * 1024 - 1);
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`);
  }
  res.setHeader("Content-Length", end - start + 1);
  if (req.method === "HEAD") return res.end();
  const bytes = await readFile(file);
  res.end(bytes.subarray(start, end + 1));
};
