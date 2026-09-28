# Tasks: Week04 AI integracija

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [AI HTTP ugovor](contracts/ai-http.md) i
[quickstart.md](quickstart.md).

**Tests**: TDD je obavezan. Svaki RED mora pasti zbog nedostajućeg ponašanja, ne zbog
nepostojećeg import-a/runner-a; GREEN je najmanja promena, zatim fokusirana i relevantna
Week03 regresija. Stvarne komande, exit code i razlog čuvaju se u navedenom
`docs/evidence/002-Txxx-*.txt`; ništa se ne označava završenim na osnovu ovog plana.

**Ownership**: A vodi backend, botove i provider integraciju; B vodi frontend, UI i
demo; zajedničke ugovore/failure oracle pregledaju oba člana kada se review stvarno
dogodi. Jedan coding agent radi serijski, zato nema `[P]` oznaka. Svaki task navodi
vlasnika, eksplicitne deps, dozvoljene putanje i completion evidence. Promene van tih
putanja zahtevaju handoff i dopunu taska. Nijedan task ne commit-uje tajnu ili traži
ključ kroz Codex chat.

## Format: `[ID] [Story] Description`

- `[US1]` model-driven botovi; `[US2]` analiza; `[US3]` status/recovery; `[US4]` dashboard.
- Setup/foundation/final tasks nemaju story label.
- Putanje su relativne u odnosu na `retro-poker/`.

## Phase 1: Governance i evidence setup

**Purpose**: zatvoriti pre-implementation gate i sačuvati Week04 kontekst pre koda.

- [ ] T001 A — Formalno ponovo pregledati i zatvoriti CHK026 poređenjem `specs/002-week04-ai-integration/checklists/requirements.md`, `docs/GAME_SPEC.md` v1.1 i `.specify/memory/constitution.md` v1.1.0; deps: nema; dozvoljeno: ta tri dokumenta i `docs/evidence/002-T001-governance.txt`; evidence: marker ostaje `[x]`, zbir je 26/26 i zapis navodi konkretne verzije/sekcije, ili se otkrivena greška prijavljuje i svi zavisni taskovi ostaju blokirani (SC-009).
- [ ] T002 A — Sačuvati neprepisujući Week04 početni prompt i stvarno korišćen kontekst u `docs/BUILD_PROMPT_WEEK04_V1.md`, `docs/CONTEXT_MANIFEST.md` i `docs/AI_USAGE_LOG.md`; deps: T001; dozvoljeno: samo navedeni docs fajlovi; evidence: scope, modeli/SDK datum provere, bez tajni, stvarni status „nije pokrenuto” i 10–15/20–30 operativni budžeti bez izmišljenih poziva.

**Checkpoint**: odobreni izvori i početni kontekst su ponovljivo evidentirani; još nema
dependency-ja ili aplikacionog koda.

---

## Phase 2: Foundational — ugovori, provider-neutral tipovi i test harness

**Purpose**: strict javni/interni ugovori i offline harness pre bilo koje priče.

**CRITICAL**: sve user-story faze zavise od ove faze.

