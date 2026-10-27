const handler = jest.requireActual("../preview/lib/practice.cjs");
const response = () => ({
  statusCode: 0,
  setHeader: jest.fn(),
  end: jest.fn(),
});
const env = { AZURE_SPEECH_KEY: "private-key", AZURE_SPEECH_REGION: "eastus" };
test("token endpoint requires configuration and a POST", async () => {
  const res = response();
  await handler({ method: "GET" }, res, { env });
  expect(res.statusCode).toBe(405);
  await handler({ method: "POST" }, res, { env: {} });
  expect(res.statusCode).toBe(503);
});
test("only a temporary token and region are returned, never the resource key", async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValue({ ok: true, text: async () => "temporary-token" });
  const res = response();
  await handler(
    { method: "POST", headers: { authorization: "test-client-1" } },
    res,
    { env, fetchImpl },
  );
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({
    token: "temporary-token",
    region: "eastus",
  });
  expect(fetchImpl.mock.calls[0][0]).toBe(
    "https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken",
  );
  await handler(
    { method: "POST", headers: { authorization: "test-client-1" } },
    res,
    { env, fetchImpl },
  );
  expect(res.statusCode).toBe(429);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
test("provider failures never leak credentials or response bodies", async () => {
  const res = response();
  await handler(
    { method: "POST", headers: { authorization: "test-client-2" } },
    res,
    {
      env,
      fetchImpl: async () => ({ ok: false, text: async () => "private-key" }),
    },
  );
  expect(res.statusCode).toBe(502);
  expect(res.end.mock.calls[0][0]).not.toContain("private-key");
});
