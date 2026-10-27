/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const registry = {};
for (const date of ["2026-10-24", "2026-10-25", "2026-10-26"]) {
  const base = date.endsWith("24") ? "src/data" : `src/data/editions/${date}`;
  const pairs = require(
    path.join(
      root,
      base,
      date.endsWith("24") ? "phrase-translations.json" : "phrases.json",
    ),
  );
  const editorial = require(path.join(root, base, "editorial.json"));
  const phrases = {};
  pairs.forEach((turn, i) => {
    if (turn.map(([fr]) => fr).join(" ") !== editorial.turns[i][1])
      throw Error(`Phrase mismatch ${date}/${i}`);
    let offset = 0;
    for (const [text] of turn) {
      phrases[`daily${date.replaceAll("-", "")}-s${i}-w${offset}`] = text;
      offset += text.split(" ").length;
    }
  });
  registry[`daily-fr-${date}`] = phrases;
}
fs.writeFileSync(
  path.join(root, "preview/lib/practice-phrases.json"),
  JSON.stringify(registry, null, 2) + "\n",
);
