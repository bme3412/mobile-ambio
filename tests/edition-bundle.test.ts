import { fixture } from "./edition-fixture";
import {
  assertEditionBundle,
  fromBundle,
  type EditionBundle,
} from "../src/data/editionBundle";
test("bundle rejects mismatched identity, broken alignment, missing translations and asset paths", () => {
  for (const corrupt of [
    (b: EditionBundle) => {
      b.id = "daily-fr-2026-10-28";
    },
    (b: EditionBundle) => {
      b.pairs[0][0][1] = "";
    },
    (b: EditionBundle) => {
      b.timing.segments[0].words[0].endMs = Infinity;
    },
    (b: EditionBundle) => {
      b.audio.path = "../other/audio.mp3";
    },
  ]) {
    const b = fixture();
    corrupt(b);
    expect(() => assertEditionBundle(b)).toThrow();
  }
});
test("revisions retain old identities and give corrected references separate identities", () => {
  const one = fixture();
  const two = fixture(2);
  assertEditionBundle(one);
  assertEditionBundle(two);
  const old = fromBundle(one);
  const revised = fromBundle(two);
  expect(old.episode.id).toBe("daily-fr-2026-10-27");
  expect(revised.episode.id).toBe("daily-fr-2026-10-27@r2");
  expect(revised.episodePhrases[0].words[0].id).toBe("daily20261027r2-s0-w0");
  expect(old.episodePhrases[0].words[0].id).toBe("daily20261027-s0-w0");
  expect(revised.featuredPhrase.segmentId).toContain("20261027r2");
  const { referenceFor } = jest.requireActual(
    "../preview/lib/published-phrases.cjs",
  );
  expect(referenceFor(two, revised.episodePhrases[0].words[0].id)).toBe(
    two.pairs[0][0][0],
  );
  expect(() => referenceFor(two, old.episodePhrases[0].words[0].id)).toThrow();
});
test("hosted artwork survives bundle loading and rejects external image URLs", () => {
  const b = fixture();
  b.artwork = {
    dataUri: "data:image/jpeg;base64,/9j/AA==",
    description: "A story-specific editorial illustration",
    label: "AI illustration",
  };
  assertEditionBundle(b);
  expect(fromBundle(b).episode.cover).toBe(b.artwork.dataUri);
  b.artwork.dataUri = "https://untrusted.example/image.jpg";
  expect(() => assertEditionBundle(b)).toThrow("artwork image");
});
