import {
  episode,
  episodeSources,
  speakingPrompt,
  featuredPhrase,
} from "./episode";
import { episodePhrases } from "./phrases";
import { vocabulary } from "./vocabulary";
import audioTiming from "./audio-timing.json";
import editorial25 from "./editions/2026-10-25/editorial.json";
import timing25 from "./editions/2026-10-25/audio-timing.json";
import vocabulary25 from "./editions/2026-10-25/vocabulary.json";
import definitions25 from "./editions/2026-10-25/dictionary.json";
import pairs25 from "./editions/2026-10-25/phrases.json";
import editorial26 from "./editions/2026-10-26/editorial.json";
import timing26 from "./editions/2026-10-26/audio-timing.json";
import vocabulary26 from "./editions/2026-10-26/vocabulary.json";
import definitions26 from "./editions/2026-10-26/dictionary.json";
import pairs26 from "./editions/2026-10-26/phrases.json";
import { buildEdition } from "./buildEdition";
import { useLibrary } from "../state/library";

export const DEFAULT_EPISODE_ID = "daily-fr-2026-10-24";
const original = {
  episode,
  date: "24 octobre 2026",
  verifiedAt: undefined as string | undefined,
  episodeSources,
  speakingPrompt,
  featuredPhrase,
  episodePhrases,
  vocabulary,
  audioTiming,
  audio: require("../../assets/audio/edition-2026-10-24-cafe.mp3"),
};
export const editions = [
  buildEdition({
    date: "2026-10-26",
    editorial: editorial26,
    timing: timing26,
    pairs: pairs26,
    definitions: definitions26,
    vocabulary: vocabulary26,
    audio: require("../../assets/audio/edition-2026-10-26-cafe.mp3"),
    featured: {
      ...editorial26.featuredPhrase,
      id: "phrase-tenir-compte-de-20261026",
    },
  }),
  buildEdition({
    date: "2026-10-25",
    editorial: editorial25,
    timing: timing25,
    pairs: pairs25,
    definitions: definitions25,
    vocabulary: vocabulary25,
    audio: require("../../assets/audio/edition-2026-10-25-cafe.mp3"),
    featured: {
      id: "phrase-a-portee-de-main-20261025",
      text: "à portée de main",
      meaning: "within reach",
      segmentIndex: 20,
      startWord: 5,
      wordCount: 4,
      example: "La curiosité à portée de main.",
    },
  }),
  original,
];
export const latestEdition = editions[0];
export const findEdition = (id: string) =>
  editions.find((item) => item.episode.id === id);
export const getEdition = (id: string) =>
  findEdition(id) ?? findEdition(DEFAULT_EPISODE_ID)!;
export const editionForSegment = (id: string) =>
  editions.find((item) =>
    item.episode.segments.some((segment) => segment.id === id),
  ) ?? getEdition(DEFAULT_EPISODE_ID);
export const phraseAt = (phrases: typeof episodePhrases, positionMs: number) =>
  phrases[
    Math.max(
      0,
      phrases.findLastIndex(({ words }) => words[0].startMs <= positionMs),
    )
  ];
export function useEpisodeData() {
  const id = useLibrary((state) => state.activeEpisodeId);
  const data = getEdition(id);
  return {
    ...data,
    currentPhrase: (positionMs: number) =>
      phraseAt(data.episodePhrases, positionMs),
  };
}
