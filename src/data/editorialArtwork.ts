import type { Episode, StoryPhoto } from "../domain/types";
import type { ImageSourcePropType } from "react-native";

export type EditorialArtwork = {
  source: ImageSourcePropType;
  description: string;
  label: "Photograph";
  photo?: StoryPhoto;
  thumbnail?: ImageSourcePropType;
  aspectRatio: number;
};
function photoArtwork(photo?: StoryPhoto): EditorialArtwork | undefined {
  return photo
    ? {
        source: { uri: photo.dataUri },
        thumbnail: { uri: photo.thumbnailDataUri },
        description: photo.description,
        label: "Photograph",
        aspectRatio: 1.85,
        photo,
      }
    : undefined;
}

// The first story is the editorial lead. Never substitute another story or
// legacy illustration when its photograph is unavailable.
export function artworkForEpisode(
  episode: Pick<Episode, "stories" | "storyArtwork">,
) {
  return photoArtwork(episode.storyArtwork?.[episode.stories[0]?.id]);
}
export function artworkForStory(
  episode: Pick<Episode, "storyArtwork">,
  storyId: string,
) {
  return photoArtwork(episode.storyArtwork?.[storyId]);
}
