const assert = require("node:assert/strict");
const { createServer } = require("./local-voice.cjs");
(async () => {
  let calls = 0;
  const server = createServer({
    apiKey: "test-server-secret",
    port: 8099,
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(options.headers.Authorization, "Bearer test-server-secret");
      const config = JSON.parse(options.body.get("session"));
      assert.equal(config.model, "gpt-realtime-2.1");
      assert(config.instructions.includes("Phobos"));
      assert(config.instructions.includes("Gentle correction"));
      return new Response("v=0\r\nanswer", { status: 200 });
    },
  });
  await new Promise((resolve) => server.listen(8099, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const headers = {
    Host: "localhost:8099",
    Origin: "http://localhost:8099",
    "Content-Type": "application/sdp",
  };
  try {
    const post = (body, extra = {}) =>
      fetch(base + "/api/voice/session", {
        method: "POST",
        headers: { ...headers, ...extra },
        body,
      });
    assert.equal(
      (await post("v=0\r\nm=audio", { Origin: "https://untrusted.example" }))
        .status,
      403,
    );
    assert.equal(calls, 0);
    assert.equal((await post("invalid")).status, 400);
    assert.equal(calls, 0);
    const response = await post("v=0\r\nm=audio");
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "v=0\r\nanswer");
    assert.equal(calls, 1);
    assert.equal((await post("v=0\r\nm=audio")).status, 429);
    assert.equal(
      (
        await fetch(base + "/server/voice-config.cjs", {
          headers: { Host: "localhost:8099" },
        })
      ).status,
      404,
    );
    console.log(
      "Local voice: origin checks, input validation, server-owned episode context, private key isolation and rate limit passed.",
    );
  } finally {
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
