import { Episode } from "../domain/types";
import { dictionary, normalizeWord } from "./dictionary";
import { vocabulary as originalVocabulary } from "./vocabulary";

type Editorial = {
  title: string;
  subtitle: string;
  edition: string;
  verifiedAt?: string;
  turns: string[][];
  speakingPrompt: string;
  stories: {
    id: string;
    category: string;
    title: string;
    description: string;
    segmentIndex: number;
  }[];
  sources: { title: string; publisher: string; url: string }[];
};
type Timing = {
  durationMs: number;
  model: string;
  segments: {
    startMs: number;
    endMs: number;
    words: { startMs: number; endMs: number }[];
  }[];
  musicOnlyRanges: { startMs: number; endMs: number }[];
};
type Featured = {
  id: string;
  text: string;
  meaning: string;
  segmentIndex: number;
  startWord: number;
  wordCount: number;
  example: string;
};
export function buildEdition({
  date,
  editorial,
  timing,
  pairs,
  definitions,
  vocabulary,
  audio,
  featured,
}: {
  date: string;
  editorial: Editorial;
  timing: Timing;
  pairs: string[][][];
  definitions: Record<string, string>;
  vocabulary: typeof originalVocabulary;
  audio: number | string;
  featured: Featured;
}) {
  const compact = date.replaceAll("-", "");
  const meanings = { ...dictionary, ...definitions };
  if (
    editorial.turns.length !== timing.segments.length ||
    pairs.length !== editorial.turns.length
  )
    throw new Error(`Incomplete edition ${date}`);
  const episode: Episode = {
    id: `daily-fr-${date}`,
    title: editorial.title,
    subtitle: editorial.subtitle,
    language: "fr",
    cover: "",
    isMock: false,
    durationMs: timing.durationMs,
    segments: editorial.turns.map(([speaker, text, translation], i) => {
      const tokens = text.split(" "),
        aligned = timing.segments[i];
      if (tokens.length !== aligned.words.length)
        throw new Error(`Word alignment mismatch: ${date} turn ${i}`);
      return {
        id: `daily${compact}-s${i}`,
        speaker,
        translation,
        startMs: aligned.startMs,
        endMs: aligned.endMs,
        words: tokens.map((text, j) => ({
          id: `daily${compact}-s${i}-w${j}`,
          text,
          ...aligned.words[j],
          meaning:
            vocabulary[normalizeWord(text)]?.meaning ??
            meanings[normalizeWord(text)],
        })),
      };
    }),
    stories: editorial.stories.map(({ segmentIndex, ...story }) => ({
      ...story,
      segmentId: `daily${compact}-s${segmentIndex}`,
    })),
  };
  const episodePhrases = episode.segments.flatMap((segment, i) => {
    if (pairs[i].map(([fr]) => fr).join(" ") !== editorial.turns[i][1])
      throw new Error(`Phrase mismatch: ${date} turn ${i}`);
    let offset = 0;
    return pairs[i].map(([french, translation]) => {
      const words = segment.words.slice(
        offset,
        offset + french.split(" ").length,
      );
      offset += words.length;
      return { segment, words, translation };
    });
  });
  const segment = episode.segments[featured.segmentIndex];
  const words = segment.words.slice(
    featured.startWord,
    featured.startWord + featured.wordCount,
  );
  if (
    !words.length ||
    normalizeWord(words.map((w) => w.text).join(" ")) !==
      normalizeWord(featured.text)
  )
    throw new Error(`Featured phrase mismatch: ${date}`);
  return {
    episode,
    date: editorial.edition.replace(/^[^ ]+ /, ""),
    verifiedAt: editorial.verifiedAt,
    episodeSources: editorial.sources,
    speakingPrompt: editorial.speakingPrompt,
    vocabulary,
    audioTiming: timing,
    episodePhrases,
    audio,
    featuredPhrase: {
      id: featured.id,
      episodeId: episode.id,
      segmentId: segment.id,
      context: editorial.turns[featured.segmentIndex][1],
      example: featured.example,
      word: {
        id: featured.id,
        text: featured.text,
        meaning: featured.meaning,
        startMs: words[0].startMs,
        endMs: words[words.length - 1].endMs,
      },
    },
  };
}
