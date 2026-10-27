# Activity and Progress

The Progress tab combines new, device-local spoken-practice activity with existing saved words, reviewed items, Talk sessions, and per-edition resume positions. Resume positions are explicitly not listening minutes or completion evidence.

`ambio-activity-v1` is a separate AsyncStorage record. Existing library storage is untouched. A completed coaching response creates one entry with a stable attempt ID, episode/phrase IDs, completion timestamp and local calendar day. It stores no learner audio, transcript, or coach feedback. Failed, locked, timed-out and cancelled attempts do not count. Repeated callbacks are deduplicated by attempt ID.

The daily suggestion is three distinct phrases. Retrying the same phrase increases attempt activity without increasing the distinct-phrase goal. The seven-day view counts coached attempts by the local date recorded at completion; historical dates do not shift when the user travels. Earlier practice was not tracked and is not inferred. Activity does not sync across devices.

Tests cover distinct phrases versus retries, local calendar boundaries, persistence, duplicate callbacks and completion-only tracking. Browser checks cover empty/populated history, 320/390/1024px layouts, Reduce Motion, the practice action, and a live coaching completion followed by reload.
