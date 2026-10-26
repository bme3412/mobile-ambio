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

## Isolated Eleven v4 comparison

`python3 scripts/compare_elevenlabs_v4.py --env-file /path/to/existing/.env.local`
checks access to `eleven_v4`, Lucie and Loïc, then generates the first four
unchanged presenter turns in one French Text to Dialogue request. The 571-character
request and raw response are cached under ignored `.audio-cache/v4-comparison/`.
Use `--cached-only` to validate and reproduce the files without network requests or
additional generation credits. Changing the request creates a new cache key.

The comparison lives in `experiments/eleven-v4/`: `A-current.mp3` is extracted from
the existing episode; `B-eleven-v4.mp3` is the new dialogue. Each has a matching
timing JSON. `comparison.json` records the script, request hash, source cache,
durations, and normalization measurements. No app imports or bundled audio are
changed. Validation rejects missing alignment, script changes, invalid timestamps,
wrong or incomplete speaker mappings, and overlapping turns.

The generated samples contain 98 aligned words across four turns. A is 33.75s;
B is 33.31s. Both underwent two-pass loudness normalization; final measured MP3
loudness is -18.53 LUFS (A) and -18.90 LUFS (B), a 0.37 dB difference. These are
technical checks, not a perceptual quality verdict. Returned text alignment does
not independently prove that the spoken performance contains no omissions or
unwanted sounds. French pronunciation, conversational flow, and voice consistency
still require listening. Keep A in the app until that comparison selects a winner.

Offline validation: `python3 -m unittest discover -s tests -p 'test_v4_comparison.py'`.

## Active full Eleven v4 edition

The user selected sample B. Both native and web players now use
`assets/audio/edition-2026-10-24-v4.mp3` with the regenerated
`src/data/audio-timing.json`: 301.44 seconds (5:01), 41 presenter turns,
914 aligned words. The spoken script, phrase translations, and stable word IDs
are unchanged; scrolling, highlighting, chapter seeking, and phrase replay all
read the new timings. Existing vocabulary clips remain unchanged.

Reproduce with `python3 scripts/build_elevenlabs_v4.py --env-file /path/to/existing/.env.local`;
add `--cached-only` to avoid network calls and generation charges. The approved
opening is reused from cache. Five dialogue batches preserve complete presenter
turns and remain below 2,000 characters. PCM sample counts determine offsets,
with 200ms pauses only between batches. A trailing silence of at most 100ms covers provider end boundaries beyond decoded audio. Normalization changes loudness, not tempo.
All chunks, speaker mappings, script text, and word ranges are validated before
output publication. Raw requests and responses remain in the ignored cache.
The previous MP3 is retained; its timing backup is `.audio-cache/pre-v4-audio-timing.json`.

This updates the local application source and preview. A new TestFlight build
or separately authorized deployment is needed to distribute the updated assets.

## Café production mix

The approved café signature is now applied to the full episode:
`assets/audio/edition-2026-10-24-cafe.mp3`, 311.44 seconds (5:11).
Speech begins after a three-second intro; the approved music bed fades out at
8 seconds. Two 1.5-second stings separate the three stories, and a four-second
outro follows the final spoken turn. The rest of the dialogue remains clean.
No new speech or music generation is needed.

Rebuild offline with `python3 scripts/build_cafe_episode.py`. It uses the
preserved dry v4 MP3 and `experiments/cafe-signature/full-dry-timing.json`, inserts
silence at exact PCM sample boundaries, and mixes the existing cue into those
spaces. Every word/segment shifts by 3000, 4500, or 6000ms according to its
position. Stable IDs and translations are unchanged. `musicOnlyRanges` in the
active timing file lets the reader hold its position and suppress word highlights
during music. Story navigation and phrase replay still start at the spoken text.

Final measurements: -19.15 LUFS, -5.25 dBTP. Mix settings and cue timings are saved
in `experiments/cafe-signature/full-mix-settings.json`. The dry v4 and original
v2 assets remain available. Changes are local; TestFlight is not updated.
