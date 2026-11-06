// Shared by mobile, web and publishing. Photos remain optional for old bundles.
function assertStoryArtwork(artwork, storyIds) {
  const check = (ok) => { if (!ok) throw Error("Invalid edition: story photographs"); };
  if (artwork === undefined) return;
  check(artwork && typeof artwork === "object" && !Array.isArray(artwork));
  check(Object.keys(artwork).length <= 3);
  const size = encodeURIComponent(JSON.stringify(artwork)).replace(/%[A-F\d]{2}/g, "x").length;
  check(size <= 600000);
  for (const [id, photo] of Object.entries(artwork)) {
    check(storyIds.includes(id) && photo && typeof photo === "object");
    for (const key of ["dataUri", "thumbnailDataUri"]) {
      check(typeof photo[key] === "string" && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo[key]));
    }
    for (const key of ["description", "caption", "creator", "license", "licenseUrl", "sourcePage"]) {
      check(typeof photo[key] === "string" && photo[key].trim().length > 0 && photo[key].length <= 2000);
    }
    check(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:[^\s]+$/.test(photo.sourcePage));
    const cc = /^CC BY (1\.0|2\.0|2\.5|3\.0|4\.0)$/.exec(photo.license);
    const expected = cc ? `https://creativecommons.org/licenses/by/${cc[1]}` :
      photo.license === "CC0" ? "https://creativecommons.org/publicdomain/zero/1.0" :
      photo.license === "Public domain" ? "https://creativecommons.org/publicdomain/mark/1.0" : null;
    check(expected && photo.licenseUrl.replace(/\/$/, "") === expected);
  }
}
module.exports = { assertStoryArtwork };
