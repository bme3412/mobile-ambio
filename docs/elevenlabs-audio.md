# Local ElevenLabs audio

The mobile prototype reuses the speech settings from the existing Ambio web project: `eleven_multilingual_v2`, stability 0.4, similarity boost 0.75, speed 1.

- Camille: Lucie narration (the existing configured French voice).
- Louis: Loïc – Engaging French Storyteller (standard French, conversational).
- Twelve vocabulary clips: Lucie narration.
- The user approved sending the episode script and vocabulary to ElevenLabs and using the existing account’s credits.
- No production Vercel project changes, new deployment, account system, or client-side credential.

`python3 scripts/build_elevenlabs_audio.py --env-file /path/to/existing/.env.local` generates the episode. `--sample` generates the first two turns only. Requests are cached in ignored `.audio-cache/`, allowing interrupted runs to resume without regenerating completed clips. The script validates original-text character alignment and publishes the bundled audio only after the episode and vocabulary requests all succeed.

The source environment file is read at generation time only. Never copy its values into app code, Expo public environment variables, or documentation. Playback uses bundled MP3s served from the local Mac; it does not call ElevenLabs on the phone.

## Local review edition — 24 October 2026

- Active episode: “Une heure de plus, un peu plus loin” (`daily-fr-2026-10-24`).
- Audio: `assets/audio/edition-2026-10-24.mp3`, 328.83 seconds (5:28).
- 41 presenter turns, 914 whitespace-delimited transcript tokens, 12 new vocabulary clips.
- All French narration matches the approved script in `docs/editorial/episode-2026-10-24-script.txt`.
- Sentence-aligned English translations are in `src/data/sentence-translations.json`; full-turn translations are in `editorial.json`.
- ElevenLabs original-text character timings produce word boundaries. Quarter-second gaps between turns are included in accumulated offsets. FFmpeg loudness normalization changes volume, not playback speed.
- The previous episode’s content is archived in `docs/editorial/archive-shared-world/`; its audio remains in `assets/audio/shared-world-fr.mp3`. The prototype’s single active episode now uses the new edition, with distinct bookmark/progress IDs.
- Local review: `http://localhost:8084/player`; same-Wi-Fi iPhone: `http://10.0.0.67:8084/player`. No production deployment was performed.
