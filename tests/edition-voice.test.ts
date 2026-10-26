/* eslint-disable @typescript-eslint/no-require-imports */
const local = require("../server/voice-config.cjs");
const hosted = require("../preview/lib/voice-config.cjs");
test("voice context uses a server-owned edition and keeps hosted/local configurations aligned", () => {
  const old = local.sessionConfig("daily-fr-2026-10-24");
  const latest = local.sessionConfig("daily-fr-2026-10-25");
  expect(latest.instructions).toContain("Le goût de la découverte");
  expect(latest.instructions).toContain("Sophie Adenot");
  expect(old.instructions).not.toContain("Sophie Adenot");
  for (const id of [
    "daily-fr-2026-10-24",
    "daily-fr-2026-10-25",
    "daily-fr-2026-10-26",
  ])
    expect(hosted.sessionConfig(id)).toEqual(local.sessionConfig(id));
  expect(() => local.sessionConfig("untrusted client text")).toThrow(
    "Unknown episode",
  );
  expect(() => hosted.sessionConfig("__proto__")).toThrow("Unknown episode");
  expect(local.sessionConfig("daily-fr-2026-10-26").instructions).toContain(
    "Le monde en mouvement",
  );
  expect(local.sessionConfig()).toEqual(old);
});
