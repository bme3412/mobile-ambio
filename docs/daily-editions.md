# Daily editions: implementation and rollout

Ambio now has a scheduled production pipeline and a downloadable edition repository. Daily publication does not rebuild the app. **Staging cloud credentials are configured.** The separate [staging app](https://ambio-daily-staging.vercel.app) uses the existing preview password and Vercel sign-in protection. Physical-device verification and three consecutive reviewed staging productions remain required before production activation. The GitHub schedule is enabled for staging only; today’s new draft was held by the factual checks. See the staging setup record below.

## Architecture

`research → write → validate → speech → mix → validate → upload → publish`

Python runs on GitHub Actions with FFmpeg and Node 22. Research uses Firecrawl search with retrieved page content; writing and independent editorial review use OpenAI Responses. The existing ElevenLabs voices, alignment checks, loudness normalization, and café music are retained. A single repair pass is allowed before editorial rejection. Model review reduces factual risk; it is not a guarantee of factual accuracy, which is why the rollout includes human listening and source review.

Supabase stores immutable revision bundles and audio in the private `editions` bucket, and checkpoints/source evidence/provider results in private `edition-work`. Postgres owns publication visibility, producer leases, stage status, and conservative cost reservations. The app calls the existing authenticated backend, which alone has storage credentials and issues one-hour media URLs. No service-role, generation, or search key belongs in an `EXPO_PUBLIC_*` variable.

The repository refreshes on launch, foregrounding, or pull-to-refresh. Bundled editions remain available offline. Remote metadata is cached in AsyncStorage; explicit audio downloads use Expo FileSystem on iOS/Android and Cache Storage on web. Browser audio caches can be evicted; an offline browser reload also requires the app shell to have loaded (this change does not add a service worker). Missing references never substitute another edition.

### Contract and revision semantics

- `GET /api/editions`: `{schemaVersion: 1, editions: [{id, date, title, revision}], nextCursor}` in newest-first order, 14 editions per page. Pass `?before=YYYY-MM-DD` for older pages; Library provides a Load older editions action. Metadata requests use at most four concurrent downloads.
- `GET /api/editions/:id`: validated `EditionBundle` version 1, including editorial, timing, dictionary, vocabulary, phrases, featured expression, verification time, and audio checksum/size/path.
- `GET /api/editions/:id/media`: `{url, expiresAt, bytes, sha256}`. Resolve again before a new playback session or after an audio failure. Signed URLs are never persisted.
- Web uses the existing signed preview cookie. Native uses the existing SecureStore bearer session. Home and Library provide an unlock form when needed.
- Revision 1 preserves `daily-fr-YYYY-MM-DD` and existing segment/word IDs. Corrections use `daily-fr-YYYY-MM-DD@r2` and revision-specific segment/word/featured-expression IDs. The catalog points to the current revision, while saved references retain the exact revision selected. Superseded published revisions remain readable; explicit withdrawal disables online access but cannot revoke files already downloaded.
- Talk and coaching resolve server-owned published context and reference phrases. The client cannot supply its own coaching reference.

## Configure staging

1. Create separate staging and production Supabase projects. Apply `supabase/migrations/202610270001_daily_editions.sql` to each with the Supabase SQL editor or your migration tool. The migration creates private buckets and tables inaccessible to anon/authenticated roles. The service role is used only by the backend and workflow.
2. Create GitHub environments named `staging` and `production`. Set the following environment secrets:

   | Secret                      | Purpose                                  |
   | --------------------------- | ---------------------------------------- |
   | `SUPABASE_URL`              | This environment's project URL           |
   | `SUPABASE_SERVICE_ROLE_KEY` | Private server access                    |
   | `OPENAI_API_KEY`            | Writing and independent editorial review |
   | `FIRECRAWL_API_KEY`         | Search with retrieved source content     |
   | `ELEVENLABS_API_KEY`        | Speech generation                        |
   | `ELEVENLABS_VOICE_ID`       | Existing Camille voice                   |
   | `ELEVENLABS_MALE_VOICE_ID`  | Existing Louis voice                     |

3. Set environment variables `EDITION_OPENAI_MODEL` to a pinned, account-accessible Responses model supporting JSON output; `OPENAI_INPUT_USD_PER_MILLION`, `OPENAI_OUTPUT_USD_PER_MILLION`, `ELEVENLABS_USD_PER_1000_CHARS`, and `FIRECRAWL_SEARCH_MAX_USD` to conservative upper bounds from the current account pricing. Search's bound must include all eight scraped results. Rates are deliberately required, not guessed. `EDITION_DAILY_BUDGET_USD` defaults to `10`.
4. Configure the staging backend with its Supabase URL/service-role key and its existing preview password and voice keys. Export/package the app as described in `hosted-preview.md`, including the entire updated `preview/lib` and `preview/api`. Keep exports under `preview/private`; do not deploy `dist` publicly. Point a staging native build at that backend using `EXPO_PUBLIC_VOICE_URL`. `expo-file-system` is a new direct dependency; install a current development build before native download testing.
5. With staging environment variables available in the shell, bootstrap the existing content:

   ```sh
   npm run editions:export
   python3 -m scripts.daily.admin import .edition-work/bootstrap
   ```

   This validates all three old bundles, checks audio hashes, uploads immutable assets, and publishes past editions. No original source data is rewritten. The app retains original local audio and IDs.

6. Manually run the `Daily Ambio edition` workflow against `staging`, or run:

   ```sh
   python3 -m scripts.daily.run --date 2026-10-27
   ```

   Substitute the intended date. Runs before 7 AM upload a ready edition; a later run performs publication without regenerating it. Future-dated editions cannot publish early.

## Scheduling, budgets, and recovery

The hourly `:17` trigger starts work at 4:17 AM America/New_York and resumes interrupted work until noon. Additional 11:00 and 12:00 UTC triggers cover 7 AM Eastern in either daylight-saving offset; the server-side time gate prevents early release. GitHub schedules are best effort, so delayed releases remain possible.

Set repository variable `EDITION_SCHEDULE_ENABLED=true` and `EDITION_SCHEDULE_ENVIRONMENT=staging` to start the staging schedule. Until explicitly enabled, only manual runs execute. Automatic requests stop at noon; a manual rerun can recover later.

Each date has a renewable 20-minute database lease; the workflow timeout is 50 minutes. Paid requests renew ownership and reserve their upper-bound cost before each attempt. They permit three transient retries, conservatively reserving cost for every attempt, even if the provider may not bill it. Successful results are content-addressed and persisted before advancing. No budget refund is assumed after an ambiguous network failure. Configure provider-side account limits as an additional billing control; application estimates are only as accurate as the configured rates. Audio/model/research intermediates are private and may be large; periodically remove old `edition-work` prefixes after retaining the evidence you need. Never delete assets referenced by published editions.

Inspect `edition_runs` for stage, status, last error and reserved spend, and `edition_cost_events` for per-request provider, reservation and returned usage. Full provider responses and evidence live in `edition-work`. GitHub exposes failures and the run summary; enable GitHub Actions failure notifications in your account. No emails or chat messages are sent by this implementation.

Operator commands:

```sh
# Resume the same date/revision; cached successful stages avoid regeneration.
python3 -m scripts.daily.run --date 2026-10-27
# Create an immutable correction, leaving existing references intact.
python3 -m scripts.daily.run --date 2026-10-27 --revision 2
python3 -m scripts.daily.admin unpublish daily-fr-2026-10-27@r2
python3 -m scripts.daily.admin rollback daily-fr-2026-10-27
```

Rollback changes the catalog pointer to a verified existing revision. Rejected editorial content remains held; repeated automatic runs reuse the failed checks instead of repeatedly paying for new drafts. To intentionally replace a rejected draft, create a new revision. An unavailable provider never relabels yesterday's edition as today's.

## Production gate and verification

Produce three consecutive dates in staging. For each, compare all stories to sources, listen to the complete audio, check French/English learning material, and test playback/seek/transcript highlighting, offline audio, saved references and Talk/practice. Record the review against the staging project:

```sh
python3 -m scripts.daily.admin review 2026-10-27 --notes 'Sources, translations, complete listening and app checks passed.'
python3 -m scripts.daily.admin check-staging
```

The production GitHub environment also needs `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_SERVICE_ROLE_KEY`, used only to verify three consecutive successful staging reviews. The workflow rejects production runs until that check passes. Then bootstrap the production catalog, deploy the updated authenticated backend/app, and change `EDITION_SCHEDULE_ENVIRONMENT=production`. An existing app installation must receive this client update once; subsequent editions need no app release.

Local verification:

```sh
npm run lint
npm run typecheck
npm test
npm run test:production
npm run editions:export
npx expo export --platform all
```

`tests/edition-publishing.sql` exercises partial-upload rejection, idempotency, leases, budget limits, immutable publication and rollback against a disposable migrated database. `tests/test_daily_editions.py` covers DST, budget enforcement, retries, repair limits and resumed publication. The JavaScript tests cover bundle validation, authentication, revisions, repository refresh, offline downloads and playback races. Exports are not physical-device verification.

References: [Expo SDK 58 FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/), [Expo Audio](https://docs.expo.dev/versions/v58.0.0/sdk/audio/), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Firecrawl search](https://docs.firecrawl.dev/api-reference/endpoint/search), [Supabase private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals), [GitHub scheduling](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Verification recorded during implementation

The three legacy editions exported and validated without ID changes. The SQL migration and transaction tests ran against a temporary local PostgreSQL 15 instance, including a failed partial upload, duplicate publication, competing producers, budget rejection, immutable content and rollback. Browser verification used a local fixture revision: it appeared on Home, downloaded successfully, retained its offline status after reload, and played with an advancing clock. This fixture check exposed and fixed the separate web playback implementation's bundled-source assumption. These were the initial local checks. Subsequent cloud and provider verification is recorded below; physical-device behavior remains unverified.

## Staging setup — 27 October 2026

- Database: existing `ambio-connected-staging` (`glmaxaqxhuxrtypuojse`). The daily-edition migration adds separate tables and private buckets alongside the existing Ambio staging schema. Existing staging tables and the original production database are unchanged.
- Website: separate Vercel project `ambio-daily-staging` (`prj_eOQM30WSV3cTcDrPzRLnpjkwUwT7`), https://ambio-daily-staging.vercel.app. Vercel sign-in and the existing Ambio preview password protect access. The existing daily-preview alias is unchanged.
- GitHub: `staging` environment contains all seven required workflow secrets; Vercel contains only backend credentials, not the Firecrawl/ElevenLabs generation keys. Credentials were read from existing ignored private files and never added to source.
- Writer and reviewer: pinned `gpt-5.4-2026-03-05`, verified available to the account. Configured input/output bounds are $2.50/$15 per million tokens ([model documentation](https://developers.openai.com/api/docs/models/gpt-5.4)).
- Conservative reservations: $0.30 per 1,000 ElevenLabs characters and $0.10 per Firecrawl search including scraped results; total daily limit $10. These exceed the published API base prices checked during setup. Both configured voices are accessible. The restricted ElevenLabs key does not allow subscription inspection.
- All three legacy editions are published in private staging storage. Deployed login, catalog, bundle retrieval, signed audio checksum, and dynamic Talk health were verified.
- Live integration fixes cover Supabase's HTTP 400/NoSuchKey response, stale checkpoint caching, the Responses API input JSON keyword, and malformed draft fields entering the repair pass.
- Scheduler is enabled: `EDITION_SCHEDULE_ENABLED=true`, `EDITION_SCHEDULE_ENVIRONMENT=staging`. Its next eligible start is 4:17 AM Eastern; publication targets 7 AM. Production publishing remains gated by three consecutive staging reviews.
- The [controlled GitHub Actions run](https://github.com/bme3412/mobile-ambio/actions/runs/40587573273) reached source-backed factual review. The repaired October 27 revision 3 was held because it still contained unsupported interpretations and a repeated story without enough novelty. No new audio was generated or published. At that point, the latest available edition remained October 26 with its real date.
- Those initial setup attempts reserved $2.0568865 against the shared $10 cap; this is conservative reservation accounting, not an invoice total. Source retrieval, writing, dictionary generation, expression selection, checkpoint resume and review ran against live providers. At that point, new audio synthesis/mixing/upload still needed a draft that cleared review.
- Structured writing now has an API-enforced schema. A separate dictionary call requires every normalized transcript token. Featured expressions are selected from exact transcript candidates and their offsets are calculated from the text. One editorial rewrite remains the limit; a rejected repaired draft stays held.
- Browser checks passed for sign-in, the hosted catalog, offline download status and playback advancing with synchronized transcript controls. All 142 JavaScript tests and 24 Python tests passed; lint and typecheck passed. Physical iOS/Android checks and three reviewed daily successes remain outstanding.

To inspect or manually resume a staging revision:

```sh
gh run list --repo bme3412/mobile-ambio --workflow daily-edition.yml
gh workflow run daily-edition.yml --repo bme3412/mobile-ambio --ref master \
  -f environment=staging -f date=YYYY-MM-DD -f revision=1
```

A resume uses cached outputs. A held draft does not receive unlimited automatic rewrites. To suspend staging generation, set `EDITION_SCHEDULE_ENABLED=false`; the staged catalog remains readable.

### Editorial pipeline corrections

Source retrieval now searches three topic groups using the French edition date. A structured brief selects exact evidence paragraphs on the server, avoiding invented quotations. The writer uses those supported facts and hypothetical learning examples. Reviews distinguish actual draft claims from unrelated source text, accept clearly attributed secondary reporting and dated cultural listings, and assess normalized glossary keys by meaning. Reviews still block substantive factual and translation errors.

Featured-expression selection now extracts the expression explicitly named by the hosts. Review caches are keyed by both the complete draft/evidence and reviewer instructions, so a changed draft cannot reuse an older approval. The corrected October 27 staging draft also fixes chapter boundaries, two pronunciation entries, the household definition, and the cultural event’s announced timing.

### Staging generation follow-up — 27 October

The next live attempt reached an account-level OpenAI error, `credit_balance_exhausted`, before final review and speech. Revision `daily-fr-2026-10-27@r9` is checkpointed in private storage with corrected editorial, glossary, featured expression and chapter metadata. It is not published. Restore credit on the API project before resuming; do not mark the draft approved to bypass review.

The repair pass now forwards review feedback to the dictionary and featured-expression generators, rather than only to the dialogue writer. Review citations resolve server-side from source paragraph IDs. The provider client records safe error codes, honors rate-limit retry delays, and stops immediately for exhausted account credit.

Migration `202610270002_settle_edition_cost.sql` retains original cost reservations and permits an idempotent settlement of completed, verified calls. `python3 -m scripts.daily.reconcile --date YYYY-MM-DD` previews reconciliation; add `--apply` to release unused reservations. It checks cached response model and token usage, uses conservative undiscounted rates, and never releases uncertain or rejected requests. The October 27 reconciliation released $3.94939750 of unused reservations; its repeat/conflict behavior was verified against staging.

The user authorized up to $15 for October 27 only. A workflow-dispatch `budget` input applies to that invocation; scheduled runs still use the $10 environment default. After restoring API credit, resume the same revision to retain cached work:

```sh
gh workflow run daily-edition.yml --repo bme3412/mobile-ambio --ref master \
  -f environment=staging -f date=2026-10-27 -f revision=9 -f budget=15
```

All 142 JavaScript tests and 32 Python tests pass, alongside lint and typecheck. New-edition audio generation, publication and browser verification remain pending the provider-credit unblock. Production publishing remains gated.
