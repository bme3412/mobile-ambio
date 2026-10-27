# Ambio Daily

An Expo application for listening, reading, and talking in French. Bundled episode audio, synchronized transcripts, vocabulary practice and locally saved recaps work alongside live OpenAI conversation. Native iOS/Android voice requires a new development build and the updated private preview backend. See [native voice setup and verification](docs/native-voice.md).

## Run

Requires Node 22.20+ and npm. Dependencies are locked in `package-lock.json`.

```sh
npm ci
npm start
```

For an iPhone simulator, install full Xcode and an iOS simulator runtime, select Xcode as the active developer directory, then run:

```sh
npm run ios
```

Use a development build for native voice; Expo Go does not contain WebRTC or InCallManager. `npm run web` provides a browser preview. The installed stack is Expo SDK 58, React Native 0.88, React 19.3, Expo Router, Zustand, and TanStack Query.

## Local prototype status

The original [Phase 1 acceptance review](docs/phase-1-review.md) is historical. The current private web preview has real audio and voice. Native voice is implemented; its backend is kept local at the user’s request and iOS signing needs interactive setup. See [current native voice status](docs/native-voice.md).

## iPhone without Xcode

EAS cloud development builds are configured. See [the iPhone setup guide](docs/iphone-development.md) for device registration, cloud signing, installation, and starting Metro.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npx expo export --platform all
```

## Try it

1. Play today's French episode; seek ±15 seconds and change speed.
2. Open the transcript, tap a word, save it, and replay its sentence.
3. Scroll backward while playback continues. Tracking remains suspended until **Back to Live**.
4. Search the transcript or enable English translations.
5. Open Saved, replay a word, mark it reviewed, and restart to check persistence.
6. Practice saved expressions: reveal each meaning, then mark it familiar or revisit it later.
7. Expand and save the episode transcript from the player; find it under Saved.
8. Open Talk, sign in to the private voice service, start voice or typed conversation, toggle captions, ask for help, interrupt the tutor, and save the recap.
9. Save the recap expression to your collection. All transcript references, bookmarks, review status, and recaps persist locally.

Bundled episode audio, artwork and the local library work offline. Live conversation requires the network. Native conversation ends on backgrounding; its transcript remains available to save.

## Scope and limitations

- Only French is included; the language selector explains this limitation.
- Every selectable word in the mock episode has an authored definition. Punctuation is not selectable.
- Email delivery is not implemented. Native voice activation and device testing are tracked in the setup guide.
- Daily remote editions, downloads and the production pipeline are implemented. Cloud credentials, staging review and schedule activation are still required; see [daily edition rollout](docs/daily-editions.md).
- Native Dynamic Type and accessibility labels are enabled. Scroll animation respects Reduce Motion. VoiceOver, largest text sizes, and native gestures still require simulator/device testing.
- On the build machine, Xcode and `simctl` are absent. iOS bundle export is verified; simulator launch cannot be verified here.
- `npm audit` reports five high-severity entries affecting Expo CLI’s transitive node-forge/Zod tooling chain. The proposed automatic resolution downgrades Expo to SDK 44; it was not applied. Recheck upstream patched releases before distribution.

See [architecture](docs/architecture.md) and [remaining integrations](docs/integrations.md).
