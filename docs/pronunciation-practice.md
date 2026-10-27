# Phrase-by-phrase pronunciation practice

Home story actions, library edition/story actions, and transcript passage actions open `/practice` with explicit catalog IDs. Practice uses the catalog’s translated phrases and a separate bounded reference player. Entering pauses the main player; practice never selects a different listening edition or changes its saved position.

The screen uses Expo SDK 58 DOM components to run the Azure JavaScript Speech SDK on web and inside the native app. The SDK is loaded only when an attempt starts. The native bundle export includes the DOM assets; native microphone, audio routing, lock/unlock, and Dynamic Type still need physical iPhone acceptance before release.

## Local preview

Create `.env.practice.local` (gitignored) with `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`, then run:

```sh
npm run practice:local
```

Use the Expo web preview on port 8092. The practice-only server listens on loopback port 8086, checks Host/Origin, and allows only the two loopback 8092 origins. It does not serve the app or expose the resource key.

## Hosted configuration

The existing authenticated voice backend now handles `POST /api/voice/practice/token`. Configure the same two server-only Azure variables in the mobile preview project, then deploy that backend together with this code when release is approved. The reference project’s credentials are not automatically shared with the mobile project. Native requests use a shared secure session for Practice and Talk. Expired sessions open an inline unlock form in Practice without changing the current phrase. Talk refreshes access when focused. Web unlock renews the existing private-preview cookie. The password is cleared after submission or dismissal; it is never persisted by the client. Origin checks and a per-client token throttle apply. Clients receive only an expiring Azure token, never the resource key; responses are private/no-store.

## Feedback semantics

- Live recognition is tentative text, not a pronunciation score.
- Azure finalizes each single-phrase attempt after a pause. Word-granularity French assessment compares it with the exact reference text.
- Missing/invalid/no-match assessments are errors, never positive scores.
- Word matching is conservative and ordered; unmatched contractions remain uncolored. Insertions are listed in assessment details rather than attached to an unrelated reference word.
- Amber marks Azure omissions/mispronunciations or an accuracy score below 60. This threshold chooses a practice target, not a pass/fail grade.
- The first target gets a short cautious explanation and bounded host-audio replay with neighboring words. There is no invented phoneme diagnosis or French prosody score.
- Optional MediaRecorder replay stays in memory for the current phrase. Starting another attempt, changing phrase, or leaving discards it. Raw recordings and assessment results are not persisted by Ambio.
- Attempts stop on cancellation, backgrounding, navigation, or the 30-second limit. Late permission/token/provider callbacks are invalidated.

## Validation

Jest covers catalog boundaries, passage filtering, conservative score mapping, token isolation/throttling, and cancellation/late-callback microphone cleanup. Real Azure checks use a short existing host clip, including a controlled omission. Browser microphone tests use prerecorded synthetic audio, not a learner recording. They establish integration behavior, not teaching quality. Human French recordings and physical iPhone acceptance remain necessary for pronunciation quality and native microphone/audio routing.