- [ ] T003 A — Napisati smislen RED za additive `aiMode` default false, `GameView.ai`, analysis request/result, usage snapshot/reset i nove bezbedne error kodove u `tests/contract/ai-contracts.test.ts`; deps: T002; dozvoljeno: taj test i `docs/evidence/002-T003-red.txt`; evidence: strict unknown-field/type/boundary primeri iz `contracts/ai-http.md` padaju na nedostajućim šemama, a postojeći Week03 contract testovi i dalje prolaze (FR-001, FR-015–FR-023).
- [ ] T004 A — Implementirati GREEN deljene strict Zod ugovore u `shared/contracts.ts`: `aiMode` boolean default false; analysis `summary 1–1200`, `goodDecisions/possibleMistakes 0–6` sa explanation `1–600`, `nextSteps 1–6` po `1–300`; attempt niz najviše 2; svi usage count/sum/max nenegativni safe integer-i; deps: T003; dozvoljeno: `shared/contracts.ts`, test T003 i `docs/evidence/002-T004-green.txt`; evidence: novi i svi postojeći contract testovi prolaze bez implicitne konverzije.
- [ ] T005 A — Napisati RED za `AiRuntimeConfig`, stable-model allowlist, tačno 2 attempts, bot pragove 12.000/5.000/500 ms, analysis 30.000/12.000/1.000 ms, prazno `GEMINI_API_KEY` unavailable i isti/prazan fallback null u `tests/unit/ai-config.test.ts`; deps: T004; dozvoljeno: taj test i `docs/evidence/002-T005-red.txt`; evidence: test ne čita/ispisuje stvarnu environment vrednost i pada samo na nedostajućoj konfiguraciji (FR-002, FR-009, FR-013–FR-014, SC-004–SC-005).
- [ ] T006 A — Implementirati provider-neutral `AiRuntimeConfig`, `AIInteraction`, `AIAttempt`, fingerprint, `ProviderUsage`, `AiProvider` i injected clock/jitter interfejse u `backend/src/ai/config.ts` i `backend/src/ai/types.ts`; deps: T005; dozvoljeno: ta dva izvora, test T005 i `docs/evidence/002-T006-green.txt`; evidence: config testovi prolaze, nema `@google/genai` importa i nijedan tip ne prima `GameState` ili engine mutation callback.
- [ ] T007 A — Napraviti deterministički skriptovani provider, controllable pending promise, fake monotonic clock i jitter u `tests/helpers/fake-ai-provider.ts` i `tests/helpers/fake-clock.ts`; deps: T006; dozvoljeno: samo navedeni helper-i i `docs/evidence/002-T007-harness.txt`; evidence: helper može brojati pozive, hvatati context/model/signal, vratiti success/malformed/429/5xx/timeout/safety/auth i resolve-ovati kasno bez mreže ili ključa (FR-024–FR-025).
- [ ] T008 A — Napisati route-level RED u `tests/contract/ai-routes.test.ts` samo za `POST /api/game` backward-compatible `aiMode` i additive `GameView.ai` kroz postojeće create/get/action/next-hand odgovore, uz `Cache-Control: no-store`; deps: T004, T007; dozvoljeno: taj test i `docs/evidence/002-T008-red.txt`; evidence: US1 endpoint oracle pada na nedostajućim poljima bez live mreže, dok analysis i usage rute ostaju svojim kasnijim RED taskovima i postojeći Week03 ugovor ostaje zelen.

**Checkpoint**: strict ugovori i offline fake postoje; provider SDK još nije dodat.

---

## Phase 3: User Story 1 — Model-driven botovi preko fake providera (Priority: P1) 🎯 MVP backend slice

**Goal**: legalan fake predlog za 1–5 botova prolazi allowlist, schema, semantic i
postojeći engine tačno jednom; AI-off zadržava neizmenjenu lokalnu strategiju.

**Independent Test**: `tests/integration/ai-bots.test.ts` pokriva botCount 1–5 i
upoređuje engine rezultat sa istom standardnom akcijom, bez UI-ja i Gemini SDK-a.

### Tests for User Story 1

- [ ] T009 [US1] A — Napisati RED za `BotDecisionContext` u `tests/unit/ai-context.test.ts`: identity/revision/actor/legalActions, samo actor-ove dve karte, najviše 64 prethodna public event-a i nula opponent/burn/deck/seed/RNG/environment/key/source/raw-log/future polja; deps: T008; dozvoljeno: taj test i `docs/evidence/002-T009-red.txt`; evidence: AIAC02/SC-002 allowlist oracle pada na nedostajućem builder-u.
- [ ] T010 [US1] A — Implementirati allowlist context builder u `backend/src/ai/context.ts` koristeći postojeći `buildBotObservation` samo kao lokalni ulaz, bez spread-a `GameState`; deps: T009; dozvoljeno: taj izvor, test T009 i `docs/evidence/002-T010-green.txt`; evidence: privacy test prolazi za preflop/flop/turn/river i sadržaj ostaje immutable (FR-003–FR-004, FR-022).
- [ ] T011 [US1] A — Napisati RED za strict `BotActionProposal` parse i zasebnu semantičku proveru u `tests/unit/ai-semantic.test.ts`: malformed, unknown field, pogrešan game/hand/version/actor, stale decisionOrdinal, nedozvoljen type i amountTo van aktuelnog min/max; deps: T010; dozvoljeno: taj test i `docs/evidence/002-T011-red.txt`; evidence: svaki rejected predlog ostavlja clone, RNG, version i accepted history bit-identičnim (AIAC03–04, SC-003).
- [ ] T012 [US1] A — Implementirati ručnu provider JSON Schema + strict Zod parse u `backend/src/ai/schemas.ts` i fingerprint/legalActions proveru u `backend/src/ai/semantic.ts`; deps: T011; dozvoljeno: ta dva izvora, test T011 i `docs/evidence/002-T012-green.txt`; evidence: schema i semantic testovi prolaze, a engine ostaje poslednji validator (FR-005–FR-007).
- [ ] T013 [US1] A — Napisati RED integraciju u `tests/integration/ai-bots.test.ts` za AI mode botCount 1–5, legalan fake response, AI mode off, i missing-key put sa tačno nula provider poziva; deps: T012; dozvoljeno: taj test i `docs/evidence/002-T013-red.txt`; evidence: expected action/stack/version/history i provider call count unapred su navedeni (AIAC01, AIAC09, SC-001).

