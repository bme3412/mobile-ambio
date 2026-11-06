import { editions } from "../src/data/catalog";
import { artworkForEpisode, artworkForStory } from "../src/data/editorialArtwork";
// The publishing validator also checks embedded local photo payloads.
import { assertEditionBundle } from "../src/data/editionBundle";
import { fixture } from "./edition-fixture";

test("all bundled stories have distinct, attributed offline photos within the edition budget", () => {
  expect(editions).toHaveLength(3);
  const sources = new Set<string>();
  for (const { episode } of editions) {
    const ids = episode.stories.map((story) => story.id);
    expect(Object.keys(episode.storyArtwork!)).toEqual(ids);
    const bundle = fixture();
    bundle.editorial.stories = bundle.editorial.stories.map((story, i) => ({ ...story, id: ids[i] }));
    bundle.storyArtwork = episode.storyArtwork;
    expect(() => assertEditionBundle(bundle)).not.toThrow();
    for (const story of episode.stories) {
      const photo = artworkForStory(episode, story.id)!.photo!;
      expect(photo.caption).toMatch(/Context|context/);
      sources.add(photo.sourcePage);
    }
    expect(artworkForEpisode(episode)?.photo).toBe(episode.storyArtwork![ids[0]]);
  }
  expect(sources.size).toBe(9);
});
