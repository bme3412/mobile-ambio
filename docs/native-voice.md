# Native French conversation

Ambio now has an iOS/Android WebRTC transport alongside the browser transport. The shared conversation controller handles captions, typed replies, interruption, corrections, mute and saved recaps. Native remote audio plays through WebRTC with InCallManager managing the audio session and speaker/headset routing. Only audio tracks are requested.

## Activation

1. Deploy the updated `preview/` backend to the existing Vercel **Preview** environment, then test and assign `ambio-daily-preview.vercel.app` to that deployment. The backend has not been deployed: after automatic approval review rejected the deployment attempt, the user explicitly chose to keep the changes local. Existing `PREVIEW_PASSWORD` and `OPENAI_API_KEY` remain server-only and do not need to be replaced.
2. Install a newly built development client. Expo Go and old development clients do not contain the new native modules.
3. Run `npm run start:dev`, open Talk, and enter the existing private preview password directly in the app. Allow microphone access when starting a voice conversation. “Type instead” receives spoken replies without requesting microphone access. Android 12+ may request Nearby devices permission for Bluetooth audio; declining leaves speaker/wired audio available.

```sh
npm run build:android:dev
npm run build:ios:dev
npm run start:dev
```

EAS project: `bme3412/ambio-daily` (`11832366-6806-432d-82ba-4b74d5676907`). Android package and iOS bundle ID: `com.ambio.daily`. Builds use the existing `development` profile for internal distribution. No App Store/Play Store submission is configured or performed.

An Android build was started on 24 October 2026: https://expo.dev/accounts/bme3412/projects/ambio-daily/builds/79088ae6-cdad-4be8-b83a-aae40e20536b . The iOS build could not start because EAS has no credentials suitable for internal distribution. Run the iOS build command interactively to choose the Apple team, distribution certificate and registered devices. Enter Apple credentials and two-factor codes only in EAS's prompts.

The native service defaults to `https://ambio-daily-preview.vercel.app`. `EXPO_PUBLIC_VOICE_URL` can select another deployed HTTPS origin with the same API; it must contain no path, credentials, query or fragment. This variable is a public URL, never a password or API key. The loopback-only local browser server is not a phone backend.

## Authentication and lifecycle

`POST /api/voice/login` exchanges the preview password for a seven-day HMAC-signed bearer token scoped to voice endpoints and the issuing origin. The app keeps only the token in Expo SecureStore with device-only, unlocked accessibility. The password is cleared from the input after successful sign-in. Sign-out deletes the local token; expired/rejected credentials lead back to sign-in. Rotating the server preview password invalidates issued tokens. Login and session throttles are best-effort per function instance, not durable user quotas or a replacement for individual-user authentication.

Bearer authentication applies only to `/api/voice/*`; it cannot unlock private web assets. Browser requests continue using signed cookies and matching Origin checks. Native SDP requests use the same server-owned episode/session configuration and OpenAI proxy; no OpenAI key is shipped in JavaScript or the native app.

Ending, leaving Talk, connection failure, timeout, and native backgrounding close the data channel and peer, stop/release microphone tracks, and stop the call audio session. A microphone granted after cancellation is released immediately. Native backgrounding leaves the transcript in memory for explicit saving on return. Browser background behavior is unchanged. No background native calling service is added.

## Verification

All 52 tests, lint and typecheck pass. Automated checks cover native microphone capture setup, receive-only mode, mute, SDP negotiation, data messages, cancellation during permission prompts, denial, cleanup, background/end-and-save behavior, secure token storage, rejected credentials and native server authentication. iOS, Android and web JavaScript bundles export successfully; config introspection confirms microphone wording, blocked Android camera access, no iOS camera usage declaration and Android Bluetooth permission.

Physical-device acceptance remains required on both platforms: speaker and wired/Bluetooth headset output, actual microphone speech/captions, denial then Settings recovery, typed-only replies, interrupt, mute/unmute, lock/background cleanup, network handoff, and episode playback after ending a call. Unit mocks and JavaScript export cannot verify the native audio devices or signed iOS installation.

References: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [WebRTC config plugin](https://github.com/expo/config-plugins/tree/main/packages/react-native-webrtc), [React Native WebRTC](https://react-native-webrtc.github.io/handbook/guides/basic-usage.html), [OpenAI WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc).