### Implementation for User Story 1

- [ ] T014 [US1] A — Implementirati minimalni fake-first bot coordinator i session rezervaciju/commit u `backend/src/ai/coordinator.ts` i `backend/src/session.ts`, uz neizmenjenu `backend/src/bots/strategy.ts` kao AI-off/missing-key fallback; deps: T013; dozvoljeno: navedena dva izvora, test T013 i `docs/evidence/002-T014-green.txt`; evidence: svih 1–5 konfiguracija imaju jedan legalan engine commit, AI-off Week03 odluke ostaju determinističke, nema provider importa u engine/strategy (FR-001–FR-008, FR-011–FR-014).
- [ ] T015 [US1] A — Projektovati bezbedan javni AI snapshot u `backend/src/view.ts` i povezati additive `aiMode` create input u `backend/src/routes.ts`; deps: T014; dozvoljeno: ta dva izvora, `tests/contract/ai-routes.test.ts` i `docs/evidence/002-T015-routes.txt`; evidence: create/get/action/next-hand schema validira `GameView.ai`, browser nikad ne dobija prompt/proposal/key/raw response, a Week03 route regresija prolazi.

**Checkpoint**: US1 je nezavisno proverljiv kroz API/fake provider; recovery matrica i
korisnički status slede pre bilo kakvog Gemini adaptera.

---

## Phase 4: User Story 3 — Bounded recovery, cancellation i vidljiv status (Priority: P2)

**Goal**: offline matrica završava svaki poziv u okviru pokušaja/deadline-a, sprečava
stale/late/double commit i ostavlja GET dostupan; zatim UI prikazuje stanje.

**Independent Test**: fake provider reprodukuje timeout, 429, 5xx, malformed,
semantic rejection, safety/auth, missing key, reset, late i duplicate callback; svaki
slučaj ima očekivan attempt chain i konačni game state.

### Tests for User Story 3

