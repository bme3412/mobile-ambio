import editorial from "./editorial.json";
import timingData from "./audio-timing.json";
import { dictionary, normalizeWord } from "./dictionary";
import { vocabulary } from "./vocabulary";
import { Episode } from "../domain/types";
export const episode: Episode = {
  id: "daily-fr-2026-10-24",
  title: editorial.title,
  subtitle: editorial.subtitle,
  language: "fr",
  durationMs: timingData.durationMs,
  isMock: false,
  cover: "",
  segments: editorial.turns.map(([speaker, text, translation], i) => {
    const { startMs, endMs } = timingData.segments[i];
    const tokens = text.split(" ");
    const words = tokens.map((text, j) => {
      const key = normalizeWord(text);
      return {
        id: `daily20261024-s${i}-w${j}`,
        text,
        startMs: timingData.segments[i].words[j].startMs,
        endMs: timingData.segments[i].words[j].endMs,
        meaning: vocabulary[key]?.meaning ?? dictionary[key],
      };
    });
    return {
      id: `daily20261024-s${i}`,
      speaker,
      startMs,
      endMs,
      translation,
      words,
    };
  }),
  stories: [
    {
      id: "clocks",
      category: "FRANCE · 25 OCT",
      title: "Une heure de plus",
      description:
        "This weekend, France puts the clocks back. Would you choose morning light or evening light?",
      segmentId: "daily20261024-s4",
    },
    {
      id: "phobos",
      category: "MONDE · 20 OCT",
      title: "Direction Phobos",
      description:
        "Japan’s MMX mission has launched. Why travel so far to bring back ten grams?",
      segmentId: "daily20261024-s12",
    },
    {
      id: "chocolate",
      category: "CULTURE · 28 OCT",
      title: "Curieux de chocolat",
      description:
        "Paris’s upcoming chocolate salon: looking beyond the label to discover craftsmanship.",
      segmentId: "daily20261024-s28",
    },
  ],
};
export const episodeSources = [
  {
    title: "Clock change · night of 24–25 October 2026",
    publisher: "Gouvernement français",
    url: "https://www.info.gouv.fr/actualite/changement-d-heure-ce-qu-il-faut-savoir-sur-le-passage-a-l-heure-d-hiver",
  },
  {
    title: "MMX initial operations complete · 21 October 2026",
    publisher: "JAXA",
    url: "https://global.jaxa.jp/press/2026/10/20261021-1_e.html",
  },
  {
    title: "Phobos mission objectives and planned sample return",
    publisher: "European Space Agency",
    url: "https://www.esa.int/Science_Exploration/Space_Science/Mars_moon_lander_set_to_launch_on_19_October",
  },
  {
    title: "Paris edition · 28 October–1 November 2026",
    publisher: "Salon du Chocolat",
    url: "https://www.salon-du-chocolat.com/en/paris",
  },
];
export const speakingPrompt =
  "Si vous aviez une heure de plus ce week-end, qu’aimeriez-vous découvrir ? Expliquez votre choix et posez une question à un scientifique ou à un artisan.";

const phraseSegment =
  episode.segments.find(
    (s) =>
      s.words.some((w) => w.text === "J’aimerais") &&
      s.words.some((w) => w.text === "comprendre"),
  ) ?? episode.segments[0];
const phraseStart =
  phraseSegment.words.find((w) => w.text === "J’aimerais") ??
  phraseSegment.words[0];
const phraseEnd =
  phraseSegment.words.find((w) => w.text === "comprendre") ?? phraseStart;

export const featuredPhrase = {
  id: "phrase-jaimerais-comprendre-20261024",
  episodeId: episode.id,
  segmentId: phraseSegment.id,
  context: phraseSegment.words.map((w) => w.text).join(" "),
  example: "J’aimerais comprendre un geste.",
  word: {
    id: "phrase-jaimerais-comprendre-20261024",
    text: "j’aimerais comprendre",
    startMs: phraseStart.startMs,
    endMs: phraseEnd.endMs,
    meaning: "I’d like to understand",
  },
};

