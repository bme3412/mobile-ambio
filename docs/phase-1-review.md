# Phase 1 prototype review

The original brief was reviewed screen by screen. This iteration is local only: no cloud build, deployment, backend provisioning, or paid API calls.

| Screen | Completed local interactions |
| --- | --- |
| Home | Editorial episode, French selector explaining single-language scope, three story seek shortcuts, Talk shortcut, continue listening and persistent mini-player |
| Player | Play/pause, ±15 seconds, speed, touch seeking and accessible increment/decrement, expandable current transcript preview, saved transcript, Talk action |
| Transcript | Timed highlight, selectable words, sentence replay, bilingual display, search/empty results, manual browse mode, Back to Live, compact controls, initial-position tracking after layout |
| Word sheet | Authored definitions for every selectable fixture word, context and translation, save/unsave, bounded word and sentence timing replay, scrollable sheet with backdrop dismissal |
| Saved | Persistent expressions, source context, replay, review status, reveal-and-review practice, saved transcripts and session history |
| Conversation | Three scripted turns, typed or sample responses, captions, language help, simulated tutor interruption, end and persist session |
| Recap | Full user/tutor transcript, applicable authored correction, natural-phrasing example, save/unsave expression and return to listening |

## Verification

- TypeScript, ESLint and all 17 tests pass.
- iOS Hermes and web bundle export succeed locally. Exporting creates files in `dist/`; it does not deploy them.
- Browser walkthrough at 390 × 844 verified player expansion and saving, initial transcript positioning, definitions, practice reveal/review, three conversation turns including typed input, persisted recap and expression saving.
- Regression coverage includes playback end/range bounds, definition coverage, paused/silent tracking, hydration, manual browse suppression, initial-layout follow behavior, practice, conversation and accessible seek actions.
- Haptics are native-only and fail gracefully. Reduce Motion disables automatic scroll animation. Text scaling remains enabled, controls have accessibility labels, sheets scroll, and the page container avoids the iOS keyboard.

## Deliberate Phase 1 boundaries

Audio, pronunciation and tutor speech are simulated. The word/passage replay controls advance the replaceable clock and stop at the selection boundary; they do not produce sound. Tutor responses are prewritten and clearly labeled. User text is stored locally and does not produce an AI assessment. Email delivery remains a later integration.

The remote editorial image has an offline fallback; the fixture and library operate locally. Full Xcode is absent, so iPhone simulator launch, native VoiceOver, hardware haptics, maximum Dynamic Type sizes and native keyboard behavior are not verified. Very long production transcripts still need device performance testing. Existing Expo tooling dependency advisories remain documented in README.

See `architecture.md` for module boundaries and `integrations.md` for Phase 2 services. EAS setup exists from an earlier request, but was not used for this local iteration.

## Reference-led visual redesign

Home now uses a full-width photo, overlaid editorial headline, green play action and three story thumbnails. The player uses a large circular transport control and compact transcript/preview/save actions. Transcript rows use a timestamp gutter, small replay icons, lavender passage focus and a persistent artwork dock. Word details use a scrollable bottom sheet with a mint definition panel. Saved words use expandable rows with All / To review / Reviewed filters. Existing conversation, recap and practice screens inherit the navy, emerald and warm-white theme.

Verified locally at 390 × 844. New library-filter interaction coverage brings the suite to 17 passing tests. External photos remain optional network assets with colored/text fallbacks. No video or waveform is implied, and playback remains explicitly simulated.

### Café visual refinement
Home now bundles an AI-generated Paris café photograph (`assets/paris-cafe-hero.png`) with a continuous warm-to-dark gradient. Lucide SVG icons replace text symbols in navigation, playback, word actions, and Home controls. Checked at 390 × 844 in the local browser; existing 17 interaction tests, typecheck, and lint pass. No deployment or EAS build was started.

### Shared artwork and reading surfaces
The bundled café artwork is now shared by Home, player, and mini-player. Transcript includes French, Bilingual, and Key points modes; tapping a key point seeks and starts its story. Saved Words uses compact context rows with purple speaker icons and mint review details. Verified locally at 390 × 844; 17 regression tests, typecheck, and lint pass.

### Researched episode and two-host audio
Episode 01, “Ce qu’on choisit de partager,” replaces the generic fixture with three dated stories (Seine swimming, EU nature restoration, and UNESCO baguette heritage). Original French dialogue and English translations live in `src/data/editorial.json`; primary source links appear in the player. Twelve curated vocabulary entries include phonetics, definitions, examples and separate pronunciation clips. The speaking studio now asks listeners to choose a public project, justify their priority, and express a reservation or condition.

Audio reuses the existing Ambio ElevenLabs model/settings with Lucie narration and Loïc as distinct hosts. Episode text and vocabulary were sent to ElevenLabs with explicit user approval. Generated MP3 files and character-aligned word timestamps are bundled locally; credentials are never included in the app. Auth and deployment remain deferred. Older demo library data is retained in storage, while this episode’s vocabulary list is scoped to its own episode ID.
