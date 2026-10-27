function referenceFor(bundle, phraseId) {
  if (!phraseId) return undefined;
  const prefix = `daily${bundle.date.replaceAll("-", "")}${bundle.revision === 1 ? "" : `r${bundle.revision}`}`;
  for (let i = 0; i < bundle.pairs.length; i++) {
    let offset = 0;
    for (const [text] of bundle.pairs[i]) {
      if (phraseId === `${prefix}-s${i}-w${offset}`) return text;
      offset += text.split(" ").length;
    }
  }
  throw Error("Unknown practice phrase");
}
module.exports = { referenceFor };