- [ ] T016 [US3] A — Napisati RED policy matricu u `tests/unit/ai-retry.test.ts`: max 2; 429/408/network/timeout same-model retry sa bot 250+0–100 ms ili analysis 500+0–250 ms backoff-om; 5xx drugi model ili isti bez fallback-a; malformed/schema/semantic jedan corrective retry bez backoff-a; missing-key/400/401/403/config/safety bez retry-ja; deps: T015; dozvoljeno: taj test i `docs/evidence/002-T016-red.txt`; evidence: fake clock dokazuje 12 s/30 s total i rezervu bez wall-clock čekanja (FR-009–FR-010, AIAC03–07).
- [ ] T017 [US3] A — Implementirati policy/deadline/AbortController u `backend/src/ai/retry-policy.ts` i dovršiti attempt chain u `backend/src/ai/coordinator.ts`, uz eksplicitno nula skrivenih SDK retry-ja na provider request-u; deps: T016; dozvoljeno: ta dva izvora, test T016 i `docs/evidence/002-T017-green.txt`; evidence: cela policy matrica prolazi sa tačnim model/relation/outcome/duration vrednostima.
- [ ] T018 [US3] A — Napisati RED failure integraciju u `tests/integration/ai-failures.test.ts` za exhausted bot → postojeći deterministic strategy, vidljiv local fallback, missing key zero-call, i dokaz da rejected proposal pre fallback-a nije promenio state/RNG/history; deps: T017; dozvoljeno: taj test i `docs/evidence/002-T018-red.txt`; evidence: AIAC03–09 imaju odvojene oracle redove i SC-003/004 metrike.
- [ ] T019 [US3] A — Implementirati krajnji lokalni bot fallback i bezbedne terminalne statuse u `backend/src/ai/coordinator.ts`, `backend/src/session.ts` i `backend/src/view.ts`; deps: T018; dozvoljeno: ta tri izvora, test T018 i `docs/evidence/002-T019-green.txt`; evidence: partija nikad ne ostaje na bot actor-u posle total budget-a, lokalni potez prolazi isti engine, model predlog ga ne zaobilazi (FR-012, FR-015).
- [ ] T020 [US3] A — Napisati RED za pending provider, paralelni `GET /api/game`, reset/new game cancellation, changed hand/version/actor, odgovor na deadline granici, late resolve i duplicate callback u `tests/integration/ai-concurrency.test.ts`; deps: T019; dozvoljeno: taj test i `docs/evidence/002-T020-red.txt`; evidence: GET završava pre fake resolve-a, a svaki stale/late/dupli slučaj ima najviše jedan game version increment (AIAC05/14/16, SC-010).
- [ ] T021 [US3] A — Refaktorisati `backend/src/session.ts` i `backend/src/ai/coordinator.ts` na kratku reserve/commit sekciju sa provider await-om van session queue-a i compare-and-set fingerprint-om; deps: T020; dozvoljeno: ta dva izvora, test T020 i `docs/evidence/002-T021-green.txt`; evidence: concurrency suite prolazi, reset abortuje signal, GET/usage GET nisu globalno blokirani i Week03 AC18 ostaje zelen (FR-008, FR-011, FR-019, FR-027).
- [ ] T022 [US3] B — Napisati UI RED u `tests/ui/ai-status.test.tsx` za off/waiting/retrying/model fallback/local fallback/completed/unavailable/failed, disabled human actions i isključivo read-only polling bez ponovljenog mutation POST-a; deps: T021; dozvoljeno: taj test i `docs/evidence/002-T022-red.txt`; evidence: svako stanje ima srpski tekst/aria-live oracle bez raw provider poruke (FR-015).

### Implementation for User Story 3

- [ ] T023 [US3] B — Implementirati `frontend/src/components/AiStatus.tsx` i bounded read-only polling u `frontend/src/api.ts`/`frontend/src/App.tsx`; deps: T022; dozvoljeno: ta tri izvora, test T022 i `docs/evidence/002-T023-green.txt`; evidence: UI testovi prolaze, polling staje na terminal/human state/unmount, nijedan mutation zahtev se automatski ne ponavlja.

**Checkpoint**: sva failure ponašanja rade offline i korisnik ih vidi pre razvoja
analysis/dashboard prikaza i pre Gemini SDK adaptera.

---

## Phase 5: User Story 2 — Analiza završene partije (Priority: P1)

**Goal**: bounded proverene činjenice cele partije daju validiranu read-only analizu;
failure čuva rezultat i ručni retry je nova interakcija.

**Independent Test**: fake analysis success/failure/retry nad terminalnom partijom uz
deep equality `HandResult`, stackova, poker version-a i events pre/posle.

### Tests for User Story 2

