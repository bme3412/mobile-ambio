// Shared runtime validation for the publisher, backend, and mobile repository.
const ID = /^daily-fr-\d{4}-\d{2}-\d{2}(?:@r[2-9]\d*|@r1\d+)?$/;
const normalize = (s) => s.toLowerCase().replace(/[^a-zàâéèêëîïôùûüç]/g, "");
function assertEditionBundle(b) {
  const check = (ok, message) => {
    if (!ok) throw Error(`Invalid edition: ${message}`);
  };
  check(b && b.schemaVersion === 1, "schema version");
  check(
    /^\d{4}-\d{2}-\d{2}$/.test(b.date) &&
      Number.isSafeInteger(b.revision) &&
      b.revision > 0,
    "date/revision",
  );
  const id = `daily-fr-${b.date}${b.revision === 1 ? "" : `@r${b.revision}`}`;
  check(b.id === id && ID.test(b.id), "identity");
  if (b.artwork !== undefined) {
    check(
      b.artwork &&
        typeof b.artwork.dataUri === "string" &&
        b.artwork.dataUri.length <= 2000023 &&
        /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(
          b.artwork.dataUri,
        ),
      "artwork image",
    );
    check(
      typeof b.artwork.description === "string" &&
        b.artwork.description.length > 0 &&
        b.artwork.description.length <= 2000,
      "artwork description",
    );
  }
  const {
    editorial: e,
    timing: t,
    pairs,
    vocabulary,
    definitions,
    featured,
  } = b;
  check(
    e &&
      [e.title, e.subtitle, e.edition, e.speakingPrompt].every(
        (x) => typeof x === "string" && x.trim(),
      ),
    "editorial fields",
  );
  check(
    Array.isArray(e.turns) && e.turns.length > 0 && e.turns.length <= 100,
    "turns",
  );
  check(
    Array.isArray(e.stories) &&
      e.stories.length === 3 &&
      new Set(e.stories.map((s) => s.id)).size === 3,
    "three stories",
  );
  check(
    e.stories.every(
      (s, i) =>
        typeof s.id === "string" &&
        s.title &&
        s.description &&
        s.category &&
        Number.isInteger(s.segmentIndex) &&
        s.segmentIndex >= 0 &&
        s.segmentIndex < e.turns.length &&
        (!i || s.segmentIndex > e.stories[i - 1].segmentIndex),
    ),
    "story boundaries",
  );
  check(
    Array.isArray(e.sources) &&
      e.sources.length >= 3 &&
      e.sources.every(
        (s) => s.title && s.publisher && /^https:\/\//.test(s.url),
      ),
    "sources",
  );
  check(
    t &&
      Number.isFinite(t.durationMs) &&
      t.durationMs > 0 &&
      t.durationMs < 3600000 &&
      t.segments?.length === e.turns.length,
    "timing",
  );
  check(
    Array.isArray(pairs) &&
      pairs.length === e.turns.length &&
      definitions &&
      vocabulary,
    "learning data",
  );
  let previous = 0;
  e.turns.forEach((turn, i) => {
    check(
      turn.length === 3 &&
        ["Camille", "Louis"].includes(turn[0]) &&
        turn.every((x) => typeof x === "string" && x.trim()),
      "speaker/translation",
    );
    check(turn[1].split(" ").every(Boolean), "single-space tokenization");
    const seg = t.segments[i],
      words = turn[1].split(" ");
    check(
      Number.isFinite(seg.startMs) &&
        Number.isFinite(seg.endMs) &&
        seg.startMs >= previous - 30 &&
        seg.endMs >= seg.startMs &&
        seg.endMs <= t.durationMs &&
        seg.words?.length === words.length,
      "segment alignment",
    );
    let last = seg.startMs;
    seg.words.forEach((w, j) => {
      check(
        Number.isFinite(w.startMs) &&
          Number.isFinite(w.endMs) &&
          w.startMs >= last &&
          w.endMs >= w.startMs &&
          w.endMs <= seg.endMs + 30,
        "word alignment",
      );
      last = w.startMs;
      const key = normalize(words[j]);
      check(
        !key ||
          typeof (vocabulary[key]?.meaning ?? definitions[key]) === "string",
        "missing definition",
      );
    });
    previous = seg.endMs;
    check(
      Array.isArray(pairs[i]) &&
        pairs[i].length > 0 &&
        pairs[i].every(
          (p) =>
            p.length === 2 && p.every((x) => typeof x === "string" && x.trim()),
        ) &&
        pairs[i].map((p) => p[0]).join(" ") === turn[1],
      "phrase coverage",
    );
  });
  check(
    featured &&
      Number.isInteger(featured.segmentIndex) &&
      Number.isInteger(featured.startWord) &&
      featured.startWord >= 0 &&
      Number.isInteger(featured.wordCount) &&
      featured.wordCount > 0 &&
      featured.id &&
      featured.meaning &&
      featured.example,
    "featured expression",
  );
  check(
    normalize(
      e.turns[featured.segmentIndex]?.[1]
        .split(" ")
        .slice(featured.startWord, featured.startWord + featured.wordCount)
        .join(" ") || "",
    ) === normalize(featured.text),
    "featured alignment",
  );
  check(
    Array.isArray(t.musicOnlyRanges) &&
      t.musicOnlyRanges.every(
        (r) =>
          Number.isFinite(r.startMs) &&
          r.startMs >= 0 &&
          r.endMs > r.startMs &&
          r.endMs <= t.durationMs,
      ),
    "music ranges",
  );
  check(
    b.audio &&
      b.audio.path === `${b.id}/audio.mp3` &&
      /^[a-f0-9]{64}$/.test(b.audio.sha256) &&
      Number.isSafeInteger(b.audio.bytes) &&
      b.audio.bytes > 0,
    "audio asset",
  );
  return b;
}
module.exports = { assertEditionBundle, ID };
