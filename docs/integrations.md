# Integrations remaining after Phase 1

1. **Expo Audio:** implement `PlaybackAdapter` using real audio status as the authoritative clock; convert seconds to milliseconds at the boundary. Add interruption handling, route changes, background playback, lock-screen controls, buffering/error states and bounded word/sentence replay.
2. **Content and alignment:** server-owned news ingestion with licensing/source attribution; TTS generation and forced alignment delivering stable episode/segment/token IDs and millisecond timing. Keep authored demo data separate.
3. **Supabase:** authentication, migrations, row-level security, bookmark/progress/session repositories, offline synchronization and conflict resolution. No infrastructure has been provisioned.
4. **AI conversation:** local browser integration is implemented with OpenAI Realtime WebRTC, episode context, spoken replies, microphone permission, mute/interruption, captions, and locally saved correction notes. Hosted preview authentication and native voice transport are implemented; see [native voice activation status](native-voice.md). Durable per-user quotas remain future work.
5. **Translation/pronunciation:** complete dictionary/translation service and cached audio; distinguish unavailable definitions from successful results.
6. **Email:** explicit opt-in delivery, verified destination and server-side provider secrets. No email is sent in Phase 1.
7. **Release work:** native simulator/device verification, VoiceOver and Dynamic Type QA, long-transcript performance, storage migration tests, error telemetry with consent, custom app icon/splash, licensed bundled editorial imagery and dependency-advisory resolution.

Recommended server contracts should be introduced with their real implementations; Phase 1 deliberately avoids empty AI/TTS/news client abstractions.

## Local voice review (24 October 2026)

Build the browser app with `npx expo export --platform web`, then run `npm run voice:local -- --env-file /path/to/existing/.env.local`. The environment file must contain OPENAI_API_KEY; it stays server-only and is never copied into Expo or Vercel. Open http://localhost:8085/conversation on the Mac. The current session uses the existing Ambio environment file outside this repository.

The server binds only to 127.0.0.1 and validates host, origin, method, content type, SDP size and a connection rate limit. It serves only dist/, proxies the SDP offer to OpenAI’s realtime calls endpoint and returns the answer. Actual audio travels over WebRTC. No recordings or transcripts are written by the local server. OpenAI processes session audio and context; its account data policies still apply.

Model: gpt-realtime-2.1; voice: marin; captions: gpt-4o-mini-transcribe. The live tutor is distinct from the prerecorded ElevenLabs hosts. Session instructions use the dated approved episode and ask for brief French turns, patient listening, one useful correction at a time, and no invented news updates. Only correction notes quoting an actual learner transcript are saved. ASR captions may contain errors.

Start voice conversation requests microphone permission. Type instead creates a receive-only audio connection without capturing a microphone. Interrupt stops buffered audio. Mute disables microphone tracks. End, cancellation, route departure, backgrounding, failure, or the ten-minute limit closes WebRTC and releases tracks. Pending microphone grants are also cleaned up if the user cancels. Recaps persist on this browser only when explicitly saved.

Verification: real API synthetic text test returned spoken French, an accurate si/imperfect correction and an episode-specific follow-up; synthetic audio-input test returned transcription and a contextual spoken response. Browser WebRTC test received a live reply and saved the real correction in the recap. No user microphone was captured during automated checks. Loopback server tests cover rejected origins/invalid SDP, backend-owned context, key isolation and connection rate limiting.

This feature has NOT been deployed. Plain LAN HTTP on an iPhone cannot request a microphone; use the Mac localhost preview for now. A later HTTPS preview needs server authentication and native apps need a separate microphone/WebRTC integration.

References: https://developers.openai.com/api/docs/guides/voice-webrtc and https://developers.openai.com/api/docs/guides/realtime-conversations

### Hosted voice preview — 2026-10-24

The password-protected preview now serves `/api/voice/health` and `/api/voice/session` after the existing signed-cookie authentication. `OPENAI_API_KEY` is a server-only Preview secret; `PREVIEW_PASSWORD` was left unchanged. SDP requests require a matching HTTPS origin, have a 64 KB limit and 30-second upstream timeout. Reconnect throttling is best-effort per warm function instance, not a durable per-user quota. Audio travels directly between the browser and OpenAI over WebRTC. The function only establishes the connection.

Deployment: `dpl_9wyvz4JT7QNZGhDEo7mCjTt2AXoK`, preview target. Stable URL: https://ambio-daily-preview.vercel.app/conversation . No App Store release.

Packaging: copy `server/voice-config.cjs` into `preview/lib/voice-config.cjs`, changing its editorial import to `./editorial.json`, and copy `src/data/editorial.json` alongside it whenever the episode changes. Keep these server files outside `preview/private`. Export the web app into `preview/private`; retain the 96 kbps hosted episode audio to fit function response limits.

Validation: 37 app tests, lint, typecheck, web export, password/private-asset tests, mocked authenticated voice proxy, rejected cross-origin and oversized SDP requests passed. Deployed unauthenticated health endpoint returned 401. Physical iPhone microphone testing remains a user device check.

### Background voice behavior

Removed the visibility-hidden session teardown. The conversation keeps its WebRTC connection and microphone tracks when the page becomes hidden, retries output playback when visible again, and allows 20 seconds for a transient disconnected state to recover. Actual page navigation/unmount still releases tracks. The app’s 10-minute timer was subsequently removed; explicit End and connection failures still close the session. Safari may suspend background capture or playback independently; physical iPhone lock-screen behavior is not verified by desktop tests. The UI now explains background microphone behavior. Lint, typecheck, 37 tests, export and password/voice proxy checks passed.

### No ten-minute app cutoff

Removed the lifetime timer and its completion message from VoiceConversation, including timer cleanup and UI copy. Explicit End, navigation away, or a failed connection still releases the microphone. OpenAI documents a 60-minute maximum per Realtime connection; this change does not implement automatic connection renewal or promise unlimited uninterrupted calls. Existing preview password and OpenAI secret are unchanged. Checks: lint, typecheck, all 37 tests, web export, private assets/authentication and voice proxy checks passed.
