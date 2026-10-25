import pairs from "./phrase-translations.json";
import { episode } from "./episode";

export const episodePhrases = episode.segments.flatMap(
  (segment, segmentIndex) => {
    let offset = 0;
    return pairs[segmentIndex].map(([french, translation]) => {
      const count = french.split(" ").length;
      const words = segment.words.slice(offset, offset + count);
      offset += count;
      return { segment, words, translation };
    });
  },
);
export const currentPhrase = (positionMs: number) =>
  episodePhrases[
    Math.max(
      0,
      episodePhrases.findLastIndex(
        ({ words }) => words[0].startMs <= positionMs,
      ),
    )
  ];
