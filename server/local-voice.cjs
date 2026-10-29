const { Buffer } = require("node:buffer");
/* global __dirname */
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { sessionConfig, episodeIds } = require("./voice-config.cjs");
const root = path.resolve(__dirname, "../dist");
function createServer({ apiKey, fetchImpl = fetch, port = 8085 }) {
  let lastSession = 0;
  return http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const json = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`];
    if (!allowedHosts.includes(req.headers.host))
      return json(403, { error: "Local access only." });
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname === "/api/voice/health")
        return json(200, {
          available: !!apiKey,
          episodeIds,
          generalConversation: true,
        });
      if (url.pathname === "/api/voice/review") {
        if (
          !allowedHosts.map((h) => "http://" + h).includes(req.headers.origin)
        )
          return json(403, { error: "Local app only." });
        return require("../preview/lib/conversation-review.cjs")(req, res, {
          fetchImpl,
          env: { ...process.env, OPENAI_API_KEY: apiKey },
        });
      }
      if (url.pathname === "/api/voice/session") {
        if (req.method !== "POST")
          return json(405, { error: "Method not allowed." });
        if (
          !allowedHosts.map((h) => "http://" + h).includes(req.headers.origin)
        )
          return json(403, {
            error: "This endpoint only accepts the local app.",
          });
        if (!apiKey)
          return json(503, {
            error: "The local voice server needs OPENAI_API_KEY.",
          });
        const jsonSession =
          req.headers["content-type"]?.startsWith("application/json");
        if (
          !jsonSession &&
          !req.headers["content-type"]?.startsWith("application/sdp")
        )
          return json(415, { error: "Expected an audio connection offer." });
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 64000)
            return json(413, { error: "Connection offer too large." });
        }
        let practiceContext;
        if (jsonSession) {
          try {
            const data = JSON.parse(body);
            practiceContext =
              require("../preview/lib/conversation-review-contract.cjs").practiceContext(
                data.practiceContext,
              );
            body = data.sdp;
          } catch {
            return json(400, { error: "Invalid practice context." });
          }
        }
        if (
          typeof body !== "string" ||
          !body.startsWith("v=0") ||
          !body.includes("m=audio")
        )
          return json(400, { error: "Invalid audio connection offer." });
        if (Date.now() - lastSession < 3000)
          return json(429, {
            error: "Please wait a few seconds before reconnecting.",
          });
        lastSession = Date.now();
        let config;
        try {
          config = sessionConfig(
            url.searchParams.get("episodeId") ?? undefined,
            undefined,
            {
              topicId: practiceContext
                ? "open"
                : url.searchParams.get("topicId"),
              practiceContext,
              localDate: url.searchParams.get("localDate") ?? undefined,
            },
          );
        } catch {
          return json(400, { error: "Unknown episode." });
        }
        const form = new FormData();
        form.set("sdp", body);
        form.set("session", JSON.stringify(config));
        const upstream = await fetchImpl(
          "https://api.openai.com/v1/realtime/calls",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
            signal: AbortSignal.timeout(30000),
          },
        );
        if (!upstream.ok) {
          console.error(
            "Voice connection rejected by provider:",
            upstream.status,
          );
          return json(502, {
            error:
              upstream.status === 429
                ? "Voice quota or rate limit reached. Please try again later."
                : "Could not connect to the voice service. Please try again.",
          });
        }
        res.writeHead(200, { "Content-Type": "application/sdp" });
        return res.end(await upstream.text());
      }
      if (url.pathname.startsWith("/api/"))
        return json(404, { error: "Not found." });
      if (!["GET", "HEAD"].includes(req.method))
        return json(405, { error: "Method not allowed." });
      const decoded = decodeURIComponent(url.pathname);
      let file = path.resolve(root, "." + decoded);
      if (file !== root && !file.startsWith(root + path.sep))
        return json(404, { error: "Not found." });
      let stat;
      try {
        stat = await fs.stat(file);
        if (!stat.isFile()) throw Error();
      } catch {
        if (path.extname(decoded)) return json(404, { error: "Not found." });
        file = path.join(root, "index.html");
        stat = await fs.stat(file);
      }
      const types = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".json": "application/json",
        ".css": "text/css",
        ".png": "image/png",
        ".mp3": "audio/mpeg",
        ".ico": "image/x-icon",
      };
      res.setHeader(
        "Content-Type",
        types[path.extname(file)] || "application/octet-stream",
      );
      res.setHeader("Accept-Ranges", "bytes");
      let start = 0,
        end = stat.size - 1;
      if (req.headers.range) {
        const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
        if (!m) return json(416, { error: "Invalid range." });
        start = +m[1];
        end = m[2] ? Math.min(+m[2], end) : end;
        if (start > end || start >= stat.size)
          return json(416, { error: "Invalid range." });
        res.statusCode = 206;
        res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      }
      res.setHeader("Content-Length", end - start + 1);
      res.end(
        req.method === "HEAD"
          ? undefined
          : (await fs.readFile(file)).subarray(start, end + 1),
      );
    } catch {
      if (!res.headersSent)
        json(500, {
          error: "The local voice server could not complete the request.",
        });
      else res.end();
    }
  });
}
async function main() {
  const envFile = process.argv[process.argv.indexOf("--env-file") + 1];
  let key = process.env.OPENAI_API_KEY;
  if (process.argv.includes("--env-file")) {
    const text = await fs.readFile(envFile, "utf8");
    const line = text.split("\n").find((l) => l.startsWith("OPENAI_API_KEY="));
    key = line
      ?.slice("OPENAI_API_KEY=".length)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
  if (!key)
    throw Error("Supply OPENAI_API_KEY through the environment or --env-file.");
  createServer({ apiKey: key }).listen(8085, "127.0.0.1", () =>
    console.log("Local voice preview: http://localhost:8085/conversation"),
  );
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { createServer };