- [ ] T024 [US2] A — Napisati RED za `HumanDecisionFact` i `MatchFacts` u `tests/unit/match-facts.test.ts`: pre-action tadašnje znanje, chosen action, odvojen kasniji outcome, max 200 detalja, max 64 public event-a/snapshot, factsRevision i brojčani aggregate za starije; deps: T023; dozvoljeno: taj test i `docs/evidence/002-T024-red.txt`; evidence: fixture dokazuje da kasniji board/outcome nije u pre-action delu i reset/restart briše facts (FR-017, FR-026, SC-006).
- [ ] T025 [US2] A — Implementirati bounded fact capture/settlement u `backend/src/ai/analysis.ts`, uz hook-ove bez promene poker semantike u `backend/src/session.ts` i `backend/src/engine/history.ts`; deps: T024; dozvoljeno: ta tri izvora, test T024 i `docs/evidence/002-T025-green.txt`; evidence: cap/revision/outcome testovi prolaze, Week03 current/previous javna istorija ostaje kompatibilna.
- [ ] T026 [US2] A — Napisati RED u `tests/integration/ai-analysis.test.ts` za terminal-only 202, success strict analysis, decisionRef validaciju, loš ishod koji nije jedini dokaz, timeout/malformed/5xx failure, duplicate request i manual retry kao nov interaction; deps: T025; dozvoljeno: taj test i `docs/evidence/002-T026-red.txt`; evidence: u svakom slučaju poker result/version/stack/events su deep-equal pre/posle (AIAC10–11, SC-005–006).
- [ ] T027 [US2] A — Implementirati analysis schema/semantic tok i route u `backend/src/ai/schemas.ts`, `backend/src/ai/analysis.ts`, `backend/src/ai/coordinator.ts`, `backend/src/routes.ts` i `backend/src/view.ts`; deps: T026; dozvoljeno: navedeni izvori, test T026 i `docs/evidence/002-T027-green.txt`; evidence: success/failure/manual retry prolaze ≤30 s fake budget-a, disclaimer je lokalni konstantan tekst, nema lažne analize (FR-016–FR-019).
- [ ] T028 [US2] B — Napisati UI RED u `tests/ui/analysis.test.tsx` za terminalno dugme, generating/completed/failed/unavailable, četiri strukturisana odeljka, disclaimer i eksplicitan retry bez nestanka `HandResult`; deps: T027; dozvoljeno: taj test i `docs/evidence/002-T028-red.txt`; evidence: UI nikad ne renderuje raw/nevalidan provider sadržaj.

### Implementation for User Story 2

- [ ] T029 [US2] B — Implementirati `frontend/src/components/MatchAnalysis.tsx` i analysis request/poll/retry u `frontend/src/api.ts` i `frontend/src/App.tsx`; deps: T028; dozvoljeno: ta tri izvora, test T028 i `docs/evidence/002-T029-green.txt`; evidence: UI testovi prolaze, retry je samo korisnički POST, završni poker rezultat ostaje prikazan (FR-016–FR-018).

**Checkpoint**: US2 radi potpuno sa fake providerom i bez ključa/mreže.

---

## Phase 6: User Story 4 — Lokalni usage dashboard (Priority: P2)

**Goal**: tačni privacy-safe agregati i nezavisan reset, bez prompta/karata/raw
response-a ili izmišljene cene.

**Independent Test**: skriptovati success, same-model retry, model fallback, local
fallback, error i partial usage; uporediti svaki brojač i oba reset ponašanja.

### Tests for User Story 4

- [x] T030 [US4] A — Napisati RED agregacije u `tests/unit/ai-usage.test.ts` za logical po purpose+initialModel+finalOutcome, attempt po purpose+actualModel+relation+outcome, retry/model/local fallback, latency count/sum/max i svako usage polje sa knownCount/missingCount/sum; deps: T029; dozvoljeno: taj test i `docs/evidence/002-T030-red.txt`; evidence: partial metadata i odsutan cost očekuju „unknown”, bez tokens×price računanja (FR-020, FR-023, SC-007).
- [x] T031 [US4] A — Implementirati procesni in-memory usage store u `backend/src/ai/usage.ts` i povezati safe attempt/terminal događaje iz `backend/src/ai/coordinator.ts`; deps: T030; dozvoljeno: ta dva izvora, test T030 i `docs/evidence/002-T031-green.txt`; evidence: deterministička matrica daje tačne agregate i store ne sadrži prompt, context, karte, key, raw response ili stack trace (FR-020, FR-022).
- [x] T032 [US4] A — Proširiti RED route test u `tests/contract/ai-routes.test.ts` za GET usage i strict expectedRevision reset: game reset čuva metrike, usage reset povećava revision/briše samo metrike, stale dupli reset 409 i game deep-equal; deps: T031; dozvoljeno: taj test i `docs/evidence/002-T032-red.txt`; evidence: AIAC12–13 oracle pada na nedostajućem route ponašanju.
- [x] T033 [US4] A — Implementirati usage GET/reset u `backend/src/routes.ts` i inicijalizaciju store-a u `backend/src/app.ts`; deps: T032; dozvoljeno: ta dva izvora, test T032 i `docs/evidence/002-T033-green.txt`; evidence: route contract prolazi, reset igre/store-a su nezavisni, restart novog app procesa daje prazan store (FR-020–FR-021).
- [x] T034 [US4] B — Napisati UI RED u `tests/ui/dashboard.test.tsx` za sklopivu sekciju, logical/attempt tabele, retry/fallback, count/avg/max latency, known/partial/unknown usage i potvrđen reset bez game mutacije; deps: T033; dozvoljeno: taj test i `docs/evidence/002-T034-red.txt`; evidence: nema prompta/karata/key/raw response/stack trace i cost je „nepoznato” kada nije direktno vraćen.

