/* global __dirname */
const http = require("node:http");
const assert = require("node:assert/strict");
const fs = require("node:fs");
process.chdir(__dirname);
process.env.PREVIEW_PASSWORD = "test-only-password-not-deployed";
const handler = require("./api/serve.js");
const server = http.createServer((req, res) =>
  handler(req, res).catch((e) => {
    console.error(e);
    res.statusCode = 500;
    res.end();
  }),
);
server.listen(0, "127.0.0.1", async () => {
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    const asset =
      "/" +
      fs
        .readdirSync("private/assets/assets/audio")
        .find((x) => x.startsWith("edition-2026-10-24."));
    const audio = "/assets/assets/audio/" + asset.slice(1);
    for (const path of [
      "/",
      "/player",
      audio,
      "/private/index.html",
      "/api/serve.js",
      "/api/voice/health",
      "/api/voice/session",
    ]) {
      assert.equal((await fetch(base + path)).status, 401);
    }
    const login = await fetch(base + "/__preview_login", {
      method: "POST",
      headers: {
        Origin: base.replace("http:", "https:"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "password=test-only-password-not-deployed",
      redirect: "manual",
    });
    assert.equal(login.status, 303);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await fetch(base + "/player", { headers: { Cookie: cookie } })).status,
      200,
    );
    const response = await fetch(base + audio, {
      headers: { Cookie: cookie, Range: "bytes=0-99" },
    });
    assert.equal(response.status, 206);
    assert.equal((await response.arrayBuffer()).byteLength, 100);
    assert.equal(
      (await fetch(base + audio, { headers: { Cookie: cookie + "wrong" } }))
        .status,
      401,
    );
    const headers = {
      Cookie: cookie,
      Origin: base.replace("http:", "https:"),
      "Content-Type": "application/sdp",
    };
    assert.equal(
      (
        await fetch(base + "/api/voice/session", {
          method: "POST",
          body: "v=0\r\nm=audio",
          headers: { ...headers, Cookie: "" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + "/api/voice/session", {
          method: "POST",
          body: "v=0",
          headers: { ...headers, Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.deepEqual(
      await (await fetch(base + "/api/voice/health", { headers })).json(),
      {
        available: false,
        dynamicEditions: false,
        generalConversation: true,
        episodeIds: [
          "daily-fr-2026-10-26",
          "daily-fr-2026-10-24",
          "daily-fr-2026-10-25",
        ],
      },
    );
    process.env.OPENAI_API_KEY = "test-only-key";
    assert.equal(
      (
        await fetch(base + "/api/voice/session", {
          method: "POST",
          body: "invalid",
          headers,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(base + "/api/voice/session", {
          method: "POST",
          body: "x".repeat(64001),
          headers,
        })
      ).status,
      413,
    );
    const realFetch = global.fetch;
    global.fetch = async (url, opts) => {
      if (url === "https://api.openai.com/v1/realtime/calls") {
        assert.equal(opts.headers.Authorization, "Bearer test-only-key");
        assert.ok(
          JSON.parse(opts.body.get("session")).instructions.includes("Phobos"),
        );
        return new Response("v=0\r\nm=audio");
      }
      return realFetch(url, opts);
    };
    assert.equal(
      (
        await fetch(base + "/api/voice/session", {
          method: "POST",
          body: "v=0\r\nm=audio",
          headers,
        })
      ).status,
      200,
    );
    global.fetch = realFetch;
    const nativeAuth = require("./lib/native-auth.cjs");
    const origin = base.replace("http:", "https:");
    const nativeLogin = (password, extra = {}) =>
      fetch(base + "/api/voice/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...extra },
        body: JSON.stringify({ password }),
      });
    assert.equal((await nativeLogin("wrong")).status, 401);
    assert.equal(
      (
        await nativeLogin(process.env.PREVIEW_PASSWORD, {
          Origin: "https://evil.example",
        })
      ).status,
      403,
    );
    const nativeResponse = await nativeLogin(process.env.PREVIEW_PASSWORD);
    assert.equal(nativeResponse.status, 200);
    const { token } = await nativeResponse.json();
    const nativeHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/sdp",
    };
    assert.equal(
      nativeAuth.verify(token, process.env.PREVIEW_PASSWORD, origin),
      true,
    );
    assert.equal(
      nativeAuth.verify(
        token,
        process.env.PREVIEW_PASSWORD,
        "https://other.example",
      ),
      false,
    );
    assert.equal(nativeAuth.verify(token, "rotated-password", origin), false);
    assert.equal(
      nativeAuth.verify(
        token,
        process.env.PREVIEW_PASSWORD,
        origin,
        Date.now() + 8 * 86400000,
      ),
      false,
    );
    assert.equal(
      (await fetch(base + "/api/voice/health", { headers: nativeHeaders }))
        .status,
      200,
    );
    assert.equal(
      (await fetch(base + "/player", { headers: nativeHeaders })).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + "/api/voice/health", {
          headers: { Authorization: `Bearer ${token}bad`, Cookie: cookie },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + "/api/voice/session", {
          method: "POST",
          headers: { ...nativeHeaders, Origin: "https://evil.example" },
          body: "v=0\r\nm=audio",
        })
      ).status,
      403,
    );
    // Reset the warm-instance reconnect throttle without waiting or calling OpenAI.
    delete require.cache[require.resolve("./lib/voice.cjs")];
    global.fetch = async (url, opts) => {
      if (url === "https://api.openai.com/v1/realtime/calls") {
        assert.equal(opts.headers.Authorization, "Bearer test-only-key");
        const config = JSON.parse(opts.body.get("session"));
        assert.match(config.instructions, /Something that surprised you/);
        assert.doesNotMatch(config.instructions, /DATED EPISODE:/);
        assert.equal(
          config.audio.input.turn_detection.interrupt_response,
          false,
        );
        assert.equal(config.audio.input.noise_reduction.type, "near_field");
        return new Response("native-answer-sdp");
      }
      return realFetch(url, opts);
    };
    const nativeCall = await fetch(
      base + "/api/voice/session?topicId=day-3-1&localDate=2026-10-28",
      {
        method: "POST",
        headers: nativeHeaders,
        body: "v=0\r\nm=audio",
      },
    );
    assert.equal(nativeCall.status, 200);
    assert.equal(await nativeCall.text(), "native-answer-sdp");
    global.fetch = realFetch;

    // Verify editorial and voice-config parity between src/server and preview/lib.
    assert.equal(
      fs.readFileSync("./lib/editorial.json", "utf8"),
      fs.readFileSync("../src/data/editorial.json", "utf8"),
    );
    const localVoiceConfig = require("../server/voice-config.cjs");
    const previewVoiceConfig = require("./lib/voice-config.cjs");
    assert.deepEqual(
      previewVoiceConfig.sessionConfig(),
      localVoiceConfig.sessionConfig(),
    );

    // Verify per-client web preview login rate limiting (20 per minute per IP).
    for (let i = 0; i < 20; i++) {
      const attempt = await fetch(base + "/__preview_login", {
        method: "POST",
        headers: {
          Origin: base.replace("http:", "https:"),
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Forwarded-For": "203.0.113.99",
        },
        body: "password=wrong-password",
      });
      assert.equal(attempt.status, 401);
    }
    const throttledWebLogin = await fetch(base + "/__preview_login", {
      method: "POST",
      headers: {
        Origin: base.replace("http:", "https:"),
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Forwarded-For": "203.0.113.99",
      },
      body: "password=test-only-password-not-deployed",
    });
    assert.equal(throttledWebLogin.status, 429);

    // Another client IP is not locked out by the throttled IP.
    const otherClientWebLogin = await fetch(base + "/__preview_login", {
      method: "POST",
      headers: {
        Origin: base.replace("http:", "https:"),
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Forwarded-For": "203.0.113.100",
      },
      body: "password=test-only-password-not-deployed",
      redirect: "manual",
    });
    assert.equal(otherClientWebLogin.status, 303);
    console.log(
      "Native login, scoped bearer auth, expiry, password rotation and SDP proxy passed.",
    );
    console.log(
      "Authenticated voice proxy, origin checks, size limits passed.",
    );
    console.log(
      "Password gate, private assets, deep links, invalid cookies and audio ranges passed.",
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
