# Test on your iPhone with EAS (no local Xcode)

The project is linked to [@bme3412/ambio-daily](https://expo.dev/accounts/bme3412/projects/ambio-daily). `expo-dev-client` is installed with an SDK-compatible version. The `development` profile in `eas.json` targets physical iOS devices using internal distribution; it is not a simulator build.

## First installation

Requirements: Expo account access, an active Apple Developer Program membership, and your iPhone. Apple authentication and two-factor codes should be entered directly into the EAS CLI prompts, never stored in source or pasted into chat.

From the project folder:

```sh
# Only needed when signed out:
npm run eas:login

# Register this iPhone; choose Website and open its link in iPhone Safari:
npm run device:register

# Compile and sign in Expo's cloud:
npm run build:ios:dev
```

For registration, follow the EAS website instructions on your iPhone to download and install the registration profile. During the build, select your Apple team and ensure this iPhone is selected for the ad hoc provisioning profile. The Apple team must be able to register the app's bundle ID, `com.ambio.daily`. If that identifier belongs to another team, change it to a unique identifier you control before building.

When the build completes, open its EAS install link on the registered iPhone and install Ambio Daily. Enable Settings → Privacy & Security → Developer Mode if requested, then restart and confirm on the iPhone. Newly enrolled/renewed Apple memberships may require Apple to process a device before signing succeeds.

## Start Phase 1

```sh
npm run start:dev
```

Keep the Mac and iPhone on the same Wi-Fi network. Scan the terminal QR code with your iPhone or open the project from the installed Ambio development client. Allow local-network access if iOS asks. Keep Metro running while testing: a development build loads the JavaScript app from this server.

If the network blocks LAN discovery:

```sh
npm run start:dev:tunnel
```

Expo may prompt to install its ngrok tunnel dependency. A tunnel makes the development server reachable through a public temporary URL; use LAN when possible.

JavaScript/UI changes use Fast Refresh. Rebuild after adding native dependencies or changing native app configuration. Registering a new iPhone requires a new build/provisioning profile or `eas build:resign`.

The build is for development testing, not TestFlight or App Store distribution. Native AI voice and microphone capture now require the updated development build and private backend described in [native voice setup](native-voice.md). EAS build availability depends on your Expo plan and quota.

## Verify

Play an episode, select/save a word, manually browse and return to live, restart the app to verify bookmarks, then sign in to Talk, complete a live conversation and open the saved recap. The native voice guide lists device-specific acceptance checks.

References: [Expo physical-device build guide](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/), [SDK 58 development client](https://docs.expo.dev/versions/v58.0.0/sdk/dev-client/), [iOS Developer Mode](https://docs.expo.dev/guides/ios-developer-mode/).
