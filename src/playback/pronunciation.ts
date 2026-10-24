import { createAudioPlayer } from "expo-audio";
import { normalizeWord } from "../data/dictionary";
import { player } from "./player";
const clips: Record<string, number> = {
  reculer: require("../../assets/audio/edition02-word-0.mp3"),
  trompeuse: require("../../assets/audio/edition02-word-1.mp3"),
  sonde: require("../../assets/audio/edition02-word-2.mp3"),
  prélever: require("../../assets/audio/edition02-word-3.mp3"),
  échantillons: require("../../assets/audio/edition02-word-4.mp3"),
  hypothèses: require("../../assets/audio/edition02-word-5.mp3"),
  départager: require("../../assets/audio/edition02-word-6.mp3"),
  dégustations: require("../../assets/audio/edition02-word-7.mp3"),
  saveurs: require("../../assets/audio/edition02-word-8.mp3"),
  bouchée: require("../../assets/audio/edition02-word-9.mp3"),
  décroche: require("../../assets/audio/edition02-word-10.mp3"),
  savoirfaire: require("../../assets/audio/edition02-word-11.mp3"),
};
let clip: ReturnType<typeof createAudioPlayer> | null = null;
export const hasPronunciation = (word: string) =>
  Boolean(clips[normalizeWord(word)]);
export const stopPronunciation = () => {
  clip?.remove();
  clip = null;
};
export const pronounce = (word: string) => {
  const source = clips[normalizeWord(word)];
  if (!source) return;
  player.pause();
  stopPronunciation();
  clip = createAudioPlayer(source);
  clip.addListener("playbackStatusUpdate", (status) => {
    if (status.didJustFinish) stopPronunciation();
  });
  clip.play();
};
