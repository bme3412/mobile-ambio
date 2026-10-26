# Hosted private preview

URL: https://ambio-daily-preview.vercel.app
Vercel team: bme3412
Project: ambio-daily-preview (prj_keLUU1isK4IW2wEptcJyNoomMOS8)
Deployment: dpl_C24fEVerSyvnyukZHLezHgXn2TVL (preview)

The preview runs independently of the development Mac. It serves the exported
Expo web app and audio through one password-checking Node function.
The server-only PREVIEW_PASSWORD environment variable controls access.
The local generated password is in the ignored .preview-password.local file.
Do not commit that file or add the password to EXPO_PUBLIC variables.

Login issues a Secure, HttpOnly, SameSite=Lax cookie lasting 30 days.
Rotating PREVIEW_PASSWORD and redeploying invalidates existing cookies.
All pages, JavaScript, artwork and audio require authentication.
Audio supports byte-range requests for Safari seeking.
This is a private testing gate, not full individual-user authentication.

The initial preview bundles a 96 kbps version of the episode so the complete
audio response stays below the hosting function response-size limit.
Original local audio is unchanged. There is no App Store release.

To update: export with npx expo export --platform web, replace preview/private
with the export, compress the hosted episode to 96 kbps preserving its filename,
run node preview/check.cjs, deploy preview/ with --target preview, and move
the stable alias to the tested deployment. Never deploy the app directory as
a static public export; the private files must remain inside the guarded function.

Normal hosting usage limits apply. No paid password-protection add-on enabled.

When redeploying from the dashboard, select a successful deployment using api/serve.js. The first failed build used the unsupported .cjs function extension; redeploying that snapshot repeats the error. Password changes must target Preview before redeploying.

## Episode update — 24 October 2026

Published the approved “Une heure de plus, un peu plus loin” episode with Lucie and Loïc, 96 English sentence translations, aligned words and 12 vocabulary clips. Hosted audio is 96 kbps, 3,946,310 bytes, approximately 5:28.

Deployment: https://ambio-daily-preview-2hwyt8sq1-bme3412.vercel.app
Stable alias: https://ambio-daily-preview.vercel.app

Export, typecheck, lint and local password-gate/audio-range tests passed. The new hosted player and MP3 both returned 401 without authentication before alias assignment. Preview environment variables and the password handler were not changed. The existing browser session required login; the older locally saved password did not match the configured password, so authenticated hosted playback could not be verified in this session. The owner should sign in with their current preview password. No password reset or App Store release was performed.

## Conversation captions update — 24 October 2026

Deployed the rebuilt web app with incremental learner captions (`conversation.item.input_audio_transcription.delta`); final transcripts replace partial text and commit events preserve fragments. Deployment: `dpl_4Tdw4aZpYZXFX4rrxtG2h9uCzVTZ`, https://ambio-daily-preview-c64jesw6x-bme3412.vercel.app . Stable alias: https://ambio-daily-preview.vercel.app .

This web deployment excludes the native login endpoint and bearer authentication dispatch, honoring the decision to keep native backend changes local. The staged package was created separately from `preview/`; redeploying `preview/` directly would include those additional native endpoints. Existing compressed episode audio was preserved.

Validation: lint, typecheck, 54 tests, web export, staged password/private-assets/audio-range and authenticated mocked voice-proxy tests passed. Deployed conversation and voice endpoints return 401 without authentication. The stored local preview password did not authenticate, so a signed-in live microphone session remains unverified; use the current preview password. No secrets were changed.

## Episode transcript follow fix — 24 October 2026

Deployment: `dpl_A3TcsCyBu64mKcgTRUCXa4vbcoi7`, https://ambio-daily-preview-33mqjgmdv-bme3412.vercel.app . Stable alias updated. Removed the touch-start handler that disabled following on ordinary touches; actual drag/wheel browsing still pauses following. Resuming from the transcript mini-player restores following, and a persistent Play & follow/current-sentence button makes the state explicit. List viewport layout changes retrigger alignment.

