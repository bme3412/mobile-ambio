import example from "../scripts/daily/example.json";
import timing from "../src/data/editions/2026-10-26/audio-timing.json";
import { dictionary } from "../src/data/dictionary";
import { type EditionBundle } from "../src/data/editionBundle";
export function fixture(revision = 1): EditionBundle {
  const id = `daily-fr-2026-10-27${revision === 1 ? "" : `@r${revision}`}`;
  return JSON.parse(
    JSON.stringify({
      ...example,
      schemaVersion: 1,
      id,
      date: "2026-10-27",
      revision,
      verifiedAt: "2026-10-27T10:00:00Z",
      timing,
      definitions: { ...dictionary, ...example.definitions },
      audio: { path: `${id}/audio.mp3`, sha256: "a".repeat(64), bytes: 500 },
    }),
  );
}
