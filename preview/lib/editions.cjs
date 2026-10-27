const { createHash } = require("node:crypto");
const { assertEditionBundle, ID } = require("./edition-contract.cjs");
function configured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
async function request(path, init = {}) {
  if (!configured()) throw Error("Edition service is not configured");
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(`Edition storage ${response.status}`);
  return response;
}
async function catalog(before) {
  const r = await request(
    "/rest/v1/edition_catalog?select=edition_id,edition_date,edition_revisions(title,revision)&order=edition_date.desc&limit=14" +
      (before ? `&edition_date=lt.${before}` : ""),
  );
  return (await r.json()).map((x) => ({
    id: x.edition_id,
    date: x.edition_date,
    title: x.edition_revisions.title,
    revision: x.edition_revisions.revision,
  }));
}
async function bundle(id) {
  if (!ID.test(id)) throw Error("Unknown edition");
  const rows = await (
    await request(
      `/rest/v1/edition_revisions?id=eq.${encodeURIComponent(id)}&status=eq.published&select=bundle_path,bundle_sha256`,
    )
  ).json();
  if (!rows.length) return null;
  const raw = await (
    await request(
      `/storage/v1/object/authenticated/editions/${rows[0].bundle_path}`,
    )
  ).text();
  if (createHash("sha256").update(raw).digest("hex") !== rows[0].bundle_sha256)
    throw Error("Edition checksum mismatch");
  const result = assertEditionBundle(JSON.parse(raw));
  if (result.id !== id) throw Error("Edition identity mismatch");
  return result;
}
async function media(b) {
  const value = await (
    await request(`/storage/v1/object/sign/editions/${b.audio.path}`, {
      method: "POST",
      body: JSON.stringify({ expiresIn: 3600 }),
    })
  ).json();
  return {
    url: `${process.env.SUPABASE_URL}/storage/v1${value.signedURL}`,
    expiresAt: Date.now() + 3500000,
    bytes: b.audio.bytes,
    sha256: b.audio.sha256,
  };
}
async function handler(req, res, url) {
  const json = (status, data) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  };
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });
  if (!configured())
    return json(503, { error: "Daily editions are not configured yet." });
  try {
    if (url.pathname === "/api/editions") {
      const before = url.searchParams.get("before");
      if (before && !/^\d{4}-\d{2}-\d{2}$/.test(before))
        return json(400, { error: "Invalid cursor" });
      const editions = await catalog(before);
      return json(200, {
        schemaVersion: 1,
        editions,
        nextCursor: editions.length === 14 ? editions[13].date : null,
      });
    }
    const match = /^\/api\/editions\/([^/]+)(\/media)?$/.exec(url.pathname);
    if (!match) return json(404, { error: "Not found" });
    const id = decodeURIComponent(match[1]);
    if (!ID.test(id)) return json(400, { error: "Invalid edition" });
    const b = await bundle(id);
    if (!b) return json(404, { error: "This edition is unavailable." });
    return json(200, match[2] ? await media(b) : b);
  } catch {
    return json(503, { error: "Could not load editions. Please retry." });
  }
}
module.exports = { configured, catalog, bundle, media, handler };
