// Called only after the parent server has authenticated the caller and origin.
const lastTokens = new Map();
module.exports = async function practice(
  req,
  res,
  { env = process.env, fetchImpl = fetch } = {},
) {
  const json = (status, value) => {
    res.statusCode = status;
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(value));
  };
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });
  const region = env.AZURE_SPEECH_REGION;
  const key = env.AZURE_SPEECH_KEY;
  if (!key || !region || !/^[a-z0-9-]{2,40}$/.test(region))
    return json(503, {
      error: "Pronunciation practice is not available on this server yet.",
    });
  const client =
    req.headers.authorization ||
    req.headers.cookie ||
    req.socket?.remoteAddress ||
    "local";
  const now = Date.now();
  for (const [id, at] of lastTokens)
    if (now - at > 60000) lastTokens.delete(id);
  if (lastTokens.has(client) && now - lastTokens.get(client) < 3000)
    return json(429, { error: "Please wait a moment before trying again." });
  if (lastTokens.size > 1000)
    return json(503, { error: "Practice is busy. Try again shortly." });
  lastTokens.set(client, now);
  try {
    const response = await fetchImpl(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      return json(502, {
        error: "Azure Speech could not start practice. Please try again later.",
      });
    const token = await response.text();
    if (!token || token.length > 20000) throw Error("Invalid token");
    return json(200, { token, region });
  } catch {
    return json(502, {
      error: "Pronunciation service timed out. Please try again.",
    });
  }
};
