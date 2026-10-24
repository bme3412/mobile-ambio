# Hosted private preview

URL: https://ambio-daily-preview.vercel.app
Vercel team: bme3412
Project: ambio-daily-preview (prj_keLUU1isK4IW2wEptcJyNoomMOS8)
Deployment: dpl_C24fEVerSyvnyukZHLezHgXn2TVL (preview)

The preview runs independently of the development Mac. It serves the exported
Expo web app and audio through one password-checking Node function.
The server-only PREVIEW_PASSWORD environment variable controls access.
The local generated password is in the ignored .preview-password.local file.
Do not commit that file or add the password to EXPO_PUBLIC variables.

Login issues a Secure, HttpOnly, SameSite=Lax cookie lasting 30 days.
Rotating PREVIEW_PASSWORD and redeploying invalidates existing cookies.
All pages, JavaScript, artwork and audio require authentication.
Audio supports byte-range requests for Safari seeking.
This is a private testing gate, not full individual-user authentication.

The initial preview bundles a 96 kbps version of the episode so the complete
audio response stays below the hosting function response-size limit.
Original local audio is unchanged. There is no App Store release.

To update: export with npx expo export --platform web, replace preview/private
with the export, compress the hosted episode to 96 kbps preserving its filename,
run node preview/check.cjs, deploy preview/ with --target preview, and move
the stable alias to the tested deployment. Never deploy the app directory as
a static public export; the private files must remain inside the guarded function.

Normal hosting usage limits apply. No paid password-protection add-on enabled.

When redeploying from the dashboard, select a successful deployment using api/serve.js. The first failed build used the unsupported .cjs function extension; redeploying that snapshot repeats the error. Password changes must target Preview before redeploying.

## Episode update — 24 October 2026

Published the approved “Une heure de plus, un peu plus loin” episode with Lucie and Loïc, 96 English sentence translations, aligned words and 12 vocabulary clips. Hosted audio is 96 kbps, 3,946,310 bytes, approximately 5:28.

Deployment: https://ambio-daily-preview-2hwyt8sq1-bme3412.vercel.app
Stable alias: https://ambio-daily-preview.vercel.app

Export, typecheck, lint and local password-gate/audio-range tests passed. The new hosted player and MP3 both returned 401 without authentication before alias assignment. Preview environment variables and the password handler were not changed. The existing browser session required login; the older locally saved password did not match the configured password, so authenticated hosted playback could not be verified in this session. The owner should sign in with their current preview password. No password reset or App Store release was performed.
