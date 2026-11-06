import { fireEvent, render } from "@testing-library/react-native";
import { EditorialImage } from "../src/components/EditorialImage";
import {
  artworkForEpisode,
  artworkForStory,
} from "../src/data/editorialArtwork";
import { assertEditionBundle, fromBundle } from "../src/data/editionBundle";
import { fixture } from "./edition-fixture";
import type { StoryPhoto } from "../src/domain/types";
const photo: StoryPhoto = {
  dataUri: "data:image/jpeg;base64,/9j/AAAA",
  thumbnailDataUri: "data:image/jpeg;base64,/9j/BBBB",
  description: "The Louvre courtyard in Paris",
  caption: "Contextual photograph of the museum, not the reported event.",
  creator: "Ada Photographer",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourcePage: "https://commons.wikimedia.org/wiki/File:Louvre.jpg",
};
test("legacy bundles load but never substitute illustration for a photograph", () => {
  const b = fixture();
  assertEditionBundle(b);
  expect(artworkForEpisode(fromBundle(b).episode)).toBeUndefined();
});
test("story mapping survives revision identity; cover only uses lead story", () => {
  const b = fixture(2),
    [first, second] = b.editorial.stories;
  b.storyArtwork = { [second.id]: photo };
  assertEditionBundle(b);
  const episode = fromBundle(b).episode;
  expect(artworkForEpisode(episode)).toBeUndefined();
  expect(artworkForStory(episode, second.id)?.photo).toEqual(photo);
  b.storyArtwork[first.id] = photo;
  expect(artworkForEpisode(fromBundle(b).episode)?.photo).toEqual(photo);
});
test("invalid photo licenses, mismatched story IDs and oversized payloads are rejected", () => {
  const b = fixture(),
    id = b.editorial.stories[0].id;
  for (const photos of [
    { unknown: photo },
    { [id]: { ...photo, license: "CC BY-NC 4.0" } },
    { [id]: { ...photo, creator: "" } },
    { [id]: { ...photo, sourcePage: "javascript:alert(1)" } },
    {
      [id]: {
        ...photo,
        dataUri: "data:image/jpeg;base64,/9j/" + "A".repeat(600000),
      },
    },
  ]) {
    b.storyArtwork = photos;
    expect(() => assertEditionBundle(b)).toThrow();
  }
});
test("missing and failed photos preserve a readable fallback across rerenders", async () => {
  const ui = await render(<EditorialImage />);
  expect(ui.getByLabelText("Photograph unavailable")).toBeTruthy();
  const episode = fromBundle(fixture()).episode;
  episode.storyArtwork = { [episode.stories[0].id]: photo };
  await ui.rerender(<EditorialImage artwork={artworkForEpisode(episode)} />);
  await fireEvent(ui.getByLabelText(photo.description), "error");
  await ui.rerender(<EditorialImage artwork={artworkForEpisode(episode)} />);
  expect(ui.getByLabelText("Photograph unavailable")).toBeTruthy();
});
test("cached attribution remains readable without a network request", async () => {
  const episode = fromBundle(fixture()).episode;
  episode.storyArtwork = { [episode.stories[0].id]: photo };
  const ui = await render(
    <EditorialImage artwork={artworkForEpisode(episode)} />,
  );
  await fireEvent.press(ui.getByLabelText("Photo credit"));
  expect(ui.getByText(photo.caption)).toBeTruthy();
  expect(ui.getByText("CC BY 4.0 ↗")).toBeTruthy();
});