Lint, typecheck, all 57 tests, web export and staged private gate/audio-range/voice-proxy checks passed. Verified the deployed signed-in preview starts playback through Play & follow and returns from manual browsing on resume. Native backend remains excluded using the isolated web deployment package `/tmp/ambio-transcript-deploy`.

## Browser playback clock — 24 October 2026

User reports iPhone audio continues while elapsed time and all text views freeze. Web playback now uses a dedicated HTML audio element and reads its currentTime on media events and host polling, without the shared asynchronous native seek queue. Play is called synchronously from the user gesture; restored seeks wait for metadata. Browser visibility no longer explicitly pauses the episode, and foregrounding refreshes the clock. Native playback stays on expo-audio.

Deployment: `dpl_F9j9PQQmZHS3uiN4Zt3ERs4eDTcX`, https://ambio-daily-preview-94nhu9020-bme3412.vercel.app ; stable alias updated. Isolated package `/tmp/ambio-browser-clock-deploy` excludes native auth backend. Lint, typecheck, 64 tests, export, and private gate/audio-range/proxy checks passed. Desktop live preview elapsed time and Focus reader advance after deployment; physical iPhone verification remains pending with the user. Do not characterize desktop verification as iPhone verification.

## Browser clock v3 — 24 October 2026

Removed the browser seeking flag as a reason to suppress currentTime updates. Pending restored seeks are also applied on normal media sync when metadata is already ready, avoiding a missed loadedmetadata event leaving the UI locked. Added a local, selectable Playback diagnostics panel (no telemetry transmission) showing build marker, raw audio clock, displayed clock, readiness, seeking, pause, pending seek and media error.

Deployment: `dpl_FWEkxxhCP5WcM1FxcTYcg2ezJZtA`, https://ambio-daily-preview-5roauwuzk-bme3412.vercel.app ; stable alias updated. Lint, typecheck, 66 tests, export and gated-package checks passed. Native backend still excluded. iPhone owner has been asked for v3 diagnostics if the freeze persists; device-specific resolution remains unconfirmed.

## Confirmed iPhone fix and diagnostics cleanup — 24 October 2026

