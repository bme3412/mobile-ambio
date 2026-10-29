import type { ImageSourcePropType } from "react-native";

export type EditorialArtwork = {
  source: ImageSourcePropType;
  description: string;
  label: "Illustration" | "AI illustration";
  aspectRatio: number;
};
const art = (
  source: ImageSourcePropType,
  description: string,
): EditorialArtwork => ({
  source,
  description,
  label: "Illustration",
  aspectRatio: 1.5,
});
const brazil = art(
  require("../../assets/editorial/brazil.jpg"),
  "Paper-cut illustration of Brazil’s Congress beneath an ochre sun, with a folded ballot in the foreground.",
);
export const editorialArtwork: Record<
  string,
  {
    cover: EditorialArtwork;
    stories: Partial<Record<string, EditorialArtwork>>;
  }
> = {
  "daily-fr-2026-10-27": {
    cover: art(
      require("../../assets/editorial/oct27.jpg"),
      "A house and coins, a bat and a watercolor palette illustrate household confidence, bat origins and an art workshop.",
    ),
    stories: {},
  },
  "daily-fr-2026-10-26": {
    cover: brazil,
    stories: {
      brazil,
      france: art(
        require("../../assets/editorial/education.jpg"),
        "An open book becomes a staircase toward a university doorway, with small abstract students.",
      ),
      anthropic: art(
        require("../../assets/editorial/ai-finances.jpg"),
        "Abstract computer servers, an abacus and accounting papers illustrate the economics of AI.",
      ),
    },
  },
  "daily-fr-2026-10-25": {
    cover: art(
      require("../../assets/editorial/oct25.jpg"),
      "A space capsule, museum arch, abstract painting and open book evoke discovery.",
    ),
    stories: {},
  },
  "daily-fr-2026-10-24": {
    cover: art(
      require("../../assets/editorial/oct24.jpg"),
      "A sculptural clock, lavender moon and chocolate squares evoke time, space and craftsmanship.",
    ),
    stories: {},
  },
};

// Neutral existing artwork for editions without a dedicated illustration.
export const defaultEditorialArtwork = art(
  require("../../assets/paris-cafe-hero.png"),
  "Ambio café illustration.",
);

export function artworkForEpisode(episode: {
  id: string;
  cover: string;
  coverDescription?: string;
}): EditorialArtwork | undefined {
  if (episode.cover.startsWith("data:image/jpeg;base64,"))
    return {
      source: { uri: episode.cover },
      description: episode.coverDescription ?? "Edition illustration",
      label: "AI illustration",
      aspectRatio: 1.5,
    };
  return editorialArtwork[episode.id.split("@")[0]]?.cover;
}
export function artworkForStory(episodeId: string, storyId: string) {
  return editorialArtwork[episodeId.split("@")[0]]?.stories[storyId];
}
