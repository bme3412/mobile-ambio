# Editorial mobile design and contextual photographs

The interface uses shared tokens in `src/components/theme.ts`: white, near-black,
blue actions, gray rules, and a red masthead accent. All five tabs share the
masthead. Reader, playback, practice, recap, sheets, and the mini-player inherit
the same palette. Native layouts retain safe areas and scalable text.

Episodes features the active unfinished edition if it matches the search/filter,
otherwise the first matching catalog edition (catalog ordering is newest first).
The featured edition is excluded from discovery rows. Row presses select the
edition and navigate to `/player?details=1` without calling play. Separate play
buttons resume or restart completed episodes. Details contains downloads,
transcript access, episode/story practice, saved transcript control, and sources.

## Photographs

The producer now calls `select_story_artwork` instead of generating a collage.
Each story gets at most one Commons search (five candidates), a bounded metadata
selection, and one download. Search-query extraction and relevance selection use
the existing budgeted/cached text model, never an image generator. Missing model
configuration, exhausted photo-selection budget, timeout, invalid metadata, or
no suitable photograph records a reason and returns no photo for that story.

Only JPEGs with photographic metadata, adequate dimensions, verified creator
and description, and an allowlisted license are eligible. The selector rejects
illustrations, AI-image metadata, untrusted download hosts, and ambiguous subject
matches. Accepted licenses: public domain, CC0, and CC BY 1.0/2.0/2.5/3.0/4.0.
License URLs must agree with the license name. This deliberately excludes
share-alike and noncommercial images from the initial automatic workflow.
Metadata-based selection is conservative, but is not a human visual review.

The optional `storyArtwork` map is keyed by the edition's actual story IDs.
Each entry includes JPEG data URIs for hero and thumbnail, description, contextual
caption, source page, creator, license, and license URL. Hero images are at most
1200px; thumbnails at most 160px. Total serialized photo payload is limited to
600,000 bytes including base64 and metadata. Shared runtime validation checks
this map in publishing, the backend, and the app. Bundles remain schema version 1.
The existing optional legacy `artwork` field is still accepted, but new clients
show only verified photos or placeholders. The lead story alone supplies the
cover. Missing lead imagery never borrows another story's photo.

Selections (including failures) are checkpointed by story ID, full story-content
fingerprint, and selector version. Changed story content invalidates the entry.
A failed lookup is not retried indefinitely within the same edition run. Publish
new revisions for deliberate later corrections; published bundles stay immutable.

Install Python image processing with:

```sh
python3 -m pip install -r scripts/daily/requirements.txt
```

The scheduled workflow installs this dependency. `COMMONS_USER_AGENT` can override
the default identifying user agent. Existing text-model cost settings and daily
budget continue to apply. There is no new API key for Commons.

Photos and attribution travel in the cached edition bundle and work offline.
Full-size images expose a credit disclosure with source/license links and a
resizing/cropping notice. Thumbnails use the same photo; full credits are available
in edition details. The three locally bundled editions (24–26 October 2026) now include nine
visually reviewed Commons photographs in `src/data/bundled-story-photos.json`.
Each story retains its own source and license; captions distinguish subject/place
photos from reported events. These embedded assets and credits work offline.
Published remote editions remain unchanged; this is a local catalog backfill.

Official API references:
- https://www.mediawiki.org/wiki/API:Imageinfo
- https://commons.wikimedia.org/wiki/Commons:API/MediaWiki
- https://docs.expo.dev/router/reference/url-parameters/

## Verification

- Unit/integration checks cover photo matching, missing/invalid licensing,
  attribution, rejected non-photos, failed downloads, bounded payloads, cache
  invalidation/reuse, backward compatibility and lead/story mapping.
- Screen interaction checks cover filters, search, resume priority, separate
  details/play actions, and replay from the beginning.
- Browser inspection at 320, 390 and 412px covered Episodes, Home, details,
  transcript, Saved, Progress and Talk's unavailable state. A temporary local
  fixture verified a real CC BY 2.5 Louvre photograph on its Louvre story with
  working credit disclosure. This fixture is not production content.
- Expo web/iOS/Android JavaScript exports succeed. Signed native installers,
  physical-device microphone behavior, and native accessibility text scaling
  still require device acceptance. No cloud build or production publish was run.

## Hosted and TestFlight release — November 5, 2026

Source commit: `6d21232c693964a1f4b90bb9e67a6faa19abd790`.
The private staging website is deployed at https://ambio-daily-staging.vercel.app
(Vercel deployment `dpl_D17mLpe62MfLZoK3nK4kwMby9zQZ`). Live authentication,
photo-bundle checksum, catalog, audio ranges, and voice health checks passed.

EAS staging iOS build **1.0.0 (21)** completed successfully:
https://expo.dev/accounts/bme3412s-team/projects/ambio/builds/00cb0ac5-46d9-4f4f-b762-afddc08c5baa

Automatic TestFlight submission finished successfully:
https://expo.dev/accounts/bme3412s-team/projects/ambio/submissions/e27d64a3-76ed-483d-aacf-feb5c6bddb48

The app uses the existing staging backend and includes all nine bundled story
photographs. Apple processing and on-device availability were not independently
verified. No public App Store review was requested. Lint and typecheck passed
before submission, with the same ten existing test-file lint warnings.