The owner confirmed clock v3 works on iPhone. Removed the temporary diagnostics UI and its diagnostic API, retaining the playback clock and seek fixes unchanged. Deployed `dpl_53YjHttDPtU4QahBn4UR7DWSHZos` (https://ambio-daily-preview-io68r88b2-bme3412.vercel.app) and updated the stable private alias.

Lint, typecheck, all 66 tests, web export and staged private-gate/audio-range/proxy checks passed. Confirmed the diagnostics control is absent in the signed-in deployed player. Native backend remains excluded in isolated package `/tmp/ambio-clean-clock-deploy`.

## Cleanup regression investigation — 24 October 2026

Owner reports frozen iPhone elapsed time again after cleanup, and confirms diagnostics were closed when v3 previously worked. Restored stable alias to the exact previously confirmed `dpl_FWEkxxhCP5WcM1FxcTYcg2ezJZtA` build. Diagnostics temporarily return in this deployed baseline; local source still contains diagnostics removal. Awaiting on-device baseline check and diagnostic values if it fails. Do not claim the regression resolved or cleanup completed until confirmed.

## Web Audio episode clock — 24 October 2026

Owner reports Play/Pause button changes and stops audible sound while the HTML media diagnostics stay frozen. Replaced web episode playback with a decoded AudioBufferSourceNode scheduled against AudioContext.currentTime; this same engine clock drives the playback snapshot and transcript. Calls resume inside the tap, loads the authenticated complete MP3, and preserves seeks, pause, replay and rates. Native expo-audio path is unchanged. Temporary diagnostics remain removed.

Deployment `dpl_DaZ9noWGYMz5Yv5KUbyLVp7J1ZU5`, https://ambio-daily-preview-10mtpzg61-bme3412.vercel.app ; stable alias updated. Lint, typecheck, 70 tests, export, private gate/range/proxy checks passed. Live desktop preview progressed from 3:02 to 3:07 and Focus reader changed sentences. Physical iPhone confirmation pending.

Tradeoffs: first playback downloads/decodes the full mono episode (about 58–63 MB decoded audio depending on device sample rate); Web Audio rate changes also change pitch. No simulated wall-clock advancement. Isolated `/tmp/ambio-decoded-clock-deploy` continues excluding native auth backend.

## iPhone audible media session — 24 October 2026

Owner confirms Web Audio advances time and synchronizes words, but no sound is audible. Added feature-detected navigator.audioSession.type = playback before creating AudioContext, addressing Safari's default ambient/silent-switch behavior. This is a supported hypothesis; physical iPhone audible output remains to be confirmed.

Deployment `dpl_49nHjuzBSTDtkFytWtZwtxGWyfpi`, https://ambio-daily-preview-m453y6zm0-bme3412.vercel.app ; stable alias updated. Lint, typecheck, 70 tests, export and protected-package checks passed. Diagnostics stay removed; clock behavior unchanged.

## Owner confirmation — 24 October 2026

Owner clarified the no-audio report used the wrong link and confirmed the current audible-clock deployment works. Kept `dpl_49nHjuzBSTDtkFytWtZwtxGWyfpi` on the stable alias. Discarded the unshipped MediaStream output experiment; no further deployment was made. Diagnostics remain removed.

## Compact live words and aligned phrases — 25 October 2026

Removed the player live-words box minimum height. Added 252 manually paired French/English phrases covering every original timed token exactly once. Player live words and Focus reader select a single short phrase by its first word timestamp; Focus reader English switches with the same phrase, and Replay phrase uses its exact audio boundaries. Bilingual transcript pairs short French phrases with English directly underneath instead of a full speaker-turn translation.

Deployment `dpl_CJpyR9CubbjS86g1GGrjpMmCT4uz`, https://ambio-daily-preview-aazmyydtq-bme3412.vercel.app ; stable alias updated. Lint, typecheck, all 72 tests, export and private-package checks passed. Verified compact player layout and paired phrases in signed-in preview. Audio engine unchanged; native backend remains excluded.

## Prevent Git pushes from replacing the private preview — 25 October 2026

Pushing commit 96a3f17 triggered an empty production deployment from the repository root (`dpl_C7qHa2Zkp1wyAox3PFxai1iQ6oNA`) and reassigned the stable preview domain, producing Vercel 404 responses. Restored the alias to the verified phrase-sync deployment `dpl_CJpyR9CubbjS86g1GGrjpMmCT4uz`. Unauthenticated /player now returns the expected 401 password gate.

Root vercel.json disables Git-triggered deployments. Continue deploying the explicitly packaged, password-gated web preview via CLI; ordinary source pushes must not replace it. This does not enable the still-local native backend or change preview credentials.

### Home layout refresh — 25 October 2026

Private alias now points to `dpl_EUfnYHQszmmDTFaL7rEKNoeuR5cb`
(`ambio-daily-preview-em8oajxt0-bme3412.vercel.app`). Export:
`/tmp/ambio-home-refresh`; isolated deployment: `/tmp/ambio-home-refresh-deploy`.
Includes a shared desktop frame for content/navigation, improved hero contrast and
spacing, selectable story details with vocabulary previews, and playback-aware
primary actions. Existing compressed audio and private gate retained; native auth
backend excluded. Typecheck/lint, 72 existing tests and 2 new home interaction tests
passed. Browser verified selection, changed vocabulary, and definition opening.

### Native Talk activation — 25 October 2026

User explicitly authorized native backend deployment. Private alias now points to `dpl_Ci7DX8vsVX9a4kGLxUKKxSrK4uyA` (`ambio-daily-preview-8n579pob3-bme3412.vercel.app`). Staging: `/tmp/ambio-native-talk-deploy`. Current web assets preserved; native login and bearer-token dispatch enabled. Native/backend checks, lint, typecheck and 74 tests pass. Live invalid-auth checks pass and authenticated health reports available. Physical iPhone voice acceptance remains pending.
