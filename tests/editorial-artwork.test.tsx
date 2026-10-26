import { fireEvent, render } from "@testing-library/react-native";
import { EditorialImage } from "../src/components/EditorialImage";
import { editorialArtwork } from "../src/data/editorialArtwork";
import { latestEdition, LATEST_EPISODE_ID } from "../src/data/catalog";

test("latest edition and all featured stories have bundled artwork", () => {
  expect(latestEdition.episode.id).toBe(LATEST_EPISODE_ID);
  for (const story of latestEdition.episode.stories) {
    expect(
      editorialArtwork[LATEST_EPISODE_ID].stories[story.id]?.source,
    ).toBeTruthy();
  }
});
test("missing and failed illustrations preserve a readable fallback", async () => {
  const ui = await render(<EditorialImage />);
  expect(ui.getByLabelText("Illustration unavailable")).toBeTruthy();
  const artwork = editorialArtwork[LATEST_EPISODE_ID].cover;
  await ui.rerender(<EditorialImage artwork={artwork} />);
  await fireEvent(ui.getByLabelText(artwork.description), "error");
  expect(ui.getByLabelText("Illustration unavailable")).toBeTruthy();
});
