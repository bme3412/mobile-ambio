const http = require("node:http");
const practice = require("../preview/lib/practice.cjs");
const origins = new Set(["http://localhost:8092", "http://127.0.0.1:8092"]);
function createPracticeServer() {
  return http.createServer((req, res) => {
    if (
      !["localhost:8086", "127.0.0.1:8086"].includes(req.headers.host) ||
      !origins.has(req.headers.origin)
    ) {
      res.writeHead(403);
      return res.end();
    }
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    if (req.url !== "/api/voice/practice/token") {
      res.writeHead(404);
      return res.end();
    }
    return practice(req, res);
  });
}
if (require.main === module)
  createPracticeServer().listen(8086, "127.0.0.1", () =>
    console.log("Local pronunciation service ready on port 8086"),
  );
module.exports = { createPracticeServer };