### Implementation for User Story 4

- [x] T035 [US4] B — Implementirati `frontend/src/components/UsageDashboard.tsx`, usage klijent u `frontend/src/api.ts`, vezu u `frontend/src/App.tsx` i 1280×720 flow stil u `frontend/src/styles.css`; deps: T034; dozvoljeno: ta četiri izvora, test T034 i `docs/evidence/002-T035-green.txt`; evidence: dashboard UI/accessibility test prolazi, reset koristi expectedRevision i ne menja prikaz igre (FR-020–FR-023).
- [ ] T036 [US4] B — Dodati offline browser acceptance proveru u `tests/e2e/ai-offline.spec.ts` za AI toggle, waiting→model/local outcome, analysis success/failure retry, dashboard agregate i oba resetovanja sa fake backend providerom; deps: T035; dozvoljeno: taj E2E test, postojeći `tests/helpers/backend-process.ts` po potrebi i `docs/evidence/002-T036-e2e.txt`; evidence: test ne zahteva internet/ključ, stvarni prvi rezultat je sačuvan, a već prolazan tok beleži se kao istinita regresija umesto fabrikovanog RED-a (AIAC01–AIAC16 representative flow).
- [ ] T037 [US4] B — Ako T036 otkrije stvarno nedostajuće ponašanje, sačuvati fokusirani smislen RED pa dovršiti najmanju fake-path integraciju u `frontend/src/App.tsx`, `frontend/src/styles.css`, `backend/src/app.ts`, `backend/src/routes.ts` ili `tests/helpers/backend-process.ts`; ako je T036 odmah zelen, ne menjati kod i samo pokrenuti regresiju; deps: T036; dozvoljeno: navedene putanje, E2E test i `docs/evidence/002-T037-green-or-regression.txt`; evidence: offline E2E prolazi na 1280×720, Week03 E2E ostaje zelen i nema spoljne mreže.

**Checkpoint**: sve četiri priče i cela failure matrica rade sa fake providerom pre
Gemini SDK integracije.

---

## Phase 7: Gemini adapter — tek posle offline behavior-a

**Purpose**: zamenjivi provider adapter za zvanični SDK bez promene već testirane
orchestration/semantic/engine logike.

