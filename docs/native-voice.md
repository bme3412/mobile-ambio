# Native French conversation

Ambio now has an iOS/Android WebRTC transport alongside the browser transport. The shared conversation controller handles captions, typed replies, interruption, corrections, mute and saved recaps. Native remote audio plays through WebRTC with InCallManager managing the audio session and speaker/headset routing. Only audio tracks are requested.

## Activation

1. Native authentication and voice proxy are deployed at `https://ambio-daily-preview.vercel.app` as of 25 October 2026, with explicit user authorization. Deployment: `dpl_Ci7DX8vsVX9a4kGLxUKKxSrK4uyA`. Existing `PREVIEW_PASSWORD` and `OPENAI_API_KEY` remain server-only.
2. Install a newly built development client. Expo Go and old development clients do not contain the new native modules.
3. Run `npm run start:dev`, open Talk, and enter the existing private preview password directly in the app. Allow microphone access when starting a voice conversation. “Type instead” receives spoken replies without requesting microphone access. Android 12+ may request Nearby devices permission for Bluetooth audio; declining leaves speaker/wired audio available.

```sh
npm run build:android:dev
npm run build:ios:dev
npm run start:dev
```

EAS project: `bme3412s-team/ambio` (`e17b2dfb-fbac-4866-80bd-33167f3eda6d`). Android package and iOS bundle ID: `com.ambio.daily`. Builds use the existing `development` profile for internal distribution. A production profile is configured for the requested TestFlight distribution; no public store release is authorized.

An Android build was started on 24 October 2026: https://expo.dev/accounts/bme3412/projects/ambio-daily/builds/79088ae6-cdad-4be8-b83a-aae40e20536b . The iOS build could not start because EAS has no credentials suitable for internal distribution. Run the iOS build command interactively to choose the Apple team, distribution certificate and registered devices. Enter Apple credentials and two-factor codes only in EAS's prompts.

The native service defaults to `https://ambio-daily-preview.vercel.app`. `EXPO_PUBLIC_VOICE_URL` can select another deployed HTTPS origin with the same API; it must contain no path, credentials, query or fragment. This variable is a public URL, never a password or API key. The loopback-only local browser server is not a phone backend.

## Authentication and lifecycle

`POST /api/voice/login` exchanges the preview password for a seven-day HMAC-signed bearer token scoped to voice endpoints and the issuing origin. The app keeps only the token in Expo SecureStore with device-only, unlocked accessibility. The password is cleared from the input after successful sign-in. Sign-out deletes the local token; expired/rejected credentials lead back to sign-in. Rotating the server preview password invalidates issued tokens. Login and session throttles are best-effort per function instance, not durable user quotas or a replacement for individual-user authentication.

Bearer authentication applies only to `/api/voice/*`; it cannot unlock private web assets. Browser requests continue using signed cookies and matching Origin checks. Native SDP requests use the same server-owned episode/session configuration and OpenAI proxy; no OpenAI key is shipped in JavaScript or the native app.

Ending, leaving Talk, connection failure, timeout, and native backgrounding close the data channel and peer, stop/release microphone tracks, and stop the call audio session. A microphone granted after cancellation is released immediately. Native backgrounding leaves the transcript in memory for explicit saving on return. Browser background behavior is unchanged. No background native calling service is added.

## Verification

All 52 tests, lint and typecheck pass. Automated checks cover native microphone capture setup, receive-only mode, mute, SDP negotiation, data messages, cancellation during permission prompts, denial, cleanup, background/end-and-save behavior, secure token storage, rejected credentials and native server authentication. iOS, Android and web JavaScript bundles export successfully; config introspection confirms microphone wording, blocked Android camera access, an iOS camera usage declaration required by the linked WebRTC SDK (audio-only capture) and Android Bluetooth permission.

Physical-device acceptance remains required on both platforms: speaker and wired/Bluetooth headset output, actual microphone speech/captions, denial then Settings recovery, typed-only replies, interrupt, mute/unmute, lock/background cleanup, network handoff, and episode playback after ending a call. Unit mocks and JavaScript export cannot verify the native audio devices or signed iOS installation.

