import { buildEdition } from "./buildEdition";
import { assertEditionBundle as validate } from "../../preview/lib/edition-contract.cjs";
type Input = Parameters<typeof buildEdition>[0];
export type EditionBundle = Omit<Input, "audio"> & {
  schemaVersion: 1;
  artwork?: { dataUri: string; description: string; label: string };
  id: string;
  revision: number;
  verifiedAt: string;
  audio: { path: string; bytes: number; sha256: string };
};
export function assertEditionBundle(
  value: unknown,
): asserts value is EditionBundle {
  validate(value);
}
export function fromBundle(bundle: EditionBundle, audio: string | number = "") {
  const result = buildEdition({ ...bundle, audio });
  result.verifiedAt = bundle.verifiedAt;
  if (bundle.artwork) {
    result.episode.cover = bundle.artwork.dataUri;
    result.episode.coverDescription = bundle.artwork.description;
  }
  if (bundle.revision > 1) {
    const old = `daily${bundle.date.replaceAll("-", "")}`;
    const next = `${old}r${bundle.revision}`;
    result.episode.id = bundle.id;
    for (const segment of result.episode.segments) {
      segment.id = segment.id.replace(old, next);
      for (const word of segment.words) word.id = word.id.replace(old, next);
    }
    for (const story of result.episode.stories)
      story.segmentId = story.segmentId.replace(old, next);
    const featured = result.featuredPhrase;
    featured.id += `@r${bundle.revision}`;
    featured.word.id = featured.id;
    featured.episodeId = bundle.id;
    featured.segmentId = featured.segmentId.replace(old, next);
  }
  return result;
}