- [ ] T038 A — Dodati i tačno zaključati jedinu novu runtime zavisnost `@google/genai` 2.24.0 u `package.json` i `package-lock.json`, bez drugih paketa ili promena skripti; deps: T037; dozvoljeno: samo ta dva manifesta i `docs/evidence/002-T038-sdk-install.txt`; evidence: `npm.cmd install --save-exact @google/genai@2.24.0` stvarno evidentiran, lockfile rezolucija odgovara i baseline `npm.cmd test`/typecheck status je sačuvan, bez live poziva.
- [ ] T039 A — Napisati adapter RED u `tests/integration/gemini-adapter.test.ts` sa mocked SDK transportom za oba purpose-a: structured `application/json` schema, tačan model, AbortSignal/per-attempt timeout, SDK retry=0, usageMetadata normalizacija, malformed/safety/auth/429/5xx klasifikacija i bez raw response persistence; deps: T038; dozvoljeno: taj test i `docs/evidence/002-T039-red.txt`; evidence: test nema DNS/live key i pada na nedostajućem adapteru (FR-002, FR-009–FR-010, FR-022–FR-024).
- [ ] T040 A — Implementirati `backend/src/ai/providers/gemini.ts` sa `@google/genai`, ručnim response schema objektima, server-only key-em, abort/timeout i normalizacijom documented usageMetadata; deps: T039; dozvoljeno: taj izvor, test T039 i `docs/evidence/002-T040-green.txt`; evidence: mocked adapter suite prolazi, nema function calling-a, key/prompt/raw response nisu logovani i adapter ne uvozi session/engine.
- [ ] T041 A — Povezati Gemini adapter samo kroz dependency injection u `backend/src/app.ts` i `backend/src/server.ts`, dok test app podrazumevano zahteva fake/explicit provider i nikad live; deps: T040; dozvoljeno: ta dva izvora, `tests/integration/gemini-adapter.test.ts` i `docs/evidence/002-T041-wiring.txt`; evidence: configured server bira adapter, missing key daje unavailable/zero-call, invalid model config ne ruši lokalnu igru, svi offline testovi ostaju bez mreže.

**Optional manual smoke (nije checkbox ni completion dependency)**: samo ako vlasnik
lokalno postavi ključ, ponovo proveriti zvanične model/capability/quota/billing stranice,
izvršiti najviše jedan bot poziv i jednu analizu po [quickstart-u](quickstart.md), bez
ispisa ključa/prompta/raw response-a. Nedostupnost, quota ili billing failure se beleži
kao runtime ograničenje; ne menja offline acceptance i ne tvrdi besplatnu upotrebu.

---

## Phase 8: Polish, traceability i završna dokumentaciona/automatska provera

- [ ] T042 A — Proširiti `README.md` server-only konfiguracijom (`GEMINI_API_KEY`, dva model env imena bez vrednosti), offline default testovima, timeout/fallback pravilima, dashboard resetom i opcionim live smoke-om; deps: T041; dozvoljeno: `README.md`, `docs/CONTEXT_MANIFEST.md`, `docs/AI_USAGE_LOG.md` i `docs/evidence/002-T042-docs.txt`; evidence: dokument ne obećava dostupnost/free tier/quota/cenu i ne sadrži tajnu.
- [ ] T043 B — Pokrenuti celu offline matricu i postojeću regresiju iz `quickstart.md`: fokusirani AI testovi, `npm.cmd test`, `npm.cmd run test:e2e`, typecheck, lint i build; deps: T042; dozvoljeno: `docs/evidence/002-T043-final.txt`, `docs/EVIDENCE_003.md`, `docs/EVALS.md`, `docs/AI_USAGE_LOG.md`; evidence: stvarne komande/exit statusi i ograničenja, AI testovi bez interneta/ključa, bez tvrdnje o opcionom live smoke-u ako nije izvršen (SC-001–SC-008/010).
- [ ] T044 A — Izvršiti završni Spec Kit consistency pregled spec/plan/tasks/checklist i FR-001–FR-027, AIAC01–AIAC16, SC-001–SC-010 mapu u `specs/002-week04-ai-integration/`; deps: T043; dozvoljeno: feature dokumenti i `docs/evidence/002-T044-traceability.txt`; evidence: 100% obaveznih ID-jeva ima task/test dokaz, dependencies nemaju ciklus, svi checkbox taskovi imaju owner/deps/paths/evidence, nema scope-a za drugi provider/DB/auth/multiplayer/deployment/persistence i nijedna neizvršena provera nije označena PASS.

## Dependencies & Execution Order

```text
T001 governance
  -> T002 evidence setup
  -> T003–T008 contracts/config/fake foundation
  -> T009–T015 US1 fake bot success/privacy/semantic path
  -> T016–T023 US3 complete offline failure matrix + status UI
  -> T024–T029 US2 bounded facts + analysis + UI
  -> T030–T037 US4 usage/dashboard + offline E2E
  -> T038–T041 Gemini SDK adapter/wiring
  -> T042–T044 docs, full offline verification, traceability
```

### User Story Dependencies

