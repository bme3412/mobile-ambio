import { createHash } from "node:crypto";
import { fixture } from "./edition-fixture";
const api = jest.requireActual("../preview/lib/editions.cjs");
const serve = jest.requireActual("../preview/api/serve.js");
const auth = jest.requireActual("../preview/lib/native-auth.cjs");
const original = global.fetch;
const env = { ...process.env };
const response = () => ({
  statusCode: 0,
  setHeader: jest.fn(),
  end: jest.fn(),
});
afterEach(() => {
  global.fetch = original;
  process.env = { ...env };
});
beforeEach(() => {
  process.env.SUPABASE_URL = "https://storage.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-secret";
});
test("unpublished editions cannot obtain a signed audio URL", async () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => [],
  })) as unknown as typeof fetch;
  const res = response();
  await api.handler(
    { method: "GET" },
    res,
    new URL("https://preview/api/editions/daily-fr-2026-10-27/media"),
  );
  expect(res.statusCode).toBe(404);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test("verified bundle identity and checksum are required before signing", async () => {
  const bundle = fixture();
  const raw = JSON.stringify(bundle);
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          bundle_path: `${bundle.id}/bundle.json`,
          bundle_sha256: createHash("sha256").update(raw).digest("hex"),
        },
      ],
    })
    .mockResolvedValueOnce({ ok: true, text: async () => raw })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signedURL: "/object/sign/editions/audio?token=temporary",
      }),
    });
  const res = response();
  await api.handler(
    { method: "GET" },
    res,
    new URL(`https://preview/api/editions/${bundle.id}/media`),
  );
  expect(res.statusCode).toBe(200);
  expect(res.end.mock.calls[0][0]).not.toContain("server-secret");
  expect(JSON.parse(res.end.mock.calls[0][0]).url).toBe(
    "https://storage.example/storage/v1/object/sign/editions/audio?token=temporary",
  );
});
test("storage errors do not disclose credentials", async () => {
  global.fetch = jest.fn(async () => {
    throw Error("server-secret");
  }) as typeof fetch;
  const res = response();
  await api.handler(
    { method: "GET" },
    res,
    new URL("https://preview/api/editions"),
  );
  expect(res.statusCode).toBe(503);
  expect(res.end.mock.calls[0][0]).not.toContain("server-secret");
});
test("the shared entrypoint rejects unauthenticated and invalid bearer catalog requests", async () => {
  process.env.PREVIEW_PASSWORD = "private";
  global.fetch = jest.fn();
  for (const authorization of [undefined, "Bearer invalid"]) {
    const res = response();
    await serve(
      {
        method: "GET",
        url: "/api/editions",
        headers: { host: "preview.example", authorization },
      },
      res,
    );
    expect(res.statusCode).toBe(401);
  }
  expect(global.fetch).not.toHaveBeenCalled();
  expect(auth).toBeTruthy();
});

test("a valid native bearer session can read a bounded catalog page", async () => {
  process.env.PREVIEW_PASSWORD = "private";
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => [],
  })) as unknown as typeof fetch;
  const res = response();
  await serve(
    {
      method: "GET",
      url: "/api/editions?before=2026-10-27",
      headers: {
        host: "preview.example",
        authorization: `Bearer ${auth.issue("private", "https://preview.example")}`,
      },
    },
    res,
  );
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.end.mock.calls[0][0])).toMatchObject({
    schemaVersion: 1,
    editions: [],
    nextCursor: null,
  });
  expect(String(jest.mocked(global.fetch).mock.calls[0][0])).toContain(
    "limit=14&edition_date=lt.2026-10-27",
  );
});
