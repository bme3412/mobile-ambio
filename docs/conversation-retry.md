# Conversation exchange retries

Saved recaps offer Try this again for adjacent, usable tutor/learner turns. The preview retains the original question and answer and optionally reveals a hint from the current validated review for those turns. It works without a review; empty, interrupted, placeholder, oversized, or missing exchanges are excluded. No new analysis is requested for a hint.

Talk receives source IDs via Expo Router and reconstructs the bounded context from the local parent session. The existing authenticated JSON session endpoint accepts retry mode; legacy phrase practice and SDP clients remain supported. The server treats the exchange as untrusted material, asks its question, and continues naturally without grading. Saved children record parentSessionId and retryExchange IDs; the parent remains untouched.

## Verification — October 29, 2026

186 tests across 38 suites passed, including retry selection, validation, hint matching, preview/navigation, native handoff/save, and parent preservation. Typecheck and web/iOS exports passed. Lint has no errors (test-file warnings remain). Staged authentication, private assets, voice proxy, and media checks passed.

Staging deployment: dpl_FkqUmbYrfPe64dDLxe1wcGhWvry5, https://ambio-daily-staging.vercel.app/ . Live typing-mode browser flow verified: conversation → save/review → transcript → retry preview/hint → original question repeated verbatim → new response → natural tutor continuation → separate save → original conversation unchanged. Spoken microphone testing is still pending.

EAS staging iOS build attempt incremented remote build number to 19 and uploaded the source, but Expo rejected build creation because the account's free iOS build quota is exhausted until November 1. No build or TestFlight submission completed; physical-device verification remains pending. Billing was not changed.

## Resumed release — November 2, 2026

Re-ran all 186 tests, lint, and typecheck successfully (existing test-file lint warnings remain). EAS accepted staging iOS build 20 (`0ef293a5-35f4-4365-b6cf-821ed01a9a65`) after the monthly quota reset, with automatic submission `0d3b1a7f-9152-4ea4-b041-68b010ee1c53`. Physical-device acceptance remains pending.

The already-generated November 2 edition, “Parler avec prudence, regarder de près,” was published through GitHub Actions run 41478216623. Verified staging catalog, authenticated bundle and audio checksum (6,263,998 bytes), and advancing web playback (6:31 duration). Daily reserved generation cost: $4.8844925.