- **US1**: posle Foundation; backend slice je samostalno testabilan sa fake providerom.
- **US3**: zavisi od US1 interaction/commit puta i završava failure matrix pre UI/Gemini.
- **US2**: zavisi od zajedničkog coordinator/retry puta iz US3, ali njen read-only
  acceptance je samostalno dokaziv terminalnim fixture-om.
- **US4**: zavisi od emitovanih attempt/terminal događaja US1–US3; reset i prikaz su
  samostalno proverljivi i ne menjaju game.
- **Gemini adapter**: zavisi od svih fake/offline priča; ne sme promeniti njihove ugovore.

### Within Each Behavior Slice

1. unapred određeni oracle i RED test;
2. stvarno pokretanje i smislen pad;
3. najmanji GREEN u dozvoljenim putanjama;
4. fokusirana provera + relevantna Week03 regresija;
5. refactor samo uz ponovljene provere i istinit evidence.

### Parallel Opportunities

Nema `[P]` taskova: projekat izričito koristi jedan coding agent za Core. Ljudski
review može uslediti posle završenog bloka, ali se ne beleži dok stvarno nije izvršen.

## Implementation Strategy

### Prvi proverljiv increment

T001–T015 daju provider-neutral US1 backend slice: AI-off kompatibilnost, privacy-safe
context, schema+semantic+engine validaciju i tačno jedan commit sa fake providerom.
To je prvi tehnički MVP, ne kompletna Week04 isporuka.

### Incremental Delivery

1. Governance + shared contracts/fake harness.
2. US1 success/privacy/semantic path.
3. US3 kompletna failure/cancellation/idempotency matrica i status UI.
4. US2 bounded match analysis i read-only UI.
5. US4 usage store/dashboard/reset i offline E2E.
6. Tek zatim zvanični Gemini adapter.
7. Cela offline regresija, dokumentacija i traceability; live smoke ostaje opcion.

## Requirement Coverage

| Zahtevi | Taskovi |
|---|---|
| FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007; AIAC01, AIAC02, AIAC03, AIAC04; SC-001, SC-002, SC-003 | T003–T004, T009–T015, T018–T019 |
| FR-008, FR-009, FR-010, FR-011, FR-012, FR-019, FR-027; AIAC05, AIAC06, AIAC07, AIAC08, AIAC14, AIAC16; SC-003, SC-004, SC-010 | T016–T023 |
| FR-013, FR-014, FR-015; AIAC09 | T005–T006, T013–T015, T018–T023, T041–T042 |
| FR-016, FR-017, FR-018, FR-026; AIAC10, AIAC11; SC-005, SC-006 | T024–T029 |
| FR-020, FR-021, FR-022, FR-023; AIAC12, AIAC13; SC-007 | T030–T035 |
| FR-024, FR-025; AIAC15; SC-008 | T007–T008, T013, T016–T021, T036–T043 |
| FR-002 provider adapter | T038–T041 |
| SC-009 / CHK026 | T001, T044 |

Ukupno: **44 taska** — setup 2, foundation 6, US1 7, US3 8, US2 6, US4 8,
Gemini adapter 4, završno 3. Story count: US1 7, US2 6, US3 8, US4 8.
Svi taskovi ostaju prazni dok evidence stvarno ne postoji.

## Ograničeni Gemini recovery bugfix — 2026-09-28

Odobreno naknadnim korisničkim zahtevom da Codex preuzme dijagnostiku i popravku.
Dokaz: `docs/evidence/002-gemini-recovery.md`. Prethodni T001–T044 statusi nisu
retroaktivno menjani.

- [x] GR1 — Uporediti direktan HTTP i SDK; zabeležiti dozvoljene statuse i limite poziva.
- [x] GR2 — RED/GREEN za očuvanje bezbednog provider razloga do usage dashboard-a i 404 klasifikaciju.
- [x] GR3 — Dijagnostički CLI vraća nonzero pri grešci/praznom odgovoru; pokriven offline testom.
- [x] GR4 — Fokusirane i pune offline provere, typecheck, lint i build; ažurirana dokumentacija.
- [ ] GR5 — Uspešan stvarni bot engine commit i analiza. Blokirano: live API odgovori 503/UNAVAILABLE i završni timeout; lokalni fallback nije PASS.
