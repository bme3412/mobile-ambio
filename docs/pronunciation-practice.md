# Phrase-by-phrase spoken coaching

Home, library and transcript actions open `/practice` with explicit catalog IDs. Practice pauses the main player and uses a separate bounded reference player, preserving its edition and saved position.

## Current flow

The React Native screen uses the same native WebRTC audio transport as Talk, with a dedicated single-phrase session. It no longer depends on Azure's DOM/WebView assessment result. This removes the reported “No clear speech was assessed” blocker from the active flow; the underlying Azure/iPhone NoMatch cause was not conclusively reproduced. The old Azure modules and token endpoint remain isolated for compatibility with older TestFlight builds.

1. Hear the original phrase if desired.
2. Tap **Read to my coach**, wait for **Read aloud now**, and read.
3. After 1.4 seconds of silence, the microphone is muted and exactly one response is requested. **I’ve finished reading** can also commit the attempt.
4. Hear one brief English tip and a French demonstration. A clear attempt gets affirmation and a model, not an invented error. Captions supplement the audio; no numerical scores are shown.
5. After output playback ends, the connection and microphone tracks are closed. Retry or advance deliberately.

The coach evaluates audio directly. Auxiliary transcription is optional to view and is not a gate for coaching. This is qualitative AI feedback, not calibrated phoneme assessment. Long hesitations can end a turn; retry if that happens. No local recording or assessment history is persisted.

## Backend and access

`POST /api/voice/practice/session?episodeId=…&phraseId=…` exchanges a WebRTC offer through the existing authenticated backend. `OPENAI_API_KEY` stays server-side. The coach uses the existing `gpt-realtime-2.1`/`marin` configuration. Origin checks, bounded SDP input, authentication and reconnect throttling are shared with Talk. Existing Talk behavior is unchanged.

The reference text is server-owned: `node scripts/build-practice-registry.cjs` builds `preview/lib/practice-phrases.json` from all three editions. Tests check exact catalog coverage. Unknown or cross-edition IDs fail; the endpoint does not accept a client-written coaching prompt.

Practice checks access before requesting the microphone. Expired sessions open the inline password form and preserve the phrase. Unlock shares the secure native session with Talk; it never automatically starts recording. Navigating away, backgrounding, changing phrases, cancellation, connection failure and timeouts close the transport and invalidate late callbacks.

## Local preview

Place `OPENAI_API_KEY` in gitignored `.env.practice.local` and run `npm run practice:local`. The loopback service on 8086 only accepts the Expo preview origins on port 8092. Legacy Azure token testing additionally needs `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`. Never bundle these variables in public Expo configuration.

## Validation

Unit tests cover one response per attempt, VAD/manual-finish races, auth before mic access, cancellation, silence timeout, microphone cleanup, and exact phrase registry coverage. A live browser check sends a known French host recording through WebRTC, verifies the returned audio/transcript and ended microphone tracks, and checks phone/tablet layouts. This synthetic fixture verifies integration, not coaching accuracy for human learners. Physical iPhone acceptance should check microphone pickup, speaker/headphone routing, interruptions, Dynamic Type and the usefulness of spoken corrections.
