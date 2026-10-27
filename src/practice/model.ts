import { findEdition } from "../data/catalog";

export function practiceMaterial(
  episodeId: string,
  storyId?: string,
  segmentId?: string,
) {
  const edition = findEdition(episodeId);
  if (!edition) return null;
  const segment = segmentId
    ? edition.episode.segments.find((s) => s.id === segmentId)
    : undefined;
  if (segmentId && !segment) return null;
  const stories = edition.episode.stories;
  const index = storyId
    ? stories.findIndex((story) => story.id === storyId)
    : -1;
  if (storyId && index < 0) return null;
  const boundary = (i: number) =>
    edition.episode.segments.find((s) => s.id === stories[i]?.segmentId)
      ?.startMs;
  const start = index < 0 ? 0 : boundary(index)!;
  const end = index < 0 ? Infinity : (boundary(index + 1) ?? Infinity);
  return {
    title: segment
      ? "Practise this passage"
      : index < 0
        ? edition.episode.title
        : stories[index].title,
    episodeId,
    phrases: edition.episodePhrases
      .filter(
        (p) =>
          p.words[0].startMs >= start &&
          p.words[0].startMs < end &&
          (!segment || p.segment.id === segment.id),
      )
      .map((p) => ({
        id: p.words[0].id,
        text: p.words.map((w) => w.text).join(" "),
        translation: p.translation,
        words: p.words,
      })),
  };
}