References: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [WebRTC config plugin](https://github.com/expo/config-plugins/tree/main/packages/react-native-webrtc), [React Native WebRTC](https://react-native-webrtc.github.io/handbook/guides/basic-usage.html), [OpenAI WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc).

## Hosted activation verification — 25 October 2026

Staged from the current home-refresh deployment, preserving its web assets/audio. Native login, scoped bearer authorization, expiry, password rotation and mocked SDP exchange passed. Lint, typecheck and all 74 tests passed. Live endpoint rejects invalid native credentials and unauthenticated private-page access. Signed-in health returns `{"available":true}`. Successful native sign-in and microphone/speaker exchange still require physical-device acceptance.

## Staging TestFlight build — 28 October 2026

The `staging` EAS build profile extends the store-signed production profile and sets only the public backend URL to `https://ambio-daily-staging.vercel.app`. Build 1.0.0 (13), ID `e97e9601-1752-4486-842e-aef46bab3be3`, was queued with automatic submission to the existing TestFlight app (ASC ID `6826860799`). It includes the downloadable-edition client. After installing, use the existing private preview password in the app to unlock staging access. Native login and the authenticated edition catalog were verified directly before submission. The October 27 revision 9 is available in that catalog.

```sh
npx eas-cli@latest build --platform ios --profile staging --auto-submit-with-profile production
```

`.easignore` excludes `.edition-work/`, Supabase CLI state and Python caches so local production checkpoints and cloud setup credentials are not uploaded with mobile builds. No provider credentials are embedded in the app. This profile uses the existing app identity, so installing it replaces the prior TestFlight build on the device.

Build 12 failed because the upload excluded the shared edition-contract validator under `preview/lib`. The EAS archive now includes that shared library while excluding private deployment state and API entry points. The corrected archive was inspected, and the iOS JavaScript export, lint and typecheck passed before build 13.

Build 13 completed and reached TestFlight, but the supplied iPhone crash report (`AmbioDaily-2026-10-28-093734.ips`) confirms a launch-time DYLD failure before JavaScript starts. Its precompiled `ExpoFileSystem` framework references `ExpoModulesCore.EventEmitter.eventRuntime(forEvent:)`, which the shipped `ExpoModulesCore` does not export.

The fix sets `expo.autolinking.ios.buildFromSource` to `[".*"]` in `package.json`, following [Expo's precompiled-module guidance](https://docs.expo.dev/guides/prebuilt-expo-modules/). This builds the Expo modules together from the installed sources instead of mixing incompatible precompiled frameworks. Local autolinking output and EAS CocoaPods logs confirm the setting is effective. Lint and typecheck pass.

Replacement build 1.0.0 (14), ID `e62825f7-e439-4728-95f0-dc84349c1b0c`, completed successfully with a clean EAS cache. Inspection of the signed IPA confirms the incompatible `ExpoFileSystem` and `ExpoModulesCore` dynamic frameworks are absent; their source-built code is linked into the app. The crash symbol is absent from undefined imports in all six bundled Mach-O binaries. TestFlight submission `0538d5d3-c0cb-4441-9ea0-fa1275de905c` is scheduled; Apple processing and availability are pending. A physical-device launch and the playback/download/Talk acceptance checks remain required after installing build 14.

## Talk audit and weekday starters — 28 October 2026

Build 14's Talk screen rejected new editions because its availability check used only the legacy `episodeIds` list and ignored the backend's `dynamicEditions: true`. Live staging health returned HTTP 200 with `available: true` while the screen displayed an unavailable message.

Talk now opens independently of edition loading and selection. “Just talk” and three weekday buttons each start a session immediately; a typing switch requests spoken replies without microphone capture. Seven sets of everyday prompts use the device's local weekday and refresh on focus/foreground. These are calendar-based topics, not generated current-news claims. The server validates topic IDs and dates, supplies the chosen opening topic, follows the learner's interests beyond the episode, and is instructed not to invent live news. Old episode-based API calls remain supported.

Removed the introductory slogan/card and long startup notice, retained a concise AI-voice label, and moved native sign-out under account options. General conversation recaps store their topic title without an episode reference. Network, authentication, missing service configuration, and outdated-service errors have separate messages.

Validation: lint and typecheck pass; the JavaScript suite plus the corrected focused rerun cover all 145 tests. Native screen tests cover starting a weekday topic with a missing selected edition and background cleanup. The authenticated proxy test verifies that the chosen topic reaches the provider configuration with no episode context. Web and iOS exports pass. Live staging rejects anonymous health requests (401), accepts native login (200), and advertises general conversations. A real browser WebRTC session opened with a French question about “Something that surprised you,” accepted a typed cafe-discovery reply, and returned a relevant French follow-up. The test session was ended. Physical iPhone microphone/speaker verification remains pending.

Staging deployment `dpl_7rZwmdP9SZuPifkrPuZNhr5uZCFY` is READY at https://ambio-daily-staging.vercel.app (preview environment, source commit `8f83ca0`). Native build 1.0.0 (15), `1932320e-2348-4d34-b3d5-7dacf7e5c1a5`, is building with automatic TestFlight submission `fd5e0b94-fc25-4a0e-a4c5-d86106809bc7`. The source-build fix for build 13's native launch failure is retained.

## Native self-interruption mitigation — 28 October 2026

The owner reports TestFlight cuts off replies while they remain quiet; the screenshot shows repeated learner “Bonjour” turns and replaced tutor captions. This is consistent with false VAD/feedback, but the microphone-level cause has not been reproduced on a physical device. Native authenticated Talk calls now use `interrupt_response: false` and near-field input noise reduction, retaining automatic responses to completed learner turns and explicit interruption controls. Speaking over the tutor no longer automatically cancels its reply; use Interrupt tutor to cut in. Browser calls retain their previous automatic interruption behavior.

Client playback state now remains speaking during overlapping input-VAD events, keeping explicit interruption available. Truncation marks the existing tutor caption instead of erasing it with a repeated placeholder. The marker warns that some generated text may not have been spoken. Lint, typecheck, 22 relevant tests, authenticated proxy integration checks, and web/iOS exports pass. The proxy test verifies native configuration and origin/auth behavior; it does not reproduce acoustic feedback.

Backend/client web deployment `dpl_HP5o1Nq8Y2msixzdhkuMq8QHe9W4` is READY, source commit `088c15c`. Native build 16 (`577c84ef-fce6-471d-a113-045d231a555d`) is building with automatic TestFlight submission `1dd8af3e-f8ae-49c4-a569-a3076a555ea3`. The server mitigation applies to new sessions from existing native builds; caption/state changes require build 16. On-device confirmation remains required.
