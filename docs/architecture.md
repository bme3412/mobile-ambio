# Architecture

## Boundaries

- `src/app/`: Expo Router routes. Three tabs (Listen, Saved, Talk), plus player, transcript, and recap stack routes.
- `src/components/`: shared visual primitives, playback controls, word sheet, and root playback lifecycle host.
- `src/domain/`: reusable domain types and pure transcript lookup/follow policy.
- `src/data/episode.ts`: one typed, explicitly fictional French episode with stable IDs, multiple speakers, three stories, translations and monotonically ordered millisecond tokens.
- `src/playback/adapter.ts`: replaceable `PlaybackAdapter` contract and simulated implementation. `player.ts` exposes the single shared player through `useSyncExternalStore`.
- `src/state/library.ts`: versioned Zustand persistence backed by AsyncStorage. Bookmarks, reviews, playback progress and demo sessions survive restarts. Storage failures surface in Saved; in-memory use continues.
- TanStack Query wraps the async local episode read on Home. A real repository can replace that query function later. No pretend remote service is installed.

## Playback and transcript

Only the adapter's position determines the highlighted word. A root host advances the clock from elapsed wall time, not an assumed timer interval, with rate multiplication in the adapter. End-of-episode stops the player; play restarts it. Seek clamps to the duration. Backgrounding pauses the simulation.

Transcript state is separate: selected word, current highlight, native list offset, manual browsing, search, bilingual display. A drag, search, or word selection enters manual browsing. No clock update changes that mode. Back to Live clears search and browsing and requests the current segment. Selection does not seek. Replay explicitly seeks. Half-open timing intervals avoid duplicate highlights at word boundaries.

FlatList virtualizes the transcript. Tracking scrolls only on segment transitions, not every 100 ms tick. Variable-height scroll failures estimate an offset and retry at most three times after layout. Content measurement retries initial tracking. Manual browsing synchronously cancels pending retries, including wheel browsing on web. The eight-turn fixture fits the initial render window; very long real transcripts still require device stress testing.

## Persistence and privacy

AsyncStorage contains only local demo learning data. It is not a secure credential store. Persisted state has a schema version for future migrations. No environment variables or credentials are needed. Later authentication tokens must use appropriate secure storage, while privileged Supabase, AI and email credentials must stay server-side.

## Verification

Tests cover playback boundaries/rate/pause, timing intervals and IDs, follow policy, actual playback buttons, word-sheet save/unsave and storage writes, and transcript selection/return-to-live. TypeScript, ESLint and platform bundling provide additional checks. Native launch, VoiceOver, large text and long transcript stress tests require Xcode/device access.

## API references checked during setup

- [Expo Router installation](https://docs.expo.dev/router/installation/): SDK-compatible native dependencies and `expo-router/entry`.
- [Zustand persistence](https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data): AsyncStorage through `createJSONStorage`, versioning and hydration.
- [TanStack Query installation](https://tanstack.com/query/latest/docs/framework/react/installation): React Native-compatible query provider and hooks.
- Installed React Native Testing Library 14 documentation: async `render` and `fireEvent` APIs.

## Completed local prototype interactions

The adapter supports bounded `replay(startMs, endMs)` and stops at the selected word or passage. Normal play clears the bound. The compact player and full player share the same adapter; the progress track supports touch seeking and accessibility increment/decrement actions.

`src/conversation/demo.ts` supplies a three-turn script. User-typed text is preserved verbatim; responses are explicitly prewritten. Only the relevant sample wording receives its authored correction. No generated feedback is claimed.

`PracticeSheet` keeps the revealed answer and practice position in transient UI state while persisting review results to the library. Saved transcripts persist episode IDs, avoiding duplication of the bundled fixture.
