/* global __dirname */
// Export legacy editions without changing their IDs, media, or source files.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );
const root = path.resolve(__dirname, "..");
const { dictionary } = require("../src/data/dictionary.ts");
const output = path.resolve(process.argv[2] || ".edition-work/bootstrap");
for (const date of ["2026-10-24", "2026-10-25", "2026-10-26"]) {
  const original = date === "2026-10-24";
  const base = path.join(
    root,
    original ? "src/data" : `src/data/editions/${date}`,
  );
  const read = (name) =>
    JSON.parse(fs.readFileSync(path.join(base, name + ".json"), "utf8"));
  let editorial = read("editorial");
  let featured = editorial.featuredPhrase || {
    text: "à portée de main",
    meaning: "within reach",
    segmentIndex: 20,
    startWord: 5,
    wordCount: 4,
    example: "La curiosité à portée de main.",
  };
  let vocabulary = original
    ? require("../src/data/vocabulary.ts").vocabulary
    : read("vocabulary");
  if (original) {
    const old = require("../src/data/episode.ts");
    editorial = {
      ...editorial,
      speakingPrompt: old.speakingPrompt,
      sources: old.episodeSources,
      stories: old.episode.stories.map(({ segmentId, ...s }) => ({
        ...s,
        segmentIndex: old.episode.segments.findIndex((x) => x.id === segmentId),
      })),
    };
    const f = old.featuredPhrase;
    const segmentIndex = old.episode.segments.findIndex(
      (x) => x.id === f.segmentId,
    );
    const words = old.episode.segments[segmentIndex].words;
    const startWord = words.findIndex((x) => x.startMs === f.word.startMs);
    featured = {
      id: f.id,
      text: f.word.text,
      meaning: f.word.meaning,
      segmentIndex,
      startWord,
      wordCount:
        words.findIndex((x) => x.endMs === f.word.endMs) - startWord + 1,
      example: f.example,
    };
  } else
    featured = {
      ...featured,
      id: date.endsWith("25")
        ? "phrase-a-portee-de-main-20261025"
        : "phrase-tenir-compte-de-20261026",
    };
  const id = `daily-fr-${date}`;
  const audio = fs.readFileSync(
    path.join(root, `assets/audio/edition-${date}-cafe.mp3`),
  );
  const bundle = {
    schemaVersion: 1,
    id,
    date,
    revision: 1,
    verifiedAt: editorial.verifiedAt || "2026-10-24T12:00:00Z",
    editorial,
    featured,
    vocabulary,
    definitions: { ...dictionary, ...(original ? {} : read("dictionary")) },
    pairs: read(original ? "phrase-translations" : "phrases"),
    timing: read("audio-timing"),
    audio: {
      path: `${id}/audio.mp3`,
      bytes: audio.length,
      sha256: crypto.createHash("sha256").update(audio).digest("hex"),
    },
  };
  require("../preview/lib/edition-contract.cjs").assertEditionBundle(bundle);
  const folder = path.join(output, id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    path.join(folder, "bundle.json"),
    JSON.stringify(bundle, null, 2) + "\n",
  );
  fs.writeFileSync(path.join(folder, "audio.mp3"), audio);
  console.log(`Exported ${id}`);
}
